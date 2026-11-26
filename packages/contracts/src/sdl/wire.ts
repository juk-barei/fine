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
    TraceDisclosure: traceDisclosureSchema,
    WalletTraceGraph: walletTraceGraphSchema,
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
