import { createApiClient, type ApiClient } from '@mestechko/contracts/client';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { appConfig } from '../../app/config';

const ApiContext = createContext<ApiClient | null>(null);

/** API client of the widget: public catalog and website bookings, no account. */
export function ApiProvider({ children }: { readonly children: ReactNode }) {
  const client = useMemo(() => createApiClient({ baseUrl: appConfig.apiBaseUrl }), []);
  return <ApiContext value={client}>{children}</ApiContext>;
}

export function useApi(): ApiClient {
  const client = use(ApiContext);
  if (!client) {
    throw new Error('useApi() must be used inside <ApiProvider>');
  }
  return client;
}
