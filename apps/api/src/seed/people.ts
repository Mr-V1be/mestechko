import type { Random } from './random.js';

const femaleNames = [
  'Алина',
  'Анастасия',
  'Валерия',
  'Вера',
  'Виктория',
  'Дарья',
  'Евгения',
  'Елизавета',
  'Ирина',
  'Карина',
  'Ксения',
  'Людмила',
  'Мария',
  'Милана',
  'Наталья',
  'Оксана',
  'Полина',
  'София',
  'Татьяна',
  'Юлия',
];
const maleNames = [
  'Александр',
  'Алексей',
  'Андрей',
  'Артём',
  'Борис',
  'Вадим',
  'Глеб',
  'Дмитрий',
  'Егор',
  'Иван',
  'Илья',
  'Кирилл',
  'Максим',
  'Михаил',
  'Никита',
  'Олег',
  'Павел',
  'Роман',
  'Степан',
  'Фёдор',
];
/** Surnames as [masculine, feminine]. */
const surnames: readonly (readonly [string, string])[] = [
  ['Иванов', 'Иванова'],
  ['Смирнов', 'Смирнова'],
  ['Кузнецов', 'Кузнецова'],
  ['Попов', 'Попова'],
  ['Васильев', 'Васильева'],
  ['Петров', 'Петрова'],
  ['Соколов', 'Соколова'],
  ['Михайлов', 'Михайлова'],
  ['Новиков', 'Новикова'],
  ['Морозов', 'Морозова'],
  ['Волков', 'Волкова'],
  ['Алексеев', 'Алексеева'],
  ['Лебедев', 'Лебедева'],
  ['Семёнов', 'Семёнова'],
  ['Егоров', 'Егорова'],
  ['Павлов', 'Павлова'],
  ['Козлов', 'Козлова'],
  ['Степанов', 'Степанова'],
  ['Николаев', 'Николаева'],
  ['Орлов', 'Орлова'],
  ['Андреев', 'Андреева'],
  ['Макаров', 'Макарова'],
  ['Никитин', 'Никитина'],
  ['Захаров', 'Захарова'],
];
/**
 * Ofcom reserves +44 7700 900000–900999 for fiction and demonstrations: these numbers
 * are never assigned to subscribers, so the public demo cannot show a real person's
 * phone. See docs/demo-data.md.
 */
const FICTIONAL_PHONE_PREFIX = '+447700900';
const FICTIONAL_PHONE_COUNT = 1000;

/** Occasional notes clients leave when booking. */
export const clientComments = [
  'Буду с ребёнком, можно стульчик?',
  'Пожалуйста, перезвоните накануне',
  'Могу задержаться на 5–10 минут',
  'Хочу обсудить новый образ',
  'Аллергия на некоторые красители',
  'Первый визит',
];

export interface DemoPerson {
  readonly displayName: string;
  readonly phone: string;
}

export function generatePeople(random: Random, count: number, femaleShare: number): DemoPerson[] {
  if (count > FICTIONAL_PHONE_COUNT) {
    throw new Error('Not enough fictional phone numbers for this many demo people');
  }
  const used = new Set<string>();
  const phones = random.shuffle(Array.from({ length: FICTIONAL_PHONE_COUNT }, (_, index) => index));
  const people: DemoPerson[] = [];
  while (people.length < count) {
    const female = random.chance(femaleShare);
    const [masculine, feminine] = random.pick(surnames);
    const displayName = `${random.pick(female ? femaleNames : maleNames)} ${female ? feminine : masculine}`;
    if (used.has(displayName)) {
      continue;
    }
    used.add(displayName);
    const suffix = phones[people.length];
    if (suffix === undefined) {
      throw new Error('Fictional phone numbers ran out');
    }
    people.push({
      displayName,
      phone: `${FICTIONAL_PHONE_PREFIX}${String(suffix).padStart(3, '0')}`,
    });
  }
  return people;
}
