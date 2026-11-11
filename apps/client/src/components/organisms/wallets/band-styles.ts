/** Score-chip and score-bar classes shared by the wallet page and the preview. */
export const bandBadge: Record<string, string> = {
  high: 'border-destructive/30 bg-destructive/10 text-destructive',
  moderate:
    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const bandBar: Record<string, string> = {
  high: 'bg-destructive',
  moderate: 'bg-amber-500',
  low: 'bg-emerald-500',
}
