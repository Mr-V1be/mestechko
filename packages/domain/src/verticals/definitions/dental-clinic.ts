import { moneyFromMajor } from '../../money/money.js';
import { defineVertical } from '../vertical.js';

const rub = (amount: number) => moneyFromMajor(amount, 'RUB');

export const dentalClinic = defineVertical({
  id: 'dental_clinic',
  presentation: { icon: 'smile_plus' },
  vocabulary: { staff: 'doctor', resource: 'cabinet', client: 'patient' },
  resourceTypes: [
    { id: 'treatment_room', term: 'treatment_room' },
    { id: 'xray_room', term: 'xray_room' },
  ],
  serviceCategories: ['diagnostics', 'therapy', 'hygiene', 'surgery'],
  serviceTemplates: [
    {
      key: 'consultation',
      categoryKey: 'diagnostics',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      suggestedPrice: rub(1000),
      resourceTypeId: 'treatment_room',
    },
    {
      key: 'dental_xray',
      categoryKey: 'diagnostics',
      durationMinutes: 15,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
      suggestedPrice: rub(500),
      resourceTypeId: 'xray_room',
    },
    {
      key: 'caries_treatment',
      categoryKey: 'therapy',
      durationMinutes: 60,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 15,
      suggestedPrice: rub(6500),
      resourceTypeId: 'treatment_room',
    },
    {
      key: 'professional_hygiene',
      categoryKey: 'hygiene',
      durationMinutes: 60,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 15,
      suggestedPrice: rub(5500),
      resourceTypeId: 'treatment_room',
    },
    {
      key: 'whitening',
      categoryKey: 'hygiene',
      durationMinutes: 90,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 15,
      suggestedPrice: rub(15000),
      resourceTypeId: 'treatment_room',
    },
    {
      key: 'tooth_extraction',
      categoryKey: 'surgery',
      durationMinutes: 45,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 20,
      suggestedPrice: rub(4000),
      resourceTypeId: 'treatment_room',
    },
  ],
  rules: {
    slotStepMinutes: 30,
    minLeadMinutes: 120,
    horizonDays: 90,
    maxServicesPerBooking: 3,
    staffAssignment: 'first_listed',
    calendarPolicy: {
      closeOnPublicHolidays: true,
      closeOnNonWorkingDays: false,
      preHolidayShorteningMinutes: 60,
    },
    prepayment: { depositPercent: 0, holdMinutes: 30 },
    repeatVisit: { suggestAfterDays: 180 },
    clientChanges: { cutoffMinutes: 1440 },
    waitlist: { offerHoldMinutes: 60 },
  },
});
