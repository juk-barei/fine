import { z } from 'zod'

export type ScreenWalletMessages = {
  addressRequired: string
  addressInvalid: string
}

/**
 * The client's copy of the address rule, so a typo fails at the field rather
 * than at the server. The server re-validates with the shared contract.
 */
export function createScreenWalletSchema(messages: ScreenWalletMessages) {
  return z.object({
    address: z
      .string()
      .trim()
      .min(1, messages.addressRequired)
      .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, messages.addressInvalid),
  })
}
