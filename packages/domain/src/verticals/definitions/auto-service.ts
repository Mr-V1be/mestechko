import { moneyFromMajor } from '../../money/money.js';
import { defineVertical } from '../vertical.js';

const rub = (amount: number) => moneyFromMajor(amount, 'RUB');

export const autoService = defineVertical({
  id: 'auto_service',
  presentation: { icon: 'wrench' },
  vocabulary: { staff: 'mechanic', resource: 'bay', client: 'client' },
  resourceTypes: [
    { id: 'lift', term: 'lift' },
    { id: 'alignment_stand', term: 'alignment_stand' },
  ],
  serviceCategories: ['maintenance', 'tires', 'diagnostics'],
  serviceTemplates: [
    {
      key: 'oil_change',
      categoryKey: 'maintenance',
      durationMinutes: 45,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(1500),
      resourceTypeId: 'lift',
    },
    {
      key: 'brake_pads',
      categoryKey: 'maintenance',
      durationMinutes: 60,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(2000),
      resourceTypeId: 'lift',
    },
    {
      key: 'ac_service',
      categoryKey: 'maintenance',
      durationMinutes: 45,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(2500),
      resourceTypeId: null,
    },
    {
      key: 'tire_change',
      categoryKey: 'tires',
      durationMinutes: 60,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(2400),
      resourceTypeId: 'lift',
    },
    {
      key: 'wheel_alignment',
      categoryKey: 'tires',
      durationMinutes: 60,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(2500),
      resourceTypeId: 'alignment_stand',
    },
    {
      key: 'computer_diagnostics',
      categoryKey: 'diagnostics',
      durationMinutes: 30,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 5,
      suggestedPrice: rub(1200),
      resourceTypeId: 'lift',
    },
  ],
  rules: {
    slotStepMinutes: 30,
    minLeadMinutes: 120,
    horizonDays: 45,
    maxServicesPerBooking: 4,
    staffAssignment: 'balanced',
    calendarPolicy: {
      closeOnPublicHolidays: true,
      closeOnNonWorkingDays: false,
      preHolidayShorteningMinutes: 60,
    },
    prepayment: { depositPercent: 0 },
    repeatVisit: { suggestAfterDays: 180 },
  },
});
