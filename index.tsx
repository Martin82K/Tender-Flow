import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initIncidentGlobalHandlers } from './services/incidentLogger';
import { initRuntimeDiagnostics, logRuntimeEvent } from './infra/diagnostics/runtimeDiagnostics';
import { installVitePreloadRecovery } from './app/runtime/vitePreloadRecovery';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
installVitePreloadRecovery();
initRuntimeDiagnostics();
initIncidentGlobalHandlers();
logRuntimeEvent("runtime", "react_root_mount_start");
root.render(
  <App />
);
