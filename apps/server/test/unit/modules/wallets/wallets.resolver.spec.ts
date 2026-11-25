import { describe, expect, it } from 'vitest';
import { walletTraceGraphSchema } from '@repo/contracts';
import { WalletsResolver } from '../../../../src/modules/wallets/wallets.resolver.ts';
import { WalletsService } from '../../../../src/modules/wallets/wallets.service.ts';
import { makeFakeDb } from '../../../support/effect-test.ts';

const ADDRESS = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';

function createResolver() {
  const db = makeFakeDb();
  const resolver = new WalletsResolver(new WalletsService(db as never));
  return { resolver, db };
}

describe('WalletsResolver.walletGraph', () => {
  it('returns a payload that parses against the trace graph contract', async () => {
    const { resolver, db } = createResolver();

    const graph = await resolver.walletGraph(ADDRESS, 5, 0);

    expect(walletTraceGraphSchema.safeParse(graph).success).toBe(true);
    expect(graph.nodes.filter((node) => node.subject)).toHaveLength(1);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.disclosure.nodesReturned).toBe(graph.nodes.length);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('passes the depth and minimum value through to the builder', async () => {
    const { resolver } = createResolver();

    const graph = await resolver.walletGraph(ADDRESS, 2, 7_500);

    expect(graph.disclosure).toMatchObject({
      depthRequested: 2,
      minValueUsdt: 7_500,
    });
    expect(Math.max(...graph.nodes.map((node) => node.hop))).toBeLessThanOrEqual(2);
    expect(graph.edges.every((edge) => edge.amountUsdt >= 7_500)).toBe(true);
  });

  it('serves the documented defaults when the optional arguments are absent', async () => {
    const { resolver } = createResolver();

    const graph = await resolver.walletGraph(
      ADDRESS,
      undefined as never,
      undefined as never,
    );

    expect(graph.disclosure).toMatchObject({
      depthRequested: 5,
      minValueUsdt: 0,
    });
  });

  it('is deterministic for repeated identical calls', async () => {
    const { resolver } = createResolver();

    expect(await resolver.walletGraph(ADDRESS, 3, 100)).toEqual(
      await resolver.walletGraph(ADDRESS, 3, 100),
    );
  });

  it('reports truncation and partial coverage at depth five honestly', async () => {
    const { resolver } = createResolver();

    const graph = await resolver.walletGraph(ADDRESS, 5, 0);

    expect(walletTraceGraphSchema.safeParse(graph).success).toBe(true);
    expect(graph.nodes).toHaveLength(500);
    expect(graph.disclosure).toMatchObject({
      depthRequested: 5,
      nodesReturned: 500,
      nodeCap: 500,
      truncated: true,
      coverage: 'partial',
    });
    expect(graph.disclosure.reason).toMatch(/cap/i);
    expect(graph.disclosure.loadedTransfers).toBeLessThan(
      graph.disclosure.reportedTransfers,
    );
    expect(await resolver.walletGraph(ADDRESS, 5, 0)).toEqual(graph);
  });

  it('rejects a depth outside the allowed range', async () => {
    const { resolver } = createResolver();

    await expect(resolver.walletGraph(ADDRESS, 9, 0)).rejects.toThrow();
  });
});
