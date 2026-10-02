import { day, weekdays, type DemoBusiness } from './types.js';

const MALYSHEVA = 'malysheva';

export const emalDental: DemoBusiness = {
  slug: 'emal',
  name: 'Эмаль',
  verticalId: 'dental_clinic',
  countryCode: 'RU',
  currency: 'RUB',
  owner: { email: 'owner@emal.example', displayName: 'Ольга Эмалиева' },
  locations: [
    {
      key: MALYSHEVA,
      name: 'Эмаль на Малышева',
      address: 'Екатеринбург, улица Малышева, 51',
      timeZone: 'Asia/Yekaterinburg',
    },
  ],
  resources: [
    { locationKey: MALYSHEVA, typeId: 'treatment_room', name: 'Кабинет 1' },
    { locationKey: MALYSHEVA, typeId: 'treatment_room', name: 'Кабинет 2' },
    { locationKey: MALYSHEVA, typeId: 'treatment_room', name: 'Кабинет 3' },
    { locationKey: MALYSHEVA, typeId: 'xray_room', name: 'Рентген-кабинет' },
  ],
  services: [
    { template: 'consultation', priceMajor: 1200 },
    { template: 'dental_xray', priceMajor: 600 },
    { template: 'caries_treatment', priceMajor: 7200 },
    { template: 'professional_hygiene', priceMajor: 6000 },
    { template: 'whitening', priceMajor: 16_500 },
    { template: 'tooth_extraction', priceMajor: 4500 },
  ],
  staff: [
    {
      key: 'elena',
      displayName: 'Елена Соколова',
      title: 'Стоматолог-терапевт',
      locationKey: MALYSHEVA,
      pattern: weekdays(day('09:00', '18:00', ['13:00', '14:00']), [1, 2, 3, 4, 5]),
      services: ['consultation', 'caries_treatment', 'dental_xray'],
    },
    {
      key: 'pavel',
      displayName: 'Павел Ильин',
      title: 'Стоматолог-терапевт',
      locationKey: MALYSHEVA,
      pattern: {
        kind: 'weekly',
        week: [
          day('12:00', '21:00', ['16:00', '16:30']),
          null,
          day('12:00', '21:00', ['16:00', '16:30']),
          null,
          day('12:00', '21:00', ['16:00', '16:30']),
          day('10:00', '16:00'),
          null,
        ],
      },
      services: ['consultation', 'caries_treatment', 'dental_xray', 'whitening'],
    },
    {
      key: 'igor',
      displayName: 'Игорь Морозов',
      title: 'Хирург-имплантолог',
      locationKey: MALYSHEVA,
      pattern: {
        kind: 'weekly',
        week: [
          null,
          day('09:00', '18:00', ['13:00', '14:00']),
          null,
          day('09:00', '18:00', ['13:00', '14:00']),
          null,
          day('10:00', '15:00'),
          null,
        ],
      },
      services: ['consultation', { template: 'tooth_extraction', priceMajor: 5200 }, 'dental_xray'],
    },
    {
      key: 'natalia',
      displayName: 'Наталья Ветрова',
      title: 'Гигиенист',
      locationKey: MALYSHEVA,
      pattern: weekdays(day('10:00', '19:00', ['14:00', '14:30']), [1, 2, 3, 4, 5]),
      services: ['professional_hygiene', 'whitening'],
      daysOff: [3, 4],
    },
  ],
  femaleClientShare: 0.55,
  utilization: { past: [0.5, 0.8], upcoming: 0.55 },
};
