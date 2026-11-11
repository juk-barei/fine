import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from '@/lib/auth'

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}))

import { Route } from '@/routes/index'

const mockedGetSession = vi.mocked(getSession)
const beforeLoad = Route.options.beforeLoad as unknown as () => Promise<unknown>

async function runLandingGuard(): Promise<unknown> {
  try {
    return await beforeLoad()
  } catch (error) {
    return error
  }
}

describe('landing guard', () => {
  beforeEach(() => {
    mockedGetSession.mockReset()
  })

  it('sends a signed-in visitor to the dashboard', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: { id: 's1' }, user: { id: 'u1' } },
    } as never)

    const result = (await runLandingGuard()) as { options?: { to?: string } }

    expect(result.options).toMatchObject({ to: '/wallets' })
  })

  it('lets an anonymous visitor see the landing', async () => {
    mockedGetSession.mockResolvedValue({ data: null } as never)

    expect(await runLandingGuard()).toBeUndefined()
  })
})
