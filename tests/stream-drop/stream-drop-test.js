// Stream drop test for the LaunchDarkly CloudFront reverse proxy.
//
// Runs the LaunchDarkly React SDK (harness.jsx) in headless Chromium, pointed at the proxy, and fails if
// the streaming connection is closed and reopened. In browser dev tools that failure shows as an
// eventsource request "(failed) net::ERR_HTTP2_PROTOCOL_ERROR" followed by a new stream request, with
// the SDK logging a stream error and reconnecting.
//
// Alongside the browser, a second stream to the same proxy records when each heartbeat arrives, so a
// drop can be matched against the time since the last data (CloudFront's OriginReadTimeout).
//
// Usage:
//   PROXY_URL=https://flags.example.com CLIENT_SIDE_ID=<id> npm test
// Optional:
//   DURATION_SECONDS  how long to hold the stream open (default 600)
//   CONTEXT_KEY       user context key to evaluate as (default stream-drop-test)

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

const PROXY_URL = (process.env.PROXY_URL || '').replace(/\/+$/, '');
const CLIENT_SIDE_ID = process.env.CLIENT_SIDE_ID || '';
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS || 600);
const CONTEXT_KEY = process.env.CONTEXT_KEY || 'stream-drop-test';

if (!PROXY_URL || !CLIENT_SIDE_ID) {
  console.error('PROXY_URL and CLIENT_SIDE_ID are required');
  process.exit(2);
}

// The page needs a real http origin so the proxy's CORS headers are exercised as they are for an app.
// It must be localhost: the SDK uses crypto.subtle, which browsers only expose in a secure context.
// Requests to it are answered by page.route, so nothing has to listen on the port.
const PAGE_ORIGIN = 'http://localhost:5199';
const context = { kind: 'user', key: CONTEXT_KEY };
const isStreamUrl = (url) => url.startsWith(`${PROXY_URL}/eval/`);

const start = Date.now();
const elapsed = () => Math.round((Date.now() - start) / 1000);
const log = (source, msg) => console.log(`+${elapsed()}s [${source}] ${msg}`);

function bundleHarness() {
  const out = esbuild.buildSync({
    entryPoints: [path.join(__dirname, 'harness.jsx')],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  return out.outputFiles[0].text;
}

// Heartbeat monitor: a plain SSE reader on the same proxy stream.
async function monitorHeartbeats(signal) {
  const ctx = Buffer.from(JSON.stringify({ ...context, key: `${CONTEXT_KEY}-monitor` })).toString('base64url');
  const result = { gaps: [], drop: null };
  let last = Date.now();
  try {
    const res = await fetch(`${PROXY_URL}/eval/${CLIENT_SIDE_ID}/${ctx}`, { signal });
    log('monitor', `stream opened: HTTP ${res.status}`);
    const decoder = new TextDecoder();
    let buffered = '';
    for await (const chunk of res.body) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop();
      for (const line of lines) {
        if (!line.startsWith(':') && !line.startsWith('event:')) continue;
        const gap = Math.round((Date.now() - last) / 1000);
        last = Date.now();
        if (line.startsWith(':')) {
          result.gaps.push(gap);
          log('monitor', `heartbeat (gap ${gap}s)`);
        } else {
          log('monitor', `${line} (gap ${gap}s)`);
        }
      }
    }
    result.drop = `stream ended by server ${Math.round((Date.now() - last) / 1000)}s after last data`;
  } catch (err) {
    if (signal.aborted) return result;
    result.drop = `${err.cause?.code || err.message} ${Math.round((Date.now() - last) / 1000)}s after last data`;
  }
  log('monitor', `DROPPED: ${result.drop}`);
  return result;
}

async function runBrowser(harnessJs) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = { streamFailures: [], sdkRetries: [], streamOpens: [], changes: 0 };

  const config = JSON.stringify({ clientSideId: CLIENT_SIDE_ID, proxyUrl: PROXY_URL, context });
  await page.route(`${PAGE_ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/harness.js') {
      return route.fulfill({ contentType: 'application/javascript', body: harnessJs });
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><div id="root"></div><script>window.__STREAM_TEST__ = ${config};</script><script src="/harness.js"></script>`,
    });
  });

  page.on('console', (m) => {
    const text = m.text();
    if (!text.includes('[LaunchDarkly]')) return;
    if (/stream/i.test(text)) log('sdk', text.replace(/https:\/\/\S+/g, '<url>'));
    // A retry means the SDK lost the stream and is reconnecting ("Will retry stream connection" in the
    // 4.x SDK, "Error on stream connection ... will continue retrying" in 3.x). A deliberate close, such as
    // the 4.x SDK restarting its stream right after start-up, logs no retry and is not counted.
    if (/retry/i.test(text) && /stream/i.test(text)) result.sdkRetries.push(`+${elapsed()}s`);
  });
  page.on('pageerror', (err) => log('page', `error: ${err.message}`));
  page.on('request', (r) => {
    if (!isStreamUrl(r.url())) return;
    result.streamOpens.push(`+${elapsed()}s`);
    log('network', `stream request #${result.streamOpens.length} (${r.resourceType()})`);
  });
  page.on('requestfailed', (r) => {
    if (!isStreamUrl(r.url())) return;
    const reason = r.failure()?.errorText || 'unknown';
    // The SDK aborts its own stream when it closes it deliberately (identify, close); that is not a drop.
    if (reason === 'net::ERR_ABORTED') return;
    result.streamFailures.push(`+${elapsed()}s ${reason}`);
    log('network', `stream request FAILED: ${reason}`);
  });
  await page.exposeFunction('reportChange', (keys) => {
    result.changes++;
    log('sdk', `flag change received: ${keys}`);
  });

  await page.goto(`${PAGE_ORIGIN}/`);
  await page.waitForFunction(() => /\d+ flags/.test(document.body.innerText) && !/^0 flags/.test(document.body.innerText), null, { timeout: 30000 });
  log('sdk', `React SDK initialized through proxy: ${await page.locator('pre').innerText()}`);

  await page.waitForTimeout(DURATION_SECONDS * 1000);
  await browser.close();
  return result;
}

(async () => {
  // These packages don't export package.json, so read the version from disk.
  const version = (pkg) => JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', pkg, 'package.json'), 'utf8')).version;
  const sdkVersion = version('@launchdarkly/react-sdk');
  const jsVersion = version('@launchdarkly/js-client-sdk');
  console.log(`Stream drop test: ${PROXY_URL}, ${DURATION_SECONDS}s, @launchdarkly/react-sdk ${sdkVersion} (js-client-sdk ${jsVersion}).`);
  console.log('Flag changes during the run are optional and logged.\n');

  const harnessJs = bundleHarness();
  const abort = new AbortController();
  const monitor = monitorHeartbeats(abort.signal);
  const browserResult = await runBrowser(harnessJs);
  abort.abort();
  const monitorResult = await monitor;

  const maxGap = monitorResult.gaps.length ? Math.max(...monitorResult.gaps) : null;
  const failed =
    browserResult.streamFailures.length > 0 || browserResult.sdkRetries.length > 0 || monitorResult.drop !== null;

  console.log('\n=== Result ===');
  console.log(`stream requests failed (excluding deliberate aborts): ${browserResult.streamFailures.length} ${browserResult.streamFailures.join(', ')}`);
  console.log(`SDK stream retries (closed and reopened): ${browserResult.sdkRetries.length} ${browserResult.sdkRetries.join(' ')}`);
  console.log(`stream requests opened: ${browserResult.streamOpens.length} (at ${browserResult.streamOpens.join(', ')})`);
  console.log(`flag changes received by SDK: ${browserResult.changes}`);
  console.log(`heartbeat gaps (s): ${monitorResult.gaps.join(', ') || 'none seen'}${maxGap !== null ? ` (max ${maxGap}s)` : ''}`);
  console.log(`monitor stream: ${monitorResult.drop ? `DROPPED, ${monitorResult.drop}` : 'held open for the whole run'}`);
  console.log(failed ? '\nFAIL: the stream was closed and reopened' : '\nPASS: the stream stayed open for the whole run');
  process.exit(failed ? 1 : 0);
})();
