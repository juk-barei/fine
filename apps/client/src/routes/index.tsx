import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button, Input } from '@/components/atom'
import { getSession } from '@/lib/auth'

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

            <div className="mt-9 flex max-w-md items-center gap-2 rounded-xl border border-border bg-card/40 p-1.5 pl-4">
              <Input
                disabled
                aria-label="Tron address"
                placeholder="Paste a Tron address (T…)"
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <Button asChild className="shrink-0">
                <Link to="/sign-in" search={{ redirect: '/wallets' }}>
                  Sign in to screen
                  <ArrowRight />
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              54 sanctioned · 7,954 frozen · 581 seized
            </p>
          </div>

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
        </section>

        <section className="grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-3">
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
