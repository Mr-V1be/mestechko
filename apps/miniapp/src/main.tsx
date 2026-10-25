import '@mestechko/ui/styles.css';
import { storedLocale } from '@mestechko/booking-ui';
import { resolveLocale } from '@mestechko/domain';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { appConfig } from './app/config';
import { setUpI18n } from './app/i18n';
import { hostLanguages, startHost } from './platform/telegram/telegram-host';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element is missing');
}

const host = startHost(appConfig.demoMode);
// The person's stored choice first, then the language Telegram (or the browser) reports.
const i18n = await setUpI18n(resolveLocale([storedLocale(), ...hostLanguages(host)]));

createRoot(root).render(
  <StrictMode>
    <App i18n={i18n} host={host} />
  </StrictMode>,
);
