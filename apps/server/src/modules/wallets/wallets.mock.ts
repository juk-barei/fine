import { createHash } from 'node:crypto';
import type {
  DecisionStatus,
  IntermediaryClass,
  LabelTier,
  TraceEdge,
  TraceEdgeDirection,
  TraceLabel,
  TraceNode,
  TraceNodeKind,
  TraceRule,
  WalletBand,
  WalletConfidence,
  WalletTraceGraph,
} from '@repo/contracts';
import { OFAC_TRON_ADDRESSES } from './ofac-seed.ts';

/**
 * The deterministic mock screener standing in for the real Tron data path.
 *
 * Same address in, same result out, so demos and tests are reproducible. When
 * the chain loader lands, the mock's place is the seam the real scorer takes:
 * `screenAddress` is pure and takes nothing but the address.
 */
export type MockScreening = {
  score: number;
  band: WalletBand;
  confidence: WalletConfidence;
  labelTier: LabelTier;
  decisionStatus: DecisionStatus;
  flags: string[];
};

const FLAG_POOL = [
  '2-hop exposure to an OFAC SDN wallet',
  'inbound flow from a Tether-frozen address',
  'fan-out to 128 recipients within 6 hours',
  'shared deposit address with a flagged wallet',
  'sanctions-adjacent counterparty (NBCTF)',
  'round-number transfers split below reporting thresholds',
] as const;

export const HIGH_BAND_THRESHOLD = 0.7;
export const MODERATE_BAND_THRESHOLD = 0.4;

export function bandForScore(score: number): WalletBand {
  if (score >= HIGH_BAND_THRESHOLD) return 'high';
  if (score >= MODERATE_BAND_THRESHOLD) return 'moderate';
  return 'low';
}

export function screenAddress(address: string): MockScreening {
  const digest = createHash('sha256').update(address).digest();

  // List membership beats the hash: a sanctioned address must not hash its way
  // into a lower tier.
  if (OFAC_TRON_ADDRESSES[address] === true) {
    return {
      score: Math.round((0.9 + (digest[0] / 255) * 0.09) * 10_000) / 10_000,
      band: 'high',
      confidence: 'high',
      labelTier: 'tier_1',
      decisionStatus: 'flagged',
      flags: [
        'direct match on the OFAC SDN list (Tier 1)',
        'OFAC action: XINBI GUARANTEE, 2026-09-09',
      ],
    };
  }

  // 0.02..0.98 keeps the result inside the contract's 0..1 range without
  // pinning either end, so every band is reachable.
  const score = Math.round((0.02 + (digest[0] / 255) * 0.96) * 10_000) / 10_000;
  const band = bandForScore(score);

  const labelTier: LabelTier =
    digest[1] < 60 ? 'tier_1' : digest[1] < 180 ? 'tier_2' : 'tier_3';

  const decisionStatus: DecisionStatus =
    band === 'high' ? 'flagged' : band === 'moderate' ? 'open' : 'cleared';

  const confidence: WalletConfidence =
    band === 'high' && labelTier === 'tier_1'
      ? 'high'
      : band === 'high' || labelTier === 'tier_2'
        ? 'medium'
        : 'low';

  const flagCount = band === 'high' ? 3 : band === 'moderate' ? 2 : 0;
  const start = digest[2] % FLAG_POOL.length;
  const flags = Array.from(
    { length: flagCount },
    (_, index) => FLAG_POOL[(start + index) % FLAG_POOL.length],
  );

  return { score, band, confidence, labelTier, decisionStatus, flags };
}

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

function rulesFor(address: string, screening: MockScreening): TraceRule[] {
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
 * the nearest hop, then the address. When it stops the trace short the
 * disclosure says so: `truncated`, `coverage: partial`, a reason, and the
 * transfers loaded against the transfers reported for this request. A node
 * the cap evicts can leave its high-value descendants in the payload as an
 * island; the disclosure is what tells the investigator the picture is partial.
 * `volumeUsdt` sums every in-scope transfer incident to the wallet, including
 * those whose counterparty the cap left out, so the ranking the cap used and
 * the volume shown on the node are the same number.
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
  const depthReached = Math.max(...keptNodes.map((node) => node.hop));

  return {
    simulated: true,
    nodes: keptNodes,
    edges: keptEdges,
    disclosure: {
      depthRequested: depth,
      depthReached,
      minValueUsdt,
      nodesReturned: keptNodes.length,
      nodeCap: TRACE_NODE_CAP,
      truncated,
      coverage: truncated ? 'partial' : 'complete',
      loadedTransfers: keptEdges.length,
      reportedTransfers: reportedEdges.length,
      reason: truncated
        ? `Node cap of ${TRACE_NODE_CAP} reached: ${keptNodes.length} of ${scopedNodes.length} nodes kept, highest value first.`
        : null,
    },
  };
}
