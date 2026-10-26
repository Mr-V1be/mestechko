import '@slotwise/ui/styles.css';
import './site.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './app/app';
import { setUpI18n } from './app/i18n';
import { pageLocaleOf } from './app/page-locale';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element is missing');
}

// The page is in the language of its address; the head's boot script opened the right one.
const i18n = await setUpI18n(pageLocaleOf(window.location.pathname, import.meta.env.BASE_URL));
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
