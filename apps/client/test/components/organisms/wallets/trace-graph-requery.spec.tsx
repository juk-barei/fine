import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WalletTraceGraph } from '@repo/contracts';
import { WalletTraceGraph as WalletTraceGraphSection } from '@/components/organisms/wallets/trace-graph/trace-graph';
import { useWalletDetail } from '@/lib/wallets';

const SUBJECT = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
const HOP_ONE = 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS';

const RULES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((code) => ({
  code,
  triggered: code === 'R1',
  summary: `${code} summary`,
}));

const graph: WalletTraceGraph = {
  simulated: true,
  nodes: [
    {
      address: SUBJECT,
      hop: 0,
      kind: 'subject',
      title: 'Subject wallet',
      badge: null,
      band: 'high',
      pLaundering: 0.82,
      confidence: 'medium',
      volumeUsdt: 1_250,
      intermediary: null,
      labels: [],
      rules: RULES,
      subject: true,
    },
    {
      address: HOP_ONE,
      hop: 1,
      kind: 'counterparty',
      title: 'Counterparty',
      badge: null,
      band: 'low',
      pLaundering: 0.1,
      confidence: 'low',
      volumeUsdt: 1_250,
      intermediary: 'pass_through',
      labels: [],
      rules: RULES,
      subject: false,
    },
  ],
  edges: [
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
  ],
  disclosure: {
    depthRequested: 5,
    depthReached: 1,
    minValueUsdt: 0,
    nodesReturned: 2,
    nodeCap: 500,
    truncated: false,
    coverage: 'complete',
    loadedTransfers: 1,
    reportedTransfers: 1,
    reason: null,
  },
};

const detail = {
  wallet: {
    address: SUBJECT,
    score: 0.82,
    band: 'high',
    confidence: 'medium',
    labelTier: 'tier_1',
    decisionStatus: 'flagged',
    lastAnalysed: '2026-11-11T13:27:15.701Z',
  },
  flags: [],
  simulated: true,
};

type SentRequest = { query: string; variables: Record<string, unknown> };

let sent: SentRequest[] = [];

function stubGraphQL() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as SentRequest;
      sent.push(body);

      const data = body.query.includes('walletGraph(')
        ? { walletGraph: graph }
        : body.query.includes('wallet(')
          ? { wallet: detail }
          : {};

      return { ok: true, status: 200, json: async () => ({ data }) };
    }),
  );
}

function graphRequests(): SentRequest[] {
  return sent.filter((request) => request.query.includes('walletGraph('));
}

function walletRequests(): SentRequest[] {
  return sent.filter(
    (request) =>
      request.query.includes('wallet(') &&
      !request.query.includes('walletGraph('),
  );
}

/**
 * The wallet page's shape as far as this ticket is concerned: the score query
 * and the fund-flow section. Changing the graph controls must re-read the
 * graph and leave the score query alone.
 */
function ScoreAndGraph() {
  const wallet = useWalletDetail(SUBJECT);

  return (
    <>
      <p>score {wallet.data?.wallet.score ?? '—'}</p>
      <WalletTraceGraphSection address={SUBJECT} language="en" />
    </>
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ScoreAndGraph />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sent = [];
  stubGraphQL();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('trace graph controls at the GraphQL boundary', () => {
  it('sends the default depth and minimum value with the graph query', async () => {
    renderPage();

    await waitFor(() => expect(graphRequests()).toHaveLength(1));

    expect(graphRequests()[0]?.variables).toEqual({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 0,
    });
  });

  it('re-queries the graph with the chosen depth without refetching the score', async () => {
    renderPage();
    await screen.findByText('score 0.82');
    await waitFor(() => expect(graphRequests()).toHaveLength(1));
    expect(walletRequests()).toHaveLength(1);

    fireEvent.change(await screen.findByLabelText('Depth'), {
      target: { value: '2' },
    });

    await waitFor(() => expect(graphRequests()).toHaveLength(2));
    expect(graphRequests()[1]?.variables).toEqual({
      address: SUBJECT,
      depth: 2,
      minValueUsdt: 0,
    });
    expect(walletRequests()).toHaveLength(1);
  });

  it('sends the committed minimum value without refetching the score', async () => {
    renderPage();
    await screen.findByText('score 0.82');
    await waitFor(() => expect(graphRequests()).toHaveLength(1));

    const minimum = await screen.findByLabelText('Minimum transfer');
    fireEvent.change(minimum, { target: { value: '250' } });
    fireEvent.blur(minimum);

    await waitFor(() => expect(graphRequests()).toHaveLength(2));
    expect(graphRequests()[1]?.variables).toEqual({
      address: SUBJECT,
      depth: 5,
      minValueUsdt: 250,
    });
    expect(walletRequests()).toHaveLength(1);
  });
});
