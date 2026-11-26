import type { ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';
import type {
  TraceDisclosure,
  TraceDisclosureReason,
} from '@repo/contracts';
import { t, type SupportedLanguage } from '@/i18n';

function DisclosureItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Every reason sentence comes from the dictionary: the server sends a code
 * plus its params record, the switch maps the code to its template, and the
 * compiler's exhaustiveness check makes a contract code unshippable without
 * its translations.
 */
function reasonSentence(
  reason: TraceDisclosureReason,
  language: SupportedLanguage,
): string {
  switch (reason.code) {
    case 'node_cap_reached':
      return t(
        language,
        (dictionary) =>
          dictionary.traceGraph.disclosure.reasons.node_cap_reached,
        reason.params,
      );
    default: {
      const exhaustive: never = reason.code;
      return exhaustive;
    }
  }
}

/**
 * What the trace actually covers, taken verbatim from the payload: the depth
 * the server was asked for and reached, the nodes it returned against the
 * cap, the minimum transfer it applied and how complete the index is. Nothing
 * here is derived from the nodes and edges in the client, so a bounded trace
 * cannot present itself as a complete one.
 */
export function TraceGraphDisclosure({
  disclosure,
  simulated,
  language,
}: {
  disclosure: TraceDisclosure;
  simulated: boolean;
  language: SupportedLanguage;
}) {
  const partial = disclosure.coverage === 'partial';
  // A complete trace may legitimately stop before the requested depth (a high
  // minimum value can leave only the subject); only a partial trace stopped
  // short of what was asked.
  const shortOfRequestedDepth =
    partial && disclosure.depthReached < disclosure.depthRequested;

  return (
    <div
      role="group"
      aria-label={t(
        language,
        (dictionary) => dictionary.traceGraph.disclosure.label,
      )}
      className="mt-2 space-y-1.5 rounded-xl border bg-muted/20 px-3 py-2 text-[11px]"
    >
      {simulated ? (
        <p
          role="note"
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-600/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400"
        >
          <FlaskConical className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {t(
              language,
              (dictionary) => dictionary.traceGraph.disclosure.simulated,
            )}
          </span>
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            {t(
              language,
              (dictionary) => dictionary.traceGraph.disclosure.simulatedHint,
            )}
          </span>
        </p>
      ) : null}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <DisclosureItem
          label={t(
            language,
            (dictionary) => dictionary.traceGraph.disclosure.depthRequested,
          )}
        >
          {disclosure.depthRequested}
        </DisclosureItem>
        <DisclosureItem
          label={t(
            language,
            (dictionary) => dictionary.traceGraph.disclosure.depthReached,
          )}
        >
          {disclosure.depthReached}
        </DisclosureItem>
        <DisclosureItem
          label={t(
            language,
            (dictionary) => dictionary.traceGraph.disclosure.nodesReturned,
          )}
        >
          {t(
            language,
            (dictionary) => dictionary.traceGraph.disclosure.nodesVsCap,
            {
              returned: disclosure.nodesReturned,
              cap: disclosure.nodeCap,
            },
          )}
        </DisclosureItem>
        <DisclosureItem
          label={t(
            language,
            (dictionary) => dictionary.traceGraph.disclosure.minimumValue,
          )}
        >
          {disclosure.minValueUsdt.toLocaleString()} USDT
        </DisclosureItem>
        <DisclosureItem
          label={t(
            language,
            (dictionary) => dictionary.traceGraph.disclosure.coverage,
          )}
        >
          {partial
            ? t(
                language,
                (dictionary) => dictionary.traceGraph.disclosure.partial,
              )
            : t(
                language,
                (dictionary) => dictionary.traceGraph.disclosure.complete,
              )}
        </DisclosureItem>
      </dl>

      <p className="text-muted-foreground">
        {t(
          language,
          (dictionary) => dictionary.traceGraph.disclosure.transfersLoaded,
          {
            loaded: disclosure.loadedTransfers.toLocaleString(),
            reported: disclosure.reportedTransfers.toLocaleString(),
          },
        )}
      </p>

      {partial && disclosure.reason ? (
        <p className="text-muted-foreground">
          {t(language, (dictionary) => dictionary.traceGraph.disclosure.reason)}{' '}
          {reasonSentence(disclosure.reason, language)}
        </p>
      ) : null}

      <p className="text-muted-foreground">
        {disclosure.truncated
          ? t(
              language,
              (dictionary) => dictionary.traceGraph.disclosure.truncated,
            )
          : t(
              language,
              (dictionary) => dictionary.traceGraph.disclosure.withinCap,
            )}
      </p>

      {shortOfRequestedDepth ? (
        <p className="font-medium text-amber-700 dark:text-amber-400">
          {t(
            language,
            (dictionary) => dictionary.traceGraph.disclosure.depthShortfall,
            {
              reached: disclosure.depthReached,
              requested: disclosure.depthRequested,
            },
          )}
        </p>
      ) : null}
    </div>
  );
}
