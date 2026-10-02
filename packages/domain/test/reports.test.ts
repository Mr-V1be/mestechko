import { describe, expect, it } from 'vitest';
import { addFacts, emptyFacts, metricValue } from '../src/index.js';

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
});
