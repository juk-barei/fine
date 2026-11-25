import { useId, useState } from 'react';
import { t, type SupportedLanguage } from '@/i18n';
import { useWalletGraph } from '@/lib/wallets';
import {
  TraceGraphCanvas,
  type TraceGraphSelection,
} from './trace-graph-canvas';
import { TraceGraphInspector } from './trace-graph-inspector';

/**
 * The fund-flow section: the loaded multi-hop graph, its selection state and
 * the inspector. Depth and minimum value are the server's inputs, so the
 * canvas never filters a payload client-side.
 */
export function WalletTraceGraph({
  address,
  language = 'en',
  depth = 5,
  minValueUsdt = 0,
}: {
  address: string;
  language?: SupportedLanguage;
  depth?: number;
  minValueUsdt?: number;
}) {
  const headingId = useId();
  const [selection, setSelection] = useState<TraceGraphSelection | null>(null);
  const graph = useWalletGraph(address, depth, minValueUsdt);

  const hasNeighbourhood =
    graph.data !== undefined &&
    graph.data.edges.length > 0 &&
    graph.data.nodes.some((node) => !node.subject);

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id={headingId}
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
        >
          {t(language, (dictionary) => dictionary.traceGraph.heading)}
        </h2>
        {graph.data ? (
          <p className="text-[10px] text-muted-foreground">
            {graph.data.nodes.length}{' '}
            {t(language, (dictionary) => dictionary.traceGraph.nodes)} ·{' '}
            {graph.data.edges.length}{' '}
            {t(language, (dictionary) => dictionary.traceGraph.transfers)}
          </p>
        ) : null}
      </div>

      {graph.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t(language, (dictionary) => dictionary.traceGraph.loading)}
        </p>
      ) : graph.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {t(language, (dictionary) => dictionary.traceGraph.error)}
        </p>
      ) : graph.data === undefined ? null : hasNeighbourhood ? (
        <>
          <TraceGraphCanvas
            graph={graph.data}
            selected={selection}
            onSelect={setSelection}
            language={language}
          />
          <TraceGraphInspector
            graph={graph.data}
            selection={selection}
            language={language}
          />
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {t(language, (dictionary) => dictionary.traceGraph.empty)}
        </p>
      )}
    </section>
  );
}
