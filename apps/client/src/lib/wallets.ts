import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  walletDetailSchema,
  walletPageSchema,
  walletScreeningSchema,
  type WalletDetail,
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
      graph {
        nodes {
          id
          label
          band
          tier
          subject
          hops
        }
        edges {
          from
          to
          amountUsdt
          txHash
          timestamp
        }
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
    onSuccess: (screening) => {
      void queryClient.invalidateQueries({ queryKey: ['wallets'] })
      void queryClient.invalidateQueries({
        queryKey: ['wallet', screening.wallet.address],
      })
    },
  })
}

const WALLET_QUERY = `
  query Wallet($address: String!) {
    wallet(address: $address) {
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
      graph {
        nodes {
          id
          label
          band
          tier
          subject
          hops
        }
        edges {
          from
          to
          amountUsdt
          txHash
          timestamp
        }
      }
    }
  }
`

/** One wallet's page data; `null` means nobody has screened the address. */
export function useWalletDetail(address: string | null) {
  return useQuery({
    queryKey: ['wallet', address],
    enabled: address !== null,
    queryFn: async (): Promise<WalletDetail | null> => {
      const data = await graphqlRequest<{ wallet: unknown }>(WALLET_QUERY, {
        address,
      })
      return data.wallet === null ? null : walletDetailSchema.parse(data.wallet)
    },
  })
}

const PREVIEW_WALLET_QUERY = `
  query PreviewWallet($address: String!) {
    previewWallet(address: $address) {
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
      graph {
        nodes {
          id
          label
          band
          tier
          subject
          hops
        }
        edges {
          from
          to
          amountUsdt
          txHash
          timestamp
        }
      }
    }
  }
`

/**
 * The landing page's anonymous screening. Nothing is written: saving the run
 * is the signed-in flow's job.
 */
export function usePreviewWallet() {
  return useMutation({
    mutationFn: async (address: string): Promise<WalletScreening> => {
      const data = await graphqlRequest<{ previewWallet: unknown }>(
        PREVIEW_WALLET_QUERY,
        { address },
      )
      return walletScreeningSchema.parse(data.previewWallet)
    },
  })
}
