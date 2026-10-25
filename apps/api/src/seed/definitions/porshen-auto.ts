import { day, twoByTwo, weekdays, type DemoBusiness } from './types.js';

const STANTSIONNAYA = 'stantsionnaya';
const shift = day('09:00', '21:00', ['14:00', '15:00']);

export const porshenAuto: DemoBusiness = {
  slug: 'porshen',
  name: 'Поршень',
  verticalId: 'auto_service',
  countryCode: 'RU',
  currency: 'RUB',
  locale: 'ru',
  owner: { email: 'owner@porshen.example', displayName: 'Геннадий Поршнев' },
  staffAccounts: [{ staffKey: 'sergey', email: 'sergey@porshen.example' }],
  locations: [
    {
      key: STANTSIONNAYA,
      name: 'Поршень на Станционной',
      address: 'Новосибирск, Станционная улица, 38',
      timeZone: 'Asia/Novosibirsk',
    },
  ],
  resources: [
    { locationKey: STANTSIONNAYA, typeId: 'lift', name: 'Подъёмник 1' },
    { locationKey: STANTSIONNAYA, typeId: 'lift', name: 'Подъёмник 2' },
    { locationKey: STANTSIONNAYA, typeId: 'lift', name: 'Подъёмник 3' },
    { locationKey: STANTSIONNAYA, typeId: 'alignment_stand', name: 'Стенд сход-развала' },
  ],
  services: [
    { template: 'oil_change', priceMajor: 1600 },
    { template: 'brake_pads', priceMajor: 2200 },
    { template: 'ac_service', priceMajor: 2700 },
    { template: 'tire_change', priceMajor: 2600 },
    { template: 'wheel_alignment', priceMajor: 2800 },
    { template: 'computer_diagnostics', priceMajor: 1300 },
  ],
  crm: {
    regularTag: 'Постоянный клиент',
    tags: ['Корпоративный', 'Kia Rio', 'Hyundai Solaris'],
    notes: [
      'Масло только своё, привозит с собой',
      'Летние шины хранятся у нас, стеллаж 4',
      'Просит позвонить перед дополнительными работами',
      'Машина на гарантии дилера — без разборки двигателя',
    ],
  },
  staff: [
    {
      key: 'sergey',
      displayName: 'Сергей Кузнецов',
      title: 'Диагност',
      popularity: 1.1,
      locationKey: STANTSIONNAYA,
      pattern: weekdays(day('09:00', '19:00', ['13:00', '14:00']), [1, 2, 3, 4, 5]),
      services: ['computer_diagnostics', 'oil_change', 'brake_pads', 'ac_service'],
    },
    {
      key: 'alexey',
      displayName: 'Алексей Попов',
      title: 'Автомеханик',
      popularity: 0.95,
      locationKey: STANTSIONNAYA,
      pattern: twoByTwo(shift, 0),
      services: ['oil_change', 'brake_pads', 'tire_change'],
    },
    {
      key: 'viktor',
      displayName: 'Виктор Фёдоров',
      title: 'Автомеханик',
      popularity: 0.85,
      locationKey: STANTSIONNAYA,
      pattern: twoByTwo(shift, 2),
      services: ['oil_change', 'brake_pads', 'tire_change', 'wheel_alignment'],
    },
    {
      key: 'nikolay',
      displayName: 'Николай Зайцев',
      title: 'Шиномонтажник',
      popularity: 0.72,
      locationKey: STANTSIONNAYA,
      pattern: weekdays(day('10:00', '19:00', ['14:00', '14:30']), [2, 3, 4, 5, 6]),
      services: ['tire_change', 'wheel_alignment'],
    },
  ],
  femaleClientShare: 0.25,
  demand: {
    base: 0.55,
    upcoming: 0.5,
    weekdays: [1.22, 0.95, 0.88, 0.92, 1.06, 1.24, 0.7],
    dayParts: { morning: 1.35, day: 1, evening: 0.7 },
    trendStart: 0.84,
  },
};
