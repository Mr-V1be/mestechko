import '@mestechko/ui/styles.css';
import './site.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './app/app';
import { setUpI18n } from './app/i18n';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element is missing');
}

const i18n = await setUpI18n();
const app = (
  <StrictMode>
    <App i18n={i18n} />
  </StrictMode>
);

// The built page arrives rendered; in development it is rendered here.
if (root.firstElementChild) {
  hydrateRoot(root, app);
} else {
  createRoot(root).render(app);
}
