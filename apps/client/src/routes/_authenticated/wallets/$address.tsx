import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react'
import { tronAddressSchema, type WalletDetail } from '@repo/contracts'
import { Button, CopyButton } from '@/components/atom'
import { Sidebar, WalletGraphView } from '@/components/organisms'
import { GraphQLRequestError } from '@/lib/graphql'
import { useWalletDetail } from '@/lib/wallets'
import type { SupportedLanguage } from '@/i18n'

export const Route = createFileRoute('/_authenticated/wallets/$address')({
  component: WalletDetailPage,
})

const bandBadge: Record<string, string> = {
  high: 'border-destructive/30 bg-destructive/10 text-destructive',
  moderate:
    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

const bandBar: Record<string, string> = {
  high: 'bg-destructive',
  moderate: 'bg-amber-500',
  low: 'bg-emerald-500',
}

function WalletDetailPage() {
  const { address } = Route.useParams()
  const [language] = useState<SupportedLanguage>('en')
  const [activeNav, setActiveNav] = useState('wallets')
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const navigate = useNavigate()
  const parsed = tronAddressSchema.safeParse(address)
  const wallet = useWalletDetail(parsed.success ? address : null)
  const failure = wallet.error
  const errorText =
    failure === null || failure === undefined
      ? null
      : failure instanceof GraphQLRequestError && failure.code === 'FORBIDDEN'
        ? 'Your role cannot read this wallet.'
        : failure instanceof GraphQLRequestError &&
            (failure.code === 'UNAUTHORIZED' || failure.code === 'SESSION_REVOKED')
          ? 'Your session expired. Sign in again.'
          : 'Could not load this wallet.'

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        language={language}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <main className="min-w-0 flex-1 p-6 md:p-8">
        <Link
          to="/wallets"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Wallets
        </Link>

        {!parsed.success ? (
          <div className="mt-6 max-w-2xl">
            <h1 className="font-mono text-base font-semibold tracking-tight">
              {address}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              That is not a TRON address (T…, 34 characters), so there is
              nothing to look up. Check the address and try again.
            </p>
          </div>
        ) : wallet.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading wallet…</p>
        ) : errorText ? (
          <p role="alert" className="mt-6 text-sm text-destructive">
            {errorText}
          </p>
        ) : wallet.data === null || wallet.data === undefined ? (
          <div className="mt-6 max-w-2xl rounded-2xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Not screened yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              No screening result is stored for
              <span className="mx-1 font-mono text-xs">{address}</span>.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate({ to: '/screen', search: { address } })}
            >
              Screen this wallet
            </Button>
          </div>
        ) : (
          <WalletDetailView detail={wallet.data} />
        )}
      </main>
    </div>
  )
}

function WalletDetailView({ detail }: { detail: WalletDetail }) {
  const navigate = useNavigate()
  const { wallet, flags, graph } = detail
  const score = wallet.score
  const band = wallet.band

  return (
    <>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-mono text-base font-semibold tracking-tight sm:text-lg">
            {wallet.address}
          </h1>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span>Simulated scoring — deterministic mock result</span>
            <CopyButton textToCopy={wallet.address} size="sm" />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            navigate({ to: '/screen', search: { address: wallet.address } })
          }
        >
          Re-screen
        </Button>
      </div>

      <div className="mt-8 max-w-4xl">
        <section>
          {score !== null && band !== null ? (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Risk score</p>
                <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">
                  {score.toFixed(2)}
                </p>
              </div>
              <div className="min-w-48 flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${bandBar[band]}`}
                    style={{ width: `${Math.round(score * 100)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${bandBadge[band]}`}
                  >
                    {band} risk
                  </span>
                  {wallet.decisionStatus ? (
                    <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize">
                      {wallet.decisionStatus}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not scored yet — this wallet exists without a screening result.
            </p>
          )}
        </section>

        <section className="mt-6 border-t pt-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Confidence', wallet.confidence ?? '—'],
              ['Label tier', wallet.labelTier?.replace('_', ' ') ?? '—'],
              ['Decision', wallet.decisionStatus ?? '—'],
              [
                'Analysed',
                wallet.lastAnalysed
                  ? new Date(wallet.lastAnalysed).toLocaleString()
                  : '—',
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm font-medium capitalize">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {graph ? (
          <section className="mt-6 border-t pt-6">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Fund flow
              </p>
              <p className="text-[10px] text-muted-foreground">
                {graph.nodes.filter((node) => !node.subject).length}{' '}
                counterparties · 1 hop
              </p>
            </div>
            <WalletGraphView graph={graph} />
          </section>
        ) : null}

        <section className="mt-6 border-t pt-6">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Flags
          </p>
          {score === null ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Not scored yet, so there are no flags.
            </p>
          ) : flags.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {flags.map((flag) => (
                <li key={flag} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              No adverse exposure found.
            </p>
          )}
        </section>

        <div className="mt-6 border-t pt-6">
          <Button onClick={() => navigate({ to: '/wallets' })}>
            Back to wallets
          </Button>
        </div>
      </div>
    </>
  )
}
