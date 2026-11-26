import type {
  DecisionStatus,
  IntermediaryClass,
  LabelTier,
  TraceEdgeDirection,
  WalletBand,
  WalletConfidence,
} from '@repo/contracts'
import { t, type SupportedLanguage } from '@/i18n'

/**
 * The wallet vocabulary: every word an enum renders as, the missing-value
 * marker, the money and date formats, and the band styles, owned by one
 * module. Renderers call `bandLabel(band, 'km')` and never learn a
 * dictionary path or a message key; the Records below stay internal, and
 * their `Record<Enum, …>` types make a missing word a compile error rather
 * than an undefined cell.
 */

const BAND_KEY: Record<WalletBand, 'bandHigh' | 'bandModerate' | 'bandLow'> = {
  high: 'bandHigh',
  moderate: 'bandModerate',
  low: 'bandLow',
}

const TIER_KEY: Record<LabelTier, 'tier1' | 'tier2' | 'tier3'> = {
  tier_1: 'tier1',
  tier_2: 'tier2',
  tier_3: 'tier3',
}

const CONFIDENCE_KEY: Record<
  WalletConfidence,
  'confidenceHigh' | 'confidenceMedium' | 'confidenceLow'
> = {
  high: 'confidenceHigh',
  medium: 'confidenceMedium',
  low: 'confidenceLow',
}

const INTERMEDIARY_KEY: Record<
  IntermediaryClass,
  'passThrough' | 'peelChain' | 'consolidation'
> = {
  pass_through: 'passThrough',
  peel_chain: 'peelChain',
  consolidation: 'consolidation',
}

const DIRECTION_KEY: Record<TraceEdgeDirection, 'inbound' | 'outbound'> = {
  inbound: 'inbound',
  outbound: 'outbound',
}

const DECISION_KEY: Record<
  DecisionStatus,
  'decisionOpen' | 'decisionFlagged' | 'decisionCleared'
> = {
  open: 'decisionOpen',
  flagged: 'decisionFlagged',
  cleared: 'decisionCleared',
}

export function bandLabel(
  band: WalletBand,
  language: SupportedLanguage,
): string {
  return t(language, (dictionary) => dictionary.traceGraph.inspector[BAND_KEY[band]])
}

export function tierLabel(
  tier: LabelTier,
  language: SupportedLanguage,
): string {
  return t(language, (dictionary) => dictionary.traceGraph[TIER_KEY[tier]])
}

export function confidenceLabel(
  confidence: WalletConfidence,
  language: SupportedLanguage,
): string {
  return t(
    language,
    (dictionary) => dictionary.traceGraph.inspector[CONFIDENCE_KEY[confidence]],
  )
}

export function intermediaryLabel(
  intermediary: IntermediaryClass,
  language: SupportedLanguage,
): string {
  return t(
    language,
    (dictionary) => dictionary.traceGraph.inspector[INTERMEDIARY_KEY[intermediary]],
  )
}

export function directionLabel(
  direction: TraceEdgeDirection,
  language: SupportedLanguage,
): string {
  return t(language, (dictionary) => dictionary.traceGraph[DIRECTION_KEY[direction]])
}

export function decisionLabel(
  status: DecisionStatus,
  language: SupportedLanguage,
): string {
  return t(language, (dictionary) => dictionary.wallet[DECISION_KEY[status]])
}

/**
 * The missing-value marker. A null band, confidence, tier or decision
 * renders as this, never as a zero or a fabricated "low".
 */
export function notAvailableLabel(language: SupportedLanguage): string {
  return t(language, (dictionary) => dictionary.common.notAvailable)
}

export function formatUsdt(amount: number): string {
  return `${amount.toLocaleString()} USDT`
}

/**
 * The ISO timestamp's own UTC text — a slice, not a locale conversion, so
 * the string always matches what the payload says.
 */
export function formatUtcTimestamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`
}

export function formatListedDate(iso: string): string {
  return iso.slice(0, 10)
}

/** Score-chip and score-bar classes shared by the wallet page and the preview. */
export const bandBadge: Record<WalletBand, string> = {
  high: 'border-destructive/30 bg-destructive/10 text-destructive',
  moderate:
    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const bandBar: Record<WalletBand, string> = {
  high: 'bg-destructive',
  moderate: 'bg-amber-500',
  low: 'bg-emerald-500',
}

/** A node without a band is not "low": it is simply not scored. */
export const NEUTRAL_BAND = 'border-border bg-muted/40 text-muted-foreground'
