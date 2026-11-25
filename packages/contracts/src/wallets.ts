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

export const walletAddressInputSchema = z.object({
  address: tronAddressSchema,
});
export type WalletAddressInput = z.infer<typeof walletAddressInputSchema>;

/** What a traced address is: the subject itself or an entity in its flow. */
export const traceNodeKindSchema = z.enum([
  'subject',
  'counterparty',
  'bridge',
  'exchange',
  'mixer',
  'darknet',
  'bank',
  'sanctioned',
  'infrastructure',
  'unknown',
]);
export type TraceNodeKind = z.infer<typeof traceNodeKindSchema>;

export const intermediaryClassSchema = z.enum([
  'pass_through',
  'peel_chain',
  'consolidation',
]);
export type IntermediaryClass = z.infer<typeof intermediaryClassSchema>;

export const coverageStatusSchema = z.enum(['complete', 'partial']);
export type CoverageStatus = z.infer<typeof coverageStatusSchema>;

export const traceEdgeDirectionSchema = z.enum(['inbound', 'outbound']);
export type TraceEdgeDirection = z.infer<typeof traceEdgeDirectionSchema>;

export const traceLabelSchema = z.object({
  tier: labelTierSchema,
  source: z.string().min(1),
  /** Unknown until the real label pipeline carries provenance. */
  listedAt: z.string().datetime().nullable(),
});
export type TraceLabel = z.infer<typeof traceLabelSchema>;

/**
 * One baseline rule's state. Codes are the product's R1–R6, never the
 * prototype's invented FR codes.
 */
export const traceRuleSchema = z.object({
  code: z.string().regex(/^R[1-6]$/, 'expected a rule code from R1 to R6'),
  triggered: z.boolean(),
  summary: z.string().min(1),
});
export type TraceRule = z.infer<typeof traceRuleSchema>;

export const traceNodeSchema = z.object({
  address: tronAddressSchema,
  hop: z.number().int().min(0).max(5),
  kind: traceNodeKindSchema,
  title: z.string().nullable(),
  badge: z.string().nullable(),
  band: walletBandSchema.nullable(),
  pLaundering: z.number().min(0).max(1).nullable(),
  confidence: walletConfidenceSchema.nullable(),
  volumeUsdt: z.number().min(0),
  intermediary: intermediaryClassSchema.nullable(),
  labels: z.array(traceLabelSchema),
  rules: z.array(traceRuleSchema),
  /** Exactly one node is the wallet the investigator opened. */
  subject: z.boolean(),
});
export type TraceNode = z.infer<typeof traceNodeSchema>;

export const traceEdgeSchema = z.object({
  id: z.string().min(1),
  from: tronAddressSchema,
  to: tronAddressSchema,
  amountUsdt: z.number().positive(),
  txHash: z.string().regex(/^[0-9a-f]{64}$/, 'expected a 64-character hex txid'),
  timestamp: z.string().datetime(),
  hop: z.number().int().min(1).max(5),
  direction: traceEdgeDirectionSchema,
});
export type TraceEdge = z.infer<typeof traceEdgeSchema>;

/**
 * What the server actually did: the depth asked for and reached, how many
 * nodes the cap allowed, and whether the index covered the flow. A truncated
 * trace must never claim complete coverage.
 */
export const traceDisclosureSchema = z
  .object({
    depthRequested: z.number().int().min(1).max(5),
    depthReached: z.number().int().min(0).max(5),
    minValueUsdt: z.number().min(0),
    nodesReturned: z.number().int().min(1),
    nodeCap: z.number().int().positive(),
    truncated: z.boolean(),
    coverage: coverageStatusSchema,
    loadedTransfers: z.number().int().min(0),
    reportedTransfers: z.number().int().min(0),
    reason: z.string().min(1).nullable(),
  })
  .superRefine((disclosure, ctx) => {
    if (disclosure.depthReached > disclosure.depthRequested) {
      ctx.addIssue({
        code: 'custom',
        path: ['depthReached'],
        message: 'depthReached cannot exceed depthRequested',
      });
    }
    if (disclosure.nodesReturned > disclosure.nodeCap) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodesReturned'],
        message: 'nodesReturned cannot exceed nodeCap',
      });
    }
    if (disclosure.truncated && disclosure.coverage === 'complete') {
      ctx.addIssue({
        code: 'custom',
        path: ['coverage'],
        message: 'a truncated trace cannot report complete coverage',
      });
    }
    if (disclosure.coverage === 'partial' && disclosure.reason === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'partial coverage must say why',
      });
    }
    if (disclosure.loadedTransfers > disclosure.reportedTransfers) {
      ctx.addIssue({
        code: 'custom',
        path: ['loadedTransfers'],
        message: 'loaded transfers cannot exceed the reported transfers',
      });
    }
  });
export type TraceDisclosure = z.infer<typeof traceDisclosureSchema>;

export const walletTraceGraphSchema = z
  .object({
    simulated: z.boolean(),
    nodes: z.array(traceNodeSchema).min(1),
    edges: z.array(traceEdgeSchema),
    disclosure: traceDisclosureSchema,
  })
  .superRefine((graph, ctx) => {
    const addresses = new Set(graph.nodes.map((node) => node.address));
    if (addresses.size !== graph.nodes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: 'node addresses must be unique',
      });
    }

    const subjects = graph.nodes.filter((node) => node.subject);
    if (subjects.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: 'exactly one node must be the subject',
      });
    } else {
      const [subject] = subjects;
      if (subject.hop !== 0 || subject.kind !== 'subject') {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes'],
          message: 'the subject must be hop 0 with kind "subject"',
        });
      }
    }

    for (const [index, edge] of graph.edges.entries()) {
      if (!addresses.has(edge.from) || !addresses.has(edge.to)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'an edge must connect two returned nodes',
        });
      }
    }

    if (graph.disclosure.nodesReturned !== graph.nodes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['disclosure', 'nodesReturned'],
        message: 'nodesReturned must match the nodes in the payload',
      });
    }
  });
export type WalletTraceGraph = z.infer<typeof walletTraceGraphSchema>;

/**
 * The trace graph's documented defaults. Declared once here so the contract,
 * the server's resolver and the client's hook and controls cannot drift.
 */
export const WALLET_GRAPH_DEFAULT_DEPTH = 5;
export const WALLET_GRAPH_DEFAULT_MIN_VALUE_USDT = 0;

export const walletGraphInputSchema = z.object({
  address: tronAddressSchema,
  depth: z.number().int().min(1).max(5).default(WALLET_GRAPH_DEFAULT_DEPTH),
  minValueUsdt: z
    .number()
    .min(0)
    .default(WALLET_GRAPH_DEFAULT_MIN_VALUE_USDT),
});
export type WalletGraphInput = z.infer<typeof walletGraphInputSchema>;

/**
 * A wallet page's data. The graph is a separate query: the detail payload
 * carries only the wallet, its flags and the simulation marker.
 */
export const walletDetailSchema = z.object({
  wallet: walletListItemSchema,
  flags: z.array(z.string()),
  simulated: z.boolean(),
});
export type WalletDetail = z.infer<typeof walletDetailSchema>;

/** One screening run's response: the wallet plus its re-derived flags. */
export const walletScreeningSchema = walletDetailSchema;
export type WalletScreening = z.infer<typeof walletScreeningSchema>;
