import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import type { WalletDetail } from '@repo/contracts'

const ADDRESS = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: unknown }) => ({
    ...options,
    useParams: () => ({ address: ADDRESS }),
  }),
  useNavigate: () => vi.fn(),
  Link: 'a',
}))

vi.mock('@/components/organisms', () => ({
  Sidebar: () => null,
  WalletTraceGraph: () => 'graph rendered',
}))

vi.mock('@/lib/wallets', () => ({
  useWalletDetail: vi.fn(),
}))

import { useWalletDetail } from '@/lib/wallets'
import { Route } from '@/routes/_authenticated/wallets/$address'

const DetailPage = (Route as unknown as { component: ComponentType })
  .component

const scored: WalletDetail = {
  wallet: {
    address: ADDRESS,
    score: 0.82,
    band: 'high',
    confidence: 'medium',
    labelTier: 'tier_1',
    decisionStatus: 'flagged',
    lastAnalysed: '2026-11-11T13:27:15.701Z',
  },
  flags: [],
  simulated: true,
}

const unscored: WalletDetail = {
  wallet: {
    address: ADDRESS,
    score: null,
    band: null,
    confidence: null,
    labelTier: null,
    decisionStatus: null,
    lastAnalysed: null,
  },
  flags: [],
  simulated: true,
}

const mockedDetail = vi.mocked(useWalletDetail)

function stubDetail(detail: WalletDetail) {
  mockedDetail.mockReturnValue({
    data: detail,
    isLoading: false,
    error: null,
  } as never)
}

beforeEach(() => {
  mockedDetail.mockReset()
})

describe('wallet detail fund flow', () => {
  it('renders the trace graph for a scored wallet', () => {
    stubDetail(scored)

    render(<DetailPage />)

    expect(screen.getByText('graph rendered')).toBeTruthy()
  })

  it('leaves the trace graph out when the wallet has no score', () => {
    stubDetail(unscored)

    render(<DetailPage />)

    expect(
      screen.getByText(
        'Not scored yet — this wallet exists without a screening result.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText('graph rendered')).toBeNull()
  })
})
