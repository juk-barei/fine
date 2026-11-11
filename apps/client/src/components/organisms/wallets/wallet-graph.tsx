import { useState } from 'react'
import type { WalletGraph, WalletGraphEdge, WalletGraphNode } from '@repo/contracts'

const NODE_FILL: Record<string, string> = {
  high: 'fill-red-500',
  moderate: 'fill-amber-500',
  low: 'fill-emerald-500',
}

const EDGE_STROKE: Record<string, string> = {
  high: 'stroke-red-500/60',
  moderate: 'stroke-amber-500/60',
  low: 'stroke-emerald-500/60',
}

const EDGE_FILL: Record<string, string> = {
  high: 'fill-red-500/60',
  moderate: 'fill-amber-500/60',
  low: 'fill-emerald-500/60',
}

const LEGEND_DOT: Record<string, string> = {
  high: 'bg-red-500',
  moderate: 'bg-amber-500',
  low: 'bg-emerald-500',
}

type Selection =
  | { kind: 'node'; node: WalletGraphNode }
  | { kind: 'edge'; edge: WalletGraphEdge }

const RADIUS = 96
const SUBJECT_RADIUS = 17
const NODE_RADIUS = 11

/**
 * The single-hop neighbourhood as an SVG: the subject at the centre, one
 * counterparty per spoke, one directed transfer per spoke. Solid lines leave
 * the subject, dashed lines arrive; colour is the counterparty's risk band.
 * Clicking a node or transfer shows the underlying address or transaction.
 */
export function WalletGraphView({ graph }: { graph: WalletGraph }) {
  const [selected, setSelected] = useState<Selection | null>(null)

  const subject = graph.nodes.find((node) => node.subject)
  const counterparties = graph.nodes.filter((node) => !node.subject)
  if (!subject || counterparties.length === 0) {
    return null
  }

  const positions: Record<string, { x: number; y: number }> = Object.fromEntries(
    counterparties.map((node, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / counterparties.length
      return [node.id, { x: Math.cos(angle) * RADIUS, y: Math.sin(angle) * RADIUS }]
    }),
  )

  return (
    <figure className="mt-4">
      <svg
        viewBox="-150 -130 300 260"
        role="img"
        aria-label={`Fund-flow graph: ${subject.label} and ${counterparties.length} counterparties`}
        className="mx-auto h-auto w-full max-w-md select-none"
      >
        {graph.edges.map((edge) => {
          const counterpartyId = edge.from === subject.id ? edge.to : edge.from
          const point = positions[counterpartyId]
          if (!point) return null

          const inbound = edge.to === subject.id
          const band = graph.nodes.find((node) => node.id === counterpartyId)?.band ?? 'low'
          const start = inbound ? point : { x: 0, y: 0 }
          const end = inbound ? { x: 0, y: 0 } : point
          const dx = end.x - start.x
          const dy = end.y - start.y
          const length = Math.hypot(dx, dy)
          const ux = dx / length
          const uy = dy / length
          const x1 = start.x + ux * (inbound ? NODE_RADIUS : SUBJECT_RADIUS)
          const y1 = start.y + uy * (inbound ? NODE_RADIUS : SUBJECT_RADIUS)
          const x2 = end.x - ux * (inbound ? SUBJECT_RADIUS : NODE_RADIUS)
          const y2 = end.y - uy * (inbound ? SUBJECT_RADIUS : NODE_RADIUS)
          const isSelected = selected?.kind === 'edge' && selected.edge.txHash === edge.txHash

          return (
            <g key={edge.txHash} className="cursor-pointer" onClick={() => setSelected({ kind: 'edge', edge })}>
              <title>
                {`${edge.amountUsdt.toLocaleString()} USDT · ${inbound ? 'inbound' : 'outbound'} · ${edge.timestamp.slice(0, 10)}`}
              </title>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={isSelected ? 3 : 1.5}
                strokeDasharray={inbound ? '4 3' : undefined}
                className={EDGE_STROKE[band]}
              />
              <polygon
                points={`${x2},${y2} ${x2 - ux * 7 + uy * 3.5},${y2 - uy * 7 - ux * 3.5} ${x2 - ux * 7 - uy * 3.5},${y2 - uy * 7 + ux * 3.5}`}
                className={EDGE_FILL[band]}
              />
              {/* Wider invisible line: the visible one is too thin to click. */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={12} className="stroke-transparent" />
            </g>
          )
        })}

        <g
          className="cursor-pointer"
          onClick={() => setSelected({ kind: 'node', node: subject })}
        >
          <title>{`${subject.id} · subject · ${subject.band} risk`}</title>
          {selected?.kind === 'node' && selected.node.id === subject.id ? (
            <circle r={SUBJECT_RADIUS + 4} className="fill-none stroke-foreground/60" strokeWidth={1.5} />
          ) : null}
          <circle r={SUBJECT_RADIUS} className={NODE_FILL[subject.band]} strokeWidth={3} stroke="var(--background)" />
          <text y={SUBJECT_RADIUS + 14} textAnchor="middle" className="fill-foreground text-[8px] font-medium">
            {subject.label}
          </text>
        </g>

        {counterparties.map((node) => {
          const point = positions[node.id]
          if (!point) return null
          const isSelected = selected?.kind === 'node' && selected.node.id === node.id

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={() => setSelected({ kind: 'node', node })}
            >
              <title>{`${node.id} · ${node.band} risk · ${node.tier.replace('_', ' ')}`}</title>
              {isSelected ? (
                <circle cx={point.x} cy={point.y} r={NODE_RADIUS + 4} className="fill-none stroke-foreground/60" strokeWidth={1.5} />
              ) : null}
              <circle
                cx={point.x}
                cy={point.y}
                r={NODE_RADIUS}
                className={NODE_FILL[node.band]}
                strokeWidth={3}
                stroke="var(--background)"
              />
              <text
                x={point.x}
                y={point.y + NODE_RADIUS + 12}
                textAnchor="middle"
                className="fill-muted-foreground text-[7px]"
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>

      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-3">
          {(['high', 'moderate', 'low'] as const).map((band) => (
            <span key={band} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${LEGEND_DOT[band]}`} />
              {band}
            </span>
          ))}
        </span>
        <span>solid = outbound · dashed = inbound</span>
      </figcaption>

      <div className="mt-3 rounded-xl border bg-muted/20 px-3 py-2.5 text-xs">
        {selected?.kind === 'edge' ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-medium">{selected.edge.amountUsdt.toLocaleString()} USDT</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Direction</dt>
              <dd className="font-medium">{selected.edge.to === subject.id ? 'inbound' : 'outbound'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Transaction</dt>
              <dd className="truncate font-mono" title={selected.edge.txHash}>
                {selected.edge.txHash}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Timestamp</dt>
              <dd className="font-medium">{new Date(selected.edge.timestamp).toLocaleString()}</dd>
            </div>
          </dl>
        ) : selected?.kind === 'node' ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            <div className="col-span-2">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="truncate font-mono" title={selected.node.id}>
                {selected.node.id}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{selected.node.subject ? 'subject' : `${selected.node.hops} hop`}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Band · tier</dt>
              <dd className="font-medium capitalize">
                {selected.node.band} · {selected.node.tier.replace('_', ' ')}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">
            Select a node or a transfer to see its address, amount and transaction.
          </p>
        )}
      </div>
    </figure>
  )
}
