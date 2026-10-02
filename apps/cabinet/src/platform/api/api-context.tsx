import { createApiClient, type ApiClient } from '@mestechko/contracts/client';
import { createContext, use, type ReactNode } from 'react';
import { appConfig } from '../../app/config';

/** Cabinet requests authenticate with the same-origin session cookie. */
const client = createApiClient({ baseUrl: appConfig.apiBaseUrl, credentials: 'same-origin' });

const ApiContext = createContext<ApiClient>(client);

export function ApiProvider({ children }: { readonly children: ReactNode }) {
  return <ApiContext value={client}>{children}</ApiContext>;
}

export function useApi(): ApiClient {
  return use(ApiContext);
}
