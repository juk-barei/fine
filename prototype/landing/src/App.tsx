import { useState, type FormEvent } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ForensicFlowGraph,
  buildForensicGraphForAddress,
} from '@/components/ForensicFlowGraph';

const steps = [
  {
    n: '01',
    title: 'Screen',
    body: 'Paste an address. We load its neighbourhood.',
  },
  {
    n: '02',
    title: 'Trace',
    body: 'Five hops. Cycles once. Truncation shown.',
  },
  {
    n: '03',
    title: 'Export',
    body: 'One PDF: score, evidence, limits.',
  },
];

const DEMO_SEEDS = [
  {
    label: 'Huione Peel Seed',
    address: 'TLyqzVGLV1DnUQGeoiw61tFhWwvV4A2h9K',
    score: 0.88,
    band: 'high' as const,
  },
  {
    label: 'OFAC SDN Designated',
    address: 'TXm9SanctOfacDesigCluster339Ab4891',
    score: 0.96,
    band: 'high' as const,
  },
  {
    label: 'OTC Relay Desk',
    address: 'TW4kDexPeelChainPassThru91xL881065',
    score: 0.64,
    band: 'moderate' as const,
  },
];

const TRON_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export default function App() {
  const [address, setAddress] = useState(DEMO_SEEDS[0].address);
  const [screenedAddress, setScreenedAddress] = useState<string>(
    DEMO_SEEDS[0].address
  );
  const [error, setError] = useState<string | null>(null);

  const activePreset =
    DEMO_SEEDS.find((s) => s.address === screenedAddress) ?? DEMO_SEEDS[0];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = address.trim();
    if (!TRON_REGEX.test(trimmed)) {
      setError('That is not a TRON address (T…, 34 base58 characters).');
      return;
    }
    setError(null);
    setScreenedAddress(trimmed);
  };

  const handleExportDossier = () => {
    const graphData = buildForensicGraphForAddress(screenedAddress);
    const payload = {
      screenedAddress,
      evaluatedAt: new Date().toISOString(),
      score: activePreset.score,
      band: activePreset.band,
      nodes: graphData.nodes,
      edges: graphData.edges,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fine-dossier-${screenedAddress.slice(0, 8)}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-foreground" />
            <span className="text-sm font-medium tracking-tight">fine</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <section className="grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
          <div>
            <Badge
              variant="outline"
              className="border-border/80 font-normal text-muted-foreground"
            >
              Self-hosted · TRC-20
            </Badge>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
              Trace Tron USDT in one screen.
            </h1>
            <p className="mt-5 max-w-sm text-base text-muted-foreground">
              Screen a wallet. Follow five hops. Export the dossier.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 max-w-md" noValidate>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card/40 p-1.5 pl-4 focus-within:ring-[3px] focus-within:ring-ring/40">
                <Input
                  className="h-9 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0"
                  placeholder="Paste a Tron address (T…)"
                  aria-label="Tron address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="off"
                />
                <Button type="submit" className="shrink-0 cursor-pointer">
                  Screen
                  <ArrowRight />
                </Button>
              </div>
              {error ? (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {error}
                </p>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Presets:</span>
                  {DEMO_SEEDS.map((seed) => (
                    <button
                      key={seed.address}
                      type="button"
                      onClick={() => {
                        setAddress(seed.address);
                        setScreenedAddress(seed.address);
                        setError(null);
                      }}
                      className={`cursor-pointer rounded-md border px-2 py-0.5 text-[11px] transition ${
                        screenedAddress === seed.address
                          ? 'border-foreground/40 bg-foreground/10 text-foreground'
                          : 'border-border/70 bg-card/30 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {seed.label}
                    </button>
                  ))}
                </div>
              )}
            </form>

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
              <circle
                cx="330"
                cy="110"
                r="20"
                className="fill-none stroke-white/25"
              />
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

        {/* Screening Result & Multi-Hop Interactive Graph Section */}
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/40">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-6 py-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Screening preview · 5-hop forensic graph
              </p>
              <p className="mt-1 truncate font-mono text-sm">
                {screenedAddress}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Deterministic Rule Engine
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDossier}
                className="h-7 cursor-pointer gap-1.5 text-xs"
              >
                <Download className="size-3.5" />
                Export dossier
              </Button>
            </div>
          </header>

          <div className="px-6 py-6">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Risk score</p>
                <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight text-red-500">
                  {activePreset.score.toFixed(2)}
                </p>
              </div>
              <div className="min-w-48 flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{ width: `${Math.round(activePreset.score * 100)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium capitalize text-red-400">
                    {activePreset.band} risk
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Flagged · Tier 1 exposure
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-border/70 pt-6">
              <ForensicFlowGraph subjectAddress={screenedAddress} />
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="bg-background p-6">
              <span className="font-mono text-[11px] text-muted-foreground">
                {s.n}
              </span>
              <h2 className="mt-3 text-sm font-medium">{s.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
