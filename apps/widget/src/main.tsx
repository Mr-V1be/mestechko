import '@mestechko/ui/styles.css';
import './embed.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { setUpI18n } from './app/i18n';
import { readEmbedParams } from './embed/embed-params';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element is missing');
}

const i18n = await setUpI18n();

createRoot(root).render(
  <StrictMode>
    <App i18n={i18n} params={readEmbedParams()} />
  </StrictMode>,
);
