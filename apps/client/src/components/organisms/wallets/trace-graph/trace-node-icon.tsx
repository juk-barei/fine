import {
  ArrowLeftRight,
  Ban,
  CircleHelp,
  Landmark,
  Server,
  Shuffle,
  Skull,
  UserRound,
  Wallet,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { TraceNodeKind } from '@repo/contracts';

const ICON_BY_KIND: Record<TraceNodeKind, LucideIcon> = {
  subject: UserRound,
  counterparty: Wallet,
  bridge: Waypoints,
  exchange: ArrowLeftRight,
  mixer: Shuffle,
  darknet: Skull,
  bank: Landmark,
  sanctioned: Ban,
  infrastructure: Server,
  unknown: CircleHelp,
};

/** One product icon per entity kind, so the same kind reads the same everywhere. */
export function TraceNodeIcon({
  kind,
  className,
}: {
  kind: TraceNodeKind;
  className?: string;
}) {
  const Icon = ICON_BY_KIND[kind];

  return <Icon aria-hidden="true" className={className} />;
}
