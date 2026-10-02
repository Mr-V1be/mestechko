import { day, twoByTwo, weekdays, type DemoBusiness } from './types.js';

const STANTSIONNAYA = 'stantsionnaya';
const shift = day('09:00', '21:00', ['14:00', '15:00']);

export const porshenAuto: DemoBusiness = {
  slug: 'porshen',
  name: 'Поршень',
  verticalId: 'auto_service',
  countryCode: 'RU',
  currency: 'RUB',
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
  staff: [
    {
      key: 'sergey',
      displayName: 'Сергей Кузнецов',
      title: 'Диагност',
      locationKey: STANTSIONNAYA,
      pattern: weekdays(day('09:00', '19:00', ['13:00', '14:00']), [1, 2, 3, 4, 5]),
      services: ['computer_diagnostics', 'oil_change', 'brake_pads', 'ac_service'],
    },
    {
      key: 'alexey',
      displayName: 'Алексей Попов',
      title: 'Автомеханик',
      locationKey: STANTSIONNAYA,
      pattern: twoByTwo(shift, 0),
      services: ['oil_change', 'brake_pads', 'tire_change'],
    },
    {
      key: 'viktor',
      displayName: 'Виктор Фёдоров',
      title: 'Автомеханик',
      locationKey: STANTSIONNAYA,
      pattern: twoByTwo(shift, 2),
      services: ['oil_change', 'brake_pads', 'tire_change', 'wheel_alignment'],
    },
    {
      key: 'nikolay',
      displayName: 'Николай Зайцев',
      title: 'Шиномонтажник',
      locationKey: STANTSIONNAYA,
      pattern: weekdays(day('10:00', '19:00', ['14:00', '14:30']), [2, 3, 4, 5, 6]),
      services: ['tire_change', 'wheel_alignment'],
    },
  ],
  femaleClientShare: 0.25,
  utilization: { past: [0.5, 0.8], upcoming: 0.5 },
};
