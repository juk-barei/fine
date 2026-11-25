import { useEffect, useId, useState } from 'react';
import { t, type SupportedLanguage } from '@/i18n';
import { useWalletGraph } from '@/lib/wallets';
import {
  TraceGraphCanvas,
  type TraceGraphSelection,
} from './trace-graph-canvas';
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
  const [depth, setDepth] = useState(5);
  const [minValueUsdt, setMinValueUsdt] = useState(0);
  const graph = useWalletGraph(address, depth, minValueUsdt);

  const subjectAddress =
    graph.data?.nodes.find((node) => node.subject)?.address ?? null;

  useEffect(() => {
    if (graph.data === undefined || selection === null) return;

    const survives =
      selection.kind === 'node'
        ? graph.data.nodes.some((node) => node.address === selection.address)
        : graph.data.edges.some((edge) => edge.id === selection.id);

    if (survives) return;

    setSelection(
      subjectAddress === null
        ? null
        : { kind: 'node', address: subjectAddress },
    );
  }, [graph.data, selection, subjectAddress]);

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
