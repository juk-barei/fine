import { useId, useState } from 'react';
import { walletGraphInputSchema } from '@repo/contracts';
import { Input } from '@/components/atom';
import { t, type SupportedLanguage } from '@/i18n';

const depthField = walletGraphInputSchema.shape.depth.unwrap();
const DEPTH_MIN = depthField.minValue ?? 1;
const DEPTH_MAX = depthField.maxValue ?? 5;
const DEPTH_VALUES = Array.from(
  { length: DEPTH_MAX - DEPTH_MIN + 1 },
  (_, index) => DEPTH_MIN + index,
);
const MINIMUM_VALUE_FLOOR =
  walletGraphInputSchema.shape.minValueUsdt.unwrap().minValue ?? 0;

/**
 * The trace inputs: depth and minimum transfer value are server-side filters,
 * so both commit to the query rather than shrinking the loaded payload. The
 * depth commits on change; the amount commits on blur or Enter so a
 * half-typed number never fires a query per keystroke. Bounds come from the
 * contract's input schema instead of a second copy of the numbers, and an
 * out-of-range amount is refused here as well as at the server.
 */
export function TraceGraphControls({
  depth,
  minValueUsdt,
  onDepthChange,
  onMinimumValueChange,
  language,
}: {
  depth: number;
  minValueUsdt: number;
  onDepthChange: (depth: number) => void;
  onMinimumValueChange: (minValueUsdt: number) => void;
  language: SupportedLanguage;
}) {
  const id = useId();
  const depthId = `${id}-depth`;
  const minimumId = `${id}-minimum`;
  const minimumHintId = `${id}-minimum-hint`;
  const minimumErrorId = `${id}-minimum-error`;
  const [draft, setDraft] = useState(String(minValueUsdt));
  const [invalid, setInvalid] = useState(false);

  const commitMinimum = () => {
    const parsed = Number(draft.trim());

    if (draft.trim() === '' || !Number.isFinite(parsed) || parsed < MINIMUM_VALUE_FLOOR) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    setDraft(String(parsed));
    onMinimumValueChange(parsed);
  };

  return (
    <div
      role="group"
      aria-label={t(
        language,
        (dictionary) => dictionary.traceGraph.controls.label,
      )}
      className="flex flex-wrap items-start gap-3"
    >
      <div>
        <label
          htmlFor={depthId}
          className="block text-[11px] font-medium text-muted-foreground"
        >
          {t(language, (dictionary) => dictionary.traceGraph.controls.depth)}
        </label>
        <select
          id={depthId}
          value={depth}
          onChange={(event) => onDepthChange(Number(event.target.value))}
          className="mt-1 h-8 rounded-lg border border-input bg-card px-2 pr-7 text-xs font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {DEPTH_VALUES.map((value) => (
            <option key={value} value={value}>
              {value}{' '}
              {t(language, (dictionary) =>
                value === 1
                  ? dictionary.traceGraph.controls.hop
                  : dictionary.traceGraph.controls.hops,
              )}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={minimumId}
          className="block text-[11px] font-medium text-muted-foreground"
        >
          {t(
            language,
            (dictionary) => dictionary.traceGraph.controls.minimumValue,
          )}
        </label>
        <Input
          id={minimumId}
          type="number"
          inputMode="decimal"
          min={MINIMUM_VALUE_FLOOR}
          step={100}
          value={draft}
          aria-invalid={invalid}
          aria-describedby={invalid ? minimumErrorId : minimumHintId}
          onChange={(event) => {
            setDraft(event.target.value);
            if (invalid) setInvalid(false);
          }}
          onBlur={commitMinimum}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commitMinimum();
          }}
          className="mt-1 h-8 w-36 text-xs"
        />
        <p id={minimumHintId} className="mt-1 text-[11px] text-muted-foreground">
          {t(
            language,
            (dictionary) => dictionary.traceGraph.controls.minimumValueHint,
          )}
        </p>
        {invalid ? (
          <p id={minimumErrorId} role="alert" className="mt-1 text-[11px] text-destructive">
            {t(
              language,
              (dictionary) => dictionary.traceGraph.controls.minimumValueInvalid,
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
