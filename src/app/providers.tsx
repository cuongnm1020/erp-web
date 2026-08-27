'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { isApiError } from '@/lib/api/errors';
import { RealtimeProvider } from '@/lib/realtime';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 4xx là lỗi nghiệp vụ/quyền — retry vô ích; chỉ retry lỗi mạng/5xx.
        retry: (count, err) =>
          count < 2 && (!isApiError(err) || err.status === 0 || err.status >= 500),
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <RealtimeProvider>{children}</RealtimeProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
