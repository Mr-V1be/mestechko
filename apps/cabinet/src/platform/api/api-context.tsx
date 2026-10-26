import { createApiClient, type ApiClient } from '@slotwise/contracts/client';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';

const ApiContext = createContext<ApiClient | null>(null);

/**
 * Cabinet requests authenticate with the same-origin session cookie and ask for the
 * reader's language, e.g. for the titles of an exported file.
 */
export function ApiProvider({ children }: { readonly children: ReactNode }) {
  const { i18n } = useTranslation();
  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: appConfig.apiBaseUrl,
        credentials: 'same-origin',
        language: () => i18n.language,
      }),
    [i18n],
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
