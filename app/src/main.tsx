import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './styles.css';
import './panels.css';
import './analysis-v13.css';
import './modeling.css';
import './results.css';
import './buckling.css';
import './modern.css';
import './modern-layout-fix.css';
import './unified-toolbar.css';
import './scientific-export.css';
import './workspaceChrome.css';
import './context-toolbar.css';
import './spatial-inspector.css';
import './modernShell';
import './scientificExportPanel';
import './workspaceChrome';
import './contextToolbar';
import './modelLabBootstrap';
import './dxfPlanBootstrap';
import './levelsBootstrap';
import './shellLabBootstrap';
import './shellMeshBootstrap';

const root = document.getElementById('root');
if (!root) throw new Error('AstraStruct: elemento #root não encontrado.');

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

requestAnimationFrame(()=>{
  document.documentElement.dataset.astraReady='true';
  (window as any).__ASTRA_BOOT_OK__?.();
});
