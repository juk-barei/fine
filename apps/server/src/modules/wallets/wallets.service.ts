import { Inject, Injectable } from '@nestjs/common';
import { Effect } from 'effect';
import { sql } from 'drizzle-orm';
import { InjectDrizzle } from '@nest-native/drizzle';
import {
  walletAddressInputSchema,
  walletGraphInputSchema,
  walletListInputSchema,
  walletTraceGraphSchema,
  type WalletListItem,
  type WalletPage,
  type WalletDetail,
  type WalletScreening,
  type WalletTraceGraph,
} from '@repo/contracts';
import type { Screening } from '../../domain/screening/screening.ts';
import { extractRows } from '../../common/db.ts';
import type { AppDatabase } from '../../database.ts';
import {
  DbFailure,
  parse,
  tryDb,
  withResilience,
  type ValidationFailure,
} from '../../common/effect/index.ts';
import { mockTraceGraph } from './wallets.mock.ts';
import { WALLET_SCORER, type WalletScorer } from './scoring.ts';

type WalletError = ValidationFailure | DbFailure;

type WalletRow = {
  address: string;
  score: string | null;
  band: string | null;
  confidence: string | null;
  label_tier: string | null;
  decision_status: string | null;
  flags: string[] | null;
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
 * The read path's single source of truth: whatever the last screening
 * persisted is exactly what the caller sees, never a fresh re-derivation.
 * Rows scored before the flags column existed read as flagless until the
 * backfill re-scores them.
 */
function toDetail(row: WalletRow): WalletDetail {
  return {
    wallet: toWalletListItem(row),
    flags: row.flags ?? [],
    simulated: true,
  };
}

/**
 * One screening result as the wire contract presents it. `simulated` stays
 * true while the deterministic mock is the scorer behind the port.
 */
function presentScreening(
  address: string,
  screening: Screening,
  lastAnalysed: string | null,
): WalletScreening {
  return {
    wallet: {
      address,
      score: screening.score,
      band: screening.band,
      confidence: screening.confidence,
      labelTier: screening.labelTier,
      decisionStatus: screening.decisionStatus,
      lastAnalysed,
    },
    flags: [...screening.flags],
    simulated: true,
  };
}

@Injectable()
export class WalletsService {
  constructor(
    @InjectDrizzle() private readonly db: AppDatabase,
    @Inject(WALLET_SCORER) private readonly scorer: WalletScorer,
  ) {}

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
   * Screen one wallet through the scorer port and persist the result whole —
   * flags included — so every later read projects the row and nothing else.
   */
  screen(input: unknown): Effect.Effect<WalletScreening, WalletError> {
    const self = this;
    return withResilience(
      Effect.gen(function* () {
        const { address } = yield* parse(walletAddressInputSchema, input);
        const screening = self.scorer.screen(address);

        const rows = extractRows<WalletRow>(
          yield* tryDb(() =>
            self.db.execute(sql`
              insert into wallets
                (address, score, band, confidence, label_tier, decision_status,
                 flags, last_analysed)
              values
                (${address}, ${screening.score}, ${screening.band},
                 ${screening.confidence}, ${screening.labelTier},
                 ${screening.decisionStatus}, ${sql.param([...screening.flags])},
                 now())
              on conflict (address) do update set
                score = excluded.score,
                band = excluded.band,
                confidence = excluded.confidence,
                label_tier = excluded.label_tier,
                decision_status = excluded.decision_status,
                flags = excluded.flags,
                last_analysed = excluded.last_analysed
              returning address, score, band, confidence, label_tier,
                        decision_status, flags, last_analysed
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

        return toDetail(row);
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
                     decision_status, flags, last_analysed
              from wallets
              where address = ${address}
              limit 1
            `),
          ),
        );

        const row = rows[0];
        return row ? toDetail(row) : null;
      }),
      { idempotent: true },
    );
  }

  /**
   * The landing page's anonymous screening: the scorer's fresh result,
   * presented and forgotten. No row is written — persisting is the signed-in
   * investigator's action, so a later `screen` overwriting the row is the
   * intended outcome, not a disagreement.
   */
  preview(input: unknown): Effect.Effect<WalletScreening, WalletError> {
    const self = this;
    return Effect.gen(function* () {
      const { address } = yield* parse(walletAddressInputSchema, input);
      const screening = self.scorer.screen(address);

      return presentScreening(address, screening, new Date().toISOString());
    });
  }

  /**
   * The trace graph is its own query: depth and the minimum transfer value
   * refetch the graph without re-reading the wallet row. The builder is pure
   * and deterministic, so the payload is parsed against the shared contract
   * before it leaves the service.
   */
  graph(input: unknown): Effect.Effect<WalletTraceGraph, WalletError> {
    return Effect.gen(function* () {
      const { address, depth, minValueUsdt } = yield* parse(
        walletGraphInputSchema,
        input,
      );

      return walletTraceGraphSchema.parse(
        mockTraceGraph({ address, depth, minValueUsdt }),
      );
    });
  }
}
