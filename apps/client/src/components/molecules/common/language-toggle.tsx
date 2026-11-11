import type { SupportedLanguage } from "@/i18n"
import { cn } from "cn"
import { Button } from "@/components/atom"

export type LanguageToggleProps = {
  language: SupportedLanguage
  onLanguageChange: (lang: SupportedLanguage) => void
  className?: string
}

function LanguageToggle({ language, onLanguageChange, className }: LanguageToggleProps) {
  return (
    <div
      role="group"
      aria-label="Language selection"
      className={cn(
        "inline-flex items-center rounded-xl bg-muted p-1 border border-border/80 shadow-xs",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onLanguageChange("en")}
        aria-pressed={language === "en"}
        className={cn(
          "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
          language === "en"
            ? "bg-card text-accent-700 shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        EN
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onLanguageChange("km")}
        aria-pressed={language === "km"}
        className={cn(
          "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
          language === "km"
            ? "bg-card text-accent-700 shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        ខ្មែរ
      </Button>
    </div>
  )
}

export { LanguageToggle }
