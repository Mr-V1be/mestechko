import '@mestechko/ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { appConfig } from './app/config';
import { setUpI18n } from './app/i18n';
import { startHost } from './platform/telegram/telegram-host';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element is missing');
}

const i18n = await setUpI18n();
const host = startHost(appConfig.demoMode);

createRoot(root).render(
  <StrictMode>
    <App i18n={i18n} host={host} />
  </StrictMode>,
);
