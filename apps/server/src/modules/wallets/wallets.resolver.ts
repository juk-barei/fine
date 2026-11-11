import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { runGraphQL } from '../../common/effect/run.ts';
import { WalletsService } from './wallets.service.ts';
import { WalletPage } from './wallets.types.ts';

@Resolver()
export class WalletsResolver {
  constructor(
    @Inject(WalletsService) private readonly walletsService: WalletsService,
  ) {}

  @UserHasPermission({ permission: { wallet: ['list'] } })
  @Query(() => WalletPage)
  async wallets(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
    limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
    @Args('status', { type: () => String, nullable: true })
    status?: string,
  ): Promise<WalletPage> {
    return runGraphQL(this.walletsService.list({ limit, offset, status }));
  }
}
