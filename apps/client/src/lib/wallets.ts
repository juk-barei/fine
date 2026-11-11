import { useQuery } from '@tanstack/react-query'
import { walletPageSchema, type WalletPage } from '@repo/contracts'
import { graphqlRequest } from './graphql'

const WALLETS_QUERY = `
  query Wallets($limit: Int, $offset: Int, $status: String) {
    wallets(limit: $limit, offset: $offset, status: $status) {
      total
      nodes {
        address
        score
        band
        confidence
        labelTier
        decisionStatus
        lastAnalysed
      }
    }
  }
`

/** The wallet read model, validated against the shared contract on arrival. */
export function useWallets(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['wallets', limit, offset],
    queryFn: async (): Promise<WalletPage> => {
      const data = await graphqlRequest<{ wallets: unknown }>(WALLETS_QUERY, {
        limit,
        offset,
        status: null,
      })
      return walletPageSchema.parse(data.wallets)
    },
  })
}
