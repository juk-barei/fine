# Barei On-Chain

A self-hosted screener for Tron USDT laundering risk: score a wallet, trace its fund flows, disclose what the trace did not return. One context — client, server and contracts share this language.

## Language

### Screening

**screening**:
Running the scorer on one wallet address. Persisting the run is the signed-in investigator's action; the anonymous landing preview is ephemeral.
_Avoid_: check, scan

**screening result**:
The six-field value a scorer returns for one address — score, band, confidence, label tier, decision status, flags. Persisted whole or presented fresh, never blended from parts.
_Avoid_: screen response

**scorer**:
The module that turns one address into a screening result. The deterministic mock is today's adapter; the Tron chain scorer is the planned second.
_Avoid_: mock screener, scorer service

**read model**:
The wallets row: a projection of the latest screening run, never a partial copy of one.
_Avoid_: wallet cache

**band**:
The risk tier a screening assigns: high, moderate or low.
_Avoid_: risk level, category

**banding**:
The threshold policy mapping a risk score to its band.
_Avoid_: grading

### Tracing

**subject**:
The wallet the investigator opened. Hop 0, present in every trace whatever its volume.

**hop**:
A wallet's distance from the subject in the trace.

**trace transfer**:
One on-chain movement — from, to, amount, transaction, time — before any subject-relative policy is applied.
_Avoid_: edge

**trace policy**:
The fixed pipeline a trace runs: minimum-value filter, reachability, volume aggregation, cap ranking and prune, reachability again, disclosure.

**trace source adapter**:
The module that produces a neighbourhood's transfers and node profiles: the synthetic generator today, the Tron loader later.

**node profile**:
Per-address enrichment — kind, band, labels, rules, intermediary class — that trace policy carries but never reads.

**neighbourhood snapshot**:
The flat transfers-plus-profiles bundle crossing the trace source seam.

**disclosure**:
What a trace reports about what it did not return: depth requested and reached, node cap, coverage, transfers loaded against transfers reported, and the reason.
_Avoid_: caption, footnote

**coverage**:
Whether a trace returned everything in scope (complete) or stopped early (partial).

**reason code**:
The machine-readable identifier for why coverage is partial, carried with typed params; the prose comes from the client's dictionary.
_Avoid_: reason string, reason text

### Wire

**wire contract**:
The single declared shape of a request or response crossing client and server. Owned by the contracts package; everything else is derived.
_Avoid_: DTO, payload shape

**generated SDL**:
GraphQL schema text derived from the wire contract. Never hand-edited.
_Avoid_: schema file (when meaning the served SDL)

**drift guard**:
The check that regenerates derived artifacts and fails on any difference.

**arrival parse**:
The client's validation of a GraphQL response on receipt — the guard over hand-written query documents.

### Client vocabulary

**message key**:
The stable dictionary key an enum member maps to. Never rendered directly.
_Avoid_: label id

**missing-value marker**:
The single rendering for a null field — one dictionary entry, never a per-component literal.
_Avoid_: placeholder, null glyph

**not scored**:
The honest rendering of a wallet without a screening result. Never rendered as low.
_Avoid_: unscored fallback

**band risk phrase**:
The composite label "High/Moderate/Low risk", built from three dictionary entries, not string interpolation.

### Interaction

**dimming**:
The hover rule that keeps a node, its immediate neighbours and their edges bright while fading the rest of the graph.

**neighbour set**:
The addresses one hop from the hovered node.

**selection survival**:
Whether the current selection — a node address or a transfer id — is still present after a re-query.

**settled selection**:
The selection actually rendered after a re-query: the prior one if it survives, else the subject, else nothing.

**sentence**:
The product-vocabulary string a node or transfer control exposes as its accessible label.

**announcement**:
The live-region text read out when a selection opens the inspector.
