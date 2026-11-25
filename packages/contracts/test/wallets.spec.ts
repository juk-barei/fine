import { describe, expect, it } from 'vitest';

import {
  walletDetailSchema,
  walletListInputSchema,
  walletListItemSchema,
  walletPageSchema,
  walletScreeningSchema,
  traceDisclosureSchema,
  walletGraphInputSchema,
  walletTraceGraphSchema,
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

  it('parses a detail and a screening without a graph', () => {
    expect(
      walletDetailSchema.safeParse({ wallet, flags: [], simulated: true }).success,
    ).toBe(true);
    expect(
      walletScreeningSchema.safeParse({ wallet, flags: [], simulated: true }).success,
    ).toBe(true);
  });

  it('drops a graph that an old payload still carries', () => {
    const parsed = walletDetailSchema.parse({
      wallet,
      flags: [],
      simulated: true,
      graph: { nodes: [], edges: [] },
    });

    expect('graph' in parsed).toBe(false);
  });
});

const RULES = [
  ['R1', 'Direct exposure to a sanctioned address'],
  ['R2', 'Pass-through behaviour: funds in and out within hours'],
  ['R3', 'Fan-out to many recipients'],
  ['R4', 'Round-number transfers'],
  ['R5', 'Zero-balance relay wallet'],
  ['R6', 'Bursty transfer timing'],
] as const;

function rules() {
  return RULES.map(([code, summary]) => ({
    code,
    triggered: false,
    summary,
  }));
}

function node(overrides: Record<string, unknown> = {}): any {
  return {
    address: SCORED,
    hop: 0,
    kind: 'subject',
    title: 'TLa2f6\u2026YjU7',
    badge: null,
    band: 'high',
    pLaundering: 0.82,
    confidence: 'high',
    volumeUsdt: 1250,
    intermediary: null,
    labels: [],
    rules: rules(),
    subject: true,
    ...overrides,
  };
}

function disclosure(overrides: Record<string, unknown> = {}): any {
  return {
    depthRequested: 2,
    depthReached: 1,
    minValueUsdt: 0,
    nodesReturned: 2,
    nodeCap: 500,
    truncated: false,
    coverage: 'complete',
    loadedTransfers: 1,
    reportedTransfers: 1,
    reason: null,
    ...overrides,
  };
}

function graph(overrides: Record<string, unknown> = {}): any {
  const nodes = [
    node(),
    node({
      address: BARE,
      hop: 1,
      kind: 'counterparty',
      subject: false,
      title: 'TYASr5\u2026xHLS',
      band: 'low',
      pLaundering: 0.12,
      confidence: 'low',
      intermediary: 'pass_through',
      labels: [
        { tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null },
      ],
    }),
  ];
  const edges = [
    {
      id: 'edge-1',
      from: SCORED,
      to: BARE,
      amountUsdt: 1250,
      txHash: 'a'.repeat(64),
      timestamp: '2026-11-11T13:27:15.701Z',
      hop: 1,
      direction: 'outbound',
    },
  ];

  return { simulated: true, nodes, edges, disclosure: disclosure(), ...overrides };
}

describe('wallet trace graph contract', () => {
  it('parses a valid multi-hop graph', () => {
    expect(walletTraceGraphSchema.safeParse(graph()).success).toBe(true);
  });

  it('parses a graph with no transfers, keeping the subject', () => {
    const payload = graph({ edges: [] });
    payload.disclosure = disclosure({ loadedTransfers: 0, reportedTransfers: 0 });

    expect(walletTraceGraphSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown node kind', () => {
    const payload = graph();
    payload.nodes[1] = node({ address: BARE, kind: 'smart-contract', subject: false });

    expect(walletTraceGraphSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a payload with no disclosure block', () => {
    const payload = graph();
    delete payload.disclosure;

    expect(walletTraceGraphSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects partial coverage without a reason', () => {
    expect(
      traceDisclosureSchema.safeParse(disclosure({ coverage: 'partial' })).success,
    ).toBe(false);
    expect(
      traceDisclosureSchema.safeParse(
        disclosure({ coverage: 'partial', reason: 'index stopped short' }),
      ).success,
    ).toBe(true);
  });

  it('rejects a truncated graph that reports itself complete', () => {
    expect(
      traceDisclosureSchema.safeParse(disclosure({ truncated: true })).success,
    ).toBe(false);
    expect(
      traceDisclosureSchema.safeParse(
        disclosure({ truncated: true, coverage: 'partial', reason: 'node cap' }),
      ).success,
    ).toBe(true);
  });

  it('rejects a depth reached beyond the depth requested and an overflowing cap', () => {
    expect(
      traceDisclosureSchema.safeParse(disclosure({ depthReached: 3 })).success,
    ).toBe(false);
    expect(
      traceDisclosureSchema.safeParse(
        disclosure({ nodesReturned: 501, nodeCap: 500 }),
      ).success,
    ).toBe(false);
  });

  it('requires exactly one subject at hop 0 with kind "subject"', () => {
    const none = graph();
    none.nodes[0] = node({ subject: false, kind: 'counterparty' });
    expect(walletTraceGraphSchema.safeParse(none).success).toBe(false);

    const both = graph();
    both.nodes[1] = node({ address: BARE, subject: true, kind: 'subject', hop: 0 });
    expect(walletTraceGraphSchema.safeParse(both).success).toBe(false);

    const wrongKind = graph();
    wrongKind.nodes[0] = node({ kind: 'counterparty' });
    expect(walletTraceGraphSchema.safeParse(wrongKind).success).toBe(false);
  });

  it('rejects an edge that points at a node the payload does not contain', () => {
    const payload = graph();
    payload.edges[0] = { ...payload.edges[0], to: 'TW5tokvhEfrb77z98Rc8HqbkzQJ6sxYtGX' };

    expect(walletTraceGraphSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects duplicated node addresses and a mismatched node count', () => {
    const duplicate = graph();
    duplicate.nodes[1] = node({ address: SCORED, subject: false, hop: 1 });
    expect(walletTraceGraphSchema.safeParse(duplicate).success).toBe(false);

    const mismatched = graph();
    mismatched.disclosure = disclosure({ nodesReturned: 9 });
    expect(walletTraceGraphSchema.safeParse(mismatched).success).toBe(false);
  });

  it('rejects a rule code outside R1-R6', () => {
    const payload = graph();
    payload.nodes[0] = node({
      rules: [{ code: 'FR-3.1', triggered: true, summary: 'invented' }],
    });

    expect(walletTraceGraphSchema.safeParse(payload).success).toBe(false);
  });
});

describe('wallet graph input', () => {
  it('defaults depth to 5 and minimum value to 0', () => {
    expect(walletGraphInputSchema.parse({ address: SCORED })).toEqual({
      address: SCORED,
      depth: 5,
      minValueUsdt: 0,
    });
  });

  it('accepts an explicit depth and minimum value', () => {
    expect(
      walletGraphInputSchema.parse({
        address: SCORED,
        depth: 2,
        minValueUsdt: 100,
      }),
    ).toMatchObject({ depth: 2, minValueUsdt: 100 });
  });

  it('rejects a depth outside 1..5 and a negative minimum value', () => {
    expect(walletGraphInputSchema.safeParse({ address: SCORED, depth: 0 }).success).toBe(false);
    expect(walletGraphInputSchema.safeParse({ address: SCORED, depth: 6 }).success).toBe(false);
    expect(
      walletGraphInputSchema.safeParse({ address: SCORED, minValueUsdt: -1 }).success,
    ).toBe(false);
  });
});
