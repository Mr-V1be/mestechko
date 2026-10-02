import { Temporal } from '@mestechko/domain';
import { fixtureTimeZone } from './tenant-fixture.js';

/** An instant of a local time `days` from today at the fixture's location, as ISO. */
export function localStart(days: number, time: string): string {
  const date = Temporal.Now.plainDateISO(fixtureTimeZone).add({ days });
  return Temporal.PlainDateTime.from(`${date.toString()}T${time}`)
    .toZonedDateTime(fixtureTimeZone)
    .toInstant()
    .toString();
}
