import type { TraceEdge, TraceNode, WalletTraceGraph } from '@repo/contracts';
import { t, type SupportedLanguage } from '@/i18n';
import { bandLabel, formatUsdt, tierLabel } from '../vocabulary';

/**
 * What the inspector shows and the canvas highlights: one node address or one
 * transfer id. Client UI state only — it never crosses the wire.
 */
export type TraceGraphSelection =
  | { kind: 'node'; address: string }
  | { kind: 'edge'; id: string };

/**
 * The neighbour set — the addresses one hop from the hovered node, derived
 * from the payload's edges. Pure: the same graph and hover always produce
 * the same set.
 */
export function neighbourSet(
  graph: WalletTraceGraph,
  hovered: string | null,
): Set<string> {
  const neighbours = new Set<string>();
  if (hovered === null) return neighbours;

  for (const edge of graph.edges) {
    if (edge.from === hovered) neighbours.add(edge.to);
    else if (edge.to === hovered) neighbours.add(edge.from);
  }
  return neighbours;
}

/** The dimming rule: which controls fade while a node is hovered. */
export type TraceDimming = {
  /** True only while a node present in the payload is hovered. */
  active: boolean;
  isNodeDimmed(address: string): boolean;
  isEdgeDimmed(edge: TraceEdge): boolean;
};

/**
 * Hovering a node keeps the node, its immediate neighbours and their edges
 * bright and dims the rest, so one thread can be followed through a dense
 * graph. A hovered address missing from the payload — it can outlive a
 * re-query — is no hover at all: nothing is dimmed.
 */
export function traceDimming(
  graph: WalletTraceGraph,
  hovered: string | null,
): TraceDimming {
  const active =
    hovered !== null && graph.nodes.some((node) => node.address === hovered);
  const neighbours = neighbourSet(graph, hovered);

  return {
    active,
    isNodeDimmed: (address) =>
      active && address !== hovered && !neighbours.has(address),
    isEdgeDimmed: (edge) =>
      active && edge.from !== hovered && edge.to !== hovered,
  };
}

/**
 * The settled selection — what actually renders: the prior selection while
 * its node or transfer is still in the payload, else the subject (the first
 * one wins when a payload carries several), else nothing. Pure and
 * idempotent, so the stored selection may lag a render behind what this
 * returns after a re-query.
 */
export function settleSelection(
  graph: WalletTraceGraph | undefined,
  selection: TraceGraphSelection | null,
): TraceGraphSelection | null {
  if (graph === undefined || selection === null) return null;

  const survives =
    selection.kind === 'node'
      ? graph.nodes.some((node) => node.address === selection.address)
      : graph.edges.some((edge) => edge.id === selection.id);
  if (survives) return selection;

  const subject = graph.nodes.find((node) => node.subject)?.address;
  return subject === undefined ? null : { kind: 'node', address: subject };
}

/**
 * The sentence a node control exposes as its accessible label: address, hop,
 * band and first label tier in the product's own vocabulary. A node without
 * a band is unscored, never "low".
 */
export function nodeSentence(
  node: TraceNode,
  language: SupportedLanguage,
): string {
  const hop = t(language, (dictionary) => dictionary.traceGraph.hop);
  const bandWord = t(
    language,
    (dictionary) => dictionary.traceGraph.inspector.band,
  );
  const bandValue =
    node.band === null
      ? t(language, (dictionary) => dictionary.traceGraph.unscored)
      : bandLabel(node.band, language);
  const label = node.labels[0];
  const tier = label ? `, ${tierLabel(label.tier, language)}` : '';
  const subject = node.subject
    ? `, ${t(language, (dictionary) => dictionary.traceGraph.subject).toLowerCase()}`
    : '';

  return `${t(language, (dictionary) => dictionary.traceGraph.node)} ${node.address}, ${hop} ${node.hop}, ${bandWord} ${bandValue}${tier}${subject}`;
}

/**
 * The sentence a transfer control exposes as its accessible label: amount,
 * endpoints, hop and direction.
 */
export function edgeSentence(
  edge: TraceEdge,
  language: SupportedLanguage,
): string {
  const direction =
    edge.direction === 'inbound'
      ? t(language, (dictionary) => dictionary.traceGraph.inbound)
      : t(language, (dictionary) => dictionary.traceGraph.outbound);
  const from = t(language, (dictionary) => dictionary.traceGraph.from);
  const to = t(language, (dictionary) => dictionary.traceGraph.to);
  const hop = t(language, (dictionary) => dictionary.traceGraph.hop);

  return `${t(language, (dictionary) => dictionary.traceGraph.transferOf)} ${formatUsdt(edge.amountUsdt)}, ${from} ${edge.from}, ${to} ${edge.to}, ${hop} ${edge.hop}, ${direction}`;
}

/**
 * What the live region reads out when the selection changes: the same
 * sentence the control carries, plus the fact that the details opened.
 * A selection that is not in the payload announces nothing.
 */
export function selectionAnnouncement(
  graph: WalletTraceGraph,
  selection: TraceGraphSelection | null,
  language: SupportedLanguage,
): string {
  if (selection === null) return '';

  let subject: string;
  if (selection.kind === 'node') {
    const node = graph.nodes.find(
      (candidate) => candidate.address === selection.address,
    );
    if (node === undefined) return '';
    subject = nodeSentence(node, language);
  } else {
    const edge = graph.edges.find((candidate) => candidate.id === selection.id);
    if (edge === undefined) return '';
    subject = edgeSentence(edge, language);
  }

  return `${subject}. ${t(
    language,
    (dictionary) => dictionary.traceGraph.a11y.selectionAnnouncement,
  )}`;
}
