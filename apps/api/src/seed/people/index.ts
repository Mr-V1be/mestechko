import type { Locale } from '@mestechko/domain';
import { demoPhoneRangeOf } from '@mestechko/contracts';
import type { Random } from '../random.js';
import { englishPopulation } from './en.js';
import type { DemoPopulation } from './population.js';
import { russianPopulation } from './ru.js';

/** Clients of demo businesses by the language of the business. */
export const demoPopulations: Readonly<Record<Locale, DemoPopulation>> = {
  en: englishPopulation,
  ru: russianPopulation,
};

export interface DemoPerson {
  readonly displayName: string;
  readonly phone: string;
}

/**
 * Clients of a demo business: names of its language, phones of its country's demo range
 * (fictional by the numbering plan, see docs/demo-data.md), unique within the business.
 */
export function generatePeople(
  random: Random,
  count: number,
  options: { readonly femaleShare: number; readonly locale: Locale; readonly countryCode: string },
): DemoPerson[] {
  const population = demoPopulations[options.locale];
  const phones = demoPhoneRangeOf(options.countryCode);
  if (!phones) {
    throw new Error(`The demo has no phone range in ${options.countryCode}`);
  }
  if (count > phones.capacity) {
    throw new Error(
      `The demo phone range of ${options.countryCode} holds ${String(phones.capacity)} numbers`,
    );
  }
  const usedNames = new Set<string>();
  const usedPhones = new Set<string>();
  const people: DemoPerson[] = [];
  while (people.length < count) {
    const female = random.chance(options.femaleShare);
    const [masculine, feminine] = random.pick(population.surnames);
    const displayName = `${random.pick(female ? population.femaleNames : population.maleNames)} ${female ? feminine : masculine}`;
    const phone = phones.numberAt(random.int(0, phones.capacity - 1));
    if (usedNames.has(displayName) || usedPhones.has(phone)) {
      continue;
    }
    usedNames.add(displayName);
    usedPhones.add(phone);
    people.push({ displayName, phone });
  }
  return people;
}
