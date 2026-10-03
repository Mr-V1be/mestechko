import { day, twoByTwo, type DemoBusiness } from './types.js';

const BAUMANA = 'baumana';
const shift = day('10:00', '22:00', ['16:00', '16:30']);

export const chubBarbershop: DemoBusiness = {
  slug: 'chub',
  name: 'Чуб',
  verticalId: 'barbershop',
  countryCode: 'RU',
  currency: 'RUB',
  owner: { email: 'owner@chub.example', displayName: 'Ильдар Чубаров' },
  staffAccounts: [{ staffKey: 'artem', email: 'artem@chub.example' }],
  locations: [
    {
      key: BAUMANA,
      name: 'Чуб на Баумана',
      address: 'Казань, улица Баумана, 44',
      timeZone: 'Europe/Moscow',
    },
  ],
  resources: [1, 2, 3, 4].map((index) => ({
    locationKey: BAUMANA,
    typeId: 'barber_chair',
    name: `Кресло ${String(index)}`,
  })),
  services: [
    { template: 'mens_haircut', priceMajor: 1900 },
    { template: 'clipper_cut', priceMajor: 1100 },
    { template: 'kids_haircut', priceMajor: 1300 },
    { template: 'beard_trim', priceMajor: 1100 },
    { template: 'royal_shave', priceMajor: 1700 },
    { template: 'haircut_and_beard', priceMajor: 2700 },
  ],
  loyalty: { accrualPercent: 3, maxRedeemPercent: 20 },
  passPlans: [
    {
      name: '5 стрижек',
      visits: 5,
      validityDays: 120,
      priceMajor: 8500,
      services: ['mens_haircut', 'clipper_cut'],
    },
  ],
  crm: {
    regularTag: 'Постоянный клиент',
    tags: ['VIP', 'Борода', 'С сыном'],
    notes: [
      'Стрижёт только машинкой, насадка 6 мм по бокам',
      'Любит крепкий кофе',
      'Приводит сына раз в месяц',
      'Не любит разговоры во время стрижки',
    ],
  },
  staff: [
    {
      key: 'artem',
      displayName: 'Артём Волков',
      title: 'Старший барбер',
      locationKey: BAUMANA,
      pattern: twoByTwo(shift, 0),
      services: [
        { template: 'mens_haircut', priceMajor: 2300 },
        'clipper_cut',
        { template: 'beard_trim', priceMajor: 1300 },
        { template: 'royal_shave', priceMajor: 2000 },
        { template: 'haircut_and_beard', priceMajor: 3200 },
      ],
    },
    {
      key: 'timur',
      displayName: 'Тимур Хайруллин',
      title: 'Барбер',
      locationKey: BAUMANA,
      pattern: twoByTwo(shift, 2),
      services: [
        'mens_haircut',
        'clipper_cut',
        'kids_haircut',
        'beard_trim',
        'royal_shave',
        'haircut_and_beard',
      ],
    },
    {
      key: 'denis',
      displayName: 'Денис Сорокин',
      title: 'Барбер',
      locationKey: BAUMANA,
      pattern: twoByTwo(shift, 1),
      services: ['mens_haircut', 'clipper_cut', 'beard_trim', 'haircut_and_beard'],
      daysOff: [5],
    },
    {
      key: 'ruslan',
      displayName: 'Руслан Галиев',
      title: 'Барбер-стажёр',
      locationKey: BAUMANA,
      pattern: twoByTwo(shift, 3),
      services: [
        { template: 'mens_haircut', durationMinutes: 75, priceMajor: 1500 },
        'clipper_cut',
        { template: 'kids_haircut', priceMajor: 1000 },
      ],
    },
  ],
  femaleClientShare: 0.05,
  utilization: { past: [0.6, 0.9], upcoming: 0.65 },
};
