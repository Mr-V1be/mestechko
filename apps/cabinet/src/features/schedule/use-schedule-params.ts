import { scheduleAxes, type ScheduleAxis } from '@slotwise/contracts/client';
import { useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { todayIn } from './timeline-model';

export const scheduleViews = ['day', 'week'] as const;
export type ScheduleView = (typeof scheduleViews)[number];
export const DEFAULT_VIEW: ScheduleView = 'day';
export const DEFAULT_AXIS: ScheduleAxis = 'staff';

export type ScheduleParamsPatch = Readonly<Record<string, string | null>>;

/**
 * Schedule view state lives in the URL so a link reproduces the screen. react-router
 * hands updaters the params of the last render, so quick consecutive changes (axis,
 * then view) build on the latest written params instead.
 */
export function useScheduleParams(defaultLocation: string, timeZone: string) {
  const [params, setParams] = useSearchParams();
  const latest = useRef(params);
  useLayoutEffect(() => {
    latest.current = params;
  }, [params]);
  const view: ScheduleView =
    scheduleViews.find((candidate) => candidate === params.get('view')) ?? DEFAULT_VIEW;
  const axis: ScheduleAxis =
    scheduleAxes.find((candidate) => candidate === params.get('axis')) ?? DEFAULT_AXIS;
  const date = params.get('date') ?? todayIn(timeZone);
  const locationId = params.get('location') ?? defaultLocation;
  const column = params.get('column');
  const set = (patch: ScheduleParamsPatch) => {
    const next = new URLSearchParams(latest.current);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    latest.current = next;
    setParams(next, { replace: true });
  };
  return { view, axis, date, locationId, column, set };
}
