import { createHash } from 'node:crypto';
import type {
  IntermediaryClass,
  TraceLabel,
  TraceNodeKind,
  TraceRule,
} from '@repo/contracts';
import { OFAC_TRON_ADDRESSES } from '../../domain/screening/ofac-seed.ts';
import {
  screenAddress,
  type Screening,
} from '../../domain/screening/screening.ts';
import type {
  TraceNeighbourhood,
  TraceNodeProfile,
  TraceTransfer,
} from '../../domain/trace/trace-graph.ts';

/**
 * The deterministic trace source adapter: the synthetic half of the Tron
 * data path that answers "where did the money go" while the chain loader is
 * still a plan. Addresses, transfers, timestamps and per-address profiles
 * all come from sha256 digests of the subject, so the same request renders
 * the same picture. Nothing here is subject-relative: this file synthesizes
 * a flat neighbourhood — the trace policy in `domain/trace/` derives every
 * hop, direction, volume and disclosure from it. The nodes' screening comes
 * from `screenAddress`, so the trace graph and the wallet list agree.
 *
 * Every traced wallet exposes the same children, so the neighbourhood grows
 * as `4^hop`: 341 nodes at depth four and 1,365 at depth five. The product's
 * node cap is therefore reachable by asking for depth five and not by
 * asking for four, with no test-only switch.
 */

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Counterparties are classified from this pool; the subject never is. */
const COUNTERPARTY_KINDS: readonly TraceNodeKind[] = [
  'counterparty',
  'exchange',
  'bridge',
  'mixer',
  'bank',
  'darknet',
  'infrastructure',
  'unknown',
];

const INTERMEDIARY_CLASSES: readonly IntermediaryClass[] = [
  'pass_through',
  'peel_chain',
  'consolidation',
];

/** R1–R6 are the product's baseline rules; never the prototype's FR codes. */
const RULE_DEFINITIONS: ReadonlyArray<readonly [string, string]> = [
  ['R1', 'Direct exposure to a sanctioned address'],
  ['R2', 'Pass-through behaviour: funds in and out within hours'],
  ['R3', 'Fan-out to many recipients'],
  ['R4', 'Round-number transfers'],
  ['R5', 'Zero-balance relay wallet'],
  ['R6', 'Bursty transfer timing'],
];

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function shortLabel(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function counterpartyAddress(subject: string, hop: number, index: number): string {
  const bytes = digest(`${subject}:trace:${hop}:${index}`);
  let address = 'T';
  for (let i = 0; i < 33; i += 1) {
    address += BASE58[bytes[i % bytes.length] % BASE58.length];
  }
  return address;
}

function kindFor(address: string): TraceNodeKind {
  if (OFAC_TRON_ADDRESSES[address] === true) return 'sanctioned';
  const bytes = digest(`${address}:kind`);
  return COUNTERPARTY_KINDS[bytes[0] % COUNTERPARTY_KINDS.length];
}

function labelsFor(address: string): TraceLabel[] {
  return OFAC_TRON_ADDRESSES[address] === true
    ? [{ tier: 'tier_1', source: 'OFAC SDN (simulated)', listedAt: null }]
    : [];
}

function intermediaryFor(address: string): IntermediaryClass | null {
  const bytes = digest(`${address}:intermediary`);
  if (bytes[0] % 2 === 1) return null;
  return INTERMEDIARY_CLASSES[bytes[1] % INTERMEDIARY_CLASSES.length];
}

function rulesFor(address: string, screening: Screening): TraceRule[] {
  const bytes = digest(`${address}:rules`);
  const threshold = 15 + Math.round(screening.score * 70);
  const sanctioned = OFAC_TRON_ADDRESSES[address] === true;

  return RULE_DEFINITIONS.map(([code, summary], index) => ({
    code,
    summary,
    triggered:
      (code === 'R1' && sanctioned) ||
      (bytes[index] + index * 7) % 100 < threshold,
  }));
}

/**
 * The per-address enrichment the policy carries: one screening at build
 * time, plus the digest-derived classification. A total function of the
 * address, so any node the policy keeps — the subject included — is
 * profiled.
 */
function mockProfileOf(address: string): TraceNodeProfile {
  const screening: Screening = screenAddress(address);

  return {
    kind: kindFor(address),
    title: shortLabel(address),
    badge: null,
    band: screening.band,
    pLaundering: screening.score,
    confidence: screening.confidence,
    intermediary: intermediaryFor(address),
    labels: labelsFor(address),
    rules: rulesFor(address, screening),
  };
}

/** Every traced wallet exposes the same number of children. */
const TRACE_FAN_OUT = 4;

/**
 * The deterministic multi-hop mock neighbourhood of a wallet: a flat,
 * depth-bounded transfer list plus the profile lookup, everything derived
 * from the address so the same request renders the same picture.
 *
 * The digest decides each transfer's orientation — which endpoint is
 * `from` — at hop one, and deeper hops inherit their branch's orientation,
 * so a branch keeps one flow direction. The trace policy re-derives
 * direction from the subject; this only picks the on-chain from/to.
 */
export function mockTraceNeighbourhood(
  address: string,
  depth: number,
): TraceNeighbourhood {
  const transfers: TraceTransfer[] = [];
  const outwardByAddress = new Map<string, boolean>();
  let parents: string[] = [address];

  for (let hop = 1; hop <= depth; hop += 1) {
    const hopBytes = digest(`${address}:trace:${hop}`);
    const current: string[] = [];

    for (let index = 0; index < parents.length * TRACE_FAN_OUT; index += 1) {
      const child = counterpartyAddress(address, hop, index);
      const parent = parents[Math.floor(index / TRACE_FAN_OUT)];
      const outward: boolean =
        hop === 1
          ? hopBytes[index % hopBytes.length] % 2 === 0
          : outwardByAddress.get(parent) ?? true;

      outwardByAddress.set(child, outward);
      current.push(child);

      const amountBytes = digest(`${address}:trace-amount:${hop}:${index}`);
      const amountUsdt =
        100 + (((amountBytes[0] << 8) | amountBytes[1]) % 49_900);
      const hours = ((amountBytes[2] << 8) | amountBytes[3]) % (30 * 24);
      const txHash = digest(`${address}:trace-tx:${hop}:${index}`).toString(
        'hex',
      );

      transfers.push({
        txHash,
        from: outward ? parent : child,
        to: outward ? child : parent,
        amountUsdt,
        timestamp: new Date(
          Date.UTC(2026, 9, 1) + hours * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    parents = current;
  }

  return { simulated: true, transfers, profileOf: mockProfileOf };
}
