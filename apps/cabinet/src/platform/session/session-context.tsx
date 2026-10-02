import type { Me } from '@mestechko/contracts/client';
import { createContext, use } from 'react';

export const SessionContext = createContext<Me | null>(null);

/** The signed-in user; only available under the session gate. */
export function useSession(): Me {
  const me = use(SessionContext);
  if (!me) {
    throw new Error('useSession() must be used under <RequireSession>');
  }
  return me;
}
