import { describe, expect, it } from 'vitest';
import { walletTraceGraphSchema } from '@repo/contracts';
import {
  buildTraceGraph,
  TRACE_NODE_CAP,
  type TraceGraphInput,
  type TraceNodeProfile,
  type TraceTransfer,
} from '../../../../src/domain/trace/trace-graph.ts';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** A valid Tron-shaped address, unique to its seed. */
function addressOf(seed: string): string {
  const tail = Array.from(
    { length: 33 },
    (_, index) =>
      ALPHABET[(seed.charCodeAt(index % seed.length) + index) % ALPHABET.length],
  ).join('');
  return `T${tail}`;
}

const SUBJECT = addressOf('subject');
const a = addressOf('aaaa');
const b = addressOf('bbbb');
const c = addressOf('cccc');
const d = addressOf('dddd');

const DEFAULT_PROFILE: TraceNodeProfile = {
  kind: 'unknown',
  title: null,
  badge: null,
  band: null,
  pLaundering: null,
  confidence: null,
  intermediary: null,
  labels: [],
  rules: [],
};

/** A total `profileOf` with per-address overrides; unknowns get the default. */
function profileOfWith(
  overrides: Record<string, Partial<TraceNodeProfile>> = {},
): (address: string) => TraceNodeProfile {
  return (address) => ({ ...DEFAULT_PROFILE, ...overrides[address] });
}

let hashCounter = 0;
function transfer(from: string, to: string, amountUsdt: number): TraceTransfer {
  hashCounter += 1;
  return {
    txHash: hashCounter.toString(16).padStart(64, '0'),
    from,
    to,
    amountUsdt,
    timestamp: '2026-10-01T00:00:00.000Z',
  };
}

type Fixture = Omit<TraceGraphInput, 'transfers' | 'profileOf'> & {
  transfers: readonly TraceTransfer[];
  profileOf?: (address: string) => TraceNodeProfile;
};

function buildTraceGraphWith({
  profileOf = profileOfWith(),
  ...request
}: Fixture) {
  return buildTraceGraph({ ...request, profileOf });
}

describe('buildTraceGraph', () => {
  it('returns the opened wallet as the single hop-0 subject, whatever its volume', () => {
    const empty = buildTraceGraphWith({
      address: SUBJECT,
      depth: 3,
      minValueUsdt: 0,
      simulated: true,
      transfers: [],
    });

    expect(empty.nodes).toHaveLength(1);
    expect(empty.nodes[0]).toMatchObject({
      address: SUBJECT,
      hop: 0,
      kind: 'subject',
      intermediary: null,
      volumeUsdt: 0,
      subject: true,
    });
    expect(empty.disclosure).toMatchObject({
      depthReached: 0,
      nodesReturned: 1,
      truncated: false,
      coverage: 'complete',
      reason: null,
    });
  });

  it('forces the subject node to kind "subject" and never an intermediary, but keeps its profile', () => {
    const profileOf = profileOfWith({
      [SUBJECT]: {
        kind: 'mixer',
        band: 'high',
        pLaundering: 0.9,
        confidence: 'high',
        intermediary: 'peel_chain',
        labels: [{ tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null }],
        rules: [{ code: 'R1', summary: 'Direct exposure', triggered: true }],
      },
    });

    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 1,
      minValueUsdt: 0,
      simulated: true,
      transfers: [transfer(SUBJECT, a, 100)],
      profileOf,
    });

    const subject = graph.nodes.find((node) => node.subject);
    expect(subject).toMatchObject({
      kind: 'subject',
      intermediary: null,
      band: 'high',
      pLaundering: 0.9,
      confidence: 'high',
      labels: [{ tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null }],
      rules: [{ code: 'R1', summary: 'Direct exposure', triggered: true }],
    });
    // The counterparty keeps whatever kind the adapter gave it.
    expect(graph.nodes.find((node) => node.address === a)).toMatchObject({
      kind: 'unknown',
      intermediary: null,
    });
  });

  it('places the adapter profile verbatim and the simulated flag as adapter truth', () => {
    const profileOf = profileOfWith({
      [a]: {
        kind: 'exchange',
        title: 'a title',
        badge: 'a badge',
        band: 'moderate',
        pLaundering: 0.42,
        confidence: 'medium',
        intermediary: 'consolidation',
        labels: [{ tier: 'tier_2', source: 'Tether blacklist', listedAt: null }],
        rules: [{ code: 'R3', summary: 'Fan-out', triggered: false }],
      },
    });

    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 1,
      minValueUsdt: 0,
      simulated: false,
      transfers: [transfer(SUBJECT, a, 100)],
      profileOf,
    });

    expect(graph.simulated).toBe(false);
    expect(graph.nodes.find((node) => node.address === a)).toMatchObject({
      kind: 'exchange',
      title: 'a title',
      badge: 'a badge',
      band: 'moderate',
      pLaundering: 0.42,
      confidence: 'medium',
      intermediary: 'consolidation',
      labels: [{ tier: 'tier_2', source: 'Tether blacklist', listedAt: null }],
      rules: [{ code: 'R3', summary: 'Fan-out', triggered: false }],
    });
  });

  it('derives every hop from the subject by BFS and echoes it on the edge', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
      simulated: true,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(a, b, 200),
        transfer(b, c, 300),
      ],
    });

    expect(graph.nodes.map((node) => [node.address, node.hop])).toEqual([
      [SUBJECT, 0],
      [b, 2],
      [a, 1],
      [c, 3],
    ]);
    expect(graph.edges.map((edge) => [edge.from, edge.to, edge.hop])).toEqual([
      [SUBJECT, a, 1],
      [a, b, 2],
      [b, c, 3],
    ]);
  });

  it('derives direction from the subject: away is outbound, back toward it is inbound', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
      simulated: true,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(a, SUBJECT, 150),
        transfer(a, b, 200),
        transfer(b, a, 250),
      ],
    });

    const directionOf = (from: string, to: string) =>
      graph.edges.find((edge) => edge.from === from && edge.to === to)
        ?.direction;

    expect(directionOf(SUBJECT, a)).toBe('outbound');
    expect(directionOf(a, SUBJECT)).toBe('inbound');
    expect(directionOf(a, b)).toBe('outbound');
    expect(directionOf(b, a)).toBe('inbound');
  });

  it('pins a lateral edge to its endpoints’ hop and calls it outbound', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
      simulated: true,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(SUBJECT, b, 100),
        transfer(a, b, 100),
      ],
    });

    expect(graph.nodes.find((node) => node.address === a)?.hop).toBe(1);
    expect(graph.nodes.find((node) => node.address === b)?.hop).toBe(1);
    expect(graph.edges.find((edge) => edge.from === a && edge.to === b)).toEqual(
      expect.objectContaining({ hop: 1, direction: 'outbound' }),
    );
  });

  it('drops self-transfers and repeated txids from overlapping pages', () => {
    const self = transfer(a, a, 999);
    const first = transfer(SUBJECT, a, 100);
    const repeated: TraceTransfer = { ...first, to: b };

    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
      simulated: true,
      transfers: [self, first, repeated],
    });

    expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(
      graph.edges.length,
    );
    expect(graph.edges).toHaveLength(1);
    expect(new Set(graph.nodes.map((node) => node.address))).toEqual(
      new Set([SUBJECT, a]),
    );
    // The duplicate never doubled anyone's volume.
    expect(graph.nodes.find((node) => node.address === a)?.volumeUsdt).toBe(100);
  });

  it('follows a cycle back toward the subject and stays connected and honest', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
      simulated: true,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(a, b, 200),
        transfer(b, c, 300),
        transfer(c, a, 50),
      ],
    });

    // The BFS hops are minimal: `c` sits at hop 2 whether it is reached
    // through `b` or through its back-edge to `a`.
    expect(new Set(graph.nodes.map((node) => node.address))).toEqual(
      new Set([SUBJECT, a, b, c]),
    );
    expect(graph.nodes.find((node) => node.address === c)?.hop).toBe(2);
    expect(graph.edges).toHaveLength(4);
    expect(graph.disclosure).toMatchObject({
      depthReached: 2,
      nodesReturned: 4,
      truncated: false,
      coverage: 'complete',
      reason: null,
    });
    expect(walletTraceGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('drops a transfer below the minimum and the island it would have connected', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 50,
      simulated: true,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(a, b, 5),
        transfer(SUBJECT, c, 200),
      ],
    });

    expect(graph.edges.every((edge) => edge.amountUsdt >= 50)).toBe(true);
    expect(new Set(graph.nodes.map((node) => node.address))).toEqual(
      new Set([SUBJECT, a, c]),
    );
    const touched = new Set(graph.edges.flatMap((edge) => [edge.from, edge.to]));
    for (const node of graph.nodes) {
      if (!node.subject) expect(touched.has(node.address)).toBe(true);
    }
  });

  it('never reaches past the requested depth', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 2,
      minValueUsdt: 0,
      simulated: true,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(a, b, 200),
        transfer(b, c, 300),
        transfer(c, d, 400),
      ],
    });

    expect(new Set(graph.nodes.map((node) => node.address))).toEqual(
      new Set([SUBJECT, a, b]),
    );
    expect(graph.nodes.every((node) => node.hop <= 2)).toBe(true);
    expect(graph.edges.every((edge) => edge.hop <= 2)).toBe(true);
    expect(graph.disclosure).toMatchObject({
      depthRequested: 2,
      depthReached: 2,
    });
  });

  it('aggregates every in-scope incident transfer into the node volume', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
      simulated: true,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(a, b, 250),
      ],
    });

    expect(graph.nodes.find((node) => node.address === SUBJECT)?.volumeUsdt).toBe(100);
    expect(graph.nodes.find((node) => node.address === a)?.volumeUsdt).toBe(350);
    expect(graph.nodes.find((node) => node.address === b)?.volumeUsdt).toBe(250);
  });

  it('lists counterparties in cap priority order: volume, then hop, then address', () => {
    const b1 = addressOf('b1');
    const b2 = addressOf('b2');
    const a0 = addressOf('a0');
    const a1 = addressOf('a1');
    const c2 = addressOf('c2');

    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
      simulated: true,
      transfers: [
        transfer(SUBJECT, b1, 400),
        transfer(SUBJECT, b2, 300),
        transfer(b2, c2, 300),
        transfer(SUBJECT, a1, 300),
        transfer(SUBJECT, a0, 300),
      ],
    });

    expect(graph.nodes.map((node) => node.address)).toEqual([
      SUBJECT,
      b2, // 600: 300 in, 300 out
      b1, // 400
      a0, // 300 at hop 1, before a1 by address
      a1, // 300 at hop 1
      c2, // 300 at hop 2, after the hop-1 ties
    ]);
  });

  it('fills the cap with the highest-value nodes and reports the structured reason', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 1,
      minValueUsdt: 0,
      simulated: true,
      nodeCap: 3,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(SUBJECT, b, 200),
        transfer(SUBJECT, c, 300),
        transfer(SUBJECT, d, 400),
      ],
    });

    expect(graph.nodes.map((node) => node.address)).toEqual([SUBJECT, d, c]);
    expect(graph.disclosure).toMatchObject({
      nodeCap: 3,
      nodesReturned: 3,
      truncated: true,
      coverage: 'partial',
      loadedTransfers: 2,
      reportedTransfers: 4,
    });
    expect(graph.disclosure.reason).toEqual({
      code: 'node_cap_reached',
      params: { nodeCap: 3, nodesKept: 3, nodesScoped: 5 },
    });
    expect(walletTraceGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('filters by minimum value before the cap, so a cheap node cannot squat in it', () => {
    const rich = addressOf('rich');
    const poor = addressOf('poor');
    const poorerStill = addressOf('poorer');

    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 500,
      simulated: true,
      nodeCap: 2,
      transfers: [
        transfer(SUBJECT, poor, 300),
        transfer(poor, poorerStill, 300),
        transfer(SUBJECT, rich, 500),
      ],
    });

    // `poor` out-ranks `rich` before the filter (600 against 500), so had
    // the cap run first it would have taken the slot. Filtered first, its
    // transfers are gone and it never enters the ranking.
    expect(graph.nodes.map((node) => node.address)).toEqual([SUBJECT, rich]);
    expect(graph.edges.every((edge) => edge.amountUsdt >= 500)).toBe(true);
    expect(graph.disclosure).toMatchObject({
      truncated: false,
      coverage: 'complete',
      reason: null,
    });
  });

  it('drops nodes the cap stranded when it evicted their parent', () => {
    const rich = addressOf('rich');
    const parent = addressOf('parent');
    const child = addressOf('child');
    const orphan = addressOf('orphan');

    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
      simulated: true,
      nodeCap: 3,
      transfers: [
        transfer(SUBJECT, rich, 1_001),
        transfer(SUBJECT, parent, 100),
        transfer(parent, child, 900),
        transfer(child, orphan, 500),
      ],
    });

    // Volumes: child 1,400, rich 1,001, parent 1,000, orphan 500. The cap
    // keeps `child` and `rich` and evicts `parent`, so every edge the child
    // kept leads to an evicted node and the second reachability pass drops
    // it with those edges.
    expect(graph.nodes.map((node) => node.address)).toEqual([SUBJECT, rich]);
    expect(graph.edges.map((edge) => [edge.from, edge.to])).toEqual([
      [SUBJECT, rich],
    ]);
    expect(graph.disclosure).toMatchObject({
      truncated: true,
      nodesReturned: 2,
    });
    expect(graph.disclosure.reason?.params).toMatchObject({
      nodesKept: 2,
      nodesScoped: 5,
    });
    expect(walletTraceGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('reports the disclosure honestly, with the product cap as the default', () => {
    const graph = buildTraceGraphWith({
      address: SUBJECT,
      depth: 3,
      minValueUsdt: 10,
      simulated: true,
      transfers: [transfer(SUBJECT, a, 100)],
    });

    expect(graph.disclosure).toEqual({
      depthRequested: 3,
      depthReached: 1,
      minValueUsdt: 10,
      nodesReturned: 2,
      nodeCap: TRACE_NODE_CAP,
      truncated: false,
      coverage: 'complete',
      loadedTransfers: 1,
      reportedTransfers: 1,
      reason: null,
    });
  });

  it('asks the adapter only for the profiles of the nodes it returns', () => {
    const evicted = addressOf('evicted');
    const seen: string[] = [];
    const profileOf = (address: string): TraceNodeProfile => {
      if (address === evicted) throw new Error('profileOf must stay lazy');
      seen.push(address);
      return { ...DEFAULT_PROFILE };
    };

    const graph = buildTraceGraph({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 50,
      simulated: true,
      transfers: [
        transfer(SUBJECT, a, 100),
        transfer(a, evicted, 5),
      ],
      profileOf,
    });

    expect(new Set(graph.nodes.map((node) => node.address))).toEqual(
      new Set([SUBJECT, a]),
    );
    expect(new Set(seen)).toEqual(new Set([SUBJECT, a]));
  });
});
