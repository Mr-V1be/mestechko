/** Deterministic pseudo-random numbers (mulberry32) so seeds are reproducible per day. */
export class Random {
  private state: number;

  constructor(seed: string) {
    let hash = 2_166_136_261;
    for (const char of seed) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
    }
    this.state = hash >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d_2b_79_f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  between(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.between(min, max + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) {
      throw new Error('Cannot pick from an empty list');
    }
    return item;
  }

  /** Index drawn with probability proportional to its weight. */
  weighted(weights: readonly number[]): number {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let threshold = this.next() * total;
    for (const [index, weight] of weights.entries()) {
      threshold -= weight;
      if (threshold < 0) {
        return index;
      }
    }
    return weights.length - 1;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(this.next() * (index + 1));
      [result[index], result[other]] = [result[other] as T, result[index] as T];
    }
    return result;
  }
}
