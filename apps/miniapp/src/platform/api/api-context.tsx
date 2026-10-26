import { createApiClient, type ApiClient } from '@slotwise/contracts/client';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';

const ApiContext = createContext<ApiClient | null>(null);

const TELEGRAM_AUTH_SCHEME = 'tma';

/**
 * API client that signs every request with the Telegram launch data, when there is one,
 * and asks for the reader's language (the payment page and the demo launch speak it).
 */
export function ApiProvider({
  initData,
  children,
}: {
  readonly initData: string | null;
  readonly children: ReactNode;
}) {
  const { i18n } = useTranslation();
  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: appConfig.apiBaseUrl,
        authorization: () => (initData ? `${TELEGRAM_AUTH_SCHEME} ${initData}` : null),
        language: () => i18n.language,
      }),
    [initData, i18n],
  );
  return <ApiContext value={client}>{children}</ApiContext>;
}

export function useApi(): ApiClient {
  const client = use(ApiContext);
  if (!client) {
    throw new Error('useApi() must be used inside <ApiProvider>');
  }
  return client;
}
