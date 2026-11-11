import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { WalletGraph } from '@repo/contracts'
import { WalletGraphView } from '@/components/organisms/wallets/wallet-graph'

const subject = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7'
const counterparty = 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS'
const txHash = 'a'.repeat(64)

const graph: WalletGraph = {
  nodes: [
    { id: subject, label: 'TLa2f6…YjU7', band: 'high', tier: 'tier_1', subject: true, hops: 0 },
    { id: counterparty, label: 'TYASr5…xHLS', band: 'low', tier: 'tier_3', subject: false, hops: 1 },
  ],
  edges: [
    {
      from: subject,
      to: counterparty,
      amountUsdt: 1250,
      txHash,
      timestamp: '2026-11-11T13:27:15.701Z',
    },
  ],
}

describe('WalletGraphView', () => {
  it('draws the subject, the counterparty and the transfer', () => {
    const { container } = render(<WalletGraphView graph={graph} />)

    expect(screen.getByText('TLa2f6…YjU7')).toBeTruthy()
    expect(screen.getByText('TYASr5…xHLS')).toBeTruthy()
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(container.querySelector('polygon')).toBeTruthy()
  })

  it('shows an address when a node is selected', () => {
    render(<WalletGraphView graph={graph} />)

    fireEvent.click(screen.getByText('TYASr5…xHLS'))

    expect(screen.getByText(counterparty)).toBeTruthy()
    expect(screen.getByText('1 hop')).toBeTruthy()
  })

  it('shows amount, txid and timestamp when a transfer is selected', () => {
    const { container } = render(<WalletGraphView graph={graph} />)

    fireEvent.click(container.querySelectorAll('line')[0])

    expect(screen.getByText('1,250 USDT')).toBeTruthy()
    expect(screen.getByText(txHash)).toBeTruthy()
  })
})
