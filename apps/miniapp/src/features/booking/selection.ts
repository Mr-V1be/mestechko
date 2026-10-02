import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';

/** "Any staff member" in the address of a booking step. */
export const ANY_STAFF = 'any';

export interface BookingSelection {
  readonly slug: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  /** `null` until chosen; `ANY_STAFF` or a staff id afterwards. */
  readonly staff: string | null;
  readonly date: string | null;
  readonly start: string | null;
}

const PARAM = { services: 's', staff: 'm', date: 'd', start: 't' } as const;

/**
 * The booking in progress lives in the address: steps survive reloads, links can be
 * shared and the back button walks through the steps naturally.
 */
export function useBookingSelection() {
  const { slug = '', locationId = '' } = useParams();
  const [params, setParams] = useSearchParams();

  const selection = useMemo<BookingSelection>(
    () => ({
      slug,
      locationId,
      serviceIds: (params.get(PARAM.services) ?? '').split(',').filter(Boolean),
      staff: params.get(PARAM.staff),
      date: params.get(PARAM.date),
      start: params.get(PARAM.start),
    }),
    [slug, locationId, params],
  );

  const pathTo = useCallback(
    (step: 'services' | 'staff' | 'time' | 'confirm', patch: Partial<BookingSelection> = {}) => {
      const next = { ...selection, ...patch };
      const query = new URLSearchParams();
      if (next.serviceIds.length > 0) {
        query.set(PARAM.services, next.serviceIds.join(','));
      }
      if (next.staff) {
        query.set(PARAM.staff, next.staff);
      }
      if (next.date) {
        query.set(PARAM.date, next.date);
      }
      if (next.start) {
        query.set(PARAM.start, next.start);
      }
      const search = query.toString();
      return `/b/${encodeURIComponent(next.slug)}/l/${encodeURIComponent(next.locationId)}/${step}${search ? `?${search}` : ''}`;
    },
    [selection],
  );

  /** Updates the current step's state without adding history entries. */
  const update = useCallback(
    (patch: Partial<Pick<BookingSelection, 'serviceIds' | 'date' | 'start'>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (patch.serviceIds) {
            if (patch.serviceIds.length > 0) {
              next.set(PARAM.services, patch.serviceIds.join(','));
            } else {
              next.delete(PARAM.services);
            }
          }
          for (const key of ['date', 'start'] as const) {
            if (key in patch) {
              const value = patch[key];
              if (value) {
                next.set(PARAM[key], value);
              } else {
                next.delete(PARAM[key]);
              }
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { selection, pathTo, update };
}
