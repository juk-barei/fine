import { describe, expect, it } from 'vitest';

import {
  walletDetailSchema,
  walletListInputSchema,
  walletListItemSchema,
  walletPageSchema,
  walletScreeningSchema,
} from '../src/index.ts';

const SCORED = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
const BARE = 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS';

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
      'tLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
      // base58 excludes 0, O, I and l.
      'T0a2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
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

describe('wallet detail and screening shapes', () => {
  const wallet = {
    address: SCORED,
    score: 0.82,
    band: 'high',
    confidence: 'medium',
    labelTier: 'tier_1',
    decisionStatus: 'flagged',
    lastAnalysed: '2026-11-11T13:27:15.701Z',
  };

  it('allows a detail with no graph but not a screening with no graph', () => {
    expect(
      walletDetailSchema.safeParse({ wallet, flags: [], simulated: true, graph: null })
        .success,
    ).toBe(true);
    expect(
      walletScreeningSchema.safeParse({ wallet, flags: [], simulated: true, graph: null })
        .success,
    ).toBe(false);
  });

  it('rejects a graph edge that points at unknown nodes or a short txid', () => {
    const graph = {
      nodes: [
        { id: SCORED, label: 'TLa2f6…YjU7', band: 'high', tier: 'tier_2', subject: true, hops: 0 },
      ],
      edges: [
        {
          from: SCORED,
          to: BARE,
          amountUsdt: 100,
          txHash: 'abc',
          timestamp: '2026-11-11T13:27:15.701Z',
        },
      ],
    };

    expect(
      walletDetailSchema.safeParse({ wallet, flags: [], simulated: true, graph }).success,
    ).toBe(false);
  });
});
