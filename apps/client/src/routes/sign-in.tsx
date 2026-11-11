import { createFileRoute } from "@tanstack/react-router"
import type { SupportedLanguage } from "@/i18n"
import { getTranslation } from "@/i18n"
import { SignInForm, BrandPanel } from "@/components/organisms"

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignIn,
})

function SignIn() {
  const { redirect } = Route.useSearch()
  const language: SupportedLanguage = "en"
  const t = getTranslation(language)

  return (
    <div className="flex min-h-screen flex-col md:flex-row md:items-stretch">
      <BrandPanel variant="desktop" language={language} />
      <BrandPanel variant="mobile" language={language} />

      <main className="flex flex-1 flex-col px-5 py-10 md:items-center md:justify-center md:p-10 lg:p-14">
        <div className="mx-auto flex w-full max-w-sm flex-col justify-start md:flex-none md:justify-center">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {t.signIn.welcomeBack}
            </h1>
          </div>

          <SignInForm translations={t.signIn} redirectTo={redirect} />

        </div>
      </main>
    </div>
  )
}
