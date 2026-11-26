# ADR 0003 — Generated GraphQL SDL from the zod wire contract

- Status: accepted
- Owner: contracts
- Date: 2026-11-26
- Pinned dependency: none (the emitter is dependency-free)

## Context

The same wire shape was hand-maintained in four places: the zod contract
(`packages/contracts`), the SDL files served verbatim through
`typePaths: '**/*.graphql'`, a class mirror in
`apps/server/src/modules/wallets/wallets.types.ts` that existed only so
resolver signatures could name return types, and the client's hand-written
query documents. Nothing cross-checked the copies, and drift already shipped:
`TraceEdge.direction` was `String!` in the SDL against an enum everywhere
else, and `WalletListItem` typed its enum fields as plain strings while the
SDL itself declared the enums. ADR-0002 already names `@repo/contracts` as
the one place to define wire contracts; the SDL had not been told.

## Decision

1. The zod contracts are the single source of the served GraphQL schema.
   Every `.graphql` file the server loads is a generated artifact, never a
   hand-written declaration.
2. A declarative wire registry (`packages/contracts/src/sdl/wire.ts`, built
   with `defineWireModule`) maps schemas to GraphQL: enums, output types,
   queries, mutations, the `Date`/`Time` scalars and the base
   `Query`/`Mutation` roots. `npm run generate:sdl` in `packages/contracts`
   emits `apps/server/src/schema.graphql`,
   `apps/server/src/modules/auth/auth.graphql` and
   `apps/server/src/modules/wallets/wallets.graphql` in place, each under a
   generated header.
3. Generated SDL is checked in, the `routeTree.gen.ts` convention. The root
   `npm run sdl:check` regenerates and fails on any diff; a reviewer sees
   schema changes as generated-file churn, never as silent divergence.
4. The emitter (`packages/contracts/src/sdl/emitter.ts`) is dependency-free
   and fails loudly on any zod construct it cannot map — it never widens a
   type silently. The only hand-declared mapping zod cannot express is the
   `ID` scalar, stated once per field in the registry.
5. What SDL cannot express stays a runtime fact of the contract, enforced by
   the server's service parse: `.regex()`/`.trim()` fields are plain
   `String`s, `min`/`max` bounds and every `superRefine` invariant have no
   SDL representation. A reader of the generated SDL must not assume the SDL
   *is* the contract.
6. The class mirror `wallets.types.ts` is deleted. In `typePaths` mode it
   never built the schema; resolvers type their returns against the inferred
   contract types and name their fields explicitly (`@Query('wallets')`).
7. SDL-first — generating zod from the SDL — is dead. It moves the wire's
   home out of `@repo/contracts`, cannot express the `superRefine`
   invariants, and would put a codegen step inside the contracts build path.
   Code-first Nest (decorator classes via `autoSchemaFile`) is rejected for
   the same reason plus its new `graphql-codegen` dependency.

## Consequences

Positive: the drift class that shipped (`direction`, `WalletListItem`'s enum
fields, the untyped `status` filter) is impossible by construction — the SDL
no longer exists as an independent declaration to forget to update; a wire
change is one edit in one package plus a regenerated diff.

Negative: schema changes now show up as generated-file churn in diffs;
cross-field invariants are invisible in the SDL; the client's query
documents remain untyped, guarded only by the arrival parse — the residual
drift surface, to be revisited if a document/contract mismatch ever ships.

## Alternatives considered

- Status quo (hand-synced SDL) — already shipped the drift this ADR removes.
- Code-first Nest — see Decision 7.
- SDL-first codegen — see Decision 7.
