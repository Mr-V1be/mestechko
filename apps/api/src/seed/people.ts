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
const mobilePrefixes = [
  '903',
  '905',
  '909',
  '915',
  '916',
  '917',
  '919',
  '925',
  '926',
  '977',
  '985',
  '999',
];

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
  const used = new Set<string>();
  const people: DemoPerson[] = [];
  while (people.length < count) {
    const female = random.chance(femaleShare);
    const [masculine, feminine] = random.pick(surnames);
    const displayName = `${random.pick(female ? femaleNames : maleNames)} ${female ? feminine : masculine}`;
    if (used.has(displayName)) {
      continue;
    }
    used.add(displayName);
    const digits = String(random.int(0, 9_999_999)).padStart(7, '0');
    people.push({ displayName, phone: `+7${random.pick(mobilePrefixes)}${digits}` });
  }
  return people;
}
