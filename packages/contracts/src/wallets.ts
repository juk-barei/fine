import { z } from 'zod';

/**
 * The wallet list read model: exactly what the home page renders. Feature,
 * score-detail and label columns belong to the frozen data contract and are
 * deliberately absent here.
 *
 * Every field except `address` is nullable: a wallet that has not been scored
 * yet must not look like a wallet scored zero.
 */
export const walletBandSchema = z.enum(['low', 'moderate', 'high']);
export type WalletBand = z.infer<typeof walletBandSchema>;

export const walletConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type WalletConfidence = z.infer<typeof walletConfidenceSchema>;

export const labelTierSchema = z.enum(['tier_1', 'tier_2', 'tier_3']);
export type LabelTier = z.infer<typeof labelTierSchema>;

export const decisionStatusSchema = z.enum(['open', 'flagged', 'cleared']);
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;

/**
 * A TRON base58 address: `T` plus 33 base58 characters. Structural only; the
 * checksum is verified when a real chain client lands.
 */
export const tronAddressSchema = z
  .string()
  .trim()
  .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'expected a TRON address (T…, 34 characters)');
export type TronAddress = z.infer<typeof tronAddressSchema>;

export const walletListItemSchema = z.object({
  address: tronAddressSchema,
  score: z.number().min(0).max(1).nullable(),
  band: walletBandSchema.nullable(),
  confidence: walletConfidenceSchema.nullable(),
  labelTier: labelTierSchema.nullable(),
  decisionStatus: decisionStatusSchema.nullable(),
  lastAnalysed: z.string().datetime().nullable(),
});
export type WalletListItem = z.infer<typeof walletListItemSchema>;

export const walletListInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  status: decisionStatusSchema.nullable().optional(),
});
export type WalletListInput = z.infer<typeof walletListInputSchema>;

export const walletPageSchema = z.object({
  nodes: z.array(walletListItemSchema),
  total: z.number().int().min(0),
});
export type WalletPage = z.infer<typeof walletPageSchema>;

export const screenWalletInputSchema = z.object({
  address: tronAddressSchema,
});
export type ScreenWalletInput = z.infer<typeof screenWalletInputSchema>;

/**
 * The result of one screening run. `simulated` marks results produced by the
 * deterministic mock scorer, so the UI can say so rather than pretend.
 */
export const walletScreeningSchema = z.object({
  wallet: walletListItemSchema,
  flags: z.array(z.string()),
  simulated: z.boolean(),
});
export type WalletScreening = z.infer<typeof walletScreeningSchema>;
