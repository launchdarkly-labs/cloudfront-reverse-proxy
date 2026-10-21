// SDK startup test for the LaunchDarkly CloudFront reverse proxy.
//
// Loads the LaunchDarkly React SDK (sdk-harness.jsx) in headless Chromium, alternating between the proxy
// and LaunchDarkly's default URLs, and compares how long the page takes to have flags. Each load uses a
// fresh browser context, so it pays for DNS, TLS and the first requests like a new visitor would.
//
// With OBSERVABILITY=1, the observability and session replay plugins are loaded too, and the test also
// times their requests. This creates real sessions in the LaunchDarkly project, named proxy-perf-test.
//
// Usage:
//   PROXY_URL=https://flags.example.com CLIENT_SIDE_ID=<id> npm run sdk
// Optional:
//   RUNS             page loads per target (default 10)
//   OBSERVABILITY    1 to load the observability and session replay plugins
//   HOLD_SECONDS     with OBSERVABILITY=1, how long each page stays open to send data (default 8)

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

const PROXY_URL = (process.env.PROXY_URL || '').replace(/\/+$/, '');
const CLIENT_SIDE_ID = process.env.CLIENT_SIDE_ID || '';
const RUNS = Number(process.env.RUNS || 10);
const OBSERVABILITY = process.env.OBSERVABILITY === '1';
const HOLD_SECONDS = Number(process.env.HOLD_SECONDS || 8);

if (!PROXY_URL || !CLIENT_SIDE_ID) {
  console.error('PROXY_URL and CLIENT_SIDE_ID are required');
  process.exit(2);
}

// A localhost origin: the SDK needs crypto.subtle, which browsers only expose in a secure context.
// Requests to it are answered by page.route, so nothing has to listen on the port.
const PAGE_ORIGIN = 'http://localhost:5199';
const OBSERVABILITY_HOSTS = ['observability.app.launchdarkly.com'];

function bundleHarness() {
  const out = esbuild.buildSync({
    entryPoints: [path.join(__dirname, 'sdk-harness.jsx')],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  return out.outputFiles[0].text;
}

// Which kind of LaunchDarkly traffic a request is, through the proxy or direct.
function classify(url) {
  const u = new URL(url);
  const viaProxy = PROXY_URL && url.startsWith(PROXY_URL);
  if (viaProxy ? u.pathname.startsWith('/v1/') : u.hostname.startsWith('otel.observability')) return 'otlp';
  if (viaProxy ? u.pathname.startsWith('/observability') : u.hostname.startsWith('pub.observability')) return 'sessions';
  if (!viaProxy && !u.hostname.endsWith('launchdarkly.com')) return null;
  if (/\/eval\//.test(u.pathname) && !u.pathname.startsWith('/sdk/')) return 'stream';
  if (u.pathname.startsWith('/sdk/')) return 'poll';
  if (u.pathname.startsWith('/events/')) return 'events';
  return 'other';
}

async function loadOnce(browser, harnessJs, target, run) {
  const proxyUrl = target === 'proxy' ? PROXY_URL : null;
  const context = await browser.newContext();
  const page = await context.newPage();
  const config = JSON.stringify({
    clientSideId: CLIENT_SIDE_ID,
    proxyUrl,
    context: { kind: 'user', key: `perf-sdk-${target}-${run}` },
    observability: OBSERVABILITY,
  });
  await page.route(`${PAGE_ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/harness.js') return route.fulfill({ contentType: 'application/javascript', body: harnessJs });
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><div id="root"></div><script>window.__PERF_TEST__ = ${config};</script><script src="/harness.js"></script>`,
    });
  });

  const started = new Map();
  const requests = [];
  const wrongHost = [];
  page.on('request', (r) => {
    const kind = classify(r.url());
    if (!kind) return;
    started.set(r, performance.now());
    if (proxyUrl && !r.url().startsWith(proxyUrl) && OBSERVABILITY_HOSTS.some((h) => r.url().includes(h))) wrongHost.push(r.url());
  });
  const finish = (r, failure) => {
    if (!started.has(r)) return;
    let operation = null;
    try {
      operation = JSON.parse(r.postData() || '{}').operationName || null;
    } catch {}
    requests.push({ kind: classify(r.url()), ms: performance.now() - started.get(r), failure, operation });
    started.delete(r);
  };
  // Timed to the response headers. The SDK sends events with keepalive fetches, which never fire
  // requestfinished, so that event can't be used.
  page.on('response', (res) => {
    if (classify(res.url()) === 'stream') return started.delete(res.request());
    finish(res.request(), res.status() >= 400 ? `HTTP ${res.status()}` : null);
  });
  page.on('requestfailed', (r) => {
    // Streams still open when the page closes end as aborted; that's not a failure.
    if (r.failure()?.errorText === 'net::ERR_ABORTED') return;
    finish(r, r.failure()?.errorText || 'failed');
  });

  await page.goto(`${PAGE_ORIGIN}/`);
  await page.waitForFunction(() => window.__flagsReadyAt !== undefined, null, { timeout: 30000 });
  const flagsReadyMs = await page.evaluate(() => window.__flagsReadyAt);
  if (OBSERVABILITY) await page.waitForTimeout(HOLD_SECONDS * 1000);
  await context.close();
  return { flagsReadyMs, requests, wrongHost };
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : null;
};
const fmt = (ms) => (ms === null ? '-' : `${Math.round(ms)}`);
const pad = (s, n) => String(s).padEnd(n);

(async () => {
  const version = (pkg) => JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', pkg, 'package.json'), 'utf8')).version;
  const plugins = OBSERVABILITY
    ? ` + @launchdarkly/observability ${version('@launchdarkly/observability')}, @launchdarkly/session-replay ${version('@launchdarkly/session-replay')}`
    : '';
  console.log(`SDK startup test: ${PROXY_URL} vs LaunchDarkly default URLs, ${RUNS} page loads each.`);
  console.log(`@launchdarkly/react-sdk ${version('@launchdarkly/react-sdk')} (js-client-sdk ${version('@launchdarkly/js-client-sdk')})${plugins}\n`);

  const harnessJs = bundleHarness();
  const browser = await chromium.launch();
  const results = { proxy: [], direct: [] };
  for (let run = 0; run < RUNS; run++) {
    // Alternate targets so network conditions drifting during the run affect both equally.
    for (const target of run % 2 ? ['direct', 'proxy'] : ['proxy', 'direct']) {
      const result = await loadOnce(browser, harnessJs, target, run);
      results[target].push(result);
      console.log(`run ${run + 1} ${pad(target, 6)} flags ready in ${fmt(result.flagsReadyMs)}ms`);
    }
  }
  await browser.close();

  const metric = (target, pick) => results[target].flatMap(pick);
  const times = (match) => (t) => metric(t, (r) => r.requests.filter((q) => !q.failure && match(q)).map((q) => q.ms));
  const rows = [
    ['flags ready (page load to flags)', (t) => metric(t, (r) => [r.flagsReadyMs])],
    ['flags: poll', times((q) => q.kind === 'poll')],
    ['events', times((q) => q.kind === 'events')],
  ];
  if (OBSERVABILITY) {
    // Session calls differ a lot in cost, so compare them per GraphQL operation.
    for (const op of ['initializeSession', 'identifySession', 'PushSessionEvents']) {
      rows.push([`sessions: ${op}`, times((q) => q.operation === op)]);
    }
    rows.push(['observability: OTLP', times((q) => q.kind === 'otlp')]);
  }

  console.log(`\n${pad('Measure', 36)}${pad('Target', 8)}${pad('n', 6)}${pad('p50', 7)}${pad('p90', 7)}${pad('max', 7)}p50 overhead`);
  for (const [name, values] of rows) {
    const p50 = { proxy: percentile(values('proxy'), 50), direct: percentile(values('direct'), 50) };
    for (const target of ['proxy', 'direct']) {
      const v = values(target);
      const overhead = target === 'proxy' && p50.proxy !== null && p50.direct !== null ? p50.proxy - p50.direct : null;
      console.log(
        `${pad(target === 'proxy' ? name : '', 36)}${pad(target, 8)}${pad(v.length, 6)}${pad(fmt(percentile(v, 50)), 7)}${pad(fmt(percentile(v, 90)), 7)}${pad(fmt(v.length ? Math.max(...v) : null), 7)}${overhead === null ? '' : `${overhead > 0 ? '+' : ''}${Math.round(overhead)}ms`}`,
      );
    }
  }
  console.log('\nTimes in ms. Overhead is proxy p50 minus direct p50; negative means the proxy was faster.');

  const failures = [];
  const proxyFailures = metric('proxy', (r) => r.requests.filter((q) => q.failure).map((q) => `${q.kind}: ${q.failure}`));
  if (proxyFailures.length) failures.push(`${proxyFailures.length} failed requests through the proxy: ${[...new Set(proxyFailures)].join(', ')}`);
  const bypassed = metric('proxy', (r) => r.wrongHost);
  if (bypassed.length) failures.push(`${bypassed.length} observability requests skipped the proxy, e.g. ${bypassed[0]}`);
  if (OBSERVABILITY && !metric('proxy', (r) => r.requests.filter((q) => q.operation === 'initializeSession' && !q.failure)).length) {
    failures.push('no observability session was started through the proxy');
  }

  console.log(failures.length ? `\nFAIL:\n  ${failures.join('\n  ')}` : '\nPASS: every SDK request through the proxy succeeded');
  process.exit(failures.length ? 1 : 0);
})();
