import type { SupportedLanguage } from "@/i18n"
import { getTranslation } from "@/i18n"

type BrandPanelProps = {
  variant?: "desktop" | "mobile"
  language?: SupportedLanguage
}

function BrandPanel({ variant = "desktop", language = "en" }: BrandPanelProps) {
  if (variant === "mobile") {
    return (
      <header className="relative overflow-hidden bg-card px-6 pt-10 pb-8 text-foreground md:hidden">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-foreground/[0.03]" />
        <div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-foreground/[0.02]" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <BrandContent language={language} />
        </div>
      </header>
    )
  }

  return (
    <div className="relative hidden md:flex md:w-1/2 flex-col items-center justify-center overflow-hidden bg-card p-8 text-center text-foreground lg:p-14">
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-foreground/[0.03]" />
      <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-foreground/[0.02]" />

      <BrandContent language={language} />
    </div>
  )
}

function BrandContent({ language = "en" }: { language?: SupportedLanguage }) {
  const dict = getTranslation(language)
  const t = dict.signIn

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        <div className="text-left">
          <span className="text-lg font-bold tracking-tight">{dict.brand.productName}</span>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.brandSubtitle}</p>
        </div>
      </div>

      <h2 className="max-w-sm text-xl font-bold leading-snug tracking-tight lg:text-2xl">
        {t.brandHeading}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t.brandDescription}
      </p>

      <div className="mt-6 flex items-center gap-3 border-t border-border pt-6">
        <div className="-space-x-2 flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-white ring-2 ring-card">A</div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-400 text-[10px] font-bold text-white ring-2 ring-card">B</div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white ring-2 ring-card">C</div>
        </div>
        <p className="text-xs text-muted-foreground">{t.brandTrust}</p>
      </div>
    </>
  )
}

export { BrandPanel }
