import type { WalletBand, WalletConfidence, DecisionStatus, LabelTier } from '@repo/contracts';

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

export class WalletGraphNode {
  id!: string;
  label!: string;
  band!: WalletBand;
  tier!: LabelTier;
  subject!: boolean;
  hops!: number;
}

export class WalletGraphEdge {
  from!: string;
  to!: string;
  amountUsdt!: number;
  txHash!: string;
  timestamp!: string;
}

export class WalletGraph {
  nodes!: WalletGraphNode[];
  edges!: WalletGraphEdge[];
}

export class WalletScreening {
  wallet!: WalletListItem;
  flags!: string[];
  simulated!: boolean;
  graph!: WalletGraph;
}
