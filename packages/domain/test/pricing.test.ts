import { describe, expect, it } from 'vitest';
import {
  DomainError,
  money,
  planBookingOptions,
  priceRange,
  quoteBooking,
  withinAgreedPrice,
  type Money,
} from '../src/index.js';
import { at, request, staff } from './builders.js';

const rub = (amount: number): Money => money(amount * 100, 'RUB');

describe('booking price for "any staff member"', () => {
  // Two staff can serve the slot; the senior one charges more for the same service.
  const team = [
    staff('senior', { rank: 1, services: { cut: null } }),
    staff('junior', { rank: 2, services: { cut: null } }),
  ];
  const personalPriceMinor = new Map([['senior', 530_000]]);
  const priced = () =>
    planBookingOptions(request({ staff: team }), at('2026-03-02T11:00')).map((plan) => ({
      plan,
      total: quoteBooking(
        [
          {
            serviceId: 'cut',
            basePriceMinor: 470_000,
            staffPriceMinor: personalPriceMinor.get(plan.staffId) ?? null,
          },
        ],
        'RUB',
      ).total,
    }));

  it('shows the full range of what the slot may cost', () => {
    expect(priceRange(priced().map((option) => option.total))).toEqual({
      min: rub(4700),
      max: rub(5300),
    });
  });

  it('never assigns a staff member above the price the client agreed to', () => {
    const options = priced();
    expect(options.map((option) => option.plan.staffId)).toContain('senior');
    const affordable = withinAgreedPrice(options, rub(4700));
    expect(affordable.map((option) => option.plan.staffId)).toEqual(['junior']);
    expect(affordable.every((option) => option.total.amountMinor <= rub(4700).amountMinor)).toBe(
      true,
    );
  });

  it('keeps the assignment order among options within the agreed price', () => {
    const options = priced();
    expect(withinAgreedPrice(options, rub(5300)).map((option) => option.plan.staffId)).toEqual(
      options.map((option) => option.plan.staffId),
    );
  });

  it('offers nothing when every option costs more than agreed', () => {
    expect(withinAgreedPrice(priced(), rub(4000))).toEqual([]);
  });

  it('refuses to compare prices in different currencies', () => {
    expect(() => withinAgreedPrice(priced(), money(470_000, 'KZT'))).toThrow(DomainError);
    expect(priceRange([])).toBeNull();
  });
});
