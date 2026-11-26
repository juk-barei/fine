import { describe, expect, it } from 'vitest';
import { walletTraceGraphSchema, type IntermediaryClass } from '@repo/contracts';
import {
  buildTraceGraph,
  TRACE_NODE_CAP,
} from '../../../../src/domain/trace/trace-graph.ts';
import { mockTraceNeighbourhood } from '../../../../src/modules/wallets/wallets.mock.ts';
import { screenAddress } from '../../../../src/domain/screening/screening.ts';
import { OFAC_TRON_ADDRESSES } from '../../../../src/domain/screening/ofac-seed.ts';

const ADDRESS = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';

/**
 * The composition the service performs: the adapter's neighbourhood in, the
 * domain policy's trace graph out.
 */
function traceGraph(request: {
  address: string;
  depth: number;
  minValueUsdt: number;
}) {
  return buildTraceGraph({
    address: request.address,
    depth: request.depth,
    minValueUsdt: request.minValueUsdt,
    ...mockTraceNeighbourhood(request.address, request.depth),
  });
}

describe('mockTraceNeighbourhood', () => {
  it('is deterministic for the same request', () => {
    expect(mockTraceNeighbourhood(ADDRESS, 3)).toEqual(
      mockTraceNeighbourhood(ADDRESS, 3),
    );
  });

  it('marks its payload as simulated', () => {
    expect(mockTraceNeighbourhood(ADDRESS, 1).simulated).toBe(true);
  });

  it('synthesizes flat transfers with unique hex txids, valid addresses and no self-transfers', () => {
    const { transfers } = mockTraceNeighbourhood(ADDRESS, 3);

    // One hop of four, then sixteen, then sixty-four.
    expect(transfers).toHaveLength(4 + 16 + 64);

    const txids = new Set<string>();
    for (const transfer of transfers) {
      expect(transfer.txHash).toMatch(/^[0-9a-f]{64}$/);
      txids.add(transfer.txHash);
      expect(transfer.from).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/);
      expect(transfer.to).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/);
      expect(transfer.from).not.toBe(transfer.to);
      expect(transfer.amountUsdt).toBeGreaterThanOrEqual(100);
      expect(transfer.amountUsdt).toBeLessThan(50_100);
      expect(Number.isNaN(Date.parse(transfer.timestamp))).toBe(false);
    }
    expect(txids.size).toBe(transfers.length);
  });

  it('profiles the subject and every counterparty through the same screener as the list', () => {
    const { transfers, profileOf } = mockTraceNeighbourhood(ADDRESS, 2);
    const addresses = new Set([
      ADDRESS,
      ...transfers.flatMap((transfer) => [transfer.from, transfer.to]),
    ]);

    for (const address of addresses) {
      const screening = screenAddress(address);
      const profile = profileOf(address);
      expect(profile.band).toBe(screening.band);
      expect(profile.pLaundering).toBe(screening.score);
      expect(profile.confidence).toBe(screening.confidence);
      expect(profile.kind === 'sanctioned').toBe(
        OFAC_TRON_ADDRESSES[address] === true,
      );
    }
  });

  it('gives every profile the six product rules', () => {
    const { transfers, profileOf } = mockTraceNeighbourhood(ADDRESS, 1);
    const addresses = new Set(
      transfers.flatMap((transfer) => [transfer.from, transfer.to]),
    );

    for (const address of addresses) {
      const { rules } = profileOf(address);
      expect(rules.map((rule) => rule.code)).toEqual([
        'R1',
        'R2',
        'R3',
        'R4',
        'R5',
        'R6',
      ]);
      for (const rule of rules) {
        expect(rule.summary.length).toBeGreaterThan(0);
        expect(typeof rule.triggered).toBe('boolean');
      }
    }
  });

  it('labels OFAC seed members with one Tier 1 row and leaves others unlabelled', () => {
    const { transfers, profileOf } = mockTraceNeighbourhood(ADDRESS, 1);
    const counterparties = new Set(
      transfers
        .flatMap((transfer) => [transfer.from, transfer.to])
        .filter((address) => address !== ADDRESS),
    );

    expect(profileOf(Object.keys(OFAC_TRON_ADDRESSES)[0]).labels).toEqual([
      { tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null },
    ]);
    for (const address of counterparties) {
      expect(profileOf(address).labels).toEqual(
        OFAC_TRON_ADDRESSES[address] === true
          ? [{ tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null }]
          : [],
      );
    }
  });

  it('gives roughly half the counterparties an intermediary class', () => {
    const { transfers, profileOf } = mockTraceNeighbourhood(ADDRESS, 5);
    const counterparties = [
      ...new Set(
        transfers
          .flatMap((transfer) => [transfer.from, transfer.to])
          .filter((address) => address !== ADDRESS),
      ),
    ];
    const classified = counterparties.filter(
      (address) => profileOf(address).intermediary !== null,
    );
    const classes = new Set(
      counterparties
        .map((address) => profileOf(address).intermediary)
        .filter((value): value is IntermediaryClass => value !== null),
    );

    expect(classified.length).toBeGreaterThan(0);
    expect(classified.length).toBeLessThan(counterparties.length);
    expect([...classes].every((value) =>
      ['pass_through', 'peel_chain', 'consolidation'].includes(value),
    )).toBe(true);
  });
});

describe('the composed trace graph (adapter + policy)', () => {
  it('parses against the trace graph contract', () => {
    const graph = traceGraph({ address: ADDRESS, depth: 3, minValueUsdt: 0 });

    expect(walletTraceGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('lays the neighbourhood out across hops up to the requested depth', () => {
    const graph = traceGraph({ address: ADDRESS, depth: 4, minValueUsdt: 0 });

    expect(Math.max(...graph.nodes.map((node) => node.hop))).toBe(4);
    expect(Math.max(...graph.edges.map((edge) => edge.hop))).toBe(4);
    expect(
      new Set(
        graph.nodes.filter((node) => !node.subject).map((node) => node.hop),
      ),
    ).toEqual(new Set([1, 2, 3, 4]));
    expect(graph.nodes.length).toBeGreaterThan(1 + 4 * 2);
  });

  it('sizes the neighbourhood so depth four fits the cap and depth five trips it', () => {
    const four = traceGraph({ address: ADDRESS, depth: 4, minValueUsdt: 0 });

    expect(four.nodes.length).toBeLessThanOrEqual(TRACE_NODE_CAP);
    expect(four.disclosure).toMatchObject({
      depthRequested: 4,
      nodesReturned: four.nodes.length,
      nodeCap: TRACE_NODE_CAP,
      truncated: false,
      coverage: 'complete',
      reason: null,
    });
    expect(four.disclosure.loadedTransfers).toBe(four.edges.length);
    expect(four.disclosure.reportedTransfers).toBe(four.edges.length);

    const five = traceGraph({ address: ADDRESS, depth: 5, minValueUsdt: 0 });

    expect(five.nodes.length).toBeLessThanOrEqual(TRACE_NODE_CAP);
    expect(five.disclosure).toMatchObject({
      depthRequested: 5,
      nodesReturned: five.nodes.length,
      nodeCap: TRACE_NODE_CAP,
      truncated: true,
      coverage: 'partial',
    });
    const reason = five.disclosure.reason;
    expect(reason?.code).toBe('node_cap_reached');
    expect(reason?.params.nodeCap).toBe(TRACE_NODE_CAP);
    expect(reason?.params.nodesKept).toBe(five.disclosure.nodesReturned);
    expect(reason?.params.nodesScoped).toBeGreaterThan(
      reason?.params.nodesKept ?? 0,
    );
    expect(five.disclosure.loadedTransfers).toBe(five.edges.length);
    expect(five.disclosure.loadedTransfers).toBeLessThan(
      five.disclosure.reportedTransfers,
    );
    expect(walletTraceGraphSchema.safeParse(five).success).toBe(true);
  });

  it('returns an identical payload for repeated identical capped requests', () => {
    const request = { address: ADDRESS, depth: 5, minValueUsdt: 0 };

    expect(traceGraph(request)).toEqual(traceGraph(request));
    expect(traceGraph(request).disclosure.truncated).toBe(true);
  });
});
