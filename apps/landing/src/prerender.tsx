import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './app/app';
import { setUpI18n } from './app/i18n';

/** The page as HTML for the build: visible before any script runs. */
export async function render(): Promise<string> {
  const i18n = await setUpI18n();
  return renderToString(
    <StrictMode>
      <App i18n={i18n} />
    </StrictMode>,
  );
}
