import { moneyFromMajor } from '../../money/money.js';
import { defineVertical } from '../vertical.js';

const rub = (amount: number) => moneyFromMajor(amount, 'RUB');

export const barbershop = defineVertical({
  id: 'barbershop',
  presentation: { icon: 'scissors' },
  vocabulary: { staff: 'barber', resource: 'chair', client: 'client' },
  resourceTypes: [{ id: 'barber_chair', term: 'barber_chair' }],
  serviceCategories: ['haircuts', 'beard', 'combo'],
  serviceTemplates: [
    {
      key: 'mens_haircut',
      categoryKey: 'haircuts',
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(1800),
      resourceTypeId: 'barber_chair',
    },
    {
      key: 'clipper_cut',
      categoryKey: 'haircuts',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(1000),
      resourceTypeId: 'barber_chair',
    },
    {
      key: 'kids_haircut',
      categoryKey: 'haircuts',
      durationMinutes: 45,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(1200),
      resourceTypeId: 'barber_chair',
    },
    {
      key: 'beard_trim',
      categoryKey: 'beard',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(1000),
      resourceTypeId: 'barber_chair',
    },
    {
      key: 'royal_shave',
      categoryKey: 'beard',
      durationMinutes: 45,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(1500),
      resourceTypeId: 'barber_chair',
    },
    {
      key: 'haircut_and_beard',
      categoryKey: 'combo',
      durationMinutes: 90,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(2500),
      resourceTypeId: 'barber_chair',
    },
  ],
  rules: {
    slotStepMinutes: 15,
    minLeadMinutes: 30,
    horizonDays: 30,
    maxServicesPerBooking: 3,
    staffAssignment: 'balanced',
    calendarPolicy: {
      closeOnPublicHolidays: false,
      closeOnNonWorkingDays: false,
      preHolidayShorteningMinutes: 0,
    },
    prepayment: { depositPercent: 0, holdMinutes: 15 },
    repeatVisit: { suggestAfterDays: 28 },
    clientChanges: { cutoffMinutes: 60 },
    waitlist: { offerHoldMinutes: 15 },
  },
});
