import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import type { WalletScreening } from '@repo/contracts'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: unknown }) => ({ ...options }),
  Link: 'a',
  redirect: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/wallets', () => ({
  usePreviewWallet: vi.fn(),
}))

import { usePreviewWallet } from '@/lib/wallets'
import { Route } from '@/routes/index'

const Landing = (Route as unknown as { component: ComponentType }).component
const mockedPreview = vi.mocked(usePreviewWallet)

const ADDRESS = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7'

function screening(scored: boolean): WalletScreening {
  return {
    wallet: {
      address: ADDRESS,
      score: scored ? 0.82 : null,
      band: scored ? 'high' : null,
      confidence: scored ? 'medium' : null,
      labelTier: null,
      decisionStatus: scored ? 'flagged' : null,
      lastAnalysed: null,
    },
    flags: [],
    simulated: true,
  }
}

function stubPreview(data: WalletScreening | null) {
  mockedPreview.mockReturnValue({
    data,
    mutate: vi.fn(),
    isPending: false,
    error: null,
  } as never)
}

beforeEach(() => {
  mockedPreview.mockReset()
})

describe('landing preview honesty', () => {
  it('renders a scored wallet with its band and score', () => {
    stubPreview(screening(true))

    render(<Landing />)

    expect(screen.getByText('0.82')).toBeTruthy()
    expect(screen.getByText('high risk')).toBeTruthy()
  })

  it('renders an unscored wallet as not scored, never as low risk', () => {
    stubPreview(screening(false))

    render(<Landing />)

    expect(
      screen.getByText(
        'Not scored yet — this wallet exists without a screening result.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText('low risk')).toBeNull()
    expect(screen.queryByText('high risk')).toBeNull()
    expect(screen.queryByText('0.00')).toBeNull()
  })
})
