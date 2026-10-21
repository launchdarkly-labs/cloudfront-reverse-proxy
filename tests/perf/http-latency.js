// HTTP latency test for the LaunchDarkly CloudFront reverse proxy.
//
// Sends the same requests the client-side SDK and the observability plugins send, once through the proxy
// and once directly to LaunchDarkly, and compares latency. The request bodies create no data in
// LaunchDarkly: an empty event batch, an empty trace batch, and a GraphQL __typename query.
//
// Usage:
//   PROXY_URL=https://flags.example.com CLIENT_SIDE_ID=<id> npm run http
// Optional:
//   REQUESTS         requests per route per target (default 200)
//   CONCURRENCY      requests in flight at once (default 10)
//   STREAM_REQUESTS  streams opened per target (default 30)
//   MAX_OVERHEAD_MS  fail if the proxy's p50 is more than this many ms slower than direct on any route

const PROXY_URL = (process.env.PROXY_URL || '').replace(/\/+$/, '');
const CLIENT_SIDE_ID = process.env.CLIENT_SIDE_ID || '';
const REQUESTS = Number(process.env.REQUESTS || 200);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const STREAM_REQUESTS = Number(process.env.STREAM_REQUESTS || 30);
const MAX_OVERHEAD_MS = process.env.MAX_OVERHEAD_MS ? Number(process.env.MAX_OVERHEAD_MS) : null;

if (!PROXY_URL || !CLIENT_SIDE_ID) {
  console.error('PROXY_URL and CLIENT_SIDE_ID are required');
  process.exit(2);
}

// The proxy answers CORS for browser origins, so send one like a browser would.
const ORIGIN = 'http://localhost:5199';
const encode = (context) => Buffer.from(JSON.stringify(context)).toString('base64url');
const fixedContext = encode({ kind: 'user', key: 'perf-test' });
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

// Each route: the proxy path and the LaunchDarkly URL the SDK uses without a proxy.
const ROUTES = [
  {
    name: 'flags: poll, same context',
    proxy: () => `${PROXY_URL}/sdk/evalx/${CLIENT_SIDE_ID}/contexts/${fixedContext}`,
    direct: () => `https://clientsdk.launchdarkly.com/sdk/evalx/${CLIENT_SIDE_ID}/contexts/${fixedContext}`,
  },
  {
    // A new context on every request, so CloudFront has nothing cached to revalidate.
    name: 'flags: poll, new context',
    proxy: (i) => `${PROXY_URL}/sdk/evalx/${CLIENT_SIDE_ID}/contexts/${encode({ kind: 'user', key: `perf-${Date.now()}-${i}` })}`,
    direct: (i) => `https://clientsdk.launchdarkly.com/sdk/evalx/${CLIENT_SIDE_ID}/contexts/${encode({ kind: 'user', key: `perf-${Date.now()}-${i}` })}`,
  },
  {
    name: 'events: bulk',
    proxy: () => `${PROXY_URL}/events/bulk/${CLIENT_SIDE_ID}`,
    direct: () => `https://events.launchdarkly.com/events/bulk/${CLIENT_SIDE_ID}`,
    init: json('[]'),
  },
  {
    name: 'observability: OTLP traces',
    proxy: () => `${PROXY_URL}/v1/traces`,
    direct: () => 'https://otel.observability.app.launchdarkly.com/v1/traces',
    init: json('{"resourceSpans":[]}'),
  },
  {
    name: 'observability: sessions (GraphQL)',
    proxy: () => `${PROXY_URL}/observability`,
    direct: () => 'https://pub.observability.app.launchdarkly.com/',
    init: json('{"query":"{ __typename }"}'),
  },
];

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

function summarize(samples) {
  const ok = samples.filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => !s.ok);
  // CloudFront's X-Cache, e.g. "Hit", "RefreshHit" (cached but revalidated with LaunchDarkly) or "Miss".
  const statuses = {};
  for (const s of samples) {
    const status = (s.cache || '').replace(/ from cloudfront$/i, '');
    if (status) statuses[status] = (statuses[status] || 0) + 1;
  }
  return {
    count: samples.length,
    errors: errors.length,
    errorSamples: [...new Set(errors.map((e) => e.error))].slice(0, 3),
    p50: ok.length ? percentile(ok, 50) : null,
    p90: ok.length ? percentile(ok, 90) : null,
    p99: ok.length ? percentile(ok, 99) : null,
    max: ok.length ? ok[ok.length - 1] : null,
    cache: Object.entries(statuses).map(([status, n]) => `${status} ${Math.round((n / samples.length) * 100)}%`).join(', '),
  };
}

// Runs fn(i) for i in [0, total) with at most `concurrency` in flight.
async function pool(total, concurrency, fn) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (next < total) {
      const i = next++;
      results[i] = await fn(i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function timedRequest(url, init = {}) {
  const startedAt = performance.now();
  try {
    const res = await fetch(url, { ...init, headers: { Origin: ORIGIN, ...(init.headers || {}) } });
    await res.arrayBuffer();
    const ms = performance.now() - startedAt;
    const ok = res.status >= 200 && res.status < 300;
    return { ok, ms, cache: res.headers.get('x-cache'), error: ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, ms: performance.now() - startedAt, error: err.cause?.code || err.message };
  }
}

// Time from opening a stream to its first event (the initial put), which is when the SDK has flags.
async function timedStream(url) {
  const abort = new AbortController();
  const startedAt = performance.now();
  try {
    const res = await fetch(url, { signal: abort.signal, headers: { Origin: ORIGIN } });
    if (res.status !== 200) return { ok: false, ms: performance.now() - startedAt, error: `HTTP ${res.status}` };
    for await (const chunk of res.body) {
      if (Buffer.from(chunk).toString().includes('event:')) {
        return { ok: true, ms: performance.now() - startedAt };
      }
    }
    return { ok: false, ms: performance.now() - startedAt, error: 'stream ended before first event' };
  } catch (err) {
    return { ok: false, ms: performance.now() - startedAt, error: err.cause?.code || err.message };
  } finally {
    abort.abort();
  }
}

async function measure(makeUrl, init, total) {
  // Open one connection per concurrent slot first, so TLS setup doesn't count against the first requests.
  await pool(CONCURRENCY * 2, CONCURRENCY, (i) => timedRequest(makeUrl(`warm-${i}`), init));
  return summarize(await pool(total, CONCURRENCY, (i) => timedRequest(makeUrl(i), init)));
}

const fmt = (ms) => (ms === null ? '-' : `${Math.round(ms)}`);
const pad = (s, n) => String(s).padEnd(n);

(async () => {
  console.log(`HTTP latency test: ${PROXY_URL} vs direct to LaunchDarkly`);
  console.log(`${REQUESTS} requests per route per target, ${CONCURRENCY} at a time; ${STREAM_REQUESTS} streams per target.\n`);

  const rows = [];
  for (const route of ROUTES) {
    const proxy = await measure(route.proxy, route.init, REQUESTS);
    const direct = await measure(route.direct, route.init, REQUESTS);
    rows.push({ name: route.name, proxy, direct });
    console.log(`done: ${route.name}`);
  }

  const streamPath = `/eval/${CLIENT_SIDE_ID}/${fixedContext}`;
  rows.push({
    name: 'flags: stream, time to first event',
    proxy: summarize(await pool(STREAM_REQUESTS, CONCURRENCY, () => timedStream(`${PROXY_URL}${streamPath}`))),
    direct: summarize(await pool(STREAM_REQUESTS, CONCURRENCY, () => timedStream(`https://clientstream.launchdarkly.com${streamPath}`))),
  });
  console.log('done: flags: stream\n');

  console.log(`${pad('Route', 38)}${pad('Target', 8)}${pad('p50', 7)}${pad('p90', 7)}${pad('p99', 7)}${pad('max', 7)}${pad('errors', 8)}${pad('p50 overhead', 14)}CloudFront cache`);
  const failures = [];
  for (const { name, proxy, direct } of rows) {
    const overhead = proxy.p50 !== null && direct.p50 !== null ? proxy.p50 - direct.p50 : null;
    for (const [target, s] of [['proxy', proxy], ['direct', direct]]) {
      const extra = target === 'proxy' && overhead !== null ? `${overhead > 0 ? '+' : ''}${Math.round(overhead)}ms` : '';
      console.log(
        `${pad(target === 'proxy' ? name : '', 38)}${pad(target, 8)}${pad(fmt(s.p50), 7)}${pad(fmt(s.p90), 7)}${pad(fmt(s.p99), 7)}${pad(fmt(s.max), 7)}${pad(`${s.errors}/${s.count}`, 8)}${pad(extra, 14)}${target === 'proxy' ? s.cache : ''}`,
      );
    }
    if (proxy.errors) failures.push(`${name}: ${proxy.errors} proxy errors (${proxy.errorSamples.join(', ')})`);
    if (MAX_OVERHEAD_MS !== null && overhead !== null && overhead > MAX_OVERHEAD_MS) {
      failures.push(`${name}: proxy p50 is ${Math.round(overhead)}ms slower than direct (limit ${MAX_OVERHEAD_MS}ms)`);
    }
  }
  console.log('\nTimes in ms. Overhead is proxy p50 minus direct p50; negative means the proxy was faster.');
  if (rows.some((r) => r.direct.errors)) console.log('Note: some direct requests failed, so that comparison is incomplete.');

  console.log(failures.length ? `\nFAIL:\n  ${failures.join('\n  ')}` : '\nPASS: no proxy errors');
  process.exit(failures.length ? 1 : 0);
})();
