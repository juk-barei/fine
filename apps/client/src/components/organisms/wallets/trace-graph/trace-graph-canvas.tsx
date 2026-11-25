import { useId, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type {
  LabelTier,
  TraceEdge,
  TraceNode,
  WalletTraceGraph,
} from '@repo/contracts';
import { t, type SupportedLanguage } from '@/i18n';
import { bandBadge } from '../band-styles';
import { layoutTraceGraph } from './trace-graph-layout';
import { TraceNodeIcon } from './trace-node-icon';

export type TraceGraphSelection =
  | { kind: 'node'; address: string }
  | { kind: 'edge'; id: string };

const TIER_KEY: Record<LabelTier, 'tier1' | 'tier2' | 'tier3'> = {
  tier_1: 'tier1',
  tier_2: 'tier2',
  tier_3: 'tier3',
};

function edgeLabel(edge: TraceEdge, language: SupportedLanguage): string {
  const direction =
    edge.direction === 'inbound'
      ? t(language, (dictionary) => dictionary.traceGraph.inbound)
      : t(language, (dictionary) => dictionary.traceGraph.outbound);

  return `${t(language, (dictionary) => dictionary.traceGraph.transferOf)} ${edge.amountUsdt.toLocaleString()} USDT, ${direction}`;
}

function nodeLabel(
  node: TraceNode,
  language: SupportedLanguage,
): string {
  const hop = t(language, (dictionary) => dictionary.traceGraph.hop);
  const subject = node.subject
    ? `, ${t(language, (dictionary) => dictionary.traceGraph.subject).toLowerCase()}`
    : '';

  return `${t(language, (dictionary) => dictionary.traceGraph.node)} ${node.address}, ${hop} ${node.hop}${subject}`;
}

function NodeCard({
  node,
  selected,
  language,
  onSelect,
}: {
  node: TraceNode;
  selected: boolean;
  language: SupportedLanguage;
  onSelect: () => void;
}) {
  const band = node.band ?? 'low';
  const tier = node.labels[0]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={nodeLabel(node, language)}
      aria-pressed={selected}
      className={`flex h-full w-full flex-col items-start justify-center gap-0.5 rounded-xl border bg-background px-3 py-1.5 text-left ${bandBadge[band]} ${
        node.subject
          ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
          : ''
      } ${selected ? 'shadow-md' : ''}`}
    >
      <span className="flex w-full items-center gap-1.5 text-[11px] font-semibold">
        <TraceNodeIcon kind={node.kind} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{node.title ?? node.address}</span>
      </span>
      <span className="flex w-full items-center justify-between gap-1 text-[9px] uppercase tracking-wider opacity-70">
        <span className="truncate">{node.kind.replace('_', ' ')}</span>
        {tier ? (
          <span className="shrink-0 font-semibold">
            {t(language, (dictionary) => dictionary.traceGraph[TIER_KEY[tier.tier]])}
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
  const markerId = `trace-arrow-${useId().replace(/:/g, '')}`;
  const layout = layoutTraceGraph(graph.nodes);
  const positionByAddress = new Map(
    layout.nodes.map((position) => [position.address, position]),
  );
  const nodeByAddress = new Map(
    graph.nodes.map((node) => [node.address, node]),
  );

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

      <div className="mt-2 overflow-auto rounded-xl border bg-muted/10">
        <svg
          role="group"
          aria-label={t(
            language,
            (dictionary) => dictionary.traceGraph.graphLabel,
          )}
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
            const x1 = from.x + from.width / 2;
            const y1 = from.y + from.height / 2;
            const x2 = to.x + to.width / 2;
            const y2 = to.y + to.height / 2;

            return (
              <g
                key={edge.id}
                role="button"
                tabIndex={0}
                aria-label={edgeLabel(edge, language)}
                aria-pressed={isSelected}
                onClick={() => onSelect({ kind: 'edge', id: edge.id })}
                className="cursor-pointer"
              >
                <title>{edgeLabel(edge, language)}</title>
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
                  language={language}
                  onSelect={() =>
                    onSelect({ kind: 'node', address: node.address })
                  }
                />
              </foreignObject>
            );
          })}
        </svg>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] text-muted-foreground">
        <span>
          {t(language, (dictionary) => dictionary.traceGraph.outbound)} · solid
        </span>
        <span>
          {t(language, (dictionary) => dictionary.traceGraph.inbound)} · dashed
        </span>
      </p>
    </div>
  );
}
