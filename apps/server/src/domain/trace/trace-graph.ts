import type {
  IntermediaryClass,
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

/**
 * The trace policy: how a flat neighbourhood of transfers becomes the trace
 * graph the investigator sees. One function runs the whole pipeline —
 * self-transfer and duplicate pruning, the minimum-value filter, BFS hop
 * layering from the subject, volume aggregation, cap ranking and prune, a
 * second reachability pass over the survivors, and the disclosure that
 * reports what was actually returned.
 *
 * Pure per ADR-0001: synchronous, no promises, database, clock or
 * randomness. Timestamps, profiles and the simulation flag are adapter data;
 * this module only places them. Hops and directions are derived here, from
 * the subject: value flowing away from the opened wallet is `outbound`,
 * value flowing toward it is `inbound`.
 *
 * A trace source adapter feeds this policy: the deterministic synthetic
 * generator in `modules/wallets/` today, the Tron loader later. The seam is
 * the flat transfer list plus a total profile lookup, so no adapter can leak
 * its fetch strategy (or its synthesis) into the policy.
 */

/** The product's node cap; a trace that needs more reports itself partial. */
export const TRACE_NODE_CAP = 500;

/** One on-chain movement, stripped of every subject-relative notion. */
export type TraceTransfer = {
  /** 64-character hex; doubles as the edge id. Overlapping pages repeat it; policy dedupes. */
  txHash: string;
  from: string;
  to: string;
  amountUsdt: number;
  /** ISO datetime, minted by the source adapter before policy runs. */
  timestamp: string;
};

/**
 * Per-address enrichment the source knows. Policy carries it onto the node
 * verbatim and never reads it; `kind` is the counterparty's — the subject's
 * kind is forced to `subject` whatever the profile says.
 */
export type TraceNodeProfile = {
  kind: TraceNodeKind;
  title: string | null;
  badge: string | null;
  band: WalletBand | null;
  pLaundering: number | null;
  confidence: WalletConfidence | null;
  intermediary: IntermediaryClass | null;
  labels: readonly TraceLabel[];
  rules: readonly TraceRule[];
};

/**
 * What a trace source adapter hands the policy: the neighbourhood's flat,
 * depth-bounded transfers plus a total profile lookup. `profileOf` must
 * answer for any address — the subject included — and default for addresses
 * it never saw; the policy calls it only for the nodes it returns.
 */
export type TraceNeighbourhood = {
  /** Adapter truth, placed verbatim in the payload. */
  simulated: boolean;
  transfers: readonly TraceTransfer[];
  profileOf: (address: string) => TraceNodeProfile;
};

/** One trace request: the subject-relative fields plus the neighbourhood. */
export type TraceGraphInput = {
  /** The wallet the investigator opened; hop 0 of every layering. */
  address: string;
  /** Requested depth; echoed in the disclosure and never exceeded. */
  depth: number;
  /** Transfers below this value never cost a node its place. */
  minValueUsdt: number;
  /**
   * The cap the trace fills to. Defaults to the product's `TRACE_NODE_CAP`;
   * the disclosure echoes whichever cap actually ran.
   */
  nodeCap?: number;
} & TraceNeighbourhood;

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
 * Direction relative to the subject, derived from BFS hops: a transfer whose
 * `from` sits nearer the subject than its `to` flows away from the opened
 * wallet (`outbound`); the reverse flows toward it (`inbound`). A lateral
 * transfer — both endpoints equidistant — moves value inside one hop layer;
 * the wire carries only the two labels, so the policy pins `outbound`.
 */
function directionOf(hopFrom: number, hopTo: number): TraceEdgeDirection {
  if (hopFrom < hopTo) return 'outbound';
  if (hopFrom > hopTo) return 'inbound';
  return 'outbound';
}

export function buildTraceGraph({
  address,
  depth,
  minValueUsdt,
  simulated,
  transfers,
  profileOf,
  nodeCap = TRACE_NODE_CAP,
}: TraceGraphInput): WalletTraceGraph {
  // A self-transfer never informs reachability or volume, and pages can
  // repeat a txHash. Both go before the minimum-value filter, so a transfer
  // the investigator ruled out never costs a node its place under the cap.
  const seenHashes = new Set<string>();
  const scopedTransfers: TraceTransfer[] = [];
  for (const transfer of transfers) {
    if (transfer.from === transfer.to) continue;
    if (seenHashes.has(transfer.txHash)) continue;
    if (transfer.amountUsdt < minValueUsdt) continue;
    seenHashes.add(transfer.txHash);
    scopedTransfers.push(transfer);
  }

  const incident = new Map<string, TraceTransfer[]>();
  for (const transfer of scopedTransfers) {
    for (const endpoint of [transfer.from, transfer.to]) {
      const list = incident.get(endpoint);
      if (list) list.push(transfer);
      else incident.set(endpoint, [transfer]);
    }
  }

  // Every node's hop is its BFS distance from the subject over the filtered
  // transfers, never past the requested depth. A node without a hop is not
  // part of the trace: a transfer below the minimum must not leave an island
  // floating beside the wallet, and a cycle back toward the subject must not
  // push a hop past the depth the investigator asked for.
  const hopOf = new Map<string, number>([[address, 0]]);
  const queue = [address];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const hop = hopOf.get(current) as number;
    if (hop >= depth) continue;
    for (const transfer of incident.get(current) ?? []) {
      const other = transfer.from === current ? transfer.to : transfer.from;
      if (!hopOf.has(other)) {
        hopOf.set(other, hop + 1);
        queue.push(other);
      }
    }
  }

  const reportedEdges: TraceEdge[] = scopedTransfers
    .filter((transfer) => hopOf.has(transfer.from) && hopOf.has(transfer.to))
    .map((transfer) => {
      const hopFrom = hopOf.get(transfer.from) as number;
      const hopTo = hopOf.get(transfer.to) as number;
      return {
        id: transfer.txHash,
        from: transfer.from,
        to: transfer.to,
        amountUsdt: transfer.amountUsdt,
        txHash: transfer.txHash,
        timestamp: transfer.timestamp,
        // An edge's hop is its deeper endpoint's; a lateral edge takes the
        // hop both endpoints share.
        hop: Math.max(hopFrom, hopTo),
        direction: directionOf(hopFrom, hopTo),
      };
    });

  // `volumeUsdt` sums every in-scope transfer incident to the wallet,
  // including those whose counterparty the cap will leave out, so the
  // ranking the cap uses and the volume shown on the node are the same
  // number.
  const volumes = new Map<string, number>();
  for (const edge of reportedEdges) {
    volumes.set(edge.from, (volumes.get(edge.from) ?? 0) + edge.amountUsdt);
    volumes.set(edge.to, (volumes.get(edge.to) ?? 0) + edge.amountUsdt);
  }

  const nodeFor = (
    nodeAddress: string,
    hop: number,
    subject: boolean,
  ): TraceNode => {
    const profile = profileOf(nodeAddress);
    return {
      address: nodeAddress,
      hop,
      kind: subject ? 'subject' : profile.kind,
      title: profile.title,
      badge: profile.badge,
      band: profile.band,
      pLaundering: profile.pLaundering,
      confidence: profile.confidence,
      volumeUsdt: volumes.get(nodeAddress) ?? 0,
      // The subject is never an intermediary, whatever the profile says.
      intermediary: subject ? null : profile.intermediary,
      labels: [...profile.labels],
      rules: [...profile.rules],
      subject,
    };
  };

  const subject = nodeFor(address, 0, true);
  const counterparties: TraceNode[] = [];
  for (const [nodeAddress, hop] of hopOf) {
    if (nodeAddress !== address) {
      counterparties.push(nodeFor(nodeAddress, hop, false));
    }
  }
  const scopedNodes = [subject, ...counterparties];

  // The subject is the wallet the investigator opened: it is in every
  // payload, whatever its volume, and the rest of the cap fills by value
  // then proximity.
  const keptNodes = [
    subject,
    ...counterparties.sort(compareForCap).slice(0, nodeCap - 1),
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
    simulated,
    nodes: returnedNodes,
    edges: returnedEdges,
    disclosure: {
      depthRequested: depth,
      depthReached,
      minValueUsdt,
      nodesReturned: returnedNodes.length,
      nodeCap,
      truncated,
      coverage: truncated ? 'partial' : 'complete',
      loadedTransfers: returnedEdges.length,
      reportedTransfers: reportedEdges.length,
      reason: truncated
        ? {
            code: 'node_cap_reached',
            params: {
              nodeCap,
              nodesKept: returnedNodes.length,
              nodesScoped: scopedNodes.length,
            },
          }
        : null,
    },
  };
}
