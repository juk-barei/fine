import type {
  CoverageStatus,
  DecisionStatus,
  IntermediaryClass,
  LabelTier,
  TraceEdgeDirection,
  TraceNodeKind,
  WalletBand,
  WalletConfidence,
} from '@repo/contracts';

export class WalletListItem {
  address!: string;
  score?: number | null;
  band?: WalletBand | null;
  confidence?: WalletConfidence | null;
  labelTier?: LabelTier | null;
  decisionStatus?: DecisionStatus | null;
  lastAnalysed?: string | null;
}

export class WalletPage {
  nodes!: WalletListItem[];
  total!: number;
}

export class TraceLabel {
  tier!: LabelTier;
  source!: string;
  listedAt?: string | null;
}

export class TraceRule {
  code!: string;
  triggered!: boolean;
  summary!: string;
}

export class TraceNode {
  address!: string;
  hop!: number;
  kind!: TraceNodeKind;
  title?: string | null;
  badge?: string | null;
  band?: WalletBand | null;
  pLaundering?: number | null;
  confidence?: WalletConfidence | null;
  volumeUsdt!: number;
  intermediary?: IntermediaryClass | null;
  labels!: TraceLabel[];
  rules!: TraceRule[];
  subject!: boolean;
}

export class TraceEdge {
  id!: string;
  from!: string;
  to!: string;
  amountUsdt!: number;
  txHash!: string;
  timestamp!: string;
  hop!: number;
  direction!: TraceEdgeDirection;
}

export class TraceDisclosure {
  depthRequested!: number;
  depthReached!: number;
  minValueUsdt!: number;
  nodesReturned!: number;
  nodeCap!: number;
  truncated!: boolean;
  coverage!: CoverageStatus;
  loadedTransfers!: number;
  reportedTransfers!: number;
  reason?: string | null;
}

export class WalletTraceGraph {
  simulated!: boolean;
  nodes!: TraceNode[];
  edges!: TraceEdge[];
  disclosure!: TraceDisclosure;
}

export class WalletDetail {
  wallet!: WalletListItem;
  flags!: string[];
  simulated!: boolean;
}

export class WalletScreening {
  wallet!: WalletListItem;
  flags!: string[];
  simulated!: boolean;
}
