import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Sidebar, WalletList } from '@/components/organisms'
import { LanguageToggle } from '@/components/molecules'
import { usePermissions } from '@/lib/permissions'
import { useWallets } from '@/lib/wallets'
import { GraphQLRequestError } from '@/lib/graphql'
import { getTranslation } from '@/i18n'
import type { SupportedLanguage } from '@/i18n'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const [activeNav, setActiveNav] = useState('dashboard')
  const [language, setLanguage] = useState<SupportedLanguage>('en')
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { user } = usePermissions()
  const wallets = useWallets()
  const errors = getTranslation(language).errors
  const failure = wallets.error
  const errorText =
    failure === null
      ? null
      : failure instanceof GraphQLRequestError && failure.code === 'FORBIDDEN'
        ? errors.forbidden
        : failure instanceof GraphQLRequestError &&
            (failure.code === 'UNAUTHORIZED' || failure.code === 'SESSION_REVOKED')
          ? errors.unauthorized
          : errors.unknown

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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Wallets</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ''}.
            </p>
          </div>
          <LanguageToggle language={language} onLanguageChange={setLanguage} />
        </div>

        <div className="mt-6">
          <WalletList
            nodes={wallets.data?.nodes ?? []}
            isLoading={wallets.isLoading}
            error={errorText}
          />
        </div>
      </main>
    </div>
  )
}

export default Dashboard
