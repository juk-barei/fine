import { createHash } from 'node:crypto';
import type {
  DecisionStatus,
  LabelTier,
  WalletBand,
  WalletConfidence,
} from '@repo/contracts';

/**
 * The deterministic mock screener standing in for the real Tron data path.
 *
 * Same address in, same result out, so demos and tests are reproducible. When
 * the chain loader lands, the mock's place is the seam the real scorer takes:
 * `screenAddress` is pure and takes nothing but the address.
 */
export type MockScreening = {
  score: number;
  band: WalletBand;
  confidence: WalletConfidence;
  labelTier: LabelTier;
  decisionStatus: DecisionStatus;
  flags: string[];
};

const FLAG_POOL = [
  '2-hop exposure to an OFAC SDN wallet',
  'inbound flow from a Tether-frozen address',
  'fan-out to 128 recipients within 6 hours',
  'shared deposit address with a flagged wallet',
  'sanctions-adjacent counterparty (NBCTF)',
  'round-number transfers split below reporting thresholds',
] as const;

export const HIGH_BAND_THRESHOLD = 0.7;
export const MODERATE_BAND_THRESHOLD = 0.4;

export function bandForScore(score: number): WalletBand {
  if (score >= HIGH_BAND_THRESHOLD) return 'high';
  if (score >= MODERATE_BAND_THRESHOLD) return 'moderate';
  return 'low';
}

export function screenAddress(address: string): MockScreening {
  const digest = createHash('sha256').update(address).digest();

  // 0.02..0.98 keeps the result inside the contract's 0..1 range without
  // pinning either end, so every band is reachable.
  const score = Math.round((0.02 + (digest[0] / 255) * 0.96) * 10_000) / 10_000;
  const band = bandForScore(score);

  const labelTier: LabelTier =
    digest[1] < 60 ? 'tier_1' : digest[1] < 180 ? 'tier_2' : 'tier_3';

  const decisionStatus: DecisionStatus =
    band === 'high' ? 'flagged' : band === 'moderate' ? 'open' : 'cleared';

  const confidence: WalletConfidence =
    band === 'high' && labelTier === 'tier_1'
      ? 'high'
      : band === 'high' || labelTier === 'tier_2'
        ? 'medium'
        : 'low';

  const flagCount = band === 'high' ? 3 : band === 'moderate' ? 2 : 0;
  const start = digest[2] % FLAG_POOL.length;
  const flags = Array.from(
    { length: flagCount },
    (_, index) => FLAG_POOL[(start + index) % FLAG_POOL.length],
  );

  return { score, band, confidence, labelTier, decisionStatus, flags };
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export type MockGraphNode = {
  id: string;
  label: string;
  band: WalletBand;
  tier: LabelTier;
  subject: boolean;
  hops: number;
};

export type MockGraphEdge = {
  from: string;
  to: string;
  amountUsdt: number;
  txHash: string;
  timestamp: string;
};

export type MockGraph = {
  nodes: MockGraphNode[];
  edges: MockGraphEdge[];
};

function shortLabel(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function counterpartyAddress(subject: string, index: number): string {
  const digest = createHash('sha256')
    .update(`${subject}:counterparty:${index}`)
    .digest();
  let address = 'T';
  for (let i = 0; i < 33; i += 1) {
    address += BASE58[digest[(i + index) % digest.length] % BASE58.length];
  }
  return address;
}

/**
 * The single-hop mock neighbourhood of a screened wallet: the subject in the
 * middle, 5-7 counterparties around it, one directed transfer per counterparty.
 * Counterparty bands come from `screenAddress`, so the graph and the wallet
 * table never disagree about a wallet's risk.
 */
export function mockGraph(subject: {
  address: string;
  band: WalletBand;
  tier: LabelTier;
}): MockGraph {
  const digest = createHash('sha256')
    .update(`${subject.address}:graph`)
    .digest();
  const counterpartyCount = 5 + (digest[4] % 3);

  const nodes: MockGraphNode[] = [
    {
      id: subject.address,
      label: shortLabel(subject.address),
      band: subject.band,
      tier: subject.tier,
      subject: true,
      hops: 0,
    },
  ];
  const edges: MockGraphEdge[] = [];

  for (let index = 0; index < counterpartyCount; index += 1) {
    const id = counterpartyAddress(subject.address, index);
    const screening = screenAddress(id);
    nodes.push({
      id,
      label: shortLabel(id),
      band: screening.band,
      tier: screening.labelTier,
      subject: false,
      hops: 1,
    });

    const edgeDigest = createHash('sha256')
      .update(`${subject.address}:edge:${index}`)
      .digest();
    const outbound = edgeDigest[11] % 2 === 0;
    const hours =
      (edgeDigest[7] * 256 + edgeDigest[8]) % (30 * 24);

    edges.push({
      from: outbound ? subject.address : id,
      to: outbound ? id : subject.address,
      amountUsdt: 100 + (((edgeDigest[9] << 8) | edgeDigest[10]) % 49_900),
      txHash: createHash('sha256')
        .update(`${subject.address}:tx:${index}`)
        .digest('hex'),
      timestamp: new Date(
        Date.UTC(2026, 9, 1) + hours * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  return { nodes, edges };
}
