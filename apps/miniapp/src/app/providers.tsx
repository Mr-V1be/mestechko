import { isRetryableError } from '@mestechko/contracts/client';
import { ThemeProvider, ToastProvider } from '@mestechko/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { i18n } from 'i18next';
import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ApiProvider } from '../platform/api/api-context';
import { useHost } from '../platform/telegram/host-context';
import { THEME_STORAGE_KEY } from './config';

const RETRY_LIMIT = 2;
const STALE_MS = 30_000;

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

/** Theme and API depend on the host (Telegram, emulator or launcher). */
function HostBound({ children }: { readonly children: ReactNode }) {
  const { status, hostTheme } = useHost();
  const initData = status.status === 'ready' ? status.host.initData : null;
  return (
    <ThemeProvider storageKey={THEME_STORAGE_KEY} host={hostTheme}>
      <ApiProvider initData={initData}>{children}</ApiProvider>
    </ThemeProvider>
  );
}

export function AppProviders({
  i18n,
  children,
}: {
  readonly i18n: i18n;
  readonly children: ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <HostBound>
          <ToastProvider>{children}</ToastProvider>
        </HostBound>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
