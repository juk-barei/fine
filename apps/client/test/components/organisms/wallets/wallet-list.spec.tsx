import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { WalletListItem } from '@repo/contracts'
import { WalletList } from '@/components/organisms/wallets/wallet-list'

const scored: WalletListItem = {
  address: '4172d5f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0',
  score: 0.82,
  band: 'high',
  confidence: 'medium',
  labelTier: 'tier_1',
  decisionStatus: 'flagged',
  lastAnalysed: '2026-11-11T13:27:15.701Z',
}

const unscored: WalletListItem = {
  address: '4100000000000000000000000000000000000000',
  score: null,
  band: null,
  confidence: null,
  labelTier: null,
  decisionStatus: null,
  lastAnalysed: null,
}

describe('WalletList', () => {
  it('renders the empty state when there are no wallets', () => {
    render(<WalletList nodes={[]} />)

    expect(screen.getByText('No wallets analysed yet')).toBeTruthy()
    expect(
      screen.getByText('Wallets appear here once a screening has run.'),
    ).toBeTruthy()
  })

  it('renders a scored wallet with its band, confidence and tier', () => {
    render(<WalletList nodes={[scored]} />)

    const row = screen.getByRole('row', { name: /4172d5f0/ })
    expect(within(row).getByText('0.82')).toBeTruthy()
    expect(within(row).getByText('high')).toBeTruthy()
    expect(within(row).getByText('medium')).toBeTruthy()
    expect(within(row).getByText('tier 1')).toBeTruthy()
    expect(within(row).getByText('flagged')).toBeTruthy()
  })

  it('renders an unscored wallet as unknown, never as zero', () => {
    render(<WalletList nodes={[unscored]} />)

    const row = screen.getByRole('row', { name: /4100/ })
    expect(within(row).getByText('not scored')).toBeTruthy()
    expect(within(row).queryByText('0')).toBeNull()
    expect(within(row).queryByText('low')).toBeNull()
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })

  it('shows a loading line instead of the empty state while fetching', () => {
    render(<WalletList nodes={[]} isLoading />)

    expect(screen.getByText('Loading wallets…')).toBeTruthy()
    expect(screen.queryByText('No wallets analysed yet')).toBeNull()
  })

  it('surfaces a query failure', () => {
    render(<WalletList nodes={[]} error="Session expired" />)

    expect(screen.getByText('Session expired')).toBeTruthy()
  })
})
