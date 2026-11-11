import { describe, expect, it } from 'vitest';

import {
  walletListInputSchema,
  walletListItemSchema,
  walletPageSchema,
} from '../src/index.ts';

const SCORED = '41' + '72'.repeat(19);
const BARE = '41' + '0'.repeat(38);

describe('wallet list read model', () => {
  it('parses a scored wallet', () => {
    const result = walletListItemSchema.safeParse({
      address: SCORED,
      score: 0.82,
      band: 'high',
      confidence: 'medium',
      labelTier: 'tier_1',
      decisionStatus: 'flagged',
      lastAnalysed: '2026-11-11T13:27:15.701Z',
    });

    expect(result.success).toBe(true);
  });

  it('parses an unscored wallet as nulls, not zeros', () => {
    const result = walletListItemSchema.safeParse({
      address: BARE,
      score: null,
      band: null,
      confidence: null,
      labelTier: null,
      decisionStatus: null,
      lastAnalysed: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a prefixed or wrong-length address', () => {
    for (const address of [
      '0x4172d5f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0',
      '4172d5f0',
      '4172D5F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0',
    ]) {
      const result = walletListItemSchema.safeParse({
        address,
        score: null,
        band: null,
        confidence: null,
        labelTier: null,
        decisionStatus: null,
        lastAnalysed: null,
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects a score outside the probability range and an unknown band', () => {
    const base = {
      address: SCORED,
      confidence: null,
      labelTier: null,
      decisionStatus: null,
      lastAnalysed: null,
    };

    expect(
      walletListItemSchema.safeParse({ ...base, score: 1.4, band: 'high' }).success,
    ).toBe(false);
    expect(
      walletListItemSchema.safeParse({ ...base, score: 0.4, band: 'severe' }).success,
    ).toBe(false);
  });

  it('defaults limit and offset and accepts an optional status filter', () => {
    expect(walletListInputSchema.parse({})).toEqual({
      limit: 20,
      offset: 0,
      status: undefined,
    });
    expect(walletListInputSchema.parse({ limit: 5, status: 'flagged' })).toMatchObject({
      limit: 5,
      status: 'flagged',
    });
    expect(walletListInputSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(walletListInputSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('parses an empty page and rejects a negative total', () => {
    expect(walletPageSchema.safeParse({ nodes: [], total: 0 }).success).toBe(true);
    expect(walletPageSchema.safeParse({ nodes: [], total: -1 }).success).toBe(false);
  });
});
