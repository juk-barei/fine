import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TraceEdge, TraceNode, WalletTraceGraph } from '@repo/contracts';
import { TraceGraphCanvas } from '@/components/organisms/wallets/trace-graph/trace-graph-canvas';

vi.mock('@/lib/wallets', () => ({
  useWalletGraph: vi.fn(),
}));

import { useWalletGraph } from '@/lib/wallets';
import { WalletTraceGraph as WalletTraceGraphSection } from '@/components/organisms/wallets/trace-graph/trace-graph';

const SUBJECT = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
const HOP_ONE = 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS';
const HOP_ONE_LOW = 'TW5tokvhEfrb77z98Rc8HqbkzQJ6sxYtGX';
const HOP_TWO = 'TZ42sU5kQ2n5rLZ6PhEGkmfLtmHjoi2vpr';

const RULES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((code) => ({
  code,
  triggered: code === 'R1',
  summary: `${code} summary`,
}));

function node(
  overrides: Partial<TraceNode> & Pick<TraceNode, 'address' | 'hop' | 'subject'>,
): TraceNode {
  return {
    kind: overrides.subject ? 'subject' : 'counterparty',
    title: `${overrides.address.slice(0, 6)}…${overrides.address.slice(-4)}`,
    badge: null,
    band: 'low',
    pLaundering: 0.1,
    confidence: 'low',
    volumeUsdt: 1_000,
    intermediary: null,
    labels: [],
    rules: RULES,
    ...overrides,
  };
}

const nodes: TraceNode[] = [
  node({
    address: SUBJECT,
    hop: 0,
    subject: true,
    band: 'high',
    volumeUsdt: 10_250,
    rules: RULES,
  }),
  node({
    address: HOP_ONE,
    hop: 1,
    subject: false,
    band: 'high',
    pLaundering: 0.83,
    confidence: 'medium',
    volumeUsdt: 4_000,
    intermediary: 'pass_through',
    labels: [
      {
        tier: 'tier_1',
        source: 'OFAC SDN (simulated)',
        listedAt: '2026-09-09T00:00:00.000Z',
      },
    ],
  }),
  node({
    address: HOP_ONE_LOW,
    hop: 1,
    subject: false,
    volumeUsdt: 500,
    labels: [
      { tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null },
    ],
  }),
  node({ address: HOP_TWO, hop: 2, subject: false, volumeUsdt: 9_000 }),
];

const edges: TraceEdge[] = [
  {
    id: 'edge-1',
    from: SUBJECT,
    to: HOP_ONE,
    amountUsdt: 1_250,
    txHash: 'a'.repeat(64),
    timestamp: '2026-11-11T13:27:15.701Z',
    hop: 1,
    direction: 'outbound',
  },
  {
    id: 'edge-2',
    from: HOP_ONE,
    to: HOP_TWO,
    amountUsdt: 9_000,
    txHash: 'b'.repeat(64),
    timestamp: '2026-11-12T08:10:00.000Z',
    hop: 2,
    direction: 'outbound',
  },
  {
    id: 'edge-3',
    from: HOP_ONE_LOW,
    to: SUBJECT,
    amountUsdt: 500,
    txHash: 'c'.repeat(64),
    timestamp: '2026-11-13T02:00:00.000Z',
    hop: 1,
    direction: 'inbound',
  },
];

const graph: WalletTraceGraph = {
  simulated: true,
  nodes,
  edges,
  disclosure: {
    depthRequested: 2,
    depthReached: 2,
    minValueUsdt: 0,
    nodesReturned: 4,
    nodeCap: 500,
    truncated: false,
    coverage: 'complete',
    loadedTransfers: 3,
    reportedTransfers: 3,
    reason: null,
  },
};

const noop = () => {};

describe('TraceGraphCanvas', () => {
  it('renders the subject and counterparties with their visible labels', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    expect(screen.getByText('TLa2f6…YjU7')).toBeTruthy();
    expect(screen.getByText('TYASr5…xHLS')).toBeTruthy();
    expect(screen.getByText('TZ42sU…2vpr')).toBeTruthy();
  });

  it('marks the subject distinctly from its counterparties', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const subject = screen.getByRole('button', {
      name: new RegExp(`${SUBJECT}.*subject`, 'i'),
    });
    expect(within(subject).getByText('Subject')).toBeTruthy();

    const counterparty = screen.getByRole('button', {
      name: new RegExp(HOP_ONE),
    });
    expect(within(counterparty).queryByText('Subject')).toBeNull();
  });

  it('orders node controls by hop', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const labels = screen
      .getAllByRole('button', { name: /^Node / })
      .map((button) => button.getAttribute('aria-label') ?? '');

    expect(labels[0]).toContain(SUBJECT);
    const hopTwoIndex = labels.findIndex((label) => label.includes(HOP_TWO));
    const hopOneIndexes = labels
      .map((label, index) => (label.includes(HOP_ONE) ? index : -1))
      .filter((index) => index >= 0);

    expect(Math.max(...hopOneIndexes)).toBeLessThan(hopTwoIndex);
  });

  it('reports a selected node by address and hop', () => {
    const onSelect = vi.fn();
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={onSelect}
        language="en"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(HOP_ONE) }),
    );

    expect(onSelect).toHaveBeenCalledWith({ kind: 'node', address: HOP_ONE });
  });

  it('reports a selected transfer by its id', () => {
    const onSelect = vi.fn();
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={onSelect}
        language="en"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Transfer.*1,250/ }));

    expect(onSelect).toHaveBeenCalledWith({ kind: 'edge', id: 'edge-1' });
  });
});

describe('WalletTraceGraph', () => {
  const mockedHook = vi.mocked(useWalletGraph);

  beforeEach(() => {
    mockedHook.mockReset();
    mockedHook.mockReturnValue({
      data: graph,
      isLoading: false,
      error: null,
    } as never);
  });

  it('shows the loaded graph with its subject', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    expect(screen.getByText('Fund flow')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: new RegExp(`${SUBJECT}.*subject`, 'i') }),
    ).toBeTruthy();
  });

  it('queries the graph with the default depth and minimum value', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    expect(mockedHook).toHaveBeenCalledWith(SUBJECT, 5, 0);
  });

  it('shows a node address and hop when a node is selected', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(HOP_TWO) }),
    );

    const inspector = screen.getByRole('region', { name: 'Selection details' });
    expect(within(inspector).getByText(HOP_TWO)).toBeTruthy();
    expect(within(inspector).getByText('2')).toBeTruthy();
    expect(within(inspector).getByText('Address')).toBeTruthy();
    expect(within(inspector).getByText('Hop')).toBeTruthy();
  });

  it('shows amount, transaction and timestamp when a transfer is selected', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(screen.getByRole('button', { name: /Transfer.*9,000/ }));

    const inspector = screen.getByRole('region', { name: 'Selection details' });
    expect(within(inspector).getByText('9,000 USDT')).toBeTruthy();
    expect(within(inspector).getByText('b'.repeat(64))).toBeTruthy();
    expect(within(inspector).getByText(HOP_ONE)).toBeTruthy();
    expect(within(inspector).getByText(HOP_TWO)).toBeTruthy();
  });

  it('explains a labelled intermediary node in the product vocabulary', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(HOP_ONE) }),
    );

    const inspector = screen.getByRole('region', { name: 'Selection details' });

    expect(within(inspector).getByText(HOP_ONE)).toBeTruthy();
    expect(within(inspector).getByText('Band')).toBeTruthy();
    const band = within(inspector).getByText('High');
    expect(band.className).toContain('text-destructive');
    expect(within(inspector).getByText('p(laundering)')).toBeTruthy();
    expect(within(inspector).getByText('Confidence')).toBeTruthy();
    expect(within(inspector).getByText('Medium')).toBeTruthy();
    expect(within(inspector).getByText('0.83')).toBeTruthy();
    expect(within(inspector).getByText('Hop')).toBeTruthy();
    expect(within(inspector).getByText('1')).toBeTruthy();
    expect(within(inspector).getByText('Volume traced')).toBeTruthy();
    expect(within(inspector).getByText('4,000 USDT')).toBeTruthy();
    expect(within(inspector).getByText('Intermediary')).toBeTruthy();
    expect(within(inspector).getByText('Pass-through')).toBeTruthy();
    expect(within(inspector).getByText('Tier 1')).toBeTruthy();
    expect(within(inspector).getByText('OFAC SDN (simulated)')).toBeTruthy();
    expect(within(inspector).getByText('2026-09-09')).toBeTruthy();
  });

  it('explains an unlabelled node without inventing a label', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(HOP_TWO) }),
    );

    const inspector = screen.getByRole('region', { name: 'Selection details' });

    expect(within(inspector).getByText('No label')).toBeTruthy();
    expect(within(inspector).queryByText('Tier 1')).toBeNull();
    expect(within(inspector).queryByText('Tier 2')).toBeNull();
    expect(within(inspector).getByText('0.10')).toBeTruthy();
    expect(within(inspector).getByText('Intermediary')).toBeTruthy();
  });

  it('lists R1 to R6 with their triggered status and no invented codes', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(HOP_ONE) }),
    );

    const inspector = screen.getByRole('region', { name: 'Selection details' });
    const codes = within(inspector)
      .getAllByText(/^R[1-6]$/)
      .map((element) => element.textContent);

    expect(codes).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
    expect(within(inspector).getByText('R1 summary')).toBeTruthy();
    expect(within(inspector).getByText('Triggered')).toBeTruthy();
    expect(within(inspector).getAllByText('Not triggered')).toHaveLength(5);
    expect(document.body.textContent).not.toMatch(/FR[-\s]?\d/);
  });

  it('shows amount, hash, timestamp and direction when a transfer is selected', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(screen.getByRole('button', { name: /Transfer.*9,000/ }));

    const inspector = screen.getByRole('region', { name: 'Selection details' });

    expect(within(inspector).getByText('9,000 USDT')).toBeTruthy();
    expect(within(inspector).getByText('b'.repeat(64))).toBeTruthy();
    expect(within(inspector).getByText('2026-11-12 08:10:00 UTC')).toBeTruthy();
    expect(within(inspector).getByText('Direction')).toBeTruthy();
    expect(within(inspector).getByText('Outbound')).toBeTruthy();
  });

  it('shows an empty state when the wallet has no traced neighbourhood', () => {
    mockedHook.mockReturnValue({
      data: {
        ...graph,
        nodes: [graph.nodes[0]],
        edges: [],
        disclosure: {
          ...graph.disclosure,
          depthReached: 0,
          nodesReturned: 1,
          loadedTransfers: 0,
          reportedTransfers: 0,
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    expect(
      screen.getByText('No traced neighbourhood was loaded for this wallet.'),
    ).toBeTruthy();
  });

  it('shows a loading state while the query runs', () => {
    mockedHook.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);

    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    expect(screen.getByText('Loading trace graph…')).toBeTruthy();
  });

  it('shows an error state when the graph cannot be loaded', () => {
    mockedHook.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    } as never);

    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Could not load the trace graph.',
    );
  });
});
