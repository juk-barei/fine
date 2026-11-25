import type { WalletTraceGraph } from '@repo/contracts';
import { t, type SupportedLanguage } from '@/i18n';
import type { TraceGraphSelection } from './trace-graph-canvas';

/**
 * Selection details. Ticket 01 keeps the minimum the retired ring offered:
 * a node's address and hop, a transfer's endpoints, amount, transaction and
 * timestamp. Ticket 03 replaces the body with the product vocabulary.
 */
export function TraceGraphInspector({
  graph,
  selection,
  language,
}: {
  graph: WalletTraceGraph;
  selection: TraceGraphSelection | null;
  language: SupportedLanguage;
}) {
  const node =
    selection?.kind === 'node'
      ? graph.nodes.find((candidate) => candidate.address === selection.address)
      : undefined;
  const edge =
    selection?.kind === 'edge'
      ? graph.edges.find((candidate) => candidate.id === selection.id)
      : undefined;

  return (
    <div
      role="region"
      aria-label={t(
        language,
        (dictionary) => dictionary.traceGraph.selection,
      )}
      className="mt-3 rounded-xl border bg-muted/20 px-3 py-2.5 text-xs"
    >
      {edge ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
          <div className="col-span-2">
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.from)}
            </dt>
            <dd className="truncate font-mono" title={edge.from}>
              {edge.from}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.to)}
            </dt>
            <dd className="truncate font-mono" title={edge.to}>
              {edge.to}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.hop)}
            </dt>
            <dd className="font-medium">{edge.hop}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.amount)}
            </dt>
            <dd className="font-medium">
              {edge.amountUsdt.toLocaleString()} USDT
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.transaction)}
            </dt>
            <dd className="truncate font-mono" title={edge.txHash}>
              {edge.txHash}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.timestamp)}
            </dt>
            <dd className="font-medium">
              {new Date(edge.timestamp).toLocaleString()}
            </dd>
          </div>
        </dl>
      ) : node ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
          <div className="col-span-2">
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.address)}
            </dt>
            <dd className="truncate font-mono" title={node.address}>
              {node.address}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.hop)}
            </dt>
            <dd className="font-medium">{node.hop}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground">
          {t(
            language,
            (dictionary) => dictionary.traceGraph.selectionHint,
          )}
        </p>
      )}
    </div>
  );
}
