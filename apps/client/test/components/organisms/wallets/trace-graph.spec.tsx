import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TraceEdge, TraceNode, WalletTraceGraph } from '@repo/contracts';
import { TraceGraphCanvas } from '@/components/organisms/wallets/trace-graph/trace-graph-canvas';

vi.mock('@/lib/wallets', () => ({
  useWalletGraph: vi.fn(),
}));

import { useWalletGraph } from '@/lib/wallets';
import { WalletTraceGraph as WalletTraceGraphSection } from '@/components/organisms/wallets/trace-graph/trace-graph';
import { TraceGraphDisclosure } from '@/components/organisms/wallets/trace-graph/trace-graph-disclosure';

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

/** The term and value cell rendered for a `dt`/`dd` pair. */
function disclosureRow(region: HTMLElement, term: string): string {
  const label = within(region).getByText(term);
  return label.parentElement?.textContent ?? '';
}

const truncatedDisclosure = {
  ...graph.disclosure,
  depthRequested: 5,
  depthReached: 3,
  minValueUsdt: 250,
  nodeCap: 4,
  truncated: true,
  coverage: 'partial' as const,
  loadedTransfers: 1_200,
  reportedTransfers: 2_400,
  reason: {
    code: 'node_cap_reached' as const,
    params: { nodeCap: 4, nodesKept: 4, nodesScoped: 8 },
  },
};

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
      name: new RegExp(`^Node ${HOP_ONE}`),
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
      screen.getByRole('button', { name: new RegExp(`^Node ${HOP_ONE}`) }),
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

  it('exposes the graph as a labelled group with keyboard instructions', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const group = screen.getByRole('group', { name: 'Wallet trace graph' });
    expect(group.tagName.toLowerCase()).toBe('svg');
    expect(screen.queryByRole('img')).toBeNull();

    const describedBy = group.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')?.textContent).toContain(
      'Tab',
    );
  });

  it('announces every node with its address and hop', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const cases: Array<[string, number]> = [
      [SUBJECT, 0],
      [HOP_ONE, 1],
      [HOP_ONE_LOW, 1],
      [HOP_TWO, 2],
    ];

    for (const [address, hop] of cases) {
      const label =
        screen
          .getByRole('button', { name: new RegExp(`^Node ${address}`) })
          .getAttribute('aria-label') ?? '';

      expect(label).toContain(address);
      expect(label).toContain(`Hop ${hop}`);
    }
  });

  it('announces every transfer with its amount, endpoints and hop', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const cases = [
      { amount: '1,250', from: SUBJECT, to: HOP_ONE, hop: 1 },
      { amount: '9,000', from: HOP_ONE, to: HOP_TWO, hop: 2 },
      { amount: '500', from: HOP_ONE_LOW, to: SUBJECT, hop: 1 },
    ];

    for (const item of cases) {
      const label =
        screen
          .getByRole('button', {
            name: new RegExp(`^Transfer of ${item.amount} USDT`),
          })
          .getAttribute('aria-label') ?? '';

      expect(label).toContain(item.from);
      expect(label).toContain(item.to);
      expect(label).toContain(`Hop ${item.hop}`);
    }
  });

  it('keeps every transfer in the tab order', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const transfers = screen.getAllByRole('button', {
      name: /^Transfer of/,
    });
    expect(transfers).toHaveLength(edges.length);

    for (const transfer of transfers) {
      expect(transfer.getAttribute('tabindex')).toBe('0');
    }
  });

  it('selects a node with Enter', () => {
    const onSelect = vi.fn();
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={onSelect}
        language="en"
      />,
    );

    const nodeButton = screen.getByRole('button', {
      name: new RegExp(`^Node ${HOP_ONE}`),
    });
    nodeButton.focus();
    fireEvent.keyDown(nodeButton, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith({ kind: 'node', address: HOP_ONE });
  });

  it('selects a node with Space', () => {
    const onSelect = vi.fn();
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={onSelect}
        language="en"
      />,
    );

    const nodeButton = screen.getByRole('button', {
      name: new RegExp(`^Node ${HOP_TWO}`),
    });
    nodeButton.focus();
    fireEvent.keyDown(nodeButton, { key: ' ' });

    expect(onSelect).toHaveBeenCalledWith({ kind: 'node', address: HOP_TWO });
  });

  it('selects a transfer with Enter', () => {
    const onSelect = vi.fn();
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={onSelect}
        language="en"
      />,
    );

    const transfer = screen.getByRole('button', {
      name: /^Transfer of 1,250 USDT/,
    });
    transfer.focus();
    fireEvent.keyDown(transfer, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith({ kind: 'edge', id: 'edge-1' });
  });

  it('selects a transfer with Space', () => {
    const onSelect = vi.fn();
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={onSelect}
        language="en"
      />,
    );

    const transfer = screen.getByRole('button', {
      name: /^Transfer of 9,000 USDT/,
    });
    transfer.focus();
    fireEvent.keyDown(transfer, { key: ' ' });

    expect(onSelect).toHaveBeenCalledWith({ kind: 'edge', id: 'edge-2' });
  });

  it('marks a focused transfer so its focus is visible', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const transfer = screen.getByRole('button', {
      name: /^Transfer of 9,000 USDT/,
    });
    expect(transfer.getAttribute('data-focused')).toBeNull();

    fireEvent.focus(transfer);
    expect(transfer.getAttribute('data-focused')).toBe('true');

    fireEvent.blur(transfer);
    expect(transfer.getAttribute('data-focused')).toBeNull();
  });

  it('bounds the canvas to a scrollable viewport while zoom and reset still work', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const svg = screen.getByRole('group', { name: 'Wallet trace graph' });
    const viewport = svg.parentElement;

    expect(viewport?.className).toContain('overflow-auto');
    expect(viewport?.style.maxHeight).toBe('560px');

    const initialWidth = Number(svg.getAttribute('width'));

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(Number(svg.getAttribute('width'))).toBeGreaterThan(initialWidth);

    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(Number(svg.getAttribute('width'))).toBe(initialWidth);
  });

  it('announces a node band and label tier, and calls a null band unscored', () => {
    const { unmount } = render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const labelled =
      screen
        .getByRole('button', { name: new RegExp(`^Node ${HOP_ONE},`) })
        .getAttribute('aria-label') ?? '';
    expect(labelled).toContain('Band High');
    expect(labelled).toContain('Tier 1');

    const unlabelled =
      screen
        .getByRole('button', { name: new RegExp(`^Node ${HOP_TWO},`) })
        .getAttribute('aria-label') ?? '';
    expect(unlabelled).toContain('Band Low');
    expect(unlabelled).not.toContain('Tier');

    unmount();

    render(
      <TraceGraphCanvas
        graph={{
          ...graph,
          nodes: nodes.map((candidate) =>
            candidate.address === HOP_ONE_LOW
              ? { ...candidate, band: null, labels: [] }
              : candidate,
          ),
        }}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const unscored =
      screen
        .getByRole('button', { name: new RegExp(`^Node ${HOP_ONE_LOW},`) })
        .getAttribute('aria-label') ?? '';
    expect(unscored).toContain('Band Unscored');
  });

  it('renders a null band neutrally instead of as low risk', () => {
    render(
      <TraceGraphCanvas
        graph={{
          ...graph,
          nodes: nodes.map((candidate) =>
            candidate.address === HOP_ONE_LOW
              ? { ...candidate, band: null, labels: [] }
              : candidate,
          ),
        }}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const unscored = screen.getByRole('button', {
      name: new RegExp(`^Node ${HOP_ONE_LOW},`),
    });
    expect(unscored.className).toContain('bg-muted/40');
    expect(unscored.className).not.toContain('emerald');

    const low = screen.getByRole('button', {
      name: new RegExp(`^Node ${HOP_TWO},`),
    });
    expect(low.className).toContain('emerald');
  });

  it('renders the contract badge when a node carries one', () => {
    render(
      <TraceGraphCanvas
        graph={{
          ...graph,
          nodes: nodes.map((candidate) =>
            candidate.address === HOP_TWO
              ? { ...candidate, badge: 'OFAC SDN' }
              : candidate,
          ),
        }}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    expect(screen.getByText('OFAC SDN')).toBeTruthy();
  });

  it('dims everything that is not an immediate neighbour while a node is hovered', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    const nodeButton = (address: string) =>
      screen.getByRole('button', { name: new RegExp(`^Node ${address},`) });
    const edgeButton = (amount: string) =>
      screen.getByRole('button', {
        name: new RegExp(`^Transfer of ${amount} USDT`),
      });

    fireEvent.mouseEnter(nodeButton(HOP_ONE));

    // HOP_ONE is adjacent to the subject (edge-1) and HOP_TWO (edge-2).
    expect(nodeButton(HOP_ONE).getAttribute('data-dimmed')).toBeNull();
    expect(nodeButton(SUBJECT).getAttribute('data-dimmed')).toBeNull();
    expect(nodeButton(HOP_TWO).getAttribute('data-dimmed')).toBeNull();
    expect(nodeButton(HOP_ONE_LOW).getAttribute('data-dimmed')).toBe('true');

    expect(edgeButton('1,250').getAttribute('data-dimmed')).toBeNull();
    expect(edgeButton('9,000').getAttribute('data-dimmed')).toBeNull();
    expect(edgeButton('500').getAttribute('data-dimmed')).toBe('true');

    fireEvent.mouseLeave(nodeButton(HOP_ONE));
    expect(nodeButton(HOP_ONE_LOW).getAttribute('data-dimmed')).toBeNull();
    expect(edgeButton('500').getAttribute('data-dimmed')).toBeNull();
  });

  it('reads the legend from the dictionary', () => {
    render(
      <TraceGraphCanvas
        graph={graph}
        selected={null}
        onSelect={noop}
        language="en"
      />,
    );

    expect(screen.getByText('Outbound · solid')).toBeTruthy();
    expect(screen.getByText('Inbound · dashed')).toBeTruthy();
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

  it('puts the inspector before the canvas in keyboard order', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const inspector = screen.getByRole('region', {
      name: 'Selection details',
    });
    const firstNode = screen.getByRole('button', {
      name: new RegExp(`^Node ${SUBJECT},`),
    });

    expect(
      inspector.compareDocumentPosition(firstNode) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('queries the graph with the default depth and minimum value', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    expect(mockedHook).toHaveBeenCalledWith(SUBJECT, 5, 0);
  });

  it('offers only the depths the contract accepts', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const depth = screen.getByLabelText('Depth') as HTMLSelectElement;

    expect([...depth.options].map((option) => option.value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
  });

  it('re-queries the graph with the chosen depth and minimum value', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.change(screen.getByLabelText('Depth'), {
      target: { value: '3' },
    });

    expect(mockedHook).toHaveBeenLastCalledWith(SUBJECT, 3, 0);

    const minimum = screen.getByLabelText('Minimum transfer');
    fireEvent.change(minimum, { target: { value: '250' } });
    fireEvent.blur(minimum);

    expect(mockedHook).toHaveBeenLastCalledWith(SUBJECT, 3, 250);
  });

  it('refuses a negative minimum value and says why', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const minimum = screen.getByLabelText('Minimum transfer');
    fireEvent.change(minimum, { target: { value: '-50' } });
    fireEvent.blur(minimum);

    expect(
      mockedHook.mock.calls.some(([, , value]) => value === -50),
    ).toBe(false);
    expect(screen.getByRole('alert').textContent).toContain('0 USDT or more');
  });

  it('keeps the selected node when it survives the re-query', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^Node ${HOP_TWO}`) }),
    );
    fireEvent.change(screen.getByLabelText('Depth'), {
      target: { value: '4' },
    });

    const inspector = screen.getByRole('region', {
      name: 'Selection details',
    });

    expect(mockedHook).toHaveBeenLastCalledWith(SUBJECT, 4, 0);
    expect(within(inspector).getByText(HOP_TWO)).toBeTruthy();
  });

  it('falls back to the subject when the selected node leaves the graph', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^Node ${HOP_TWO}`) }),
    );

    mockedHook.mockReturnValue({
      data: {
        ...graph,
        nodes: nodes.filter((candidate) => candidate.address !== HOP_TWO),
        edges: edges.filter((edge) => edge.hop < 2),
        disclosure: { ...graph.disclosure, depthReached: 1 },
      },
      isLoading: false,
      error: null,
    } as never);

    fireEvent.change(screen.getByLabelText('Depth'), {
      target: { value: '1' },
    });

    const inspector = screen.getByRole('region', {
      name: 'Selection details',
    });

    expect(within(inspector).getByText(SUBJECT)).toBeTruthy();
    expect(within(inspector).queryByText(HOP_TWO)).toBeNull();
  });

  it('shows a node address and hop when a node is selected', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^Node ${HOP_TWO}`) }),
    );

    const inspector = screen.getByRole('region', { name: 'Selection details' });
    expect(within(inspector).getByText(HOP_TWO)).toBeTruthy();
    expect(within(inspector).getByText('2')).toBeTruthy();
    expect(within(inspector).getByText('Address')).toBeTruthy();
    expect(within(inspector).getByText('Hop')).toBeTruthy();
  });

  it('opens a node inspector with Enter on the focused node', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const nodeButton = screen.getByRole('button', {
      name: new RegExp(`^Node ${HOP_TWO}`),
    });
    nodeButton.focus();
    expect(document.activeElement).toBe(nodeButton);
    fireEvent.keyDown(nodeButton, { key: 'Enter' });

    const inspector = screen.getByRole('region', { name: 'Selection details' });
    expect(within(inspector).getByText(HOP_TWO)).toBeTruthy();
    expect(within(inspector).getByText('Hop')).toBeTruthy();
  });

  it('opens a transfer inspector with Space on the focused transfer', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const transfer = screen.getByRole('button', {
      name: /^Transfer of 9,000 USDT/,
    });
    transfer.focus();
    fireEvent.keyDown(transfer, { key: ' ' });

    const inspector = screen.getByRole('region', { name: 'Selection details' });
    expect(within(inspector).getByText('9,000 USDT')).toBeTruthy();
    expect(within(inspector).getByText('b'.repeat(64))).toBeTruthy();
  });

  it('announces a keyboard selection in a live region', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');

    const nodeButton = screen.getByRole('button', {
      name: new RegExp(`^Node ${HOP_TWO}`),
    });
    nodeButton.focus();
    fireEvent.keyDown(nodeButton, { key: 'Enter' });

    expect(status.textContent).toContain(HOP_TWO);
    expect(status.textContent).toContain('Hop 2');
    expect(status.textContent).toContain('Selection details opened');
  });

  it('announces a keyboard-selected transfer in the live region', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const transfer = screen.getByRole('button', {
      name: /^Transfer of 1,250 USDT/,
    });
    transfer.focus();
    fireEvent.keyDown(transfer, { key: 'Enter' });

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('1,250');
    expect(status.textContent).toContain(SUBJECT);
    expect(status.textContent).toContain(HOP_ONE);
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
      screen.getByRole('button', { name: new RegExp(`^Node ${HOP_ONE}`) }),
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
      screen.getByRole('button', { name: new RegExp(`^Node ${HOP_TWO}`) }),
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
      screen.getByRole('button', { name: new RegExp(`^Node ${HOP_ONE}`) }),
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
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Depth')).toBeTruthy();
    expect(
      screen.queryByRole('region', { name: 'Selection details' }),
    ).toBeNull();
  });

  it('renders the disclosure the payload reported, not the query it asked for', () => {
    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const disclosure = screen.getByRole('group', {
      name: 'Graph disclosure',
    });

    expect(mockedHook).toHaveBeenCalledWith(SUBJECT, 5, 0);
    expect(disclosureRow(disclosure, 'Depth requested')).toContain('2');
    expect(
      within(disclosure).getByRole('note').textContent,
    ).toContain('Simulated data');
  });

  it('states truncation and partial coverage when the graph stopped short', () => {
    mockedHook.mockReturnValue({
      data: { ...graph, disclosure: truncatedDisclosure },
      isLoading: false,
      error: null,
    } as never);

    render(<WalletTraceGraphSection address={SUBJECT} language="en" />);

    const disclosure = screen.getByRole('group', { name: 'Graph disclosure' });

    expect(disclosureRow(disclosure, 'Coverage')).toContain('Partial');
    expect(within(disclosure).getByText('1,200 of 2,400 transfers')).toBeTruthy();
    expect(
      within(disclosure).getByText(
        'Node cap reached — the trace stopped at the cap.',
      ),
    ).toBeTruthy();
    expect(
      within(disclosure).getByText(
        'Reason: Index covers half of the reported transfers.',
      ),
    ).toBeTruthy();
    expect(within(disclosure).queryByText('Within the node cap.')).toBeNull();
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
    expect(
      screen.queryByText('No traced neighbourhood was loaded for this wallet.'),
    ).toBeNull();
    expect(screen.getByLabelText('Depth')).toBeTruthy();
  });
});

describe('TraceGraphDisclosure', () => {
  it('states requested depth, depth reached, nodes against the cap, coverage and minimum value', () => {
    render(
      <TraceGraphDisclosure
        disclosure={graph.disclosure}
        simulated={graph.simulated}
        language="en"
      />,
    );

    const disclosure = screen.getByRole('group', { name: 'Graph disclosure' });

    expect(disclosureRow(disclosure, 'Depth requested')).toContain('2');
    expect(disclosureRow(disclosure, 'Depth reached')).toContain('2');
    expect(disclosureRow(disclosure, 'Nodes returned')).toContain(
      '4 of 500 cap',
    );
    expect(disclosureRow(disclosure, 'Minimum transfer')).toContain('0 USDT');
    expect(disclosureRow(disclosure, 'Coverage')).toContain('Complete');
    expect(within(disclosure).getByText('3 of 3 transfers')).toBeTruthy();
    expect(within(disclosure).getByText('Within the node cap.')).toBeTruthy();
    expect(within(disclosure).queryByText(/^Node cap reached/)).toBeNull();
    expect(within(disclosure).queryByText(/^Reason:/)).toBeNull();
    expect(within(disclosure).queryByText(/^Stopped short/)).toBeNull();
  });

  it('states truncation, partial coverage with counts, the reason and the depth shortfall', () => {
    render(
      <TraceGraphDisclosure
        disclosure={truncatedDisclosure}
        simulated={false}
        language="en"
      />,
    );

    const disclosure = screen.getByRole('group', { name: 'Graph disclosure' });

    expect(disclosureRow(disclosure, 'Depth requested')).toContain('5');
    expect(disclosureRow(disclosure, 'Depth reached')).toContain('3');
    expect(disclosureRow(disclosure, 'Nodes returned')).toContain('4 of 4 cap');
    expect(disclosureRow(disclosure, 'Minimum transfer')).toContain(
      '250 USDT',
    );
    expect(disclosureRow(disclosure, 'Coverage')).toContain('Partial');
    expect(within(disclosure).getByText('1,200 of 2,400 transfers')).toBeTruthy();
    expect(
      within(disclosure).getByText(
        'Reason: Node cap of 4 reached: 4 of 8 nodes kept, highest value first.',
      ),
    ).toBeTruthy();
    expect(
      within(disclosure).getByText(
        'Node cap reached — the trace stopped at the cap.',
      ),
    ).toBeTruthy();
    expect(
      within(disclosure).getByText(
        'Stopped short of the requested depth: 3 of 5 hops.',
      ),
    ).toBeTruthy();
    expect(within(disclosure).queryByText('Within the node cap.')).toBeNull();
    expect(within(disclosure).queryByRole('note')).toBeNull();
  });

  it('renders the capped disclosure from the Khmer templates', () => {
    render(
      <TraceGraphDisclosure
        disclosure={truncatedDisclosure}
        simulated={false}
        language="km"
      />,
    );

    const disclosure = screen.getByRole('group', { name: 'Graph disclosure' });

    expect(disclosureRow(disclosure, 'Nodes returned')).toContain(
      '4 នៃ 4 ដែនកំណត់',
    );
    expect(
      within(disclosure).getByText('1,200 នៃ 2,400 ការផ្ទេរ'),
    ).toBeTruthy();
    expect(
      within(disclosure).getByText(
        'Reason: បានដល់ដែនកំណត់ចំណុច 4៖ បានរក្សាទុកចំណុច 4 នៃ 8 ដោយតម្លៃខ្ពស់បំផុតមុនគេ។',
      ),
    ).toBeTruthy();
    expect(
      within(disclosure).getByText(
        'ឈប់មិនដល់ជម្រៅដែលបានស្នើ: 3 នៃ 5 ហប់។',
      ),
    ).toBeTruthy();
  });

  it('renders the uncapped disclosure from the Khmer templates', () => {
    render(
      <TraceGraphDisclosure
        disclosure={graph.disclosure}
        simulated={false}
        language="km"
      />,
    );

    const disclosure = screen.getByRole('group', { name: 'Graph disclosure' });

    expect(disclosureRow(disclosure, 'Nodes returned')).toContain(
      '4 នៃ 500 ដែនកំណត់',
    );
    expect(within(disclosure).getByText('3 នៃ 3 ការផ្ទេរ')).toBeTruthy();
    expect(within(disclosure).queryByText(/^Reason:/)).toBeNull();
    expect(within(disclosure).queryByText(/^Stopped short/)).toBeNull();
  });

  it('does not claim a shortfall when complete coverage simply stopped early', () => {
    render(
      <TraceGraphDisclosure
        disclosure={{
          ...graph.disclosure,
          depthRequested: 5,
          depthReached: 0,
          nodesReturned: 1,
          loadedTransfers: 0,
          reportedTransfers: 0,
          truncated: false,
          coverage: 'complete',
          minValueUsdt: 50_000,
        }}
        simulated={false}
        language="en"
      />,
    );

    const disclosure = screen.getByRole('group', { name: 'Graph disclosure' });

    expect(disclosureRow(disclosure, 'Coverage')).toContain('Complete');
    expect(within(disclosure).queryByText(/^Stopped short/)).toBeNull();
  });

  it('marks a simulated payload in words, not colour alone', () => {
    render(
      <TraceGraphDisclosure
        disclosure={graph.disclosure}
        simulated
        language="en"
      />,
    );

    const marker = screen.getByRole('note');

    expect(marker.textContent).toContain('Simulated data');
    expect(marker.textContent).toContain(
      'Synthetic fixture, not chain evidence.',
    );
  });
});
