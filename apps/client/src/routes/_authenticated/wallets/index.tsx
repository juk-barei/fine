import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ScanSearch } from 'lucide-react'
import { Button } from '@/components/atom'
import { Sidebar, WalletList } from '@/components/organisms'
import { GraphQLRequestError } from '@/lib/graphql'
import { usePermissions } from '@/lib/permissions'
import { useWallets } from '@/lib/wallets'
import { getTranslation } from '@/i18n'
import type { SupportedLanguage } from '@/i18n'

export const Route = createFileRoute('/_authenticated/wallets/')({
  component: WalletsPage,
})

function WalletsPage() {
  const [activeNav, setActiveNav] = useState('wallets')
  const language: SupportedLanguage = 'en'
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { user, has } = usePermissions()
  const navigate = useNavigate()
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
          {has('wallet:create') ? (
            <Button onClick={() => navigate({ to: '/screen' })}>
              <ScanSearch className="h-4 w-4" />
              Screen wallet
            </Button>
          ) : null}
        </div>

        <div className="mt-6">
          <WalletList
            nodes={wallets.data?.nodes ?? []}
            isLoading={wallets.isLoading}
            error={errorText}
            onSelect={(address) =>
              navigate({ to: '/wallets/$address', params: { address } })
            }
          />
        </div>
      </main>
    </div>
  )
}
