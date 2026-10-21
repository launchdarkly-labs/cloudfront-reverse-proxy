// Minimal React app for the SDK startup test: the LaunchDarkly React SDK, optionally with the observability
// and session replay plugins. Configuration comes from window.__PERF_TEST__, set by sdk-startup.js.
// With proxyUrl unset, the SDK and plugins use their default LaunchDarkly URLs.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createLDReactProvider, useFlags } from '@launchdarkly/react-sdk';
import Observability from '@launchdarkly/observability';
import SessionReplay from '@launchdarkly/session-replay';

const { clientSideId, proxyUrl, context, observability } = window.__PERF_TEST__;

const ldOptions = { streaming: true };
if (proxyUrl) Object.assign(ldOptions, { baseUri: proxyUrl, streamUri: proxyUrl, eventsUri: proxyUrl });
if (observability) {
  const backendUrl = proxyUrl ? { backendUrl: `${proxyUrl}/observability` } : {};
  ldOptions.plugins = [
    new Observability({ ...backendUrl, serviceName: 'proxy-perf-test', ...(proxyUrl ? { otel: { otlpEndpoint: proxyUrl } } : {}) }),
    new SessionReplay({ ...backendUrl, serviceName: 'proxy-perf-test' }),
  ];
}

const LDProvider = createLDReactProvider(clientSideId, context, { ldOptions });

function FlagsReady() {
  const flags = useFlags();
  const count = Object.keys(flags).length;
  useEffect(() => {
    if (count && window.__flagsReadyAt === undefined) window.__flagsReadyAt = performance.now();
  }, [count]);
  return <pre>{count} flags</pre>;
}

createRoot(document.getElementById('root')).render(
  <LDProvider>
    <FlagsReady />
  </LDProvider>,
);
