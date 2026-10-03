import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { useApi } from './api-context';

export interface ReportInput {
  /** Local dates of the business, both included. */
  readonly from: string;
  readonly to: string;
  readonly locationId: string | null;
  readonly staffId: string | null;
}

export const reportQueryKeys = {
  report: (businessId: string, input: ReportInput | null) =>
    [
      'report',
      businessId,
      input?.from,
      input?.to,
      input?.locationId ?? null,
      input?.staffId ?? null,
    ] as const,
};

/**
 * Figures of a period; `null` waits until the period is known. The previous figures
 * stay on screen while another period loads.
 */
export function useBusinessReport(businessId: string, input: ReportInput | null) {
  const api = useApi();
  return useQuery({
    queryKey: reportQueryKeys.report(businessId, input),
    queryFn: input
      ? ({ signal }) =>
          api.request(
            'getBusinessReport',
            {
              params: { businessId },
              query: {
                from: input.from,
                to: input.to,
                ...(input.locationId ? { locationId: input.locationId } : {}),
                ...(input.staffId ? { staffId: input.staffId } : {}),
              },
            },
            { signal },
          )
      : skipToken,
    placeholderData: keepPreviousData,
  });
}
