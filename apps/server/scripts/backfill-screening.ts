import { eq, isNotNull } from 'drizzle-orm';
import { db } from '../src/database.ts';
import { wallets } from '../src/db/schema.ts';
import { screenAddress } from '../src/domain/screening/screening.ts';

/**
 * One-off backfill for rows scored before the `flags` column existed: re-runs
 * the deterministic scorer over every scored row and persists the result whole.
 * The scorer is deterministic, so re-running is a no-op-by-construction for
 * rows the current code already screened, and idempotent however often it runs.
 * Unscored rows keep their nulls — a row nobody screened reads as unscreened.
 */
async function main(): Promise<void> {
  const scored = await db
    .select({ address: wallets.address })
    .from(wallets)
    .where(isNotNull(wallets.score));

  for (const row of scored) {
    const screening = screenAddress(row.address);
    await db
      .update(wallets)
      .set({
        score: screening.score.toFixed(4),
        band: screening.band,
        confidence: screening.confidence,
        labelTier: screening.labelTier,
        decisionStatus: screening.decisionStatus,
        flags: [...screening.flags],
      })
      .where(eq(wallets.address, row.address));
  }

  console.log(`[backfill-screening] re-scored ${scored.length} wallet(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[backfill-screening] failed:', error);
    process.exit(1);
  });
