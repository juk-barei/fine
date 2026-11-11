import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from 'sonner'
import { PermissionsProvider } from '@/lib/permissions'

const RootLayout = () => (
  <PermissionsProvider>
    <Outlet />
    <Toaster richColors position="top-right" />
    <TanStackRouterDevtools />
  </PermissionsProvider>
)

export const Route = createRootRoute({ component: RootLayout })
