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

/** The product's node cap. Ticket 05 makes reaching it truncate the trace. */
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
 * The deterministic multi-hop mock neighbourhood of a wallet.
 *
 * Topology, amounts, hashes and timestamps all come from the address, so the
 * same request renders the same picture. Depth sets the furthest hop; the
 * minimum transfer value filters transfers before nodes without one are
 * dropped, keeping only the component connected to the subject. Banding comes
 * from `screenAddress`, so the graph and the wallet list agree.
 *
 * The node cap is reported but not enforced: ticket 05 owns truncation and
 * partial coverage.
 */
export function mockTraceGraph({
  address,
  depth,
  minValueUsdt,
}: MockTraceGraphInput): WalletTraceGraph {
  const nodes: TraceNode[] = [traceNode(address, 0, true)];
  const parentsByHop: string[][] = [[address]];
  const directionByAddress = new Map<string, TraceEdgeDirection>();
  const candidates: TraceEdge[] = [];

  for (let hop = 1; hop <= depth; hop += 1) {
    const bytes = digest(`${address}:trace:${hop}`);
    const parents = parentsByHop[hop - 1];
    const count = 3 + (bytes[0] % 2);
    const current: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const child = counterpartyAddress(address, hop, index);
      const parent = parents[bytes[1 + index] % parents.length];
      const direction: TraceEdgeDirection =
        hop === 1
          ? bytes[2 + index] % 2 === 0
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

      candidates.push({
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

    parentsByHop.push(current);
  }

  const edges = candidates.filter((edge) => edge.amountUsdt >= minValueUsdt);

  // Keep the component reachable from the subject; a transfer below the
  // minimum must not leave an island floating beside the wallet.
  const incident = new Map<string, TraceEdge[]>();
  for (const edge of edges) {
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

  const keptEdges = edges.filter(
    (edge) => reachable.has(edge.from) && reachable.has(edge.to),
  );
  const volumes = new Map<string, number>();
  for (const edge of keptEdges) {
    volumes.set(edge.from, (volumes.get(edge.from) ?? 0) + edge.amountUsdt);
    volumes.set(edge.to, (volumes.get(edge.to) ?? 0) + edge.amountUsdt);
  }

  const keptNodes = nodes
    .filter((node) => reachable.has(node.address))
    .map((node) => ({
      ...node,
      volumeUsdt: volumes.get(node.address) ?? 0,
    }));
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
      truncated: false,
      coverage: 'complete',
      loadedTransfers: keptEdges.length,
      reportedTransfers: keptEdges.length,
      reason: null,
    },
  };
}
