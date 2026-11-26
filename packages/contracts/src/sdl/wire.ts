import { z } from 'zod';
import {
  authSessionInfoSchema,
  revokeSessionInputSchema,
  sessionUserSchema,
} from '../auth.ts';
import { pingInputSchema, pingResultSchema } from '../ping.ts';
import {
  coverageStatusSchema,
  decisionStatusSchema,
  intermediaryClassSchema,
  labelTierSchema,
  traceDisclosureReasonParamsSchema,
  traceDisclosureSchema,
  traceEdgeDirectionSchema,
  traceEdgeSchema,
  traceLabelSchema,
  traceNodeKindSchema,
  traceNodeSchema,
  traceRuleSchema,
  walletAddressInputSchema,
  walletBandSchema,
  walletConfidenceSchema,
  walletDetailSchema,
  walletGraphInputSchema,
  walletListItemSchema,
  walletListInputSchema,
  walletPageSchema,
  walletScreeningSchema,
  walletTraceGraphSchema,
} from '../wallets.ts';
import { defineWireModule } from './registry.ts';

/**
 * The root of the served schema: the shared scalars, the liveness probe and
 * the base `Query`/`Mutation` types every module extends.
 */
export const rootWire = defineWireModule({
  name: 'root',
  root: true,
  scalars: ['Date', 'Time'],
  outputTypes: {
    PingResult: pingResultSchema,
  },
  query: {
    health: { type: 'String!' },
    ping: { args: pingInputSchema, type: 'PingResult!' },
  },
  mutation: {
    _: {
      type: 'Boolean',
      comment: [
        'Base mutation root. Feature modules attach mutations with',
        '`extend type Mutation { ... }`. GraphQL requires at least one field, so a',
        'placeholder is kept here until the application defines its own.',
      ],
    },
  },
});

/** The signed-in session's queries and its one mutation. */
export const authWire = defineWireModule({
  name: 'auth',
  outputTypes: {
    AuthUser: { schema: sessionUserSchema, ids: ['id'] },
    AuthSessionInfo: { schema: authSessionInfoSchema, ids: ['id'] },
  },
  query: {
    me: { type: 'AuthUser' },
    mySessions: { type: '[AuthSessionInfo!]!' },
  },
  mutation: {
    revokeSession: {
      args: revokeSessionInputSchema,
      ids: ['sessionId'],
      type: 'Boolean!',
    },
  },
});

/**
 * The disclosure reason's SDL view. The contract carries the reason as a
 * discriminated union; SDL serves one flat type instead — `code` is a plain
 * `String` (a real enum when a second code lands) and the params record is
 * its own named type. Like the `ID` scalar, this is a hand-declared
 * mapping zod cannot express, stated once here in the registry.
 */
const traceDisclosureReasonSdlSchema = z.object({
  code: z.string(),
  params: traceDisclosureReasonParamsSchema,
});

/**
 * The disclosure's SDL view: the contract's fields with the reason's union
 * swapped for its SDL view, so the emitter never meets a union.
 */
const traceDisclosureSdlSchema = z.object({
  ...traceDisclosureSchema.shape,
  reason: traceDisclosureReasonSdlSchema.nullable(),
});

/**
 * The trace graph's SDL view: the contract's fields with the disclosure
 * swapped for its SDL view, so the graph's reference resolves to the type
 * the registry actually serves.
 */
const walletTraceGraphSdlSchema = z.object({
  ...walletTraceGraphSchema.shape,
  disclosure: traceDisclosureSdlSchema,
});

/** The laundering screener's read model, trace graph and screening mutation. */
export const walletsWire = defineWireModule({
  name: 'wallets',
  enums: {
    WalletBand: walletBandSchema,
    WalletConfidence: walletConfidenceSchema,
    LabelTier: labelTierSchema,
    DecisionStatus: decisionStatusSchema,
    TraceNodeKind: traceNodeKindSchema,
    IntermediaryClass: intermediaryClassSchema,
    CoverageStatus: coverageStatusSchema,
    TraceEdgeDirection: traceEdgeDirectionSchema,
  },
  outputTypes: {
    WalletListItem: walletListItemSchema,
    WalletPage: walletPageSchema,
    TraceLabel: traceLabelSchema,
    TraceRule: traceRuleSchema,
    TraceNode: traceNodeSchema,
    TraceEdge: { schema: traceEdgeSchema, ids: ['id'] },
    TraceDisclosureReasonParams: traceDisclosureReasonParamsSchema,
    TraceDisclosureReason: traceDisclosureReasonSdlSchema,
    TraceDisclosure: traceDisclosureSdlSchema,
    WalletTraceGraph: walletTraceGraphSdlSchema,
    WalletDetail: walletDetailSchema,
    WalletScreening: walletScreeningSchema,
  },
  query: {
    wallets: { args: walletListInputSchema, type: 'WalletPage!' },
    wallet: { args: walletAddressInputSchema, type: 'WalletDetail' },
    previewWallet: { args: walletAddressInputSchema, type: 'WalletScreening!' },
    walletGraph: { args: walletGraphInputSchema, type: 'WalletTraceGraph!' },
  },
  mutation: {
    screenWallet: { args: walletAddressInputSchema, type: 'WalletScreening!' },
  },
});
