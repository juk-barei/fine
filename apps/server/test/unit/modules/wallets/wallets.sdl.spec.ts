import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildSchema,
  graphql,
  parse,
  validate,
  type GraphQLObjectType,
  type GraphQLSchema,
} from 'graphql';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'src');

/**
 * The server serves these files verbatim through the typePaths glob. Merging
 * them the way Nest merges them and building the schema proves what the wire
 * actually accepts — the SDL files, not any decorator, are the served schema.
 */
function servedSchema(): GraphQLSchema {
  const sdl = [
    'schema.graphql',
    'modules/auth/auth.graphql',
    'modules/wallets/wallets.graphql',
  ]
    .map((path) => readFileSync(join(SRC, path), 'utf8'))
    .join('\n');
  return buildSchema(sdl);
}

describe('the served schema', () => {
  it('roots every served operation', () => {
    const schema = servedSchema();

    expect(Object.keys(schema.getQueryType()!.getFields()).sort()).toEqual([
      'health',
      'me',
      'mySessions',
      'ping',
      'previewWallet',
      'wallet',
      'walletGraph',
      'wallets',
    ]);
    expect(Object.keys(schema.getMutationType()!.getFields()).sort()).toEqual([
      '_',
      'revokeSession',
      'screenWallet',
    ]);
  });

  it('types the wallet read model with the enums the contract declares', () => {
    const schema = servedSchema();
    const walletListItem = schema.getType('WalletListItem') as GraphQLObjectType;
    const traceEdge = schema.getType('TraceEdge') as GraphQLObjectType;

    expect(String(walletListItem.getFields().band.type)).toBe('WalletBand');
    expect(String(walletListItem.getFields().confidence.type)).toBe('WalletConfidence');
    expect(String(walletListItem.getFields().labelTier.type)).toBe('LabelTier');
    expect(String(walletListItem.getFields().decisionStatus.type)).toBe('DecisionStatus');
    expect(String(traceEdge.getFields().direction.type)).toBe('TraceEdgeDirection!');
  });

  it('rejects an unknown status filter at the schema level', () => {
    const schema = servedSchema();

    const rejected = validate(schema, parse('{ wallets(status: "bogus") { total } }'));
    expect(rejected[0]?.message).toMatch(/DecisionStatus/);

    const accepted = validate(schema, parse('{ wallets(status: flagged) { total } }'));
    expect(accepted).toEqual([]);
  });

  it('rejects a direction outside the enum on the wire', async () => {
    const schema = servedSchema();

    const result = await graphql({
      schema,
      source:
        '{ walletGraph(address: "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7") { edges { direction } } }',
      rootValue: { walletGraph: { edges: [{ direction: 'sideways' }] } },
    });

    expect(result.errors?.[0]?.message).toMatch(/TraceEdgeDirection/);
  });

  it('serializes a legal direction untouched', async () => {
    const schema = servedSchema();

    const result = await graphql({
      schema,
      source:
        '{ walletGraph(address: "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7") { edges { direction } } }',
      rootValue: { walletGraph: { edges: [{ direction: 'outbound' }] } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      walletGraph: { edges: [{ direction: 'outbound' }] },
    });
  });
});
