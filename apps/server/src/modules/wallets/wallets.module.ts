import { Module } from '@nestjs/common';
import { MockWalletScorer } from './mock-scorer.adapter.ts';
import { WALLET_SCORER } from './scoring.ts';
import { WalletsResolver } from './wallets.resolver.ts';
import { WalletsService } from './wallets.service.ts';

@Module({
  providers: [
    { provide: WALLET_SCORER, useClass: MockWalletScorer },
    WalletsService,
    WalletsResolver,
  ],
})
export class WalletsModule {}
