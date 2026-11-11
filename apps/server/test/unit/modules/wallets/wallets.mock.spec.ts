import { describe, expect, it } from 'vitest';
import {
  bandForScore,
  screenAddress,
} from '../../../../src/modules/wallets/wallets.mock.ts';

const ADDRESS = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function addressAt(index: number): string {
  let value = index;
  let tail = '';
  for (let i = 0; i < 33; i += 1) {
    tail += BASE58[value % BASE58.length];
    value = Math.floor(value / BASE58.length);
  }
  return `T${tail}`;
}

describe('screenAddress', () => {
  it('is deterministic for the same address', () => {
    expect(screenAddress(ADDRESS)).toEqual(screenAddress(ADDRESS));
  });

  it('keeps every field inside the contract', () => {
    const result = screenAddress(ADDRESS);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(Number(result.score.toFixed(4))).toBe(result.score);
    expect(result.band).toBe(bandForScore(result.score));
    expect(result.decisionStatus).toBe(
      result.band === 'high'
        ? 'flagged'
        : result.band === 'moderate'
          ? 'open'
          : 'cleared',
    );
    expect(['tier_1', 'tier_2', 'tier_3']).toContain(result.labelTier);
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('reaches low, moderate and high bands across addresses', () => {
    const bands = new Set(
      Array.from({ length: 60 }, (_, index) => screenAddress(addressAt(index)).band),
    );

    expect(bands).toEqual(new Set(['low', 'moderate', 'high']));
  });

  it('flags only scored wallets, with distinct flags', () => {
    for (let index = 0; index < 40; index += 1) {
      const result = screenAddress(addressAt(index));
      const expectedCount = result.band === 'high' ? 3 : result.band === 'moderate' ? 2 : 0;

      expect(result.flags).toHaveLength(expectedCount);
      expect(new Set(result.flags).size).toBe(result.flags.length);
    }
  });
});
