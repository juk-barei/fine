import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowRight, Loader2 } from 'lucide-react'
import { tronAddressSchema, type WalletScreening } from '@repo/contracts'
import { Button, Input } from '@/components/atom'
import { WalletGraphView, bandBadge, bandBar } from '@/components/organisms'
import { GraphQLRequestError } from '@/lib/graphql'
import { getSession } from '@/lib/auth'
import { usePreviewWallet } from '@/lib/wallets'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data } = await getSession()
    if (data) {
      throw redirect({ to: '/wallets' })
    }
  },
  component: Landing,
})

const steps = [
  { n: '01', title: 'Screen', body: 'Paste an address. We load its neighbourhood.' },
  { n: '02', title: 'Trace', body: 'Five hops. Cycles once. Truncation shown.' },
  { n: '03', title: 'Export', body: 'One PDF: score, evidence, limits.' },
]

function Landing() {
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const preview = usePreviewWallet()
  const result = preview.data ?? null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = tronAddressSchema.safeParse(address)
    if (!parsed.success) {
      setError('That is not a TRON address (T…, 34 characters).')
      return
    }
    setError(null)
    preview.mutate(parsed.data)
  }

  const previewError =
    preview.error instanceof GraphQLRequestError &&
    preview.error.code === 'VALIDATION_ERROR'
      ? 'That address failed server validation.'
      : preview.error
        ? 'Screening failed. Try again.'
        : null

  return (
    <div className="min-h-screen bg-[radial-gradient(70%_55%_at_50%_0%,rgba(255,255,255,0.07),transparent_100%)]">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-foreground" />
            <span className="text-sm font-medium tracking-tight">fine</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/sign-in" search={{ redirect: '/wallets' }}>
              Sign in
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <section className="grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <span className="inline-flex w-fit items-center rounded-md border border-border/80 px-2 py-0.5 text-xs text-muted-foreground">
              Self-hosted · TRC-20
            </span>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
              Trace Tron USDT in one screen.
            </h1>
            <p className="mt-5 max-w-sm text-base text-muted-foreground">
              Screen a wallet. Follow five hops. Export the dossier.
            </p>

            <form onSubmit={submit} className="mt-9 max-w-md" noValidate>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card/40 p-1.5 pl-4">
                <Input
                  aria-label="Tron address"
                  placeholder="Paste a Tron address (T…)"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  autoComplete="off"
                  className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  className="shrink-0"
                  disabled={preview.isPending}
                >
                  {preview.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Screening…
                    </>
                  ) : (
                    <>
                      Screen
                      <ArrowRight />
                    </>
                  )}
                </Button>
              </div>
              {error || previewError ? (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {error ?? previewError}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No account needed. Signing in saves the screening.
                </p>
              )}
            </form>

            <p className="mt-4 text-xs text-muted-foreground">
              54 sanctioned · 7,954 frozen · 581 seized
            </p>
          </div>

          {result ? null : (
            <div className="relative hidden lg:block">
              <svg
                viewBox="0 0 420 300"
                className="w-full text-white/25"
                role="img"
                aria-label="Wallet graph with a labelled endpoint"
              >
                <g stroke="currentColor" strokeWidth="1.25">
                  <line x1="70" y1="210" x2="150" y2="140" />
                  <line x1="150" y1="140" x2="240" y2="190" />
                  <line x1="240" y1="190" x2="330" y2="110" />
                  <line x1="110" y1="80" x2="150" y2="140" />
                  <line x1="240" y1="190" x2="290" y2="245" />
                  <line x1="150" y1="140" x2="330" y2="110" />
                </g>
                <g className="fill-card" stroke="currentColor" strokeWidth="1.25">
                  <circle cx="70" cy="210" r="9" />
                  <circle cx="150" cy="140" r="8" />
                  <circle cx="240" cy="190" r="8" />
                  <circle cx="110" cy="80" r="7" />
                  <circle cx="290" cy="245" r="7" />
                </g>
                <circle cx="330" cy="110" r="20" className="fill-none stroke-white/25" />
                <circle cx="330" cy="110" r="10" className="fill-foreground" />
                <text
                  x="330"
                  y="88"
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] tracking-wide"
                >
                  labelled
                </text>
              </svg>
            </div>
          )}
        </section>

        {result ? <PreviewResult result={result} /> : null}

        <section className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="bg-background p-6">
              <span className="font-mono text-[11px] text-muted-foreground">{step.n}</span>
              <h2 className="mt-3 text-sm font-medium">{step.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}

function PreviewResult({ result }: { result: WalletScreening }) {
  const { wallet, flags, graph } = result
  const band = wallet.band ?? 'low'
  const score = wallet.score ?? 0

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/40">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-6 py-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Screening preview
          </p>
          <p className="mt-1 truncate font-mono text-sm">{wallet.address}</p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Simulated
        </span>
      </header>

      <div className="px-6 py-6">
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

        <div className="mt-6 border-t pt-6">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Fund flow
            </p>
            <p className="text-[10px] text-muted-foreground">
              {graph.nodes.filter((node) => !node.subject).length} counterparties · 1 hop
            </p>
          </div>
          <WalletGraphView graph={graph} />
        </div>

        <div className="mt-6 border-t pt-6">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Flags
          </p>
          {flags.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {flags.map((flag) => (
                <li key={flag} className="text-sm">
                  {flag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No adverse exposure found.
            </p>
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-6 py-4">
        <p className="text-xs text-muted-foreground">
          Preview only — signing in saves the screening.
        </p>
        <Button asChild>
          <Link to="/sign-in" search={{ redirect: '/wallets' }}>
            Sign in to save
            <ArrowRight />
          </Link>
        </Button>
      </footer>
    </section>
  )
}
