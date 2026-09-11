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

const root = document.getElementById('root');
if (!root) throw new Error('AstraStruct: elemento #root não encontrado.');

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
