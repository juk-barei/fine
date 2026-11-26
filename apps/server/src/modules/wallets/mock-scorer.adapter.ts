import { Injectable } from '@nestjs/common';
import {
  screenAddress,
  type Screening,
} from '../../domain/screening/screening.ts';
import type { WalletScorer } from './scoring.ts';

/**
 * The deterministic mock behind the `WALLET_SCORER` port: the domain's
 * `screenAddress`, nothing more. Same address in, same screening result out,
 * so demos and tests stay reproducible.
 */
@Injectable()
export class MockWalletScorer implements WalletScorer {
  screen(address: string): Screening {
    return screenAddress(address);
  }
}
