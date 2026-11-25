import { describe, expect, it } from 'vitest';
import { walletTraceGraphSchema } from '@repo/contracts';
import {
  bandForScore,
  mockTraceGraph,
  screenAddress,
} from '../../../../src/modules/wallets/wallets.mock.ts';
import { OFAC_TRON_ADDRESSES } from '../../../../src/modules/wallets/ofac-seed.ts';

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

describe('mockTraceGraph', () => {
  const request = { address: ADDRESS, depth: 3, minValueUsdt: 0 };

  it('is deterministic for the same request', () => {
    expect(mockTraceGraph(request)).toEqual(mockTraceGraph(request));
  });

  it('parses against the trace graph contract', () => {
    expect(walletTraceGraphSchema.safeParse(mockTraceGraph(request)).success).toBe(
      true,
    );
  });

  it('makes the opened wallet the single hop-0 subject', () => {
    const graph = mockTraceGraph(request);
    const subjects = graph.nodes.filter((node) => node.subject);

    expect(subjects).toHaveLength(1);
    expect(subjects[0]).toMatchObject({
      address: ADDRESS,
      hop: 0,
      kind: 'subject',
    });
    expect(graph.nodes[0]).toMatchObject({ address: ADDRESS, subject: true });
  });

  it('lays the neighbourhood out across hops up to the requested depth', () => {
    const graph = mockTraceGraph({ ...request, depth: 4 });

    expect(Math.max(...graph.nodes.map((node) => node.hop))).toBe(4);
    expect(Math.max(...graph.edges.map((edge) => edge.hop))).toBe(4);
    expect(new Set(graph.nodes.filter((node) => !node.subject).map((node) => node.hop))).toEqual(
      new Set([1, 2, 3, 4]),
    );
    expect(graph.nodes.length).toBeGreaterThan(1 + 4 * 2);
  });

  it('uses unique, valid addresses and connects every edge between returned nodes', () => {
    const graph = mockTraceGraph(request);
    const addresses = new Set(graph.nodes.map((node) => node.address));

    expect(addresses.size).toBe(graph.nodes.length);
    for (const node of graph.nodes) {
      expect(node.address).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/);
    }
    for (const edge of graph.edges) {
      expect(addresses.has(edge.from)).toBe(true);
      expect(addresses.has(edge.to)).toBe(true);
      expect(edge.from).not.toBe(edge.to);
      expect(edge.amountUsdt).toBeGreaterThan(0);
      expect(edge.txHash).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isNaN(Date.parse(edge.timestamp))).toBe(false);
      expect(['inbound', 'outbound']).toContain(edge.direction);
      expect(edge.hop).toBeGreaterThanOrEqual(1);
      expect(edge.hop).toBeLessThanOrEqual(4);
    }
    expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(
      graph.edges.length,
    );
  });

  it('derives band, score and confidence from the same screener as the list', () => {
    const graph = mockTraceGraph(request);

    for (const node of graph.nodes) {
      const screening = screenAddress(node.address);
      expect(node.band).toBe(screening.band);
      expect(node.pLaundering).toBe(screening.score);
      expect(node.confidence).toBe(screening.confidence);
      expect(node.volumeUsdt).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every node the six product rules', () => {
    for (const node of mockTraceGraph(request).nodes) {
      expect(node.rules.map((rule) => rule.code)).toEqual([
        'R1',
        'R2',
        'R3',
        'R4',
        'R5',
        'R6',
      ]);
      for (const rule of node.rules) {
        expect(rule.summary.length).toBeGreaterThan(0);
        expect(typeof rule.triggered).toBe('boolean');
      }
    }
  });

  it('labels OFAC seed members with one Tier 1 row and leaves others unlabelled', () => {
    const seeded = mockTraceGraph({
      address: Object.keys(OFAC_TRON_ADDRESSES)[0],
      depth: 1,
      minValueUsdt: 0,
    });
    expect(seeded.nodes[0].labels).toEqual([
      { tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null },
    ]);

    const graph = mockTraceGraph(request);
    for (const node of graph.nodes) {
      if (OFAC_TRON_ADDRESSES[node.address] === true) {
        expect(node.labels).toEqual([
          { tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null },
        ]);
      } else {
        expect(node.labels).toEqual([]);
      }
    }
  });

  it('gives roughly half the counterparties an intermediary class', () => {
    const graph = mockTraceGraph({ address: ADDRESS, depth: 5, minValueUsdt: 0 });
    const counterparties = graph.nodes.filter((node) => node.hop >= 1);
    const classified = counterparties.filter((node) => node.intermediary !== null);
    const classes = new Set(
      counterparties
        .map((node) => node.intermediary)
        .filter((value): value is NonNullable<typeof value> => value !== null),
    );

    expect(graph.nodes[0].intermediary).toBeNull();
    expect(classified.length).toBeGreaterThan(0);
    expect(classified.length).toBeLessThan(counterparties.length);
    expect([...classes].every((value) =>
      ['pass_through', 'peel_chain', 'consolidation'].includes(value),
    )).toBe(true);
  });

  it('drops transfers below the minimum value and any node left without one', () => {
    const graph = mockTraceGraph({
      address: ADDRESS,
      depth: 3,
      minValueUsdt: 4_000,
    });

    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.edges.every((edge) => edge.amountUsdt >= 4_000)).toBe(true);

    const touched = new Set(
      graph.edges.flatMap((edge) => [edge.from, edge.to]),
    );
    for (const node of graph.nodes) {
      if (!node.subject) {
        expect(touched.has(node.address)).toBe(true);
      }
    }
  });

  it('reports what it returned in the disclosure, honestly', () => {
    const graph = mockTraceGraph(request);
    const { disclosure } = graph;

    expect(graph.simulated).toBe(true);
    expect(disclosure).toMatchObject({
      depthRequested: 3,
      minValueUsdt: 0,
      nodesReturned: graph.nodes.length,
      nodeCap: 500,
      truncated: false,
      coverage: 'complete',
      loadedTransfers: graph.edges.length,
      reportedTransfers: graph.edges.length,
      reason: null,
    });
    expect(disclosure.depthReached).toBe(
      Math.max(...graph.nodes.map((node) => node.hop)),
    );
  });

  it('reports the requested depth as one hop without reaching further', () => {
    const graph = mockTraceGraph({ address: ADDRESS, depth: 1, minValueUsdt: 0 });

    expect(graph.disclosure.depthRequested).toBe(1);
    expect(graph.disclosure.depthReached).toBe(1);
    expect(graph.nodes.every((node) => node.hop <= 1)).toBe(true);
    expect(graph.edges.every((edge) => edge.hop === 1)).toBe(true);
  });

  it('sizes the neighbourhood so depth four fits the cap and depth five trips it', () => {
    const four = mockTraceGraph({ address: ADDRESS, depth: 4, minValueUsdt: 0 });

    expect(four.nodes.length).toBeLessThanOrEqual(500);
    expect(four.disclosure).toMatchObject({
      depthRequested: 4,
      nodesReturned: four.nodes.length,
      nodeCap: 500,
      truncated: false,
      coverage: 'complete',
      reason: null,
    });
    expect(four.disclosure.loadedTransfers).toBe(four.edges.length);
    expect(four.disclosure.reportedTransfers).toBe(four.edges.length);

    const five = mockTraceGraph({ address: ADDRESS, depth: 5, minValueUsdt: 0 });

    expect(five.nodes).toHaveLength(500);
    expect(five.disclosure).toMatchObject({
      depthRequested: 5,
      nodesReturned: five.nodes.length,
      nodeCap: 500,
      truncated: true,
      coverage: 'partial',
    });
    expect(five.disclosure.reason).toMatch(/cap/i);
    expect(five.disclosure.loadedTransfers).toBe(five.edges.length);
    expect(five.disclosure.loadedTransfers).toBeLessThan(
      five.disclosure.reportedTransfers,
    );
    expect(walletTraceGraphSchema.safeParse(five).success).toBe(true);
  });

  it('keeps the highest-volume nodes first and lists them in cap priority order', () => {
    const graph = mockTraceGraph({ address: ADDRESS, depth: 5, minValueUsdt: 0 });
    const ranked = graph.nodes.filter((node) => !node.subject);
    const volumeOf = (node: (typeof ranked)[number]) => node.volumeUsdt;

    for (let index = 1; index < ranked.length; index += 1) {
      const previous = ranked[index - 1];
      const current = ranked[index];
      const ordered =
        volumeOf(previous) > volumeOf(current) ||
        (volumeOf(previous) === volumeOf(current) &&
          (previous.hop < current.hop ||
            (previous.hop === current.hop && previous.address < current.address)));

      expect(ordered).toBe(true);
    }

    // The cap lands in the deepest hop: almost every shallower wallet survives
    // and the drop is confined to hop-five leaves with the lowest volume.
    expect(graph.nodes[0]).toMatchObject({ address: ADDRESS, subject: true });
    expect(graph.nodes.filter((node) => node.hop < 5).length).toBeGreaterThan(300);
    expect(graph.nodes.some((node) => node.hop === 5)).toBe(true);
  });

  it('applies the minimum-value filter to transfers before the node cap', () => {
    const all = mockTraceGraph({ address: ADDRESS, depth: 3, minValueUsdt: 0 });
    const filtered = mockTraceGraph({
      address: ADDRESS,
      depth: 3,
      minValueUsdt: 15_000,
    });

    expect(filtered.nodes.length).toBeGreaterThan(1);
    expect(filtered.nodes.length).toBeLessThan(all.nodes.length);
    const allAddresses = new Set(all.nodes.map((node) => node.address));
    expect(
      filtered.nodes.every((node) => allAddresses.has(node.address)),
    ).toBe(true);
    expect(filtered.edges.every((edge) => edge.amountUsdt >= 15_000)).toBe(true);
    expect(filtered.disclosure).toMatchObject({
      minValueUsdt: 15_000,
      truncated: false,
      coverage: 'complete',
    });

    // The same filter leaves a depth-five trace under the cap. Had the cap run
    // first it would have reported a truncated 500-node trace.
    const deep = mockTraceGraph({
      address: ADDRESS,
      depth: 5,
      minValueUsdt: 15_000,
    });
    expect(deep.nodes.length).toBeGreaterThan(filtered.nodes.length);
    expect(deep.nodes.length).toBeLessThan(500);
    expect(deep.disclosure).toMatchObject({
      truncated: false,
      coverage: 'complete',
      reason: null,
    });
    expect(deep.disclosure.reportedTransfers).toBe(deep.edges.length);
  });

  it('returns an identical payload for repeated identical capped requests', () => {
    const request = { address: ADDRESS, depth: 5, minValueUsdt: 0 };

    expect(mockTraceGraph(request)).toEqual(mockTraceGraph(request));
    expect(mockTraceGraph(request).disclosure.truncated).toBe(true);
  });
});

describe('screenAddress with the OFAC seed', () => {
  it('carries the 52 documented addresses', () => {
    expect(Object.keys(OFAC_TRON_ADDRESSES)).toHaveLength(52);
  });

  it('screens every seeded address as Tier 1, high and flagged', () => {
    for (const address of Object.keys(OFAC_TRON_ADDRESSES)) {
      const result = screenAddress(address);

      expect(result.labelTier).toBe('tier_1');
      expect(result.band).toBe('high');
      expect(result.decisionStatus).toBe('flagged');
      expect(result.confidence).toBe('high');
      expect(result.score).toBeGreaterThanOrEqual(0.9);
      expect(result.flags.some((flag) => flag.includes('OFAC'))).toBe(true);
    }
  });

  it('leaves an unlisted address to the deterministic scorer', () => {
    expect(OFAC_TRON_ADDRESSES[ADDRESS]).toBeUndefined();
    expect(screenAddress(ADDRESS).flags).not.toContain(
      'direct match on the OFAC SDN list (Tier 1)',
    );
  });
});
