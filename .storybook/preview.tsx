import type { Preview } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { AbilityProvider } from '../src/lib/permission';
import { RealtimeProvider } from '../src/lib/realtime';
import { Toaster } from '../src/components/ui/toaster';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { handlers, ME_ADMIN, ME_SALE } from '../src/test/msw/handlers';
import '../src/app/globals.css';

const ME = { admin: ME_ADMIN, sale: ME_SALE, none: null } as const;

const preview: Preview = {
  loaders: [mswLoader()],
  parameters: {
    msw: { handlers },
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/crm/customers' } },
    a11y: { test: 'todo' },
  },
  globalTypes: {
    me: {
      description: 'Người dùng giả lập (ability)',
      toolbar: { icon: 'user', items: ['admin', 'sale', 'none'], dynamicTitle: true },
    },
  },
  initialGlobals: { me: 'admin' },
  decorators: [
    (Story, ctx) => {
      const me = ME[(ctx.globals.me as keyof typeof ME) ?? 'admin'];
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return (
        <QueryClientProvider client={qc}>
          <AbilityProvider me={me}>
            <RealtimeProvider socket={{ on: () => undefined, off: () => undefined }}>
              <TooltipProvider>
                <Story />
                <Toaster />
              </TooltipProvider>
            </RealtimeProvider>
          </AbilityProvider>
        </QueryClientProvider>
      );
    },
  ],
};

export default preview;
