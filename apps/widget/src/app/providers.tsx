import { DocumentLocale } from '@slotwise/booking-ui';
import { isRetryableError } from '@slotwise/contracts/client';
import { ThemeProvider, ToastProvider } from '@slotwise/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { i18n } from 'i18next';
import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { EmbedTheme } from '../embed/embed-params';
import { ApiProvider } from '../platform/api/api-context';

const RETRY_LIMIT = 2;
const DOCUMENT_TITLE_KEY = 'loader.title';
const STALE_MS = 30_000;
/** The widget keeps no theme of its own: the embedding page decides, or the system does. */
const THEME_STORAGE_KEY = 'mst-widget-theme';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        retry: (failures, error) => failures < RETRY_LIMIT && isRetryableError(error),
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function AppProviders({
  i18n,
  theme,
  children,
}: {
  readonly i18n: i18n;
  readonly theme: EmbedTheme;
  readonly children: ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);
  const [host] = useState(() => (theme === 'auto' ? null : { theme, palette: {} }));
  return (
    <I18nextProvider i18n={i18n}>
      <DocumentLocale titleKey={DOCUMENT_TITLE_KEY} />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider storageKey={THEME_STORAGE_KEY} host={host}>
          <ApiProvider>
            <ToastProvider>{children}</ToastProvider>
          </ApiProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
