import { useId, useState, type KeyboardEvent } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { TraceEdge, TraceNode, WalletTraceGraph } from '@repo/contracts';
import { t, type SupportedLanguage } from '@/i18n';
import { bandBadge, bandLabel, NEUTRAL_BAND, tierLabel } from '../vocabulary';
import { layoutTraceGraph } from './trace-graph-layout';
import { TraceNodeIcon } from './trace-node-icon';

export type TraceGraphSelection =
  | { kind: 'node'; address: string }
  | { kind: 'edge'; id: string };

/** A bounded viewport keeps a depth-five graph from stretching the page. */
const CANVAS_VIEWPORT_HEIGHT = 560;

function edgeLabel(edge: TraceEdge, language: SupportedLanguage): string {
  const direction =
    edge.direction === 'inbound'
      ? t(language, (dictionary) => dictionary.traceGraph.inbound)
      : t(language, (dictionary) => dictionary.traceGraph.outbound);
  const from = t(language, (dictionary) => dictionary.traceGraph.from);
  const to = t(language, (dictionary) => dictionary.traceGraph.to);
  const hop = t(language, (dictionary) => dictionary.traceGraph.hop);

  return `${t(language, (dictionary) => dictionary.traceGraph.transferOf)} ${edge.amountUsdt.toLocaleString()} USDT, ${from} ${edge.from}, ${to} ${edge.to}, ${hop} ${edge.hop}, ${direction}`;
}

function nodeLabel(
  node: TraceNode,
  language: SupportedLanguage,
): string {
  const hop = t(language, (dictionary) => dictionary.traceGraph.hop);
  const bandWord = t(
    language,
    (dictionary) => dictionary.traceGraph.inspector.band,
  );
  const nodeBand = node.band;
  const bandValue =
    nodeBand === null
      ? t(language, (dictionary) => dictionary.traceGraph.unscored)
      : bandLabel(nodeBand, language);
  const label = node.labels[0];
  const tier = label ? `, ${tierLabel(label.tier, language)}` : '';
  const subject = node.subject
    ? `, ${t(language, (dictionary) => dictionary.traceGraph.subject).toLowerCase()}`
    : '';

  return `${t(language, (dictionary) => dictionary.traceGraph.node)} ${node.address}, ${hop} ${node.hop}, ${bandWord} ${bandValue}${tier}${subject}`;
}

/**
 * What the live region reads out when the selection changes: the same label the
 * control carries, plus the fact that the details opened.
 */
function selectionAnnouncement(
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
    subject = nodeLabel(node, language);
  } else {
    const edge = graph.edges.find((candidate) => candidate.id === selection.id);
    if (edge === undefined) return '';
    subject = edgeLabel(edge, language);
  }

  return `${subject}. ${t(
    language,
    (dictionary) => dictionary.traceGraph.a11y.selectionAnnouncement,
  )}`;
}

/** Enter and Space activate a control, matching native button behaviour. */
function activateOnKey(
  event: KeyboardEvent<HTMLElement | SVGGElement>,
  activate: () => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  activate();
}

function NodeCard({
  node,
  selected,
  dimmed,
  language,
  onSelect,
  onHover,
}: {
  node: TraceNode;
  selected: boolean;
  dimmed: boolean;
  language: SupportedLanguage;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}) {
  const tier = node.labels[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={(event) => activateOnKey(event, onSelect)}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-label={nodeLabel(node, language)}
      aria-pressed={selected}
      data-dimmed={dimmed ? 'true' : undefined}
      className={`flex h-full w-full flex-col items-start justify-center gap-0.5 rounded-xl border bg-background px-3 py-1.5 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-opacity ${node.band ? bandBadge[node.band] : NEUTRAL_BAND} ${
        node.subject
          ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
          : ''
      } ${selected ? 'shadow-md' : ''} ${dimmed ? 'opacity-30' : ''}`}
    >
      <span className="flex w-full items-center gap-1.5 text-[11px] font-semibold">
        <TraceNodeIcon kind={node.kind} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{node.title ?? node.address}</span>
      </span>
      <span className="flex w-full items-center justify-between gap-1 text-[9px] uppercase tracking-wider opacity-70">
        <span className="truncate">{node.kind.replace('_', ' ')}</span>
        {node.badge ? (
          <span className="shrink-0 rounded-sm bg-foreground/10 px-1 font-semibold">
            {node.badge}
          </span>
        ) : null}
        {tier ? (
          <span className="shrink-0 font-semibold">
            {tierLabel(tier.tier, language)}
          </span>
        ) : null}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider">
        {node.subject
          ? t(language, (dictionary) => dictionary.traceGraph.subject)
          : `${t(language, (dictionary) => dictionary.traceGraph.hop)} ${node.hop}`}
      </span>
    </button>
  );
}

/**
 * The multi-hop canvas. Edges are SVG lines; nodes are HTML controls inside
 * foreignObjects so they stay real buttons. Positions come from the pure
 * layout, never from the payload; zoom only scales the view.
 */
export function TraceGraphCanvas({
  graph,
  selected,
  onSelect,
  language,
}: {
  graph: WalletTraceGraph;
  selected: TraceGraphSelection | null;
  onSelect: (selection: TraceGraphSelection) => void;
  language: SupportedLanguage;
}) {
  const [zoom, setZoom] = useState(1);
  const [focusedEdgeId, setFocusedEdgeId] = useState<string | null>(null);
  const [hoveredAddress, setHoveredAddress] = useState<string | null>(null);
  const generatedId = useId().replace(/:/g, '');
  const markerId = `trace-arrow-${generatedId}`;
  const instructionsId = `trace-instructions-${generatedId}`;
  const layout = layoutTraceGraph(graph.nodes);
  const positionByAddress = new Map(
    layout.nodes.map((position) => [position.address, position]),
  );
  const nodeByAddress = new Map(
    graph.nodes.map((node) => [node.address, node]),
  );

  // Hovering a node keeps the node and its immediate neighbours bright and
  // dims the rest, so one thread can be followed through a dense graph.
  const neighbours = new Set<string>();
  if (hoveredAddress !== null) {
    for (const edge of graph.edges) {
      if (edge.from === hoveredAddress) neighbours.add(edge.to);
      else if (edge.to === hoveredAddress) neighbours.add(edge.from);
    }
  }

  const zoomBy = (step: number) => {
    setZoom((current) =>
      Math.min(2, Math.max(0.5, Math.round((current + step) * 10) / 10)),
    );
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          aria-label={t(language, (dictionary) => dictionary.traceGraph.zoomOut)}
          onClick={() => zoomBy(-0.2)}
          className="rounded-md border p-1 text-muted-foreground hover:text-foreground"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="w-9 text-center text-[10px] tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label={t(language, (dictionary) => dictionary.traceGraph.zoomIn)}
          onClick={() => zoomBy(0.2)}
          className="rounded-md border p-1 text-muted-foreground hover:text-foreground"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={t(
            language,
            (dictionary) => dictionary.traceGraph.resetZoom,
          )}
          onClick={() => setZoom(1)}
          className="rounded-md border p-1 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <p id={instructionsId} className="sr-only">
        {t(language, (dictionary) => dictionary.traceGraph.a11y.instructions)}
      </p>

      <div
        className="mt-2 overflow-auto rounded-xl border bg-muted/10"
        style={{ maxHeight: CANVAS_VIEWPORT_HEIGHT }}
      >
        <svg
          role="group"
          aria-label={t(
            language,
            (dictionary) => dictionary.traceGraph.graphLabel,
          )}
          aria-describedby={instructionsId}
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="block max-w-none"
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L0,8 L8,4 z" className="fill-muted-foreground/60" />
            </marker>
          </defs>

          {graph.edges.map((edge) => {
            const from = positionByAddress.get(edge.from);
            const to = positionByAddress.get(edge.to);
            if (!from || !to) return null;

            const isSelected =
              selected?.kind === 'edge' && selected.id === edge.id;
            const isFocused = focusedEdgeId === edge.id;
            const dimmed =
              hoveredAddress !== null &&
              edge.from !== hoveredAddress &&
              edge.to !== hoveredAddress;
            const label = edgeLabel(edge, language);
            const x1 = from.x + from.width / 2;
            const y1 = from.y + from.height / 2;
            const x2 = to.x + to.width / 2;
            const y2 = to.y + to.height / 2;

            return (
              <g
                key={edge.id}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={isSelected}
                data-focused={isFocused ? 'true' : undefined}
                onClick={() => onSelect({ kind: 'edge', id: edge.id })}
                onKeyDown={(event) =>
                  activateOnKey(event, () =>
                    onSelect({ kind: 'edge', id: edge.id }),
                  )
                }
                onFocus={() => setFocusedEdgeId(edge.id)}
                onBlur={() => setFocusedEdgeId(null)}
                data-dimmed={dimmed ? 'true' : undefined}
                className={`cursor-pointer outline-none transition-opacity ${dimmed ? 'opacity-20' : ''}`}
              >
                <title>{label}</title>
                {/* Focus is drawn as a halo, since SVG groups have no outline. */}
                {isFocused ? (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    strokeWidth={isSelected ? 10 : 8}
                    strokeLinecap="round"
                    className="stroke-foreground/40"
                  />
                ) : null}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeDasharray={edge.direction === 'inbound' ? '6 4' : undefined}
                  markerEnd={`url(#${markerId})`}
                  strokeLinecap="round"
                  className={
                    isSelected
                      ? 'stroke-foreground'
                      : 'stroke-muted-foreground/50'
                  }
                />
                {/* The visible line is too thin to click comfortably. */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={14}
                  className="stroke-transparent"
                />
              </g>
            );
          })}

          {layout.nodes.map((position) => {
            const node = nodeByAddress.get(position.address);
            if (!node) return null;

            return (
              <foreignObject
                key={node.address}
                x={position.x}
                y={position.y}
                width={position.width}
                height={position.height}
              >
                <NodeCard
                  node={node}
                  selected={
                    selected?.kind === 'node' &&
                    selected.address === node.address
                  }
                  dimmed={
                    hoveredAddress !== null &&
                    node.address !== hoveredAddress &&
                    !neighbours.has(node.address)
                  }
                  language={language}
                  onSelect={() =>
                    onSelect({ kind: 'node', address: node.address })
                  }
                  onHover={(hovered) =>
                    setHoveredAddress(hovered ? node.address : null)
                  }
                />
              </foreignObject>
            );
          })}
        </svg>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] text-muted-foreground">
        <span>
          {t(language, (dictionary) => dictionary.traceGraph.outbound)} ·{' '}
          {t(language, (dictionary) => dictionary.traceGraph.legendSolid)}
        </span>
        <span>
          {t(language, (dictionary) => dictionary.traceGraph.inbound)} ·{' '}
          {t(language, (dictionary) => dictionary.traceGraph.legendDashed)}
        </span>
      </p>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {selectionAnnouncement(graph, selected, language)}
      </p>
    </div>
  );
}
