import { z } from 'zod';

/**
 * The liveness probe's payload. `serverTime` crosses the wire through the
 * `Date` scalar, so it is a `Date` in the contract, not an ISO string.
 */
export const pingResultSchema = z.object({
  serverTime: z.date(),
  uptimeSeconds: z.number(),
  processingTimeMs: z.number(),
  nonce: z.string().nullable(),
});
export type PingResult = z.infer<typeof pingResultSchema>;

/** The `ping` query's only argument; omitted means the client wants no echo. */
export const pingInputSchema = z.object({
  nonce: z.string().nullable().optional(),
});
