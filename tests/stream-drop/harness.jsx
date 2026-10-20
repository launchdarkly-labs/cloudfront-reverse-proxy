// Minimal React app for the stream drop test: the LaunchDarkly React SDK with streaming on, pointed at
// the proxy. Configuration comes from window.__STREAM_TEST__, set by stream-drop-test.js.
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { basicLogger, createLDReactProvider, useFlags } from '@launchdarkly/react-sdk';

const { clientSideId, proxyUrl, context } = window.__STREAM_TEST__;

const LDProvider = createLDReactProvider(clientSideId, context, {
  ldOptions: {
    baseUri: proxyUrl,
    streamUri: proxyUrl,
    eventsUri: proxyUrl,
    streaming: true,
    logger: basicLogger({ level: 'info', destination: (line) => console.log(`[LaunchDarkly] ${line}`) }),
  },
});

function FlagWatcher() {
  const flags = useFlags();
  const previous = useRef(null);
  useEffect(() => {
    // The first non-empty set is the initial load, not a change.
    if (previous.current && Object.keys(previous.current).length) {
      const changed = Object.keys(flags).filter((k) => JSON.stringify(flags[k]) !== JSON.stringify(previous.current[k]));
      if (changed.length) window.reportChange(changed.join(', '));
    }
    previous.current = flags;
  }, [flags]);
  return <pre>{Object.keys(flags).length} flags</pre>;
}

createRoot(document.getElementById('root')).render(
  <LDProvider>
    <FlagWatcher />
  </LDProvider>,
);
