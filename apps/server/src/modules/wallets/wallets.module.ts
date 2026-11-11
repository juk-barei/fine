import { Module } from '@nestjs/common';
import { WalletsResolver } from './wallets.resolver.ts';
import { WalletsService } from './wallets.service.ts';

@Module({
  providers: [WalletsService, WalletsResolver],
})
export class WalletsModule {}
