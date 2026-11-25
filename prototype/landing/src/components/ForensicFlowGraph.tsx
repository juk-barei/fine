import React, { useMemo, useRef, useState } from 'react';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Copy,
  Check,
  GitBranch,
  Timer,
  Cpu,
  ArrowDownUp,
  ChevronDown,
} from 'lucide-react';

export type FlowNodeShape = 'circle' | 'pentagon';
export type FlowNodeIcon =
  | 'bank'
  | 'none'
  | 'mixer'
  | 'darknet'
  | 'suspect'
  | 'bridge'
  | 'exchange-warn'
  | 'wallet'
  | 'sanctioned';

export type RiskBand = 'high' | 'moderate' | 'low';

export interface NodeRiskBreakdown {
  flowShape: string;
  velocityTiming: string;
  tronFingerprint: string;
  flowImbalance: string;
}

export interface ForensicFlowNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  shape: FlowNodeShape;
  monoFill: string;
  monoStroke: string;
  icon: FlowNodeIcon;
  title?: string;
  badge?: string;
  sizeTier?: 'sm' | 'md' | 'lg';
  address: string;
  hop: number;
  score: number;
  band: RiskBand;
  subject?: boolean;
  volumeUsdt: number;
  breakdown: NodeRiskBreakdown;
}

export interface ForensicFlowEdge {
  id: string;
  from: string;
  to: string;
  variant: 'highlighted' | 'secondary';
  bidirectional?: boolean;
  amountUsdt: number;
  txHash: string;
  timestamp: string;
  hop: number;
}

export interface ForensicFlowStub {
  id: string;
  from: string;
  dx: number;
  dy: number;
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function deterministicAddress(seed: string, salt: string): string {
  let h = 2166136261;
  const str = `${seed}:${salt}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = 'T';
  for (let i = 0; i < 33; i++) {
    h ^= i * 31 + str.charCodeAt(i % str.length);
    h = Math.imul(h, 16777619);
    const idx = Math.abs(h) % BASE58.length;
    out += BASE58[idx];
  }
  return out;
}

function deterministicTxHash(seed: string, edgeId: string): string {
  const hex = '0123456789abcdef';
  let h = 5381;
  const s = `${seed}:${edgeId}`;
  let out = '';
  for (let i = 0; i < 64; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i % s.length) ^ (i * 17)) >>> 0;
    out += hex[h % 16];
  }
  return out;
}

function deterministicScore(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 101;
}

export const BAND_STYLES: Record<
  RiskBand,
  { text: string; bar: string; chip: string }
> = {
  high: {
    text: 'text-red-500',
    bar: 'bg-red-500',
    chip: 'border-red-500/30 bg-red-500/10 text-red-400',
  },
  moderate: {
    text: 'text-amber-400',
    bar: 'bg-amber-400',
    chip: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  },
  low: {
    text: 'text-emerald-400',
    bar: 'bg-emerald-400',
    chip: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  },
};

export function buildForensicGraphForAddress(subjectAddress: string): {
  nodes: ForensicFlowNode[];
  edges: ForensicFlowEdge[];
  stubs: ForensicFlowStub[];
} {
  const cleanSubject =
    subjectAddress.trim().length === 34
      ? subjectAddress.trim()
      : 'TLyqzVGLV1DnUQGeoiw61tFhWwvV4A2h9K';

  const subjectScore = deterministicScore(cleanSubject);
  const subjectBand: RiskBand =
    subjectScore >= 70 ? 'high' : subjectScore >= 40 ? 'moderate' : 'low';

  const nodes: ForensicFlowNode[] = [
    {
      id: 'victim-bank',
      x: 108,
      y: 234,
      radius: 27,
      shape: 'pentagon',
      monoFill: '#27272a',
      monoStroke: '#a1a1aa',
      icon: 'bank',
      title: 'P2P Victim Origin',
      badge: 'Victim bank account',
      sizeTier: 'md',
      address: deterministicAddress(cleanSubject, 'victim-bank'),
      hop: 2,
      score: 14,
      band: 'low',
      volumeUsdt: 420_000,
      breakdown: {
        flowShape: 'Single-source settlement origin (1 outbound path)',
        velocityTiming: 'Normal Fiat/P2P settlement cadence (4.2d hold)',
        tronFingerprint: 'Organic TRX fee wallet (Jaccard 0.78)',
        flowImbalance: '100% outbound initial transfer ($420,000 USDT)',
      },
    },
    {
      id: 'suspected-scam',
      x: 232,
      y: 92,
      radius: 22,
      shape: 'circle',
      monoFill: '#3f3f46',
      monoStroke: '#e4e4e7',
      icon: 'none',
      title: 'Scam Collector #04',
      badge: 'Suspected scam',
      sizeTier: 'md',
      address: deterministicAddress(cleanSubject, 'suspected-scam'),
      hop: 2,
      score: 82,
      band: 'high',
      volumeUsdt: 418_500,
      breakdown: {
        flowShape: 'Fan-in collector funneling 19 victim deposits',
        velocityTiming: 'Fast pass-through (< 9 min median dwell time)',
        tronFingerprint: '84% round ×100 USDT structured transfers',
        flowImbalance: '99.6% swept immediately to Mixing.io relay',
      },
    },
    {
      id: 'mixing',
      x: 354,
      y: 165,
      radius: 17,
      shape: 'circle',
      monoFill: '#27272a',
      monoStroke: '#d4d4d8',
      icon: 'mixer',
      title: 'Mixing.io',
      badge: 'Mixing pool',
      sizeTier: 'sm',
      address: deterministicAddress(cleanSubject, 'mixing'),
      hop: 1,
      score: 91,
      band: 'high',
      volumeUsdt: 410_000,
      breakdown: {
        flowShape: 'High-degree obfuscation pool (fan-in / fan-out hub)',
        velocityTiming: 'Automated burst batching every 180 seconds',
        tronFingerprint: 'Programmatic TRX gas delegation (Jaccard 0.02)',
        flowImbalance: '99.9% pass-through pool turnover',
      },
    },
    {
      id: 'darknet-market',
      x: 268,
      y: 326,
      radius: 50,
      shape: 'circle',
      monoFill: '#18181b',
      monoStroke: '#d4d4d8',
      icon: 'darknet',
      title: 'ShadowShop.io',
      badge: 'Darknet market',
      sizeTier: 'lg',
      address: deterministicAddress(cleanSubject, 'darknet-market'),
      hop: 1,
      score: 95,
      band: 'high',
      volumeUsdt: 685_000,
      breakdown: {
        flowShape: 'Bidirectional escrow & vendor payout cluster',
        velocityTiming: 'High-frequency burst activity (142 tx / hr peak)',
        tronFingerprint: 'Zero TRX/USDT counterpart overlap (Jaccard 0.00)',
        flowImbalance: 'Continuous net outflow to suspect staging wallet',
      },
    },
    {
      id: 'suspect',
      x: 502,
      y: 200,
      radius: 42,
      shape: 'pentagon',
      monoFill: '#fafafa',
      monoStroke: '#ffffff',
      icon: 'suspect',
      title: 'Huione Staging Desk',
      badge: 'Suspect (Seed)',
      sizeTier: 'lg',
      address: cleanSubject,
      hop: 0,
      score: subjectScore,
      band: subjectBand,
      subject: true,
      volumeUsdt: 1_410_000,
      breakdown: {
        flowShape: 'Peeling chain & 4-way fan-out across bridge/mixer hops',
        velocityTiming: 'Pass-through velocity < 6.4 min · 14d burner lifetime',
        tronFingerprint: 'Separate TRX gas-station funder · 89% ×100 amounts',
        flowImbalance: '99.8% of inbound USDT swept to zero-balance relays',
      },
    },
    {
      id: 'bridge',
      x: 628,
      y: 128,
      radius: 14,
      shape: 'circle',
      monoFill: '#27272a',
      monoStroke: '#a1a1aa',
      icon: 'bridge',
      title: 'SunSwap Router',
      badge: 'Bridge',
      sizeTier: 'sm',
      address: deterministicAddress(cleanSubject, 'bridge'),
      hop: 1,
      score: 52,
      band: 'moderate',
      volumeUsdt: 318_000,
      breakdown: {
        flowShape: 'Cross-pool bridge router (hub-bounded node)',
        velocityTiming: 'Automated contract relay (< 45 sec settlement)',
        tronFingerprint: 'Contract energy consumption · standard denominations',
        flowImbalance: 'Balanced liquidity relay ratio (1.01x)',
      },
    },
    {
      id: 'no-kyc-exchange',
      x: 748,
      y: 74,
      radius: 22,
      shape: 'circle',
      monoFill: '#27272a',
      monoStroke: '#d4d4d8',
      icon: 'exchange-warn',
      title: 'Maui Exchange',
      badge: 'No KYC Exchange',
      sizeTier: 'md',
      address: deterministicAddress(cleanSubject, 'no-kyc-exchange'),
      hop: 2,
      score: 79,
      band: 'high',
      volumeUsdt: 295_000,
      breakdown: {
        flowShape: 'Unhosted OTC / No-KYC exchange aggregation desk',
        velocityTiming: 'Rapid hot-wallet sweep within 12 minutes',
        tronFingerprint: '92% round ×100 USDT batch payouts',
        flowImbalance: 'High net outflow toward sanctioned corridor',
      },
    },
    {
      id: 'top-right-address',
      x: 856,
      y: 125,
      radius: 10,
      shape: 'circle',
      monoFill: '#52525b',
      monoStroke: '#d4d4d8',
      icon: 'none',
      title: 'Burner Relay #09',
      badge: 'Peel hop',
      sizeTier: 'sm',
      address: deterministicAddress(cleanSubject, 'top-right-address'),
      hop: 3,
      score: 68,
      band: 'moderate',
      volumeUsdt: 280_000,
      breakdown: {
        flowShape: 'Single-purpose peeling intermediary',
        velocityTiming: 'Burner wallet active for 38 minutes total',
        tronFingerprint: 'Externally funded TRX fee drop (25 TRX)',
        flowImbalance: '100% drained into CryptoHub44 cluster',
      },
    },
    {
      id: 'multiple-transfers',
      x: 705,
      y: 258,
      radius: 10,
      shape: 'circle',
      monoFill: '#e4e4e7',
      monoStroke: '#ffffff',
      icon: 'none',
      title: 'Peel Mule Cluster',
      badge: 'Multiple transfers',
      sizeTier: 'sm',
      address: deterministicAddress(cleanSubject, 'multiple-transfers'),
      hop: 1,
      score: 90,
      band: 'high',
      volumeUsdt: 712_000,
      breakdown: {
        flowShape: 'Peeling chain burst (14 split transfers in 1 block window)',
        velocityTiming: 'Sub-2-minute pass-through velocity',
        tronFingerprint: '100% asset-standard amounts divisible by 100 USDT',
        flowImbalance: '100% zero-balance sweep to avoid Tether freeze',
      },
    },
    {
      id: 'hosted-wallet',
      x: 603,
      y: 355,
      radius: 21,
      shape: 'circle',
      monoFill: '#27272a',
      monoStroke: '#a1a1aa',
      icon: 'wallet',
      title: 'Exchange Deposit #14',
      badge: 'Hosted wallet',
      sizeTier: 'md',
      address: deterministicAddress(cleanSubject, 'hosted-wallet'),
      hop: 1,
      score: 46,
      band: 'moderate',
      volumeUsdt: 185_000,
      breakdown: {
        flowShape: 'Custodial deposit address (2 downstream branches)',
        velocityTiming: 'Moderate hold time (3.4 hours before sweep)',
        tronFingerprint: 'Exchange gas station TRX top-up pattern',
        flowImbalance: '94% swept to omnibus cold storage',
      },
    },
    {
      id: 'sanctioned',
      x: 886,
      y: 230,
      radius: 50,
      shape: 'circle',
      monoFill: '#27272a',
      monoStroke: '#fafafa',
      icon: 'sanctioned',
      title: 'CryptoHub44 (OFAC)',
      badge: 'Sanctioned jurisdiction',
      sizeTier: 'lg',
      address: deterministicAddress(cleanSubject, 'sanctioned'),
      hop: 2,
      score: 98,
      band: 'high',
      volumeUsdt: 992_000,
      breakdown: {
        flowShape: 'Terminal collector sink receiving multi-path peel flows',
        velocityTiming: 'High-volume burst accumulation window',
        tronFingerprint: 'Flagged on OFAC SDN & Tether freeze watchlists',
        flowImbalance: 'Heavy net inflow sink ($992,000 USDT converged)',
      },
    },
  ];

  const edges: ForensicFlowEdge[] = [
    {
      id: 'e-victim-scam',
      from: 'victim-bank',
      to: 'suspected-scam',
      variant: 'highlighted',
      amountUsdt: 420_000,
      txHash: deterministicTxHash(cleanSubject, 'e-victim-scam'),
      timestamp: '2026-11-12T03:14:22Z',
      hop: 1,
    },
    {
      id: 'e-scam-mixing',
      from: 'suspected-scam',
      to: 'mixing',
      variant: 'highlighted',
      amountUsdt: 410_000,
      txHash: deterministicTxHash(cleanSubject, 'e-scam-mixing'),
      timestamp: '2026-11-12T03:21:09Z',
      hop: 2,
    },
    {
      id: 'e-mixing-suspect',
      from: 'mixing',
      to: 'suspect',
      variant: 'highlighted',
      amountUsdt: 405_000,
      txHash: deterministicTxHash(cleanSubject, 'e-mixing-suspect'),
      timestamp: '2026-11-12T03:24:41Z',
      hop: 1,
    },
    {
      id: 'e-suspect-multi',
      from: 'suspect',
      to: 'multiple-transfers',
      variant: 'highlighted',
      amountUsdt: 712_000,
      txHash: deterministicTxHash(cleanSubject, 'e-suspect-multi'),
      timestamp: '2026-11-12T03:29:15Z',
      hop: 1,
    },
    {
      id: 'e-multi-sanctioned',
      from: 'multiple-transfers',
      to: 'sanctioned',
      variant: 'highlighted',
      amountUsdt: 712_000,
      txHash: deterministicTxHash(cleanSubject, 'e-multi-sanctioned'),
      timestamp: '2026-11-12T03:31:02Z',
      hop: 2,
    },
    {
      id: 'e-darknet-suspect',
      from: 'darknet-market',
      to: 'suspect',
      variant: 'secondary',
      bidirectional: true,
      amountUsdt: 685_000,
      txHash: deterministicTxHash(cleanSubject, 'e-darknet-suspect'),
      timestamp: '2026-11-12T02:48:10Z',
      hop: 1,
    },
    {
      id: 'e-suspect-bridge',
      from: 'suspect',
      to: 'bridge',
      variant: 'secondary',
      amountUsdt: 318_000,
      txHash: deterministicTxHash(cleanSubject, 'e-suspect-bridge'),
      timestamp: '2026-11-12T03:30:11Z',
      hop: 1,
    },
    {
      id: 'e-bridge-exchange',
      from: 'bridge',
      to: 'no-kyc-exchange',
      variant: 'secondary',
      amountUsdt: 295_000,
      txHash: deterministicTxHash(cleanSubject, 'e-bridge-exchange'),
      timestamp: '2026-11-12T03:33:50Z',
      hop: 2,
    },
    {
      id: 'e-exchange-addr',
      from: 'no-kyc-exchange',
      to: 'top-right-address',
      variant: 'secondary',
      amountUsdt: 280_000,
      txHash: deterministicTxHash(cleanSubject, 'e-exchange-addr'),
      timestamp: '2026-11-12T03:41:27Z',
      hop: 3,
    },
    {
      id: 'e-addr-sanctioned',
      from: 'top-right-address',
      to: 'sanctioned',
      variant: 'secondary',
      amountUsdt: 280_000,
      txHash: deterministicTxHash(cleanSubject, 'e-addr-sanctioned'),
      timestamp: '2026-11-12T03:44:05Z',
      hop: 4,
    },
    {
      id: 'e-suspect-hosted',
      from: 'suspect',
      to: 'hosted-wallet',
      variant: 'secondary',
      amountUsdt: 185_000,
      txHash: deterministicTxHash(cleanSubject, 'e-suspect-hosted'),
      timestamp: '2026-11-12T03:35:19Z',
      hop: 1,
    },
  ];

  const stubs: ForensicFlowStub[] = [
    { id: 's-bridge-top', from: 'bridge', dx: 34, dy: -76 },
    { id: 's-exchange-right', from: 'no-kyc-exchange', dx: 134, dy: -22 },
    { id: 's-hosted-left', from: 'hosted-wallet', dx: -81, dy: 70 },
    { id: 's-hosted-right', from: 'hosted-wallet', dx: 92, dy: 73 },
  ];

  return { nodes, edges, stubs };
}

function pentagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 5 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function renderNodeIcon(node: ForensicFlowNode, pos: { x: number; y: number }) {
  const { x, y } = pos;
  const fg = node.subject ? '#09090b' : '#ffffff';
  const cutout = node.subject ? '#fafafa' : node.monoFill;

  switch (node.icon) {
    case 'bank':
      return (
        <g
          transform={`translate(${x}, ${y})`}
          fill="none"
          stroke={fg}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="0,-11 -11,-4 11,-4" fill={fg} stroke="none" />
          <line x1={-11} y1={-2} x2={11} y2={-2} />
          <line x1={-7} y1={-1} x2={-7} y2={7} strokeWidth={2} />
          <line x1={-2} y1={-1} x2={-2} y2={7} strokeWidth={2} />
          <line x1={3} y1={-1} x2={3} y2={7} strokeWidth={2} />
          <line x1={-11} y1={9} x2={11} y2={9} strokeWidth={2} />
          <circle
            cx={7.5}
            cy={3.5}
            r={3.5}
            fill={cutout}
            stroke={fg}
            strokeWidth={1.4}
          />
        </g>
      );

    case 'mixer':
      return (
        <g
          transform={`translate(${x}, ${y})`}
          fill="none"
          stroke={fg}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1={-5} y1={-7} x2={4} y2={-7} />
          <polygon points="-5,-5 4,-5 3,3 -4,3" />
          <path d="M 4 -4 H 6.5 V 1 H 3.5" />
          <rect x={-4.5} y={3.5} width={8} height={3.5} rx={1} fill={fg} />
        </g>
      );

    case 'darknet':
      return (
        <g
          transform={`translate(${x}, ${y})`}
          fill="none"
          stroke={fg}
          strokeWidth={2.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M -18 -16 H 14 L 18 -6 H -22 Z" />
          <path d="M -22 -6 C -22 -1 -14 -1 -14 -6 C -14 -1 -6 -1 -6 -6 C -6 -1 2 -1 2 -6 C 2 -1 10 -1 10 -6 C 10 -1 18 -1 18 -6" />
          <path d="M -17 -3 V 15 H 2" />
          <line x1={-19} y1={15} x2={2} y2={15} />
          <path
            d="M 11 1 C 6.5 1 4 4 4 8 C 4 10.5 5.2 12 6.5 13 V 16 H 15.5 V 13 C 16.8 12 18 10.5 18 8 C 18 4 15.5 1 11 1 Z"
            fill={fg}
            stroke="none"
          />
          <circle cx={8.5} cy={8} r={1.6} fill={cutout} stroke="none" />
          <circle cx={13.5} cy={8} r={1.6} fill={cutout} stroke="none" />
          <line x1={9} y1={13.5} x2={9} y2={16} stroke={cutout} strokeWidth={1.3} />
          <line x1={11} y1={13.5} x2={11} y2={16} stroke={cutout} strokeWidth={1.3} />
          <line x1={13} y1={13.5} x2={13} y2={16} stroke={cutout} strokeWidth={1.3} />
        </g>
      );

    case 'suspect':
      return (
        <g transform={`translate(${x}, ${y})`} fill={fg}>
          <circle cx={-3} cy={-13} r={3.6} />
          <path
            d="M -4 -7 L -9 -3 L -13 2 M -4 -7 L 2 -4 M -4 -7 L -6 2 L -13 10 M -6 2 L 0 6 L -2 14"
            fill="none"
            stroke={fg}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={9} cy={3} r={7.5} fill={fg} />
          <text
            x={9}
            y={6.2}
            textAnchor="middle"
            fill={cutout}
            fontSize={9.5}
            fontWeight={800}
            fontFamily="sans-serif"
          >
            $
          </text>
        </g>
      );

    case 'bridge':
      return (
        <g transform={`translate(${x}, ${y})`}>
          <circle cx={-5} cy={-3} r={3.2} fill={fg} />
          <circle
            cx={2}
            cy={2}
            r={5.5}
            fill="none"
            stroke={fg}
            strokeWidth={1.4}
            opacity={0.85}
          />
        </g>
      );

    case 'exchange-warn':
      return (
        <g
          transform={`translate(${x}, ${y})`}
          fill="none"
          stroke={fg}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1={-7} y1={-5} x2={6} y2={-5} />
          <polyline points="-4,-8 -7,-5 -4,-2" />
          <line x1={-7} y1={1} x2={3} y2={1} />
          <polyline points="0,-2 3,1 0,4" />
          <polygon
            points="5,2 10,10 0,10"
            fill={fg}
            stroke={cutout}
            strokeWidth={0.8}
          />
          <line x1={5} y1={4.8} x2={5} y2={7.3} stroke={cutout} strokeWidth={1.3} />
          <circle cx={5} cy={8.8} r={0.6} fill={cutout} stroke="none" />
        </g>
      );

    case 'wallet':
      return (
        <g
          transform={`translate(${x}, ${y})`}
          fill="none"
          stroke={fg}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x={-7} y={-5.5} width={14} height={11} rx={2} />
          <path d="M 3 -1.5 H 7 V 2.5 H 3 A 2 2 0 0 1 3 -1.5 Z" fill={fg} />
        </g>
      );

    case 'sanctioned':
      return (
        <g
          transform={`translate(${x}, ${y})`}
          fill="none"
          stroke={fg}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1={-12} y1={-13} x2={12} y2={15} strokeWidth={3.6} />
          <line x1={-1} y1={-14} x2={8} y2={-4} strokeWidth={3.6} />
          <line x1={5} y1={-11} x2={12} y2={-3} strokeWidth={3.6} />
          <path
            d="M -10 1 C -13 1 -15.5 3.5 -15.5 6.5 C -15.5 10.5 -10 15 -10 15 C -10 15 -4.5 10.5 -4.5 6.5 C -4.5 3.5 -7 1 -10 1 Z"
            strokeWidth={2.5}
          />
          <circle cx={-10} cy={6.5} r={1.5} fill={fg} stroke="none" />
        </g>
      );

    default:
      return null;
  }
}

export interface ForensicFlowGraphProps {
  subjectAddress?: string;
  nodes?: ForensicFlowNode[];
  edges?: ForensicFlowEdge[];
  stubs?: ForensicFlowStub[];
  className?: string;
  showInspector?: boolean;
}

type GraphSelection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string };

export const ForensicFlowGraph: React.FC<ForensicFlowGraphProps> = ({
  subjectAddress = 'TLyqzVGLV1DnUQGeoiw61tFhWwvV4A2h9K',
  nodes: customNodes,
  edges: customEdges,
  stubs: customStubs,
  className = '',
  showInspector = true,
}) => {
  const generated = useMemo(
    () => buildForensicGraphForAddress(subjectAddress),
    [subjectAddress]
  );

  const baseNodes = customNodes ?? generated.nodes;
  const edges = customEdges ?? generated.edges;
  const stubs = customStubs ?? generated.stubs;

  const [nodeOffsets, setNodeOffsets] = useState<
    Record<string, { dx: number; dy: number }>
  >({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origDx: number;
    origDy: number;
    moved: boolean;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [filterMode, setFilterMode] = useState<'all' | 'critical'>('all');
  const [zoom, setZoom] = useState<number>(1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const [openCards, setOpenCards] = useState<Record<number, boolean>>({
    0: false,
    1: false,
    2: false,
    3: false,
  });

  const toggleCard = (idx: number) => {
    setOpenCards((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const allExpanded =
    openCards[0] && openCards[1] && openCards[2] && openCards[3];
  const toggleAllCards = () => {
    const next = !allExpanded;
    setOpenCards({ 0: next, 1: next, 2: next, 3: next });
  };

  const [selection, setSelection] = useState<GraphSelection>({
    kind: 'node',
    id: 'suspect',
  });

  const getPos = (node: ForensicFlowNode) => {
    const off = nodeOffsets[node.id];
    return {
      x: node.x + (off?.dx ?? 0),
      y: node.y + (off?.dy ?? 0),
    };
  };

  const nodeMap = useMemo(
    () => new Map(baseNodes.map((n) => [n.id, n])),
    [baseNodes]
  );

  const selectedNode =
    selection.kind === 'node'
      ? nodeMap.get(selection.id) ?? nodeMap.get('suspect') ?? baseNodes[0]
      : null;

  const selectedEdge =
    selection.kind === 'edge'
      ? edges.find((e) => e.id === selection.id) ?? null
      : null;

  const clientToSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = 1000 / rect.width;
    const scaleY = 460 / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDownNode = (
    e: React.PointerEvent<SVGGElement>,
    node: ForensicFlowNode
  ) => {
    e.stopPropagation();
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    const currentOff = nodeOffsets[node.id] ?? { dx: 0, dy: 0 };
    dragStartRef.current = {
      id: node.id,
      startX: pt.x,
      startY: pt.y,
      origDx: currentOff.dx,
      origDy: currentOff.dy,
      moved: false,
    };
    setDraggingId(node.id);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMoveSvg = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragStartRef.current;
    if (!drag) return;
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    const deltaX = pt.x - drag.startX;
    const deltaY = pt.y - drag.startY;
    if (Math.hypot(deltaX, deltaY) > 3) {
      drag.moved = true;
    }
    setNodeOffsets((prev) => ({
      ...prev,
      [drag.id]: {
        dx: drag.origDx + deltaX,
        dy: drag.origDy + deltaY,
      },
    }));
  };

  const handlePointerUpNode = (node: ForensicFlowNode) => {
    const drag = dragStartRef.current;
    setDraggingId(null);
    dragStartRef.current = null;
    if (!drag || !drag.moved) {
      setSelection({ kind: 'node', id: node.id });
    }
  };

  const handleResetLayout = () => {
    setNodeOffsets({});
    setZoom(1);
    setFilterMode('all');
  };

  const handleCopyAddress = (addr: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(addr)
      .then(() => {
        setCopiedAddress(addr);
        if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(
          () => setCopiedAddress(null),
          1400
        );
      })
      .catch(() => {});
  };

  const criticalNodeIds = useMemo(() => {
    const s = new Set<string>();
    edges
      .filter((e) => e.variant === 'highlighted')
      .forEach((e) => {
        s.add(e.from);
        s.add(e.to);
      });
    return s;
  }, [edges]);

  const hoveredNeighbors = useMemo(() => {
    if (!hoveredNodeId) return null;
    const s = new Set<string>([hoveredNodeId]);
    edges.forEach((e) => {
      if (e.from === hoveredNodeId) s.add(e.to);
      if (e.to === hoveredNodeId) s.add(e.from);
    });
    return s;
  }, [hoveredNodeId, edges]);

  const hopLevels = Math.max(...baseNodes.map((n) => n.hop)) + 1;
  const subjectVolume = baseNodes.find((n) => n.subject)?.volumeUsdt ?? 0;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Interactive Monochrome Graph Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`cursor-pointer rounded-lg border px-2.5 py-1 font-medium transition ${
              filterMode === 'all'
                ? 'border-foreground/30 bg-foreground text-background'
                : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            All hops ({baseNodes.length} nodes)
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('critical')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition ${
              filterMode === 'critical'
                ? 'border-foreground/30 bg-foreground text-background'
                : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                filterMode === 'critical' ? 'bg-background' : 'bg-foreground'
              }`}
            />
            Primary trace path
          </button>
          <span className="hidden pl-1 text-[11px] text-muted-foreground sm:inline">
            Drag any node to rearrange · Click node or arrow to inspect
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-border bg-card/40 p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.1).toFixed(2)))}
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[10px] text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.35, +(z + 0.1).toFixed(2)))}
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetLayout}
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Reset layout & zoom"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Black & White SVG Graph Canvas */}
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-border/80 bg-[#141416]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.11) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        {/* Soft radial vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 65% at 52% 50%, transparent 45%, #141416 96%)',
          }}
        />

        <div className="overflow-x-auto p-3 sm:p-5">
          <svg
            ref={svgRef}
            viewBox="0 0 1000 460"
            role="group"
            aria-label="Interactive multi-hop forensic fund-flow graph"
            onPointerMove={handlePointerMoveSvg}
            onPointerUp={() => {
              setDraggingId(null);
              dragStartRef.current = null;
            }}
            className="relative z-10 mx-auto h-auto w-full min-w-[680px] max-w-[1000px] select-none transition-transform duration-150"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            <defs>
              {/* Primary white arrowhead */}
              <marker
                id="arrow-white"
                viewBox="0 0 10 10"
                refX="7.5"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto-start-reverse"
              >
                <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="#fafafa" />
              </marker>

              {/* Secondary grey arrowhead */}
              <marker
                id="arrow-grey"
                viewBox="0 0 10 10"
                refX="7.5"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto-start-reverse"
              >
                <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="#71717a" />
              </marker>

              <filter
                id="node-shadow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="4"
                  floodColor="#000000"
                  floodOpacity="0.45"
                />
              </filter>
            </defs>

            {/* Unexpanded continuation stubs */}
            {stubs.map((stub) => {
              const source = nodeMap.get(stub.from);
              if (!source) return null;
              const pos = getPos(source);
              const toX = pos.x + stub.dx;
              const toY = pos.y + stub.dy;
              const len = Math.hypot(stub.dx, stub.dy);
              if (len === 0) return null;
              const ux = stub.dx / len;
              const uy = stub.dy / len;
              const startPad = source.radius + 5;
              const dimmed = filterMode === 'critical';

              return (
                <line
                  key={stub.id}
                  x1={pos.x + ux * startPad}
                  y1={pos.y + uy * startPad}
                  x2={toX}
                  y2={toY}
                  stroke="#3f3f46"
                  strokeWidth={1.35}
                  strokeLinecap="round"
                  opacity={dimmed ? 0.2 : 0.85}
                />
              );
            })}

            {/* Interactive Directed Edges */}
            {edges.map((edge) => {
              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);
              if (!fromNode || !toNode) return null;

              const fromPos = getPos(fromNode);
              const toPos = getPos(toNode);

              const dx = toPos.x - fromPos.x;
              const dy = toPos.y - fromPos.y;
              const len = Math.hypot(dx, dy);
              if (len === 0) return null;
              const ux = dx / len;
              const uy = dy / len;

              const startGap =
                fromNode.radius + (edge.bidirectional ? 11 : 7);
              const endGap = toNode.radius + 11;

              const x1 = fromPos.x + ux * startGap;
              const y1 = fromPos.y + uy * startGap;
              const x2 = toPos.x - ux * endGap;
              const y2 = toPos.y - uy * endGap;

              const isHighlighted = edge.variant === 'highlighted';
              const isEdgeSelected =
                selection.kind === 'edge' && selection.id === edge.id;

              const dimmedByFilter =
                filterMode === 'critical' && !isHighlighted;
              const dimmedByHover =
                hoveredNeighbors !== null &&
                !(
                  hoveredNeighbors.has(edge.from) &&
                  hoveredNeighbors.has(edge.to)
                );

              const strokeColor = isHighlighted ? '#fafafa' : '#71717a';
              const markerUrl = isHighlighted
                ? 'url(#arrow-white)'
                : 'url(#arrow-grey)';

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g
                  key={edge.id}
                  onClick={() => setSelection({ kind: 'edge', id: edge.id })}
                  role="button"
                  tabIndex={0}
                  aria-label={`Transfer ${edge.amountUsdt.toLocaleString()} USDT, hop ${edge.hop}, ${edge.from} to ${edge.to}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelection({ kind: 'edge', id: edge.id });
                    }
                  }}
                  className="cursor-pointer transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                  opacity={dimmedByFilter || dimmedByHover ? 0.22 : 1}
                >
                  <title>
                    {`${edge.amountUsdt.toLocaleString()} USDT · Hop ${edge.hop} · Click to inspect transfer`}
                  </title>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth={
                      isEdgeSelected ? 3 : isHighlighted ? 2 : 1.5
                    }
                    strokeLinecap="round"
                    markerEnd={markerUrl}
                    markerStart={edge.bidirectional ? markerUrl : undefined}
                  />
                  {/* Wide hit target for easy clicking */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={16}
                  />
                  {/* Live transfer amount badge when selected */}
                  {isEdgeSelected && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-44}
                        y={-11}
                        width={88}
                        height={22}
                        rx={6}
                        fill="#18181b"
                        stroke="#fafafa"
                        strokeWidth={1.2}
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        fill="#fafafa"
                        fontSize={10}
                        fontWeight={600}
                        fontFamily="ui-monospace, monospace"
                      >
                        ${(edge.amountUsdt / 1000).toFixed(0)}k USDT
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Interactive Nodes */}
            {baseNodes.map((node) => {
              const pos = getPos(node);
              const isSelected =
                selection.kind === 'node' && selection.id === node.id;
              const isLarge = node.sizeTier === 'lg';
              const isSmall = node.sizeTier === 'sm';

              const dimmedByFilter =
                filterMode === 'critical' && !criticalNodeIds.has(node.id);
              const dimmedByHover =
                hoveredNeighbors !== null && !hoveredNeighbors.has(node.id);

              const titleFontSize = isLarge ? 14.5 : isSmall ? 11 : 12;
              const badgeFontSize = isLarge ? 13 : isSmall ? 10.5 : 11.5;

              const titleY = pos.y + node.radius + (isLarge ? 20 : 16);
              const badgeY = node.title
                ? titleY + (isLarge ? 12 : 9)
                : pos.y + node.radius + 11;

              const badgeText = node.badge ?? '';
              const badgeWidth =
                badgeText.length * (badgeFontSize * 0.56) +
                (isLarge ? 28 : 20);
              const badgeHeight = isLarge ? 26 : 21;

              return (
                <g
                  key={node.id}
                  onPointerDown={(e) => handlePointerDownNode(e, node)}
                  onPointerUp={() => handlePointerUpNode(node)}
                  onPointerEnter={() => setHoveredNodeId(node.id)}
                  onPointerLeave={() =>
                    setHoveredNodeId((prev) => (prev === node.id ? null : prev))
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.title ?? node.badge ?? 'Wallet'}, ${node.address}, hop ${node.hop}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelection({ kind: 'node', id: node.id });
                    }
                  }}
                  className={`${
                    draggingId === node.id ? 'cursor-grabbing' : 'cursor-grab'
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70`}
                  opacity={dimmedByFilter || dimmedByHover ? 0.28 : 1}
                >
                  {/* Active selection ring in pure white */}
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={node.radius + 8}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />
                  )}

                  {/* Pentagon or Circle shape */}
                  {node.shape === 'pentagon' ? (
                    <polygon
                      points={pentagonPoints(pos.x, pos.y, node.radius)}
                      fill={node.monoFill}
                      stroke={node.monoStroke}
                      strokeWidth={2.2}
                      strokeLinejoin="round"
                      filter="url(#node-shadow)"
                    />
                  ) : (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={node.radius}
                      fill={node.monoFill}
                      stroke={node.monoStroke}
                      strokeWidth={2}
                      filter="url(#node-shadow)"
                    />
                  )}

                  {/* Pure SVG vector icon inside node */}
                  {renderNodeIcon(node, pos)}

                  {/* Node title */}
                  {node.title && (
                    <text
                      x={pos.x}
                      y={titleY}
                      textAnchor="middle"
                      fill="#e4e4e7"
                      fontSize={titleFontSize}
                      fontWeight={isLarge ? 500 : 400}
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {node.title}
                    </text>
                  )}

                  {/* Category pill badge */}
                  {node.badge && (
                    <g
                      transform={`translate(${pos.x - badgeWidth / 2}, ${badgeY})`}
                    >
                      <rect
                        width={badgeWidth}
                        height={badgeHeight}
                        rx={6}
                        fill="#27272a"
                        stroke="#3f3f46"
                        strokeWidth={1}
                      />
                      <text
                        x={badgeWidth / 2}
                        y={badgeHeight / 2 + badgeFontSize * 0.35}
                        textAnchor="middle"
                        fill="#a1a1aa"
                        fontSize={badgeFontSize}
                        fontWeight={500}
                        fontFamily="Inter, system-ui, sans-serif"
                      >
                        {node.badge}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Bottom Legend Bar inside canvas */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-black/20 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-white" />
              Primary traced flow ($712k → CryptoHub44)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-zinc-500" />
              Secondary / multi-hop exposure
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-zinc-600" />
              Unexpanded continuation
            </span>
          </div>
          <span className="font-mono text-[10px]">
            {hopLevels} hop levels · {baseNodes.length} entities · $
            {(subjectVolume / 1_000_000).toFixed(2)}M USDT traced · synthetic
          </span>
        </div>
      </div>

      {/* Live Interactive Node / Edge Telemetry Inspector + 4 Risky Wallet Signs */}
      {showInspector && (
        <div className="rounded-2xl border border-border/80 bg-card/50 p-4 sm:p-5">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {selectedNode.subject
                        ? 'Subject Seed · Hop 0'
                        : `Hop ${selectedNode.hop}`}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {selectedNode.title ?? selectedNode.badge ?? 'Address'}
                    </span>
                    {selectedNode.badge && selectedNode.title && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {selectedNode.badge}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="truncate font-mono text-xs text-muted-foreground">
                      {selectedNode.address}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyAddress(selectedNode.address)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {copiedAddress === selectedNode.address ? (
                        <>
                          <Check className="size-3 text-foreground" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Volume Traced
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      ${selectedNode.volumeUsdt.toLocaleString()} USDT
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Risk Score
                    </p>
                    <p
                      className={`font-mono text-xl font-semibold tabular-nums ${BAND_STYLES[selectedNode.band].text}`}
                    >
                      {selectedNode.score}/100
                    </p>
                  </div>
                </div>
              </div>

              {/* The 4 Grouped Risky Wallet Sign Cards (FR-3.1 to FR-3.4) */}
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    4 Risky Wallet Sign Groups (Deterministic Rule Breakdown)
                  </p>
                  <button
                    type="button"
                    onClick={toggleAllCards}
                    className="cursor-pointer rounded border border-border/70 bg-background/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    {allExpanded ? 'Collapse all' : 'Explain all 4'}
                  </button>
                </div>

                <div className="grid items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Card 1: Laundering Flow Shapes */}
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3 transition">
                    <button
                      type="button"
                      onClick={() => toggleCard(0)}
                      aria-expanded={openCards[0]}
                      className="flex w-full cursor-pointer items-center justify-between gap-1.5 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                        1. Laundering Flow Shapes
                      </span>
                      <span className="inline-flex items-center justify-center rounded border border-border/70 bg-muted/40 p-1 text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform duration-200 ${
                            openCards[0] ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </button>

                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {selectedNode.breakdown.flowShape}
                    </p>

                    {openCards[0] && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                        <p className="font-mono text-[10px] text-foreground/90">
                          Rule FR-3.1 · Topology &amp; Graph Shape
                        </p>
                        <p>
                          Normal P2P payments move point-to-point. Launderers
                          either <em>fan-out</em> (spray one balance into dozens
                          of mule wallets), <em>fan-in</em> (funnel many scam
                          deposits into one collector), or run{' '}
                          <em>peeling chains</em> that strip off small chunks
                          hop-by-hop to hide the trail.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Mule Speed & Timing */}
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3 transition">
                    <button
                      type="button"
                      onClick={() => toggleCard(1)}
                      aria-expanded={openCards[1]}
                      className="flex w-full cursor-pointer items-center justify-between gap-1.5 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Timer className="size-3.5 shrink-0 text-muted-foreground" />
                        2. Mule Speed &amp; Timing
                      </span>
                      <span className="inline-flex items-center justify-center rounded border border-border/70 bg-muted/40 p-1 text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform duration-200 ${
                            openCards[1] ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </button>

                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {selectedNode.breakdown.velocityTiming}
                    </p>

                    {openCards[1] && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                        <p className="font-mono text-[10px] text-foreground/90">
                          Rule FR-3.2 · Pass-Through &lt; 15m &amp; Burstiness
                        </p>
                        <p>
                          Real users hold USDT between trades. Disposable
                          &ldquo;burner/mule&rdquo; wallets forward funds within
                          minutes of arrival (<code>&lt; 15 min</code> hold),
                          fire sudden high-frequency transaction bursts in
                          narrow time windows, and are abandoned after a few
                          days.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Bot & Gas Fingerprints */}
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3 transition">
                    <button
                      type="button"
                      onClick={() => toggleCard(2)}
                      aria-expanded={openCards[2]}
                      className="flex w-full cursor-pointer items-center justify-between gap-1.5 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Cpu className="size-3.5 shrink-0 text-muted-foreground" />
                        3. Bot &amp; Gas Fingerprints
                      </span>
                      <span className="inline-flex items-center justify-center rounded border border-border/70 bg-muted/40 p-1 text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform duration-200 ${
                            openCards[2] ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </button>

                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {selectedNode.breakdown.tronFingerprint}
                    </p>

                    {openCards[2] && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                        <p className="font-mono text-[10px] text-foreground/90">
                          Rule FR-3.3 · TRX/USDT Jaccard &amp; ×100 Amounts
                        </p>
                        <p>
                          Sending USDT on TRON requires TRX for gas. When a
                          separate &ldquo;gas-station boss&rdquo; wallet funds
                          TRX fees for mule accounts that only move USDT, the
                          TRX vs. USDT counterparty overlap (Jaccard) drops near{' '}
                          <code>0</code>. Scripts also send neat multiples of{' '}
                          <code>100 USDT</code> instead of organic retail
                          prices.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card 4: One-Way Flow Imbalance */}
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3 transition">
                    <button
                      type="button"
                      onClick={() => toggleCard(3)}
                      aria-expanded={openCards[3]}
                      className="flex w-full cursor-pointer items-center justify-between gap-1.5 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <ArrowDownUp className="size-3.5 shrink-0 text-muted-foreground" />
                        4. One-Way Flow Imbalance
                      </span>
                      <span className="inline-flex items-center justify-center rounded border border-border/70 bg-muted/40 p-1 text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform duration-200 ${
                            openCards[3] ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </button>

                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {selectedNode.breakdown.flowImbalance}
                    </p>

                    {openCards[3] && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                        <p className="font-mono text-[10px] text-foreground/90">
                          Rule FR-3.4 · Net Inflow / Outflow Asymmetry
                        </p>
                        <p>
                          Everyday wallets keep a working balance. Scam deposit
                          pots show extreme one-way inflow hoarding, while
                          laundering relays immediately sweep <code>~100%</code>{' '}
                          of incoming USDT out to leave a <code>$0</code>{' '}
                          balance—so Tether cannot freeze funds sitting in the
                          wallet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : selectedEdge ? (
            <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Transfer Amount</dt>
                <dd className="mt-1 font-mono text-sm font-semibold">
                  {selectedEdge.amountUsdt.toLocaleString()} USDT
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Route</dt>
                <dd className="mt-1 font-medium">
                  {(nodeMap.get(selectedEdge.from)?.title ??
                    nodeMap.get(selectedEdge.from)?.badge) ||
                    'Address'}{' '}
                  →{' '}
                  {(nodeMap.get(selectedEdge.to)?.title ??
                    nodeMap.get(selectedEdge.to)?.badge) ||
                    'Address'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Transaction Hash</dt>
                <dd
                  className="mt-1 truncate font-mono text-muted-foreground"
                  title={selectedEdge.txHash}
                >
                  {selectedEdge.txHash}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Timestamp</dt>
                <dd className="mt-1 font-mono">
                  {new Date(selectedEdge.timestamp).toLocaleString()}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ForensicFlowGraph;
