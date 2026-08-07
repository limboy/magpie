import {
  Outlet,
  RouterProvider,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter
} from '@tanstack/react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PlayerRoute } from '@/routes/player'
import { ThemeProvider } from '@/components/theme-provider'

const rootRoute = createRootRoute({
  component: () => (
    <ThemeProvider defaultTheme="system" storageKey="soundbox-ui-theme">
      <TooltipProvider delayDuration={300}>
        <Outlet />
      </TooltipProvider>
    </ThemeProvider>
  )
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlayerRoute
})

const routeTree = rootRoute.addChildren([indexRoute])

const router = createRouter({
  routeTree,
  history: createHashHistory()
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App(): React.JSX.Element {
  return <RouterProvider router={router} />
}

export default App
