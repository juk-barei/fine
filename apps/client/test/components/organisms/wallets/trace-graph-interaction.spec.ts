import { describe, expect, it } from 'vitest';
import type { TraceEdge, TraceNode, WalletTraceGraph } from '@repo/contracts';
import {
  edgeSentence,
  neighbourSet,
  nodeSentence,
  selectionAnnouncement,
  settleSelection,
  traceDimming,
} from '@/components/organisms/wallets/trace-graph/trace-graph-interaction';

const SUBJECT = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
const HOP_ONE = 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS';
const HOP_ONE_LOW = 'TW5tokvhEfrb77z98Rc8HqbkzQJ6sxYtGX';
const HOP_TWO = 'TZ42sU5kQ2n5rLZ6PhEGkmfLtmHjoi2vpr';

const RULES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((code) => ({
  code,
  triggered: false,
  summary: `${code} summary`,
}));

function node(
  overrides: Partial<TraceNode> & Pick<TraceNode, 'address' | 'hop' | 'subject'>,
): TraceNode {
  return {
    kind: overrides.subject ? 'subject' : 'counterparty',
    title: `${overrides.address.slice(0, 6)}…${overrides.address.slice(-4)}`,
    badge: null,
    band: 'low',
    pLaundering: 0.1,
    confidence: 'low',
    volumeUsdt: 1_000,
    intermediary: null,
    labels: [],
    rules: RULES,
    ...overrides,
  };
}

const nodes: TraceNode[] = [
  node({ address: SUBJECT, hop: 0, subject: true, band: 'high' }),
  node({
    address: HOP_ONE,
    hop: 1,
    subject: false,
    band: 'high',
    labels: [
      {
        tier: 'tier_1',
        source: 'OFAC SDN (simulated)',
        listedAt: '2026-09-09T00:00:00.000Z',
      },
    ],
  }),
  node({ address: HOP_ONE_LOW, hop: 1, subject: false }),
  node({ address: HOP_TWO, hop: 2, subject: false, band: null }),
];

const edges: TraceEdge[] = [
  {
    id: 'edge-1',
    from: SUBJECT,
    to: HOP_ONE,
    amountUsdt: 1_250,
    txHash: 'a'.repeat(64),
    timestamp: '2026-11-11T13:27:15.701Z',
    hop: 1,
    direction: 'outbound',
  },
  {
    id: 'edge-2',
    from: HOP_ONE,
    to: HOP_TWO,
    amountUsdt: 9_000,
    txHash: 'b'.repeat(64),
    timestamp: '2026-11-12T08:10:00.000Z',
    hop: 2,
    direction: 'outbound',
  },
  {
    id: 'edge-3',
    from: HOP_ONE_LOW,
    to: SUBJECT,
    amountUsdt: 500,
    txHash: 'c'.repeat(64),
    timestamp: '2026-11-13T02:00:00.000Z',
    hop: 1,
    direction: 'inbound',
  },
];

const graph: WalletTraceGraph = {
  simulated: true,
  nodes,
  edges,
  disclosure: {
    depthRequested: 2,
    depthReached: 2,
    minValueUsdt: 0,
    nodesReturned: 4,
    nodeCap: 500,
    truncated: false,
    coverage: 'complete',
    loadedTransfers: 3,
    reportedTransfers: 3,
    reason: null,
  },
};

describe('neighbourSet', () => {
  it('collects the addresses one hop away over both edge directions', () => {
    // edge-1 out of and edge-2 out of HOP_ONE; edge-3 only touches SUBJECT.
    expect([...neighbourSet(graph, HOP_ONE)].sort()).toEqual(
      [SUBJECT, HOP_TWO].sort(),
    );
    // SUBJECT is the `to` of the inbound edge-3 and the `from` of edge-1.
    expect([...neighbourSet(graph, SUBJECT)].sort()).toEqual(
      [HOP_ONE, HOP_ONE_LOW].sort(),
    );
    expect([...neighbourSet(graph, HOP_ONE_LOW)]).toEqual([SUBJECT]);
  });

  it('is empty when nothing is hovered', () => {
    expect(neighbourSet(graph, null).size).toBe(0);
  });
});

describe('traceDimming', () => {
  it('keeps the hovered node, its neighbours and their edges bright', () => {
    const dimming = traceDimming(graph, HOP_ONE);

    expect(dimming.active).toBe(true);
    expect(dimming.isNodeDimmed(HOP_ONE)).toBe(false);
    expect(dimming.isNodeDimmed(SUBJECT)).toBe(false);
    expect(dimming.isNodeDimmed(HOP_TWO)).toBe(false);
    expect(dimming.isNodeDimmed(HOP_ONE_LOW)).toBe(true);

    expect(dimming.isEdgeDimmed(edges[0])).toBe(false);
    expect(dimming.isEdgeDimmed(edges[1])).toBe(false);
    expect(dimming.isEdgeDimmed(edges[2])).toBe(true);
  });

  it('dims nothing while no node is hovered', () => {
    const dimming = traceDimming(graph, null);

    expect(dimming.active).toBe(false);
    for (const node of nodes) {
      expect(dimming.isNodeDimmed(node.address)).toBe(false);
    }
    for (const edge of edges) {
      expect(dimming.isEdgeDimmed(edge)).toBe(false);
    }
  });

  it('treats a hovered address that left the payload as no hover', () => {
    // The stale-hover case: a hover can outlive a re-query that dropped the
    // node, and it must not dim the whole graph.
    const dimming = traceDimming(graph, 'TVanishedFromThePayload42');

    expect(dimming.active).toBe(false);
    for (const node of nodes) {
      expect(dimming.isNodeDimmed(node.address)).toBe(false);
    }
    for (const edge of edges) {
      expect(dimming.isEdgeDimmed(edge)).toBe(false);
    }
  });
});

describe('settleSelection', () => {
  it('keeps a selection whose node is still in the payload', () => {
    expect(settleSelection(graph, { kind: 'node', address: HOP_TWO })).toEqual({
      kind: 'node',
      address: HOP_TWO,
    });
  });

  it('keeps a selection whose transfer is still in the payload', () => {
    expect(settleSelection(graph, { kind: 'edge', id: 'edge-3' })).toEqual({
      kind: 'edge',
      id: 'edge-3',
    });
  });

  it('falls back to the subject when the selection left the payload', () => {
    const shrunk: WalletTraceGraph = {
      ...graph,
      nodes: nodes.filter((candidate) => candidate.address !== HOP_TWO),
      edges: edges.filter((edge) => edge.hop < 2),
    };

    expect(settleSelection(shrunk, { kind: 'node', address: HOP_TWO })).toEqual(
      { kind: 'node', address: SUBJECT },
    );
    expect(settleSelection(shrunk, { kind: 'edge', id: 'edge-2' })).toEqual({
      kind: 'node',
      address: SUBJECT,
    });
  });

  it('settles for the first subject when a payload carries several', () => {
    const several: WalletTraceGraph = {
      ...graph,
      nodes: [
        { ...nodes[1], subject: true },
        nodes[3],
        nodes[0],
      ],
    };

    expect(settleSelection(several, { kind: 'edge', id: 'edge-gone' })).toEqual(
      { kind: 'node', address: HOP_ONE },
    );
  });

  it('settles for nothing when the payload carries no subject either', () => {
    const subjectless: WalletTraceGraph = {
      ...graph,
      nodes: nodes.map((candidate) => ({ ...candidate, subject: false })),
    };

    expect(
      settleSelection(subjectless, { kind: 'node', address: HOP_TWO }),
    ).toBe(null);
  });

  it('settles for nothing while the graph is undefined', () => {
    expect(settleSelection(undefined, { kind: 'edge', id: 'edge-1' })).toBe(
      null,
    );
  });

  it('settles for nothing when there is no selection', () => {
    expect(settleSelection(graph, null)).toBe(null);
  });
});

describe('nodeSentence', () => {
  it('states address, hop, band and the first label tier', () => {
    expect(nodeSentence(nodes[1], 'en')).toBe(
      `Node ${HOP_ONE}, Hop 1, Band High, Tier 1`,
    );
  });

  it('states the band as low for a scored node without a label', () => {
    expect(nodeSentence(nodes[2], 'en')).toBe(
      `Node ${HOP_ONE_LOW}, Hop 1, Band Low`,
    );
  });

  it('calls a node without a band unscored, never low', () => {
    expect(nodeSentence(nodes[3], 'en')).toBe(
      `Node ${HOP_TWO}, Hop 2, Band Unscored`,
    );
  });

  it('marks the subject', () => {
    expect(nodeSentence(nodes[0], 'en')).toBe(
      `Node ${SUBJECT}, Hop 0, Band High, subject`,
    );
  });

  it('reads the Khmer dictionary', () => {
    expect(nodeSentence(nodes[1], 'km')).toBe(
      `Node ${HOP_ONE}, Hop 1, Band High, Tier 1`,
    );
  });
});

describe('edgeSentence', () => {
  it('states amount, endpoints, hop and the outbound direction', () => {
    expect(edgeSentence(edges[0], 'en')).toBe(
      `Transfer of 1,250 USDT, From ${SUBJECT}, To ${HOP_ONE}, Hop 1, Outbound`,
    );
  });

  it('states the inbound direction for an inbound transfer', () => {
    expect(edgeSentence(edges[2], 'en')).toBe(
      `Transfer of 500 USDT, From ${HOP_ONE_LOW}, To ${SUBJECT}, Hop 1, Inbound`,
    );
  });

  it('reads the Khmer dictionary', () => {
    expect(edgeSentence(edges[0], 'km')).toBe(
      `Transfer of 1,250 USDT, From ${SUBJECT}, To ${HOP_ONE}, Hop 1, Outbound`,
    );
  });
});

describe('selectionAnnouncement', () => {
  it('reads out the node sentence and the opened details', () => {
    expect(
      selectionAnnouncement(graph, { kind: 'node', address: HOP_TWO }, 'en'),
    ).toBe(`Node ${HOP_TWO}, Hop 2, Band Unscored. Selection details opened.`);
  });

  it('reads out the transfer sentence and the opened details', () => {
    expect(
      selectionAnnouncement(graph, { kind: 'edge', id: 'edge-2' }, 'en'),
    ).toBe(
      `Transfer of 9,000 USDT, From ${HOP_ONE}, To ${HOP_TWO}, Hop 2, Outbound. Selection details opened.`,
    );
  });

  it('stays silent without a selection', () => {
    expect(selectionAnnouncement(graph, null, 'en')).toBe('');
  });

  it('stays silent when the selection is no longer in the payload', () => {
    const shrunk: WalletTraceGraph = {
      ...graph,
      nodes: nodes.filter((candidate) => candidate.address !== HOP_TWO),
      edges: edges.filter((edge) => edge.hop < 2),
    };

    expect(
      selectionAnnouncement(shrunk, { kind: 'node', address: HOP_TWO }, 'en'),
    ).toBe('');
  });
});
