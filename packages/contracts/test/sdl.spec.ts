import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  emitWireModule,
  emitWireModules,
  defineWireModule,
  renderSdlFiles,
  rootWire,
  walletsWire,
} from '../src/index.ts';

const FIXTURE_ENUM = z.enum(['alpha', 'beta']);

const fixtureWire = defineWireModule({
  name: 'fixture',
  enums: { FixtureEnum: FIXTURE_ENUM },
  outputTypes: {
    Fixture: {
      schema: z.object({
        id: z.string(),
        name: z.string().nullable(),
        count: z.number().int(),
        ratio: z.number(),
        flag: z.boolean(),
        kinds: z.array(FIXTURE_ENUM),
      }),
      ids: ['id'],
    },
  },
  query: {
    fixture: {
      args: z.object({
        take: z.number().int().default(25),
        when: z.string().nullable().optional(),
        kind: FIXTURE_ENUM.nullable().optional(),
        cursorId: z.string(),
      }),
      ids: ['cursorId'],
      type: 'Fixture!',
    },
  },
  mutation: {
    fixtureSave: {
      args: z.object({ id: z.string() }),
      ids: ['id'],
      type: 'Boolean!',
    },
  },
});

describe('the SDL emitter', () => {
  it('maps a wire module to GraphQL text', () => {
    expect(emitWireModule(fixtureWire).sdl).toBe(`enum FixtureEnum {
  alpha
  beta
}

type Fixture {
  id: ID!
  name: String
  count: Int!
  ratio: Float!
  flag: Boolean!
  kinds: [FixtureEnum!]!
}

extend type Query {
  fixture(take: Int = 25, when: String, kind: FixtureEnum, cursorId: ID!): Fixture!
}

extend type Mutation {
  fixtureSave(id: ID!): Boolean!
}
`);
  });

  it('fails loudly on a zod construct SDL cannot express', () => {
    const unionWire = defineWireModule({
      name: 'union',
      outputTypes: {
        Broken: z.object({ either: z.union([z.string(), z.number()]) }),
      },
    });

    expect(() => emitWireModule(unionWire)).toThrowError(
      /unmappable zod construct 'union' at Broken\.either/,
    );
  });

  it('fails loudly on an enum the registry never registered', () => {
    const strayWire = defineWireModule({
      name: 'stray',
      outputTypes: { Stray: z.object({ kind: z.enum(['x']) }) },
    });

    expect(() => emitWireModule(strayWire)).toThrowError(
      /zod enum at Stray\.kind is not registered under a name/,
    );
  });

  it('fails loudly on an unnamed nested object', () => {
    const nestedWire = defineWireModule({
      name: 'nested',
      outputTypes: {
        Nested: z.object({ inner: z.object({ x: z.string() }) }),
      },
    });

    expect(() => emitWireModule(nestedWire)).toThrowError(
      /unnamed zod object at Nested\.inner cannot be served/,
    );
  });

  it('fails loudly when an ID override is applied to a non-string field', () => {
    const badIdWire = defineWireModule({
      name: 'badId',
      outputTypes: {
        Bad: { schema: z.object({ id: z.number().int() }), ids: ['id'] },
      },
    });

    expect(() => emitWireModule(badIdWire)).toThrowError(
      /declares 'id' as ID, but its zod schema maps to 'Int'/,
    );
  });

  it('fails loudly when the SDL references an undeclared type', () => {
    const danglingWire = defineWireModule({
      name: 'dangling',
      query: { gone: { type: 'Missing!' } },
    });

    expect(() => emitWireModules([danglingWire])).toThrowError(
      /'Missing' is served by the wire registry but declared nowhere/,
    );
  });

  it('fails loudly on a Date field when no module declares the scalar', () => {
    const dateWire = defineWireModule({
      name: 'date',
      outputTypes: { Dated: z.object({ at: z.date() }) },
    });

    expect(() => emitWireModules([dateWire])).toThrowError(
      /'Date' is served by the wire registry but declared nowhere/,
    );
  });
});

describe('the served wallets SDL', () => {
  const sdl = emitWireModule(walletsWire).sdl;

  it('types the shipped drifts as the enums the contract declares', () => {
    expect(sdl).toContain('direction: TraceEdgeDirection!');
    expect(sdl).toContain('band: WalletBand\n');
    expect(sdl).toContain('confidence: WalletConfidence\n');
    expect(sdl).toContain('labelTier: LabelTier\n');
    expect(sdl).toContain('decisionStatus: DecisionStatus\n');
    expect(sdl).toContain('status: DecisionStatus');
  });

  it('declares every enum it references', () => {
    expect(sdl).toContain('enum TraceEdgeDirection {\n  inbound\n  outbound\n}');
    expect(sdl).toContain('enum DecisionStatus {\n  open\n  flagged\n  cleared\n}');
  });

  it('carries the documented defaults in the argument lists', () => {
    expect(sdl).toContain(
      'wallets(limit: Int = 20, offset: Int = 0, status: DecisionStatus): WalletPage!',
    );
    expect(sdl).toContain(
      'walletGraph(address: String!, depth: Int = 5, minValueUsdt: Float = 0): WalletTraceGraph!',
    );
  });

  it('keeps serving identifier fields through the ID scalar', () => {
    expect(sdl).toContain('id: ID!');
  });

  it('serves the disclosure reason as its structured type', () => {
    expect(sdl).toContain('reason: TraceDisclosureReason');
    expect(sdl).toContain(
      'type TraceDisclosureReason {\n  code: String!\n  params: TraceDisclosureReasonParams!\n}',
    );
  });
});

describe('the served root SDL', () => {
  const sdl = emitWireModule(rootWire).sdl;

  it('keeps the shared scalars and the base roots', () => {
    expect(sdl).toContain('scalar Date\n\nscalar Time');
    expect(sdl).toContain('type Query {\n  health: String!\n  ping(nonce: String): PingResult!\n}');
    expect(sdl).toContain('_: Boolean');
  });
});

describe('SDL generation', () => {
  it('targets the three served files under the generated header', () => {
    const files = renderSdlFiles();

    expect(files.map((file) => file.target)).toEqual([
      'apps/server/src/schema.graphql',
      'apps/server/src/modules/auth/auth.graphql',
      'apps/server/src/modules/wallets/wallets.graphql',
    ]);
    for (const file of files) {
      expect(file.contents).toMatch(
        /^# Generated by `npm run generate:sdl` in @repo\/contracts — do not edit\./,
      );
    }
  });
});
