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
/** Demo numbers are `+7 0XX …`: no Russian code starts with 0 (docs/demo-data.md). */
const DEMO_PHONE_PREFIX = '+70';
const DEMO_SUBSCRIBER_NUMBERS = 1_000_000_000;

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
  const usedNames = new Set<string>();
  const usedPhones = new Set<string>();
  const people: DemoPerson[] = [];
  while (people.length < count) {
    const female = random.chance(femaleShare);
    const [masculine, feminine] = random.pick(surnames);
    const displayName = `${random.pick(female ? femaleNames : maleNames)} ${female ? feminine : masculine}`;
    const phone = `${DEMO_PHONE_PREFIX}${String(random.int(0, DEMO_SUBSCRIBER_NUMBERS - 1)).padStart(9, '0')}`;
    if (usedNames.has(displayName) || usedPhones.has(phone)) {
      continue;
    }
    usedNames.add(displayName);
    usedPhones.add(phone);
    people.push({ displayName, phone });
  }
  return people;
}
