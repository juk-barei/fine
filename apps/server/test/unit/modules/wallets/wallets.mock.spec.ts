import { describe, expect, it } from 'vitest';
import {
  bandForScore,
  mockGraph,
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

describe('mockGraph', () => {
  const subject = {
    address: ADDRESS,
    band: screenAddress(ADDRESS).band,
    tier: screenAddress(ADDRESS).labelTier,
  };

  it('is deterministic for the same subject', () => {
    expect(mockGraph(subject)).toEqual(mockGraph(subject));
  });

  it('has exactly one subject node plus 5-7 counterparties', () => {
    const graph = mockGraph(subject);

    expect(graph.nodes.filter((node) => node.subject)).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({
      id: ADDRESS,
      subject: true,
      band: subject.band,
      tier: subject.tier,
      hops: 0,
    });
    expect(graph.nodes.length).toBeGreaterThanOrEqual(6);
    expect(graph.nodes.length).toBeLessThanOrEqual(8);

    const counterparties = graph.nodes.filter((node) => !node.subject);
    expect(new Set(counterparties.map((node) => node.id)).size).toBe(counterparties.length);
    for (const node of counterparties) {
      expect(node.id).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/);
      expect(node.hops).toBe(1);
    }
  });

  it('connects every edge to the subject with a valid transfer', () => {
    const graph = mockGraph(subject);
    const ids = new Set(graph.nodes.map((node) => node.id));

    expect(graph.edges).toHaveLength(graph.nodes.length - 1);
    for (const edge of graph.edges) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
      expect(edge.from === ADDRESS || edge.to === ADDRESS).toBe(true);
      expect(edge.from).not.toBe(edge.to);
      expect(edge.amountUsdt).toBeGreaterThan(0);
      expect(edge.txHash).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isNaN(Date.parse(edge.timestamp))).toBe(false);
    }
  });

  it('reaches inbound and outbound transfers across subjects', () => {
    const directions = new Set<string>();
    for (let index = 0; index < 20; index += 1) {
      const address = addressAt(index);
      const graph = mockGraph({ address, band: 'low', tier: 'tier_3' });
      for (const edge of graph.edges) {
        directions.add(edge.to === address ? 'inbound' : 'outbound');
      }
    }

    expect(directions).toEqual(new Set(['inbound', 'outbound']));
  });
});
