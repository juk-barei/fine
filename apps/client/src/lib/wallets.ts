import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  walletPageSchema,
  walletScreeningSchema,
  type WalletPage,
  type WalletScreening,
} from '@repo/contracts'
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

const SCREEN_WALLET_MUTATION = `
  mutation ScreenWallet($address: String!) {
    screenWallet(address: $address) {
      simulated
      flags
      wallet {
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

/**
 * Runs one screening and refreshes the list, so a screened wallet shows up on
 * the dashboard without a manual reload.
 */
export function useScreenWallet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (address: string): Promise<WalletScreening> => {
      const data = await graphqlRequest<{ screenWallet: unknown }>(
        SCREEN_WALLET_MUTATION,
        { address },
      )
      return walletScreeningSchema.parse(data.screenWallet)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
  })
}
