
// MUST be first import: patches window.fetch / XHR / EventSource / WebSocket
// so that file:// rendered pages can reach the local server at 127.0.0.1:5174.
import './electron-bridge';

// MUST happen before any <Editor /> renders: tell @monaco-editor/react to use
// the locally bundled monaco-editor (otherwise it tries to load from jsdelivr
// and shows "Loading..." forever when offline / network slow).
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
loader.config({ monaco });

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// URL 分流：?window=agents → 走 Agents Window 根组件（独立第二窗口用）
const isAgentsWindow =
  new URLSearchParams(window.location.search).get('window') === 'agents';

const AgentsApp = React.lazy(() =>
  import('./agents-window/AgentsApp').then((m) => ({ default: m.AgentsApp })),
);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    {isAgentsWindow ? (
      <React.Suspense fallback={<div className="agents-loading">Loading…</div>}>
        <AgentsApp />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);