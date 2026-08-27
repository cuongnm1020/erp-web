import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AbilityProvider, type AuthMe } from '@/lib/permission';
import { RealtimeProvider, type RealtimeSocket } from '@/lib/realtime';
import { ME_ADMIN } from './msw/handlers';

export interface AppRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  me?: Pick<AuthMe, 'permissions' | 'hasGlobalAccess'> | null;
  socket?: RealtimeSocket;
  queryClient?: QueryClient;
}

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

/** render() với đủ provider (Query, Ability, Realtime, Tooltip) — dùng cho test feature. */
export function renderApp(ui: ReactElement, opts: AppRenderOptions = {}) {
  const qc = opts.queryClient ?? makeTestQueryClient();
  const socket = opts.socket ?? { on: () => undefined, off: () => undefined };
  const me = opts.me === undefined ? ME_ADMIN : opts.me;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <AbilityProvider me={me}>
        <RealtimeProvider socket={socket}>
          <TooltipProvider>{children}</TooltipProvider>
        </RealtimeProvider>
      </AbilityProvider>
    </QueryClientProvider>
  );
  return { ...render(ui, { ...opts, wrapper: Wrapper }), queryClient: qc };
}
