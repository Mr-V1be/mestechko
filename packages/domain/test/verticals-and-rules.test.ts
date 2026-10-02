import { describe, expect, it } from 'vitest';
import {
  builtInVerticals,
  defineVertical,
  DomainError,
  moneyFromMajor,
  resolveBookingRules,
  verticalRegistry,
  VerticalRegistry,
} from '../src/index.js';
import { rules } from './builders.js';

const sportsSchool = defineVertical({
  id: 'sports_school',
  presentation: { icon: 'dumbbell' },
  vocabulary: { staff: 'coach', resource: 'hall', client: 'student' },
  resourceTypes: [{ id: 'gym_hall', term: 'gym_hall' }],
  serviceCategories: ['training'],
  serviceTemplates: [
    {
      key: 'personal_training',
      categoryKey: 'training',
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      suggestedPrice: moneyFromMajor(2000, 'RUB'),
      resourceTypeId: 'gym_hall',
    },
  ],
  rules: rules(),
});

describe('vertical registry', () => {
  it('ships the four launch verticals', () => {
    expect(verticalRegistry.list().map((vertical) => vertical.id)).toEqual([
      'beauty_salon',
      'barbershop',
      'dental_clinic',
      'auto_service',
    ]);
    expect(verticalRegistry.get('dental_clinic').vocabulary.staff).toBe('doctor');
    expect(verticalRegistry.resourceType('auto_service', 'lift').term).toBe('lift');
  });

  it('accepts a new line of business as a single definition', () => {
    const registry = new VerticalRegistry([...builtInVerticals, sportsSchool]);
    expect(registry.get('sports_school').vocabulary.staff).toBe('coach');
  });

  it('rejects inconsistent definitions', () => {
    const broken = defineVertical({
      ...sportsSchool,
      serviceTemplates: [{ ...sportsSchool.serviceTemplates[0], resourceTypeId: 'pool' }],
    });
    expect(() => new VerticalRegistry([broken])).toThrow(DomainError);
    expect(() => new VerticalRegistry([sportsSchool, sportsSchool])).toThrow(DomainError);
    expect(() => verticalRegistry.get('bakery')).toThrow(DomainError);
  });
});

describe('booking rules', () => {
  it('stores only differences and merges nested policies', () => {
    const defaults = verticalRegistry.get('dental_clinic').rules;
    const resolved = resolveBookingRules(defaults, {
      horizonDays: 14,
      calendarPolicy: { preHolidayShorteningMinutes: 0 },
    });
    expect(resolved.horizonDays).toBe(14);
    expect(resolved.slotStepMinutes).toBe(defaults.slotStepMinutes);
    expect(resolved.calendarPolicy).toEqual({
      ...defaults.calendarPolicy,
      preHolidayShorteningMinutes: 0,
    });
  });

  it('rejects a slot step that does not divide the day', () => {
    expect(() => rules({ slotStepMinutes: 7 })).toThrow(DomainError);
    expect(() => rules({ horizonDays: 0 })).toThrow(DomainError);
  });
});
