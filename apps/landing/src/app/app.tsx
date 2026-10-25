import { DocumentLocale } from '@mestechko/booking-ui';
import { ThemeProvider } from '@mestechko/ui';
import type { i18n } from 'i18next';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { DemoChoice } from '../sections/chrome/demo-choice';
import { SiteFooter } from '../sections/chrome/site-footer';
import { SiteHeader } from '../sections/chrome/site-header';
import { Hero } from '../sections/hero/hero';
import { Journey } from '../sections/journey/journey';
import { Closing } from '../sections/pricing/closing';
import { Pricing } from '../sections/pricing/pricing';
import { Surfaces } from '../sections/surfaces/surfaces';
import { Verticals } from '../sections/verticals/verticals';
import { THEME_STORAGE_KEY } from './config';

function Page() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => {
    setDemoOpen(true);
  };
  return (
    <>
      <SiteHeader onDemo={openDemo} />
      <main>
        <Hero onDemo={openDemo} />
        <Journey />
        <Surfaces />
        <Verticals />
        <Pricing onDemo={openDemo} />
        <Closing onDemo={openDemo} />
      </main>
      <SiteFooter />
      <DemoChoice open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
}

/** The product site: one page, rendered ahead of time and brought to life in the browser. */
export function App({ i18n }: { readonly i18n: i18n }) {
  return (
    <I18nextProvider i18n={i18n}>
      <DocumentLocale titleKey="meta.title" />
      <ThemeProvider storageKey={THEME_STORAGE_KEY}>
        <Page />
      </ThemeProvider>
    </I18nextProvider>
  );
}
