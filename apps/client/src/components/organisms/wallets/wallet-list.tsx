import type { WalletListItem } from '@repo/contracts'

interface WalletListProps {
  nodes: WalletListItem[]
  isLoading?: boolean
  error?: string | null
  /** When set, a row navigates on click and accepts Enter or Space. */
  onSelect?: (address: string) => void
}

const headCell = 'px-4 py-2 text-left font-medium'
const bodyCell = 'px-4 py-3 align-middle'

/**
 * The wallet read model as a table. Every field except the address can be
 * absent: an unscored wallet renders as "not scored", never as a zero, and an
 * unknown band, tier or decision renders as an em dash.
 */
export function WalletList({
  nodes,
  isLoading = false,
  error = null,
  onSelect,
}: WalletListProps) {
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (isLoading && nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading wallets…</p>
  }

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-14 text-center">
        <p className="text-sm font-medium">No wallets analysed yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Wallets appear here once a screening has run.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className={headCell}>Address</th>
            <th className={headCell}>Score</th>
            <th className={headCell}>Band</th>
            <th className={headCell}>Confidence</th>
            <th className={headCell}>Tier</th>
            <th className={headCell}>Decision</th>
            <th className={headCell}>Last analysed</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((wallet) => (
            <tr
              key={wallet.address}
              className={
                onSelect
                  ? 'group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none'
                  : 'border-b last:border-0'
              }
              onClick={onSelect ? () => onSelect(wallet.address) : undefined}
              onKeyDown={
                onSelect
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(wallet.address)
                      }
                    }
                  : undefined
              }
              tabIndex={onSelect ? 0 : undefined}
            >
              <td
                className={`${bodyCell} font-mono text-xs ${
                  onSelect ? 'underline-offset-4 group-hover:underline' : ''
                }`}
              >
                {wallet.address}
              </td>
              <td className={bodyCell}>
                {wallet.score === null ? (
                  <span className="text-muted-foreground">not scored</span>
                ) : (
                  wallet.score.toFixed(2)
                )}
              </td>
              <td className={bodyCell}>{wallet.band ?? '—'}</td>
              <td className={bodyCell}>{wallet.confidence ?? '—'}</td>
              <td className={bodyCell}>
                {wallet.labelTier ? wallet.labelTier.replace('_', ' ') : '—'}
              </td>
              <td className={bodyCell}>{wallet.decisionStatus ?? '—'}</td>
              <td className={`${bodyCell} text-muted-foreground`}>
                {wallet.lastAnalysed
                  ? new Date(wallet.lastAnalysed).toLocaleDateString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
