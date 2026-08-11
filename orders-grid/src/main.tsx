import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import config from 'devextreme/core/config';
import 'devextreme/dist/css/dx.fluent.blue.light.css';
import './index.css';
import { licenseKey } from './devextreme-license';
import { App } from './App';

if (licenseKey !== '') {
  config({ licenseKey });
}

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
