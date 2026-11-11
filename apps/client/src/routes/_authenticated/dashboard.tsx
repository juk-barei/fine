import { createFileRoute, redirect } from '@tanstack/react-router'

/** The wallet list moved to /wallets; old links keep working. */
export const Route = createFileRoute('/_authenticated/dashboard')({
  beforeLoad: () => {
    throw redirect({ to: '/wallets' })
  },
  component: () => null,
})
