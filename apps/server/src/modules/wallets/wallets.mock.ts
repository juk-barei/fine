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
