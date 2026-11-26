import { createHash } from 'node:crypto';
import type {
  DecisionStatus,
  LabelTier,
  WalletBand,
  WalletConfidence,
} from '@repo/contracts';
import { OFAC_TRON_ADDRESSES } from './ofac-seed.ts';

/**
 * The screening policy: how one address becomes one screening result — score,
 * band, confidence, label tier, decision status and flags.
 *
 * Pure per ADR-0001: synchronous, no database, no clock, no randomness.
 * `node:crypto`'s `createHash` is deterministic, so the sha256 digest stays
 * inside the letter of the rule.
 *
 * `screenAddress` below is the deterministic mock implementation: same address
 * in, same result out, so demos and tests are reproducible. When the chain
 * loader lands, the real Tron scorer becomes a second adapter behind the
 * `WALLET_SCORER` port in the imperative shell; this one keeps serving the
 * trace graph and the tests.
 */
export type Screening = {
  readonly score: number;
  readonly band: WalletBand;
  readonly confidence: WalletConfidence;
  readonly labelTier: LabelTier;
  readonly decisionStatus: DecisionStatus;
  readonly flags: readonly string[];
};

export const HIGH_BAND_THRESHOLD = 0.7;
export const MODERATE_BAND_THRESHOLD = 0.4;

export function bandForScore(score: number): WalletBand {
  if (score >= HIGH_BAND_THRESHOLD) return 'high';
  if (score >= MODERATE_BAND_THRESHOLD) return 'moderate';
  return 'low';
}

const FLAG_POOL = [
  '2-hop exposure to an OFAC SDN wallet',
  'inbound flow from a Tether-frozen address',
  'fan-out to 128 recipients within 6 hours',
  'shared deposit address with a flagged wallet',
  'sanctions-adjacent counterparty (NBCTF)',
  'round-number transfers split below reporting thresholds',
] as const;

export function screenAddress(address: string): Screening {
  const digest = createHash('sha256').update(address).digest();

  // List membership beats the hash: a sanctioned address must not hash its way
  // into a lower tier.
  if (OFAC_TRON_ADDRESSES[address] === true) {
    return {
      score: Math.round((0.9 + (digest[0] / 255) * 0.09) * 10_000) / 10_000,
      band: 'high',
      confidence: 'high',
      labelTier: 'tier_1',
      decisionStatus: 'flagged',
      flags: [
        'direct match on the OFAC SDN list (Tier 1)',
        'OFAC action: XINBI GUARANTEE, 2026-09-09',
      ],
    };
  }

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
