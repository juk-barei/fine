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
