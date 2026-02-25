import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initIncidentGlobalHandlers } from './services/incidentLogger';
import { initRuntimeDiagnostics, logRuntimeEvent } from './infra/diagnostics/runtimeDiagnostics';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
initRuntimeDiagnostics();
initIncidentGlobalHandlers();
logRuntimeEvent("runtime", "react_root_mount_start");
root.render(
  <App />
);
