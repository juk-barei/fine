import { describe, expect, it } from 'vitest';
import type { TraceNode } from '@repo/contracts';
import { layoutTraceGraph } from '@/components/organisms/wallets/trace-graph/trace-graph-layout';

const SUBJECT = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
const HIGH_VOLUME = 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS';
const LOW_VOLUME_A = 'TW5tokvhEfrb77z98Rc8HqbkzQJ6sxYtGX';
const LOW_VOLUME_B = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU8';

const RULES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((code) => ({
  code,
  triggered: false,
  summary: `${code} summary`,
}));

function node(overrides: Partial<TraceNode> & Pick<TraceNode, 'address' | 'hop' | 'subject'>): TraceNode {
  return {
    kind: overrides.subject ? 'subject' : 'counterparty',
    title: overrides.address.slice(0, 6),
    badge: null,
    band: 'low',
    pLaundering: 0.1,
    confidence: 'low',
    volumeUsdt: 0,
    intermediary: null,
    labels: [],
    rules: RULES,
    ...overrides,
  };
}

const nodes = [
  node({ address: SUBJECT, hop: 0, subject: true, volumeUsdt: 10_250 }),
  node({ address: HIGH_VOLUME, hop: 1, subject: false, volumeUsdt: 4_000 }),
  node({ address: LOW_VOLUME_A, hop: 1, subject: false, volumeUsdt: 500 }),
  node({ address: LOW_VOLUME_B, hop: 1, subject: false, volumeUsdt: 500 }),
  node({ address: 'TZ42sU5kQ2n5rLZ6PhEGkmfLtmHjoi2vpr', hop: 2, subject: false, volumeUsdt: 9_000 }),
];

describe('layoutTraceGraph', () => {
  it('is deterministic and independent of the order nodes arrive in', () => {
    const first = layoutTraceGraph(nodes);

    expect(layoutTraceGraph(nodes)).toEqual(first);
    expect(layoutTraceGraph([...nodes].reverse())).toEqual(first);
  });

  it('places each node in the column for its hop', () => {
    const layout = layoutTraceGraph(nodes);
    const xByHop = new Map<number, number>();

    for (const node of layout.nodes) {
      const x = xByHop.get(node.hop);
      if (x === undefined) xByHop.set(node.hop, node.x);
      else expect(node.x).toBe(x);
    }

    expect(xByHop.get(0)).toBeLessThan(xByHop.get(1) as number);
    expect(xByHop.get(1)).toBeLessThan(xByHop.get(2) as number);
  });

  it('orders within a column by volume then address', () => {
    const layout = layoutTraceGraph(nodes);
    const hopOne = layout.nodes.filter((node) => node.hop === 1);

    expect(hopOne.map((node) => node.address)).toEqual([
      HIGH_VOLUME,
      LOW_VOLUME_A.toLowerCase() < LOW_VOLUME_B.toLowerCase()
        ? LOW_VOLUME_A
        : LOW_VOLUME_B,
      LOW_VOLUME_A.toLowerCase() < LOW_VOLUME_B.toLowerCase()
        ? LOW_VOLUME_B
        : LOW_VOLUME_A,
    ]);
    expect(hopOne[0].y).toBeLessThan(hopOne[1].y);
    expect(hopOne[1].y).toBeLessThan(hopOne[2].y);
  });

  it('sizes every position and the canvas to hold the columns', () => {
    const layout = layoutTraceGraph(nodes);

    for (const node of layout.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it('keeps the subject first even when a counterparty carries more volume', () => {
    const layout = layoutTraceGraph(nodes);

    expect(layout.nodes[0]).toMatchObject({ address: SUBJECT, hop: 0 });
  });
});
