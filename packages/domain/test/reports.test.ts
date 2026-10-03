import { describe, expect, it } from 'vitest';
import { addFacts, emptyFacts, metricChange, metricValue } from '../src/index.js';

describe('report metrics', () => {
  const monday = {
    workingMinutes: 600,
    bookedMinutes: 450,
    revenueMinor: 1_250_000,
    visits: 6,
    noShows: 2,
    repeatVisits: 3,
  };

  it('computes shares and sums from period facts', () => {
    expect(metricValue('occupancy', monday)).toBe(0.75);
    expect(metricValue('no_shows', monday)).toBe(0.25);
    expect(metricValue('repeat_visits', monday)).toBe(0.5);
    expect(metricValue('revenue', monday)).toBe(1_250_000);
  });

  it('adds days into a period', () => {
    const week = addFacts(monday, { ...emptyFacts, workingMinutes: 600, visits: 2 });
    expect(metricValue('occupancy', week)).toBe(0.375);
    expect(metricValue('repeat_visits', week)).toBe(0.375);
  });

  it('has no share when there is nothing to divide', () => {
    expect(metricValue('occupancy', emptyFacts)).toBeNull();
    expect(metricValue('no_shows', emptyFacts)).toBeNull();
    expect(metricValue('revenue', emptyFacts)).toBe(0);
  });

  it('compares shares in points and money relative to before', () => {
    const earlier = { ...monday, bookedMinutes: 300, noShows: 1, revenueMinor: 1_000_000 };
    expect(metricChange('occupancy', monday, earlier)).toEqual({
      measure: 'points',
      amount: 0.25,
      improved: true,
    });
    expect(metricChange('revenue', monday, earlier)).toEqual({
      measure: 'relative',
      amount: 0.25,
      improved: true,
    });
    const noShows = metricChange('no_shows', monday, earlier);
    expect(noShows?.improved).toBe(false);
    expect(noShows?.amount).toBeCloseTo(0.25 - 1 / 7);
  });

  it('has no change without a value to compare with', () => {
    expect(metricChange('occupancy', monday, emptyFacts)).toBeNull();
    expect(metricChange('revenue', monday, emptyFacts)).toBeNull();
    expect(metricChange('repeat_visits', monday, monday)).toEqual({
      measure: 'points',
      amount: 0,
      improved: null,
    });
  });
});
