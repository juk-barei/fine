import { Args, Float, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { OptionalAuth, UserHasPermission } from '@thallesp/nestjs-better-auth';
import {
  WALLET_GRAPH_DEFAULT_DEPTH,
  WALLET_GRAPH_DEFAULT_MIN_VALUE_USDT,
} from '@repo/contracts';
import { runGraphQL } from '../../common/effect/run.ts';
import { WalletsService } from './wallets.service.ts';
import {
  WalletDetail,
  WalletPage,
  WalletScreening,
  WalletTraceGraph,
} from './wallets.types.ts';

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

  @UserHasPermission({ permission: { wallet: ['get'] } })
  @Query(() => WalletDetail, { nullable: true })
  async wallet(
    @Args('address', { type: () => String }) address: string,
  ): Promise<WalletDetail | null> {
    return runGraphQL(this.walletsService.getByAddress({ address }));
  }

  @OptionalAuth()
  @Query(() => WalletScreening)
  async previewWallet(
    @Args('address', { type: () => String }) address: string,
  ): Promise<WalletScreening> {
    return runGraphQL(this.walletsService.preview({ address }));
  }

  @UserHasPermission({ permission: { trace: ['read'] } })
  @Query(() => WalletTraceGraph)
  async walletGraph(
    @Args('address', { type: () => String }) address: string,
    @Args('depth', {
      type: () => Int,
      nullable: true,
      defaultValue: WALLET_GRAPH_DEFAULT_DEPTH,
    })
    depth: number,
    @Args('minValueUsdt', {
      type: () => Float,
      nullable: true,
      defaultValue: WALLET_GRAPH_DEFAULT_MIN_VALUE_USDT,
    })
    minValueUsdt: number,
  ): Promise<WalletTraceGraph> {
    return runGraphQL(
      this.walletsService.graph({ address, depth, minValueUsdt }),
    );
  }

  @UserHasPermission({ permission: { wallet: ['create'] } })
  @Mutation(() => WalletScreening)
  async screenWallet(
    @Args('address', { type: () => String }) address: string,
  ): Promise<WalletScreening> {
    return runGraphQL(this.walletsService.screen({ address }));
  }
}
