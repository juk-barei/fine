import { Injectable } from '@nestjs/common';
import { Effect } from 'effect';
import { sql } from 'drizzle-orm';
import { InjectDrizzle } from '@nest-native/drizzle';
import {
  walletAddressInputSchema,
  walletListInputSchema,
  type WalletListItem,
  type WalletPage,
  type WalletDetail,
  type WalletScreening,
} from '@repo/contracts';
import { extractRows } from '../../common/db.ts';
import type { AppDatabase } from '../../database.ts';
import {
  DbFailure,
  parse,
  tryDb,
  withResilience,
  type ValidationFailure,
} from '../../common/effect/index.ts';
import { mockGraph, screenAddress } from './wallets.mock.ts';

type WalletError = ValidationFailure | DbFailure;

type WalletRow = {
  address: string;
  score: string | null;
  band: string | null;
  confidence: string | null;
  label_tier: string | null;
  decision_status: string | null;
  last_analysed: Date | string | null;
};

function toWalletListItem(row: WalletRow): WalletListItem {
  return {
    address: row.address,
    score: row.score === null ? null : Number(row.score),
    band: row.band as WalletListItem['band'],
    confidence: row.confidence as WalletListItem['confidence'],
    labelTier: row.label_tier as WalletListItem['labelTier'],
    decisionStatus: row.decision_status as WalletListItem['decisionStatus'],
    // Raw `execute` returns timestamps as strings on this driver; a Drizzle
    // select would hand back a Date. Accept both rather than guess.
    lastAnalysed:
      row.last_analysed === null
        ? null
        : new Date(row.last_analysed).toISOString(),
  };
}

/**
 * A row plus everything the mock scorer knows about the address. Reading it
 * back is a pure re-derivation rather than a second write, so a re-screen and
 * a read can never disagree.
 */
function toWalletDetail(address: string, row: WalletRow): WalletDetail {
  if (row.score === null) {
    return {
      wallet: toWalletListItem(row),
      flags: [],
      simulated: true,
      graph: null,
    };
  }

  const mock = screenAddress(address);

  return {
    wallet: toWalletListItem(row),
    flags: mock.flags,
    simulated: true,
    graph: mockGraph({ address, band: mock.band, tier: mock.labelTier }),
  };
}

@Injectable()
export class WalletsService {
  constructor(@InjectDrizzle() private readonly db: AppDatabase) {}

  list(input: unknown): Effect.Effect<WalletPage, WalletError> {
    const self = this;
    return withResilience(
      Effect.gen(function* () {
        const query = yield* parse(walletListInputSchema, input);
        const filter = query.status
          ? sql`where decision_status = ${query.status}`
          : sql`where true`;

        const rows = extractRows<WalletRow>(
          yield* tryDb(() =>
            self.db.execute(sql`
              select address, score, band, confidence, label_tier,
                     decision_status, last_analysed
              from wallets
              ${filter}
              order by score desc nulls last, address asc
              limit ${query.limit} offset ${query.offset}
            `),
          ),
        );

        const totals = extractRows<{ total: number | string }>(
          yield* tryDb(() =>
            self.db.execute(
              sql`select count(*)::int as total from wallets ${filter}`,
            ),
          ),
        );

        return {
          nodes: rows.map(toWalletListItem),
          total: Number(totals[0]?.total ?? 0),
        };
      }),
      { idempotent: true },
    );
  }

  /**
   * Screen one wallet with the deterministic mock scorer and persist the
   * result into the read model, so the list reflects the run.
   */
  screen(input: unknown): Effect.Effect<WalletScreening, WalletError> {
    const self = this;
    return withResilience(
      Effect.gen(function* () {
        const { address } = yield* parse(walletAddressInputSchema, input);
        const mock = screenAddress(address);

        const rows = extractRows<WalletRow>(
          yield* tryDb(() =>
            self.db.execute(sql`
              insert into wallets
                (address, score, band, confidence, label_tier, decision_status, last_analysed)
              values
                (${address}, ${mock.score}, ${mock.band}, ${mock.confidence},
                 ${mock.labelTier}, ${mock.decisionStatus}, now())
              on conflict (address) do update set
                score = excluded.score,
                band = excluded.band,
                confidence = excluded.confidence,
                label_tier = excluded.label_tier,
                decision_status = excluded.decision_status,
                last_analysed = excluded.last_analysed
              returning address, score, band, confidence, label_tier,
                        decision_status, last_analysed
            `),
          ),
        );

        const row = rows[0];
        if (!row) {
          return yield* Effect.fail(
            new DbFailure({
              sqlState: undefined,
              detail: 'screening upsert returned no row',
              cause: undefined,
            }),
          );
        }

        const detail = toWalletDetail(address, row);
        if (detail.graph === null || detail.graph === undefined) {
          return yield* Effect.fail(
            new DbFailure({
              sqlState: undefined,
              detail: 'screened row read back unscored',
              cause: undefined,
            }),
          );
        }

        return { ...detail, graph: detail.graph };
      }),
      { idempotent: true },
    );
  }

  getByAddress(input: unknown): Effect.Effect<WalletDetail | null, WalletError> {
    const self = this;
    return withResilience(
      Effect.gen(function* () {
        const { address } = yield* parse(walletAddressInputSchema, input);

        const rows = extractRows<WalletRow>(
          yield* tryDb(() =>
            self.db.execute(sql`
              select address, score, band, confidence, label_tier,
                     decision_status, last_analysed
              from wallets
              where address = ${address}
              limit 1
            `),
          ),
        );

        const row = rows[0];
        return row ? toWalletDetail(address, row) : null;
      }),
      { idempotent: true },
    );
  }

  /**
   * The landing page's anonymous screening: same deterministic result, no row
   * written. Persisting is the signed-in investigator's action.
   */
  preview(input: unknown): Effect.Effect<WalletScreening, WalletError> {
    return Effect.gen(function* () {
      const { address } = yield* parse(walletAddressInputSchema, input);
      const mock = screenAddress(address);

      return {
        wallet: {
          address,
          score: mock.score,
          band: mock.band,
          confidence: mock.confidence,
          labelTier: mock.labelTier,
          decisionStatus: mock.decisionStatus,
          lastAnalysed: new Date().toISOString(),
        },
        flags: mock.flags,
        simulated: true,
        graph: mockGraph({
          address,
          band: mock.band,
          tier: mock.labelTier,
        }),
      };
    });
  }
}
