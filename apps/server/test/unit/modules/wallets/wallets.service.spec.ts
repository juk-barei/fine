import { describe, expect, it, vi } from 'vitest';
import { Param, type SQL } from 'drizzle-orm';
import { walletTraceGraphSchema } from '@repo/contracts';
import type { Screening } from '../../../../src/domain/screening/screening.ts';
import { MockWalletScorer } from '../../../../src/modules/wallets/mock-scorer.adapter.ts';
import { WalletsService } from '../../../../src/modules/wallets/wallets.service.ts';
import { DbFailure } from '../../../../src/common/effect/failures.ts';
import {
  makeFakeDb,
  runEffect,
  runEffectResult,
} from '../../../support/effect-test.ts';

const ADDRESS = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
const STORED_FLAGS = ['stored flag one', 'stored flag two'];

const SCREENING: Screening = {
  score: 0.8213,
  band: 'high',
  confidence: 'medium',
  labelTier: 'tier_2',
  decisionStatus: 'flagged',
  flags: ['scorer flag one', 'scorer flag two', 'scorer flag three'],
};

/** A scorer the spec controls: it records every screening it is asked for. */
function makeFakeScorer() {
  return { screen: vi.fn(() => SCREENING) };
}

function walletRow(overrides: Record<string, unknown> = {}) {
  return {
    address: ADDRESS,
    score: '0.8213',
    band: 'high',
    confidence: 'medium',
    label_tier: 'tier_2',
    decision_status: 'flagged',
    flags: STORED_FLAGS,
    last_analysed: '2026-11-12T04:00:00.000Z',
    ...overrides,
  };
}

/** The driver-bound values inside one of the service's raw sql statements. */
function boundParams(query: SQL): unknown[] {
  return query.queryChunks
    .filter((chunk) => chunk instanceof Param)
    .map((chunk) => (chunk as Param).value);
}

describe('WalletsService.screen', () => {
  it('persists the screening result whole and returns the stored row', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({ rows: [walletRow()] });
    const scorer = makeFakeScorer();
    const service = new WalletsService(db as never, scorer);

    const result = await runEffect(service.screen({ address: ADDRESS }));

    expect(scorer.screen).toHaveBeenCalledTimes(1);
    expect(scorer.screen).toHaveBeenCalledWith(ADDRESS);
    expect(db.execute).toHaveBeenCalledTimes(1);
    const [query] = db.execute.mock.calls[0];
    expect(boundParams(query)).toContainEqual([...SCREENING.flags]);
    expect(result).toEqual({
      wallet: {
        address: ADDRESS,
        score: 0.8213,
        band: 'high',
        confidence: 'medium',
        labelTier: 'tier_2',
        decisionStatus: 'flagged',
        lastAnalysed: '2026-11-12T04:00:00.000Z',
      },
      flags: STORED_FLAGS,
      simulated: true,
    });
  });

  it('rejects a malformed address without screening or touching the database', async () => {
    const db = makeFakeDb();
    const scorer = makeFakeScorer();
    const service = new WalletsService(db as never, scorer);

    const outcome = await runEffectResult(service.screen({ address: '0xnot-a-wallet' }));

    expect(outcome._tag).toBe('Failure');
    expect(scorer.screen).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('fails loudly when the upsert returns no row', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({ rows: [] });
    const service = new WalletsService(db as never, makeFakeScorer());

    const outcome = await runEffectResult(service.screen({ address: ADDRESS }));

    expect(outcome._tag).toBe('Failure');
    if (outcome._tag === 'Failure') {
      expect(outcome.failure).toBeInstanceOf(DbFailure);
    }
  });
});

describe('WalletsService.getByAddress', () => {
  it('returns the stored row’s own flags and never invokes the scorer', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({ rows: [walletRow()] });
    const scorer = makeFakeScorer();
    const service = new WalletsService(db as never, scorer);

    const detail = await runEffect(service.getByAddress({ address: ADDRESS }));

    expect(detail).not.toBeNull();
    expect(detail?.wallet).toMatchObject({ address: ADDRESS, score: 0.8213 });
    expect(detail?.flags).toEqual(STORED_FLAGS);
    expect(detail?.simulated).toBe(true);
    expect(scorer.screen).not.toHaveBeenCalled();
  });

  it('returns null for an address nobody screened', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({ rows: [] });
    const service = new WalletsService(db as never, makeFakeScorer());

    const detail = await runEffect(service.getByAddress({ address: ADDRESS }));

    expect(detail).toBeNull();
  });

  it('rejects a malformed address without touching the database', async () => {
    const db = makeFakeDb();
    const service = new WalletsService(db as never, makeFakeScorer());

    const outcome = await runEffectResult(service.getByAddress({ address: 'nope' }));

    expect(outcome._tag).toBe('Failure');
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('gives an unscored row no flags', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({
      rows: [
        walletRow({
          score: null,
          band: null,
          confidence: null,
          label_tier: null,
          decision_status: null,
          flags: null,
          last_analysed: null,
        }),
      ],
    });
    const scorer = makeFakeScorer();
    const service = new WalletsService(db as never, scorer);

    const detail = await runEffect(service.getByAddress({ address: ADDRESS }));

    expect(detail?.wallet.score).toBeNull();
    expect(detail?.flags).toEqual([]);
    expect(scorer.screen).not.toHaveBeenCalled();
  });
});

describe('WalletsService.preview', () => {
  it('presents the scorer’s fresh result without touching the database', async () => {
    const db = makeFakeDb();
    const scorer = makeFakeScorer();
    const service = new WalletsService(db as never, scorer);

    const result = await runEffect(service.preview({ address: ADDRESS }));

    expect(scorer.screen).toHaveBeenCalledTimes(1);
    expect(scorer.screen).toHaveBeenCalledWith(ADDRESS);
    expect(db.execute).not.toHaveBeenCalled();
    expect(result.wallet).toMatchObject({
      address: ADDRESS,
      score: SCREENING.score,
      band: SCREENING.band,
      confidence: SCREENING.confidence,
      labelTier: SCREENING.labelTier,
      decisionStatus: SCREENING.decisionStatus,
    });
    expect(typeof result.wallet.lastAnalysed).toBe('string');
    expect(result.flags).toEqual([...SCREENING.flags]);
    expect(result.simulated).toBe(true);
  });

  it('rejects a malformed address without touching the database', async () => {
    const db = makeFakeDb();
    const service = new WalletsService(db as never, makeFakeScorer());

    const outcome = await runEffectResult(service.preview({ address: 'nope' }));

    expect(outcome._tag).toBe('Failure');
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe('WalletsService.graph', () => {
  it('builds the trace graph without screening or touching the database', async () => {
    const db = makeFakeDb();
    const scorer = makeFakeScorer();
    const service = new WalletsService(db as never, scorer);

    const graph = await runEffect(
      service.graph({ address: ADDRESS, depth: 3, minValueUsdt: 0 }),
    );

    expect(scorer.screen).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
    expect(walletTraceGraphSchema.safeParse(graph).success).toBe(true);
    expect(graph.nodes.filter((node) => node.subject)).toHaveLength(1);
    expect(graph.disclosure).toMatchObject({
      depthRequested: 3,
      nodeCap: 500,
      truncated: false,
      coverage: 'complete',
    });
  });

  it('passes depth and the minimum transfer value to the builder', async () => {
    const db = makeFakeDb();
    const service = new WalletsService(db as never, new MockWalletScorer());

    const graph = await runEffect(
      service.graph({ address: ADDRESS, depth: 2, minValueUsdt: 5_000 }),
    );

    expect(graph.disclosure.depthRequested).toBe(2);
    expect(graph.disclosure.minValueUsdt).toBe(5_000);
    expect(Math.max(...graph.nodes.map((node) => node.hop))).toBeLessThanOrEqual(2);
    expect(graph.edges.every((edge) => edge.amountUsdt >= 5_000)).toBe(true);
  });

  it('defaults to depth 5 and a minimum value of 0', async () => {
    const service = new WalletsService(makeFakeDb() as never, new MockWalletScorer());

    const graph = await runEffect(service.graph({ address: ADDRESS }));

    expect(graph.disclosure).toMatchObject({
      depthRequested: 5,
      minValueUsdt: 0,
    });
    expect(Math.max(...graph.nodes.map((node) => node.hop))).toBe(5);
  });

  it('returns the same graph for the same arguments', async () => {
    const service = new WalletsService(makeFakeDb() as never, new MockWalletScorer());
    const input = { address: ADDRESS, depth: 4, minValueUsdt: 100 };

    expect(await runEffect(service.graph(input))).toEqual(
      await runEffect(service.graph(input)),
    );
  });

  it('rejects a malformed address, depth outside 1..5 and a negative minimum', async () => {
    const db = makeFakeDb();
    const service = new WalletsService(db as never, new MockWalletScorer());

    for (const input of [
      { address: 'nope' },
      { address: ADDRESS, depth: 0 },
      { address: ADDRESS, depth: 6 },
      { address: ADDRESS, minValueUsdt: -1 },
    ]) {
      const outcome = await runEffectResult(service.graph(input));
      expect(outcome._tag).toBe('Failure');
    }
    expect(db.execute).not.toHaveBeenCalled();
  });
});
