import { Injectable } from '@nestjs/common';
import { Effect } from 'effect';
import { sql } from 'drizzle-orm';
import { InjectDrizzle } from '@nest-native/drizzle';
import {
  walletListInputSchema,
  type WalletListItem,
  type WalletPage,
} from '@repo/contracts';
import { extractRows } from '../../common/db.ts';
import type { AppDatabase } from '../../database.ts';
import {
  parse,
  tryDb,
  withResilience,
  type DbFailure,
  type ValidationFailure,
} from '../../common/effect/index.ts';

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
}
