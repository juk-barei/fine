import { createHash } from 'node:crypto';
import type {
  IntermediaryClass,
  TraceEdge,
  TraceEdgeDirection,
  TraceLabel,
  TraceNode,
  TraceNodeKind,
  TraceRule,
  WalletTraceGraph,
} from '@repo/contracts';
import { OFAC_TRON_ADDRESSES } from '../../domain/screening/ofac-seed.ts';
import {
  screenAddress,
  type Screening,
} from '../../domain/screening/screening.ts';

/**
 * The deterministic mock trace graph: the synthetic half of the Tron data path
 * that answers "where did the money go" while the chain loader is still a plan.
 *
 * The screening policy itself lives in `domain/screening/`; this file only
 * synthesizes the neighbourhood around an address. Its nodes carry the
 * screening the domain gives them, so the graph and the wallet list agree.
 */

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** The product's node cap; a trace that needs more reports itself partial. */
export const TRACE_NODE_CAP = 500;

/** Counterparties are classified from this pool; the subject never is. */
const COUNTERPARTY_KINDS: readonly TraceNodeKind[] = [
  'counterparty',
  'exchange',
  'bridge',
  'mixer',
  'bank',
  'darknet',
  'infrastructure',
  'unknown',
];

const INTERMEDIARY_CLASSES: readonly IntermediaryClass[] = [
  'pass_through',
  'peel_chain',
  'consolidation',
];

/** R1–R6 are the product's baseline rules; never the prototype's FR codes. */
const RULE_DEFINITIONS: ReadonlyArray<readonly [string, string]> = [
  ['R1', 'Direct exposure to a sanctioned address'],
  ['R2', 'Pass-through behaviour: funds in and out within hours'],
  ['R3', 'Fan-out to many recipients'],
  ['R4', 'Round-number transfers'],
  ['R5', 'Zero-balance relay wallet'],
  ['R6', 'Bursty transfer timing'],
];

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function shortLabel(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function counterpartyAddress(subject: string, hop: number, index: number): string {
  const bytes = digest(`${subject}:trace:${hop}:${index}`);
  let address = 'T';
  for (let i = 0; i < 33; i += 1) {
    address += BASE58[bytes[i % bytes.length] % BASE58.length];
  }
  return address;
}

function kindFor(address: string): TraceNodeKind {
  if (OFAC_TRON_ADDRESSES[address] === true) return 'sanctioned';
  const bytes = digest(`${address}:kind`);
  return COUNTERPARTY_KINDS[bytes[0] % COUNTERPARTY_KINDS.length];
}

function labelsFor(address: string): TraceLabel[] {
  return OFAC_TRON_ADDRESSES[address] === true
    ? [{ tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null }]
    : [];
}

function intermediaryFor(address: string): IntermediaryClass | null {
  const bytes = digest(`${address}:intermediary`);
  if (bytes[0] % 2 === 1) return null;
  return INTERMEDIARY_CLASSES[bytes[1] % INTERMEDIARY_CLASSES.length];
}

function rulesFor(address: string, screening: Screening): TraceRule[] {
  const bytes = digest(`${address}:rules`);
  const threshold = 15 + Math.round(screening.score * 70);
  const sanctioned = OFAC_TRON_ADDRESSES[address] === true;

  return RULE_DEFINITIONS.map(([code, summary], index) => ({
    code,
    summary,
    triggered:
      (code === 'R1' && sanctioned) ||
      (bytes[index] + index * 7) % 100 < threshold,
  }));
}

function traceNode(address: string, hop: number, subject: boolean): TraceNode {
  const screening = screenAddress(address);

  return {
    address,
    hop,
    kind: subject ? 'subject' : kindFor(address),
    title: shortLabel(address),
    badge: null,
    band: screening.band,
    pLaundering: screening.score,
    confidence: screening.confidence,
    volumeUsdt: 0,
    intermediary: subject ? null : intermediaryFor(address),
    labels: labelsFor(address),
    rules: rulesFor(address, screening),
    subject,
  };
}

export type MockTraceGraphInput = {
  address: string;
  depth: number;
  minValueUsdt: number;
};

/**
 * Every traced wallet exposes the same children, so the mock's neighbourhood
 * grows as `4^hop`: 341 nodes at depth four and 1,365 at depth five. The cap
 * is therefore reachable by asking for depth five and not by asking for four,
 * with no test-only switch.
 */
const TRACE_FAN_OUT = 4;

/** Highest value first, then nearest hop, then address. */
function compareForCap(left: TraceNode, right: TraceNode): number {
  if (left.volumeUsdt !== right.volumeUsdt) {
    return right.volumeUsdt - left.volumeUsdt;
  }
  if (left.hop !== right.hop) return left.hop - right.hop;
  return left.address < right.address
    ? -1
    : left.address > right.address
      ? 1
      : 0;
}

/**
 * The deterministic multi-hop mock neighbourhood of a wallet.
 *
 * Topology, amounts, hashes and timestamps all come from the address, so the
 * same request renders the same picture. Depth sets the furthest hop; the
 * minimum transfer value filters transfers before nodes without one are
 * dropped, keeping only the component connected to the subject. Banding comes
 * from `screenAddress`, so the graph and the wallet list agree.
 *
 * The node cap runs after that filter and keeps the highest-value nodes, then
 * the nearest hop, then the address. Keeping nodes by value can evict a node
 * whose descendants survive, so the cap is followed by a reachability pass:
 * anything the subject can no longer reach is dropped with its edges, and the
 * disclosure counts what was actually returned. When the cap stops the trace
 * short the disclosure still says so: `truncated`, `coverage: partial`, a
 * reason, and the transfers loaded against the transfers reported for this
 * request. `volumeUsdt` sums every in-scope transfer incident to the wallet,
 * including those whose counterparty the cap left out, so the ranking the cap
 * used and the volume shown on the node are the same number.
 */
export function mockTraceGraph({
  address,
  depth,
  minValueUsdt,
}: MockTraceGraphInput): WalletTraceGraph {
  const nodes: TraceNode[] = [traceNode(address, 0, true)];
  const edges: TraceEdge[] = [];
  const directionByAddress = new Map<string, TraceEdgeDirection>();
  let parents: string[] = [address];

  for (let hop = 1; hop <= depth; hop += 1) {
    const hopBytes = digest(`${address}:trace:${hop}`);
    const current: string[] = [];

    for (let index = 0; index < parents.length * TRACE_FAN_OUT; index += 1) {
      const child = counterpartyAddress(address, hop, index);
      const parent = parents[Math.floor(index / TRACE_FAN_OUT)];
      const direction: TraceEdgeDirection =
        hop === 1
          ? hopBytes[index % hopBytes.length] % 2 === 0
            ? 'outbound'
            : 'inbound'
          : directionByAddress.get(parent) ?? 'outbound';

      directionByAddress.set(child, direction);
      nodes.push(traceNode(child, hop, false));
      current.push(child);

      const amountBytes = digest(`${address}:trace-amount:${hop}:${index}`);
      const amountUsdt =
        100 + (((amountBytes[0] << 8) | amountBytes[1]) % 49_900);
      const hours = ((amountBytes[2] << 8) | amountBytes[3]) % (30 * 24);
      const txHash = digest(`${address}:trace-tx:${hop}:${index}`).toString(
        'hex',
      );

      edges.push({
        id: txHash,
        from: direction === 'outbound' ? parent : child,
        to: direction === 'outbound' ? child : parent,
        amountUsdt,
        txHash,
        timestamp: new Date(
          Date.UTC(2026, 9, 1) + hours * 60 * 60 * 1000,
        ).toISOString(),
        hop,
        direction,
      });
    }

    parents = current;
  }

  // The minimum value filters transfers first, so a transfer the investigator
  // ruled out never costs a node its place under the cap.
  const scopedEdges = edges.filter((edge) => edge.amountUsdt >= minValueUsdt);

  // Keep the filtered transfers reachable from the subject: a transfer below
  // the minimum must not leave an island floating beside the wallet.
  const incident = new Map<string, TraceEdge[]>();
  for (const edge of scopedEdges) {
    for (const endpoint of [edge.from, edge.to]) {
      const list = incident.get(endpoint);
      if (list) list.push(edge);
      else incident.set(endpoint, [edge]);
    }
  }

  const reachable = new Set<string>([address]);
  const queue = [address];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of incident.get(current) ?? []) {
      const other = edge.from === current ? edge.to : edge.from;
      if (!reachable.has(other)) {
        reachable.add(other);
        queue.push(other);
      }
    }
  }

  const reportedEdges = scopedEdges.filter(
    (edge) => reachable.has(edge.from) && reachable.has(edge.to),
  );
  const volumes = new Map<string, number>();
  for (const edge of reportedEdges) {
    volumes.set(edge.from, (volumes.get(edge.from) ?? 0) + edge.amountUsdt);
    volumes.set(edge.to, (volumes.get(edge.to) ?? 0) + edge.amountUsdt);
  }

  const scopedNodes = nodes
    .filter((node) => reachable.has(node.address))
    .map((node) => ({
      ...node,
      volumeUsdt: volumes.get(node.address) ?? 0,
    }));

  // The subject is the wallet the investigator opened: it is in every payload,
  // whatever its volume, and the rest of the cap fills by value then proximity.
  const [subject, ...counterparties] = scopedNodes;
  const keptNodes = [
    subject,
    ...counterparties.sort(compareForCap).slice(0, TRACE_NODE_CAP - 1),
  ];
  const truncated = keptNodes.length < scopedNodes.length;

  const keptAddresses = new Set(keptNodes.map((node) => node.address));
  const keptEdges = reportedEdges.filter(
    (edge) => keptAddresses.has(edge.from) && keptAddresses.has(edge.to),
  );

  // The cap ranks by value, so an evicted parent can strand its children.
  // Reachability is recomputed over what survived: an island is not part of
  // the subject's trace and must not be returned as if it were.
  const keptIncident = new Map<string, TraceEdge[]>();
  for (const edge of keptEdges) {
    for (const endpoint of [edge.from, edge.to]) {
      const list = keptIncident.get(endpoint);
      if (list) list.push(edge);
      else keptIncident.set(endpoint, [edge]);
    }
  }

  const connected = new Set<string>([subject.address]);
  const connectedQueue = [subject.address];
  while (connectedQueue.length > 0) {
    const current = connectedQueue.shift() as string;
    for (const edge of keptIncident.get(current) ?? []) {
      const other = edge.from === current ? edge.to : edge.from;
      if (!connected.has(other)) {
        connected.add(other);
        connectedQueue.push(other);
      }
    }
  }

  const returnedNodes = keptNodes.filter((node) =>
    connected.has(node.address),
  );
  const returnedEdges = keptEdges.filter(
    (edge) => connected.has(edge.from) && connected.has(edge.to),
  );
  const depthReached = Math.max(...returnedNodes.map((node) => node.hop));

  return {
    simulated: true,
    nodes: returnedNodes,
    edges: returnedEdges,
    disclosure: {
      depthRequested: depth,
      depthReached,
      minValueUsdt,
      nodesReturned: returnedNodes.length,
      nodeCap: TRACE_NODE_CAP,
      truncated,
      coverage: truncated ? 'partial' : 'complete',
      loadedTransfers: returnedEdges.length,
      reportedTransfers: reportedEdges.length,
      reason: truncated
        ? {
            code: 'node_cap_reached',
            params: {
              nodeCap: TRACE_NODE_CAP,
              nodesKept: returnedNodes.length,
              nodesScoped: scopedNodes.length,
            },
          }
        : null,
    },
  };
}
