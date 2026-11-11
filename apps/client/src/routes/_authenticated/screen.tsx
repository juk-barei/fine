import { useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2, ScanSearch } from 'lucide-react'
import { Button } from '@/components/atom'
import { Sidebar } from '@/components/organisms'
import { useAppForm } from '@/lib/form'
import { GraphQLRequestError } from '@/lib/graphql'
import { usePermissions } from '@/lib/permissions'
import { useScreenWallet } from '@/lib/wallets'
import { createScreenWalletSchema } from '@/lib/validations/screen-wallet'
import type { SupportedLanguage } from '@/i18n'

export const Route = createFileRoute('/_authenticated/screen')({
  validateSearch: (search: Record<string, unknown>): { address?: string } => ({
    address: typeof search.address === 'string' ? search.address : undefined,
  }),
  component: ScreenWalletPage,
})

const STEPS = [
  'Validating address',
  'Loading TRC-20 transfers',
  'Building the wallet graph',
  'Scoring risk features',
  'Writing the result',
] as const

const MIN_RUN_MS = 1400
const STEP_MS = 320

type Phase = 'form' | 'running'

function errorMessage(error: unknown): string {
  if (error instanceof GraphQLRequestError) {
    if (error.code === 'FORBIDDEN') {
      return 'You do not have permission to screen wallets.'
    }
    if (error.code === 'VALIDATION_ERROR') {
      return 'That address failed server validation. Check it and try again.'
    }
  }
  return 'Screening failed. Try again.'
}

function ScreenWalletPage() {
  const [language] = useState<SupportedLanguage>('en')
  const [activeNav, setActiveNav] = useState('wallets')
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { has } = usePermissions()
  const navigate = useNavigate()
  const { address: prefilledAddress } = Route.useSearch()
  const mutation = useScreenWallet()

  const [phase, setPhase] = useState<Phase>('form')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [screenedAddress, setScreenedAddress] = useState('')

  const schema = useMemo(
    () =>
      createScreenWalletSchema({
        addressRequired: 'Enter a wallet address.',
        addressInvalid: 'That is not a TRON address (T…, 34 characters).',
      }),
    [],
  )

  const runScreening = async (address: string) => {
    setScreenedAddress(address)
    setError(null)
    setProgress(0)
    setPhase('running')

    const startedAt = Date.now()
    const timer = setInterval(() => {
      setProgress((step) => (step < STEPS.length - 1 ? step + 1 : step))
    }, STEP_MS)

    try {
      const screening = await mutation.mutateAsync(address)
      const remaining = MIN_RUN_MS - (Date.now() - startedAt)
      if (remaining > 0) {
        const { promise, resolve } = Promise.withResolvers<void>()
        setTimeout(resolve, remaining)
        await promise
      }
      clearInterval(timer)
      setProgress(STEPS.length)
      await navigate({
        to: '/wallets/$address',
        params: { address: screening.wallet.address },
      })
    } catch (failure) {
      clearInterval(timer)
      setError(errorMessage(failure))
      setPhase('form')
    }
  }

  const form = useAppForm({
    defaultValues: { address: prefilledAddress ?? '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await runScreening(value.address.trim())
    },
  })

  const canScreen = has('wallet:create')

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
        <Link
          to="/wallets"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Wallets
        </Link>

        <div className="mt-3">
          <h1 className="text-lg font-semibold tracking-tight">Screen a wallet</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Paste a TRON address. The screening writes its result and opens the
            wallet's page, so the run is still there when you come back.
          </p>
        </div>

        <div className="mt-8 max-w-2xl">
          {!canScreen ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              Your role cannot create screenings. Ask an administrator for the
              wallet:create permission.
            </div>
          ) : phase === 'running' ? (
            <div className="rounded-2xl border bg-card/40 px-6 py-8">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Screening
              </p>
              <p className="mt-1 truncate font-mono text-sm">{screenedAddress}</p>
              <ul className="mt-6 space-y-3">
                {STEPS.map((step, index) => {
                  const state =
                    index < progress ? 'done' : index === progress ? 'active' : 'pending'
                  return (
                    <li key={step} className="flex items-center gap-3 text-sm">
                      <span
                        className={
                          state === 'done'
                            ? 'flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : state === 'active'
                              ? 'flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground'
                              : 'flex h-6 w-6 items-center justify-center rounded-full border text-muted-foreground'
                        }
                      >
                        {state === 'done' ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : state === 'active' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                      </span>
                      <span
                        className={
                          state === 'pending'
                            ? 'text-muted-foreground'
                            : 'text-foreground'
                        }
                      >
                        {step}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card/40 p-6">
              {error ? (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  form.handleSubmit()
                }}
                className="space-y-5"
                noValidate
              >
                <form.AppField name="address">
                  {(field) => (
                    <field.TextField
                      label="Wallet address"
                      placeholder="TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7"
                      autoComplete="off"
                      leadingIcon={<ScanSearch className="h-4 w-4" />}
                      description="TRON base58 address. Results come from the deterministic mock scorer."
                    />
                  )}
                </form.AppField>

                <form.AppForm>
                  <form.SubmitButton label="Run screening" loadingLabel="Screening…" />
                </form.AppForm>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
