import type { SupportedLanguage } from "@/i18n"
import { getTranslation } from "@/i18n"

type BrandPanelProps = {
  variant?: "desktop" | "mobile"
  language?: SupportedLanguage
}

const tiers = [
  { tier: 'Tier 1', name: 'OFAC SDN', count: '54' },
  { tier: 'Tier 2', name: 'Tether', count: '7,954' },
  { tier: 'Tier 3', name: 'NBCTF', count: '581' },
]

function BrandPanel({ variant = "desktop", language = "en" }: BrandPanelProps) {
  if (variant === "mobile") {
    return (
      <header className="relative overflow-hidden border-b border-border bg-card px-6 py-8 md:hidden">
        <div className="relative z-10 flex flex-col items-center text-center">
          <BrandContent language={language} />
        </div>
      </header>
    )
  }

  return (
    <div className="relative hidden overflow-hidden border-r border-border bg-card md:flex md:w-1/2 md:flex-col md:justify-center lg:p-14 md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,255,255,0.06),transparent_100%)]"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col">
        <BrandContent language={language} />
      </div>
    </div>
  )
}

function BrandContent({ language = "en" }: { language?: SupportedLanguage }) {
  const dict = getTranslation(language)
  const t = dict.signIn

  return (
    <>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        <div className="text-left">
          <span className="block text-base font-semibold tracking-tight">
            {dict.brand.productName}
          </span>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {t.brandSubtitle}
          </p>
        </div>
      </div>

      <h2 className="max-w-sm text-2xl font-semibold leading-tight tracking-tight text-balance">
        {t.brandHeading}
      </h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t.brandDescription}
      </p>

      <dl className="mt-10 grid w-full max-w-sm grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {tiers.map((entry) => (
          <div key={entry.tier} className="bg-card px-3 py-3">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {entry.tier} · {entry.name}
            </dt>
            <dd className="mt-1 font-mono text-sm">{entry.count}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">{t.brandTrust}</p>
    </>
  )
}

export { BrandPanel }
