import type {
  IntermediaryClass,
  TraceEdgeDirection,
  WalletConfidence,
  WalletTraceGraph,
} from '@repo/contracts';
import { t, type SupportedLanguage } from '@/i18n';
import { bandBadge, bandLabel, tierLabel } from '../vocabulary';
import type { TraceGraphSelection } from './trace-graph-interaction';

const CONFIDENCE_KEY: Record<
  WalletConfidence,
  'confidenceHigh' | 'confidenceMedium' | 'confidenceLow'
> = {
  high: 'confidenceHigh',
  medium: 'confidenceMedium',
  low: 'confidenceLow',
};

const INTERMEDIARY_KEY: Record<
  IntermediaryClass,
  'passThrough' | 'peelChain' | 'consolidation'
> = {
  pass_through: 'passThrough',
  peel_chain: 'peelChain',
  consolidation: 'consolidation',
};

const DIRECTION_KEY: Record<TraceEdgeDirection, 'inbound' | 'outbound'> = {
  inbound: 'inbound',
  outbound: 'outbound',
};

/**
 * Selection details in the product's own vocabulary: band, p(laundering) and
 * confidence as separate values, the label rows behind a tier, intermediary
 * classes, and the six baseline rules with their triggered status. Codes are
 * whatever the payload carries, and the contract admits only R1–R6.
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
      aria-label={t(language, (dictionary) => dictionary.traceGraph.selection)}
      className="mt-3 rounded-xl border bg-muted/20 px-3 py-2.5 text-xs"
    >
      {edge ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.amount)}
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {edge.amountUsdt.toLocaleString()} USDT
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.direction)}
            </dt>
            <dd className="mt-0.5 font-medium">
              {t(
                language,
                (dictionary) => dictionary.traceGraph[DIRECTION_KEY[edge.direction]],
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.hop)}
            </dt>
            <dd className="mt-0.5 font-medium">{edge.hop}</dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.transaction)}
            </dt>
            <dd className="mt-0.5 truncate font-mono" title={edge.txHash}>
              {edge.txHash}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.timestamp)}
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {`${edge.timestamp.slice(0, 10)} ${edge.timestamp.slice(11, 19)} UTC`}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.from)}
            </dt>
            <dd className="mt-0.5 truncate font-mono" title={edge.from}>
              {edge.from}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.to)}
            </dt>
            <dd className="mt-0.5 truncate font-mono" title={edge.to}>
              {edge.to}
            </dd>
          </div>
        </dl>
      ) : node ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground">
                {t(language, (dictionary) => dictionary.traceGraph.address)}
              </dt>
              <dd className="mt-0.5 truncate font-mono" title={node.address}>
                {node.address}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t(language, (dictionary) => dictionary.traceGraph.inspector.band)}
              </dt>
              <dd className="mt-0.5">
                {node.band ? (
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${bandBadge[node.band]}`}
                  >
                    {bandLabel(node.band, language)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t(
                      language,
                      (dictionary) => dictionary.traceGraph.inspector.none,
                    )}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t(
                  language,
                  (dictionary) => dictionary.traceGraph.inspector.pLaundering,
                )}
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {node.pLaundering === null
                  ? t(
                      language,
                      (dictionary) => dictionary.traceGraph.inspector.none,
                    )
                  : node.pLaundering.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t(
                  language,
                  (dictionary) => dictionary.traceGraph.inspector.confidence,
                )}
              </dt>
              <dd className="mt-0.5 font-medium">
                {node.confidence
                  ? t(
                      language,
                      (dictionary) =>
                        dictionary.traceGraph.inspector[
                          CONFIDENCE_KEY[node.confidence as WalletConfidence]
                        ],
                    )
                  : t(
                      language,
                      (dictionary) => dictionary.traceGraph.inspector.none,
                    )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t(language, (dictionary) => dictionary.traceGraph.hop)}
              </dt>
              <dd className="mt-0.5 font-medium">{node.hop}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t(
                  language,
                  (dictionary) => dictionary.traceGraph.inspector.volume,
                )}
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {node.volumeUsdt.toLocaleString()} USDT
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t(
                  language,
                  (dictionary) => dictionary.traceGraph.inspector.intermediary,
                )}
              </dt>
              <dd className="mt-0.5 font-medium">
                {node.intermediary
                  ? t(
                      language,
                      (dictionary) =>
                        dictionary.traceGraph.inspector[
                          INTERMEDIARY_KEY[node.intermediary as IntermediaryClass]
                        ],
                    )
                  : t(
                      language,
                      (dictionary) => dictionary.traceGraph.inspector.none,
                    )}
              </dd>
            </div>
          </dl>

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.inspector.labels)}
            </h3>
            {node.labels.length === 0 ? (
              <p className="mt-1.5 text-muted-foreground">
                {t(
                  language,
                  (dictionary) => dictionary.traceGraph.inspector.noLabels,
                )}
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {node.labels.map((label, index) => (
                  <li
                    key={`${label.tier}:${label.source}:${index}`}
                    className="rounded-lg border bg-background px-2 py-1.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <span className="font-semibold">
                        {tierLabel(label.tier, language)}
                      </span>
                      <span className="text-muted-foreground">
                        {t(
                          language,
                          (dictionary) => dictionary.traceGraph.inspector.source,
                        )}
                        {': '}
                        <span className="font-medium text-foreground">
                          {label.source}
                        </span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {t(
                        language,
                        (dictionary) =>
                          dictionary.traceGraph.inspector.listedAt,
                      )}
                      {': '}
                      {label.listedAt
                        ? (
                            <span className="font-medium text-foreground">
                              {label.listedAt.slice(0, 10)}
                            </span>
                          )
                        : t(
                            language,
                            (dictionary) =>
                              dictionary.traceGraph.inspector.listedAtUnknown,
                          )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t(language, (dictionary) => dictionary.traceGraph.inspector.rules)}
            </h3>
            <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
              {node.rules.map((rule) => (
                <li
                  key={rule.code}
                  className="flex items-start justify-between gap-2 rounded-lg border bg-background px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-semibold">{rule.code}</span>
                    <p
                      className="mt-0.5 text-[10px] text-muted-foreground"
                      title={rule.summary}
                    >
                      {rule.summary}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider ${
                      rule.triggered ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {rule.triggered
                      ? t(
                          language,
                          (dictionary) =>
                            dictionary.traceGraph.inspector.triggered,
                        )
                      : t(
                          language,
                          (dictionary) =>
                            dictionary.traceGraph.inspector.notTriggered,
                        )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <p className="text-muted-foreground">
          {t(language, (dictionary) => dictionary.traceGraph.selectionHint)}
        </p>
      )}
    </div>
  );
}
