import type { Location, PublicBusiness } from '@slotwise/contracts/client';
import { createContext, use } from 'react';

export const CurrentBusinessContext = createContext<PublicBusiness | null>(null);

export function useCurrentBusiness(): PublicBusiness {
  const business = use(CurrentBusinessContext);
  if (!business) {
    throw new Error('useCurrentBusiness() must be used inside a business route');
  }
  return business;
}

export function useLocation(locationId: string | undefined): Location | null {
  const business = useCurrentBusiness();
  return business.locations.find((location) => location.id === locationId) ?? null;
}
