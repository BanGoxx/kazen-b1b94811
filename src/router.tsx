import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Client keeps data ~30min; the server layer (20min fresh + 6h SWR)
        // absorbs re-fetches, so content stays fresh hourly without API abuse.
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60 * 2,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // Dehydrate the TanStack Query cache across the SSR boundary so the client's
  // first render matches server HTML (prevents hydration mismatch crashes on
  // every useSuspenseQuery surface — home rails, catalogs, fiches).
  return routerWithQueryClient(router, queryClient);
};
