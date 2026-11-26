import { useId, useState } from 'react';
import {
  WALLET_GRAPH_DEFAULT_DEPTH,
  WALLET_GRAPH_DEFAULT_MIN_VALUE_USDT,
} from '@repo/contracts';
import { t, type SupportedLanguage } from '@/i18n';
import { useWalletGraph } from '@/lib/wallets';
import { TraceGraphCanvas } from './trace-graph-canvas';
import {
  settleSelection,
  type TraceGraphSelection,
} from './trace-graph-interaction';
import { TraceGraphControls } from './trace-graph-controls';
import { TraceGraphDisclosure } from './trace-graph-disclosure';
import { TraceGraphInspector } from './trace-graph-inspector';

/**
 * The fund-flow section: the loaded multi-hop graph, its selection state, the
 * inspector and the trace controls. Depth and minimum value are the server's
 * inputs, so changing them re-queries the graph alone — the wallet's score
 * comes from its own query — and the canvas never filters a payload
 * client-side. A selection survives a re-query while its node or transfer is
 * still in the payload; otherwise it falls back to the subject.
 */
export function WalletTraceGraph({
  address,
  language = 'en',
}: {
  address: string;
  language?: SupportedLanguage;
}) {
  const headingId = useId();
  const [selection, setSelection] = useState<TraceGraphSelection | null>(null);
  const [depth, setDepth] = useState(WALLET_GRAPH_DEFAULT_DEPTH);
  const [minValueUsdt, setMinValueUsdt] = useState(
    WALLET_GRAPH_DEFAULT_MIN_VALUE_USDT,
  );
  const graph = useWalletGraph(address, depth, minValueUsdt);

  // The settled selection: what actually renders after a re-query. Survival
  // is a derivation of (graph, selection), so a stale stored entry is never
  // displayed and no reconciliation effect is needed.
  const settled = settleSelection(graph.data, selection);

  const hasNeighbourhood =
    graph.data !== undefined &&
    graph.data.edges.length > 0 &&
    graph.data.nodes.some((node) => !node.subject);

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id={headingId}
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
        >
          {t(language, (dictionary) => dictionary.traceGraph.heading)}
        </h2>
        <TraceGraphControls
          depth={depth}
          minValueUsdt={minValueUsdt}
          onDepthChange={setDepth}
          onMinimumValueChange={setMinValueUsdt}
          language={language}
        />
      </div>

      {graph.data ? (
        <TraceGraphDisclosure
          disclosure={graph.data.disclosure}
          simulated={graph.data.simulated}
          language={language}
        />
      ) : null}

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
          <TraceGraphInspector
            graph={graph.data}
            selection={settled}
            language={language}
          />
          <TraceGraphCanvas
            graph={graph.data}
            selected={settled}
            onSelect={setSelection}
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
