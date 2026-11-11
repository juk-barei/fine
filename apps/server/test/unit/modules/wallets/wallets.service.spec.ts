import { describe, expect, it } from 'vitest';
import { WalletsService } from '../../../../src/modules/wallets/wallets.service.ts';
import { DbFailure } from '../../../../src/common/effect/failures.ts';
import {
  makeFakeDb,
  runEffect,
  runEffectResult,
} from '../../../support/effect-test.ts';

const ADDRESS = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';

function walletRow(overrides: Record<string, unknown> = {}) {
  return {
    address: ADDRESS,
    score: '0.8213',
    band: 'high',
    confidence: 'medium',
    label_tier: 'tier_2',
    decision_status: 'flagged',
    last_analysed: '2026-11-12T04:00:00.000Z',
    ...overrides,
  };
}

describe('WalletsService.screen', () => {
  it('persists the mock result and returns the read-model row', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({ rows: [walletRow()] });
    const service = new WalletsService(db as never);

    const result = await runEffect(service.screen({ address: ADDRESS }));

    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(result.simulated).toBe(true);
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.graph.nodes.filter((node) => node.subject)).toHaveLength(1);
    expect(result.graph.edges).toHaveLength(result.graph.nodes.length - 1);
    expect(result.wallet).toEqual({
      address: ADDRESS,
      score: 0.8213,
      band: 'high',
      confidence: 'medium',
      labelTier: 'tier_2',
      decisionStatus: 'flagged',
      lastAnalysed: '2026-11-12T04:00:00.000Z',
    });
  });

  it('rejects a malformed address without touching the database', async () => {
    const db = makeFakeDb();
    const service = new WalletsService(db as never);

    const outcome = await runEffectResult(service.screen({ address: '0xnot-a-wallet' }));

    expect(outcome._tag).toBe('Failure');
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('fails loudly when the upsert returns no row', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({ rows: [] });
    const service = new WalletsService(db as never);

    const outcome = await runEffectResult(service.screen({ address: ADDRESS }));

    expect(outcome._tag).toBe('Failure');
    if (outcome._tag === 'Failure') {
      expect(outcome.failure).toBeInstanceOf(DbFailure);
    }
  });
});

describe('WalletsService.getByAddress', () => {
  it('returns the row with re-derived flags and graph', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({ rows: [walletRow()] });
    const service = new WalletsService(db as never);

    const detail = await runEffect(service.getByAddress({ address: ADDRESS }));

    expect(detail).not.toBeNull();
    expect(detail?.wallet).toMatchObject({ address: ADDRESS, score: 0.8213 });
    expect(detail?.flags.length).toBeGreaterThan(0);
    expect(detail?.graph?.nodes.filter((node) => node.subject)).toHaveLength(1);
    expect(detail?.simulated).toBe(true);
  });

  it('returns null for an address nobody screened', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({ rows: [] });
    const service = new WalletsService(db as never);

    const detail = await runEffect(service.getByAddress({ address: ADDRESS }));

    expect(detail).toBeNull();
  });

  it('rejects a malformed address without touching the database', async () => {
    const db = makeFakeDb();
    const service = new WalletsService(db as never);

    const outcome = await runEffectResult(service.getByAddress({ address: 'nope' }));

    expect(outcome._tag).toBe('Failure');
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('gives an unscored row no graph and no flags', async () => {
    const db = makeFakeDb();
    db.execute.mockResolvedValueOnce({
      rows: [
        walletRow({
          score: null,
          band: null,
          confidence: null,
          label_tier: null,
          decision_status: null,
          last_analysed: null,
        }),
      ],
    });
    const service = new WalletsService(db as never);

    const detail = await runEffect(service.getByAddress({ address: ADDRESS }));

    expect(detail?.wallet.score).toBeNull();
    expect(detail?.graph).toBeNull();
    expect(detail?.flags).toEqual([]);
  });
});
