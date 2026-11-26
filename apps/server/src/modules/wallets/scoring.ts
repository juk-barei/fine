import type { Screening } from '../../domain/screening/screening.ts';

/**
 * The one-method seam between the imperative shell and the scorer. The mock
 * sha256 implementation is today's only adapter; the Tron chain loader will
 * provide the second, and the service never learns which one it holds.
 */
export const WALLET_SCORER = Symbol('WALLET_SCORER');

export interface WalletScorer {
  screen(address: string): Screening;
}
