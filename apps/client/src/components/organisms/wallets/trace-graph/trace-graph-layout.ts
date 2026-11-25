import type { TraceNode } from '@repo/contracts';

/** Space reserved around and between node cards. */
const MARGIN = 24;
const COLUMN_GAP = 110;
const ROW_GAP = 20;

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 68;

export type TraceNodePosition = {
  address: string;
  hop: number;
  volumeUsdt: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TraceGraphLayout = {
  nodes: TraceNodePosition[];
  width: number;
  height: number;
};

/**
 * Columns by hop, volume-descending with an address tiebreak inside each
 * column. Pure: the same nodes always produce the same positions, whatever
 * order they arrive in.
 */
export function layoutTraceGraph(nodes: TraceNode[]): TraceGraphLayout {
  const ordered = [...nodes].sort(
    (left, right) =>
      left.hop - right.hop ||
      right.volumeUsdt - left.volumeUsdt ||
      (left.address < right.address ? -1 : left.address > right.address ? 1 : 0),
  );

  const byHop = new Map<number, TraceNode[]>();
  for (const node of ordered) {
    const column = byHop.get(node.hop);
    if (column) column.push(node);
    else byHop.set(node.hop, [node]);
  }

  const hops = [...byHop.keys()].sort((left, right) => left - right);
  const maxRows = hops.reduce(
    (rows, hop) => Math.max(rows, byHop.get(hop)?.length ?? 0),
    0,
  );
  const maxHop = hops.length > 0 ? hops[hops.length - 1] : 0;

  const positions: TraceNodePosition[] = [];
  for (const hop of hops) {
    const column = byHop.get(hop) ?? [];
    column.forEach((node, row) => {
      positions.push({
        address: node.address,
        hop: node.hop,
        volumeUsdt: node.volumeUsdt,
        x: MARGIN + hop * (NODE_WIDTH + COLUMN_GAP),
        y: MARGIN + row * (NODE_HEIGHT + ROW_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    });
  }

  return {
    nodes: positions,
    width:
      MARGIN * 2 +
      (maxHop + 1) * NODE_WIDTH +
      maxHop * COLUMN_GAP,
    height:
      MARGIN * 2 +
      Math.max(maxRows, 1) * NODE_HEIGHT +
      Math.max(maxRows - 1, 0) * ROW_GAP,
  };
}
