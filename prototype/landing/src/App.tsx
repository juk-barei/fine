import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const steps = [
  { n: '01', title: 'Screen', body: 'Paste an address. We load its neighbourhood.' },
  { n: '02', title: 'Trace', body: 'Five hops. Cycles once. Truncation shown.' },
  { n: '03', title: 'Export', body: 'One PDF: score, evidence, limits.' },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-foreground" />
            <span className="text-sm font-medium tracking-tight">fine</span>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <section className="grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <Badge variant="outline" className="border-border/80 font-normal text-muted-foreground">
              Self-hosted · TRC-20
            </Badge>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
              Trace Tron USDT in one screen.
            </h1>
            <p className="mt-5 max-w-sm text-base text-muted-foreground">
              Screen a wallet. Follow five hops. Export the dossier.
            </p>

            <div className="mt-9 flex max-w-md items-center gap-2 rounded-xl border border-border bg-card/40 p-1.5 pl-4 focus-within:ring-[3px] focus-within:ring-ring/40">
              <Input
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                placeholder="Paste a Tron address (T…)"
                aria-label="Tron address"
              />
              <Button className="shrink-0">
                Screen
                <ArrowRight />
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
          {steps.map((s) => (
            <div key={s.n} className="bg-background p-6">
              <span className="font-mono text-[11px] text-muted-foreground">{s.n}</span>
              <h2 className="mt-3 text-sm font-medium">{s.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
