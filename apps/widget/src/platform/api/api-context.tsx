import { createApiClient, type ApiClient } from '@mestechko/contracts/client';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';

const ApiContext = createContext<ApiClient | null>(null);

/**
 * API client of the widget: public catalog and website bookings, no account. It asks
 * for the visitor's language: a prepayment's page speaks it.
 */
export function ApiProvider({ children }: { readonly children: ReactNode }) {
  const { i18n } = useTranslation();
  const client = useMemo(
    () => createApiClient({ baseUrl: appConfig.apiBaseUrl, language: () => i18n.language }),
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
