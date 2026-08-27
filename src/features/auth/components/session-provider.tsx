'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { AbilityProvider, type AuthMe } from '@/lib/permission';
import { useMe } from '../api/use-me';

interface SessionValue {
  me: AuthMe | undefined;
  isLoading: boolean;
  error: unknown;
}

const SessionContext = createContext<SessionValue>({ me: undefined, isLoading: true, error: null });

/**
 * Bọc các route đã đăng nhập: tải /auth/me một lần, cung cấp ability + thông tin người dùng.
 * Lỗi 401 đã được client chuyển về /login; lỗi khác để shell hiển thị.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const q = useMe();
  return (
    <SessionContext.Provider value={{ me: q.data, isLoading: q.isPending, error: q.error }}>
      <AbilityProvider me={q.data ?? null}>{children}</AbilityProvider>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
