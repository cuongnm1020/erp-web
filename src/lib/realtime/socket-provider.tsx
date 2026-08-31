'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { publicEnv } from '@/lib/env';

/**
 * Giao diện tối thiểu để test không cần socket thật.
 * Socket.IO client thật thỏa interface này.
 */
export interface RealtimeSocket {
  on(event: string, handler: (...args: unknown[]) => void): unknown;
  off(event: string, handler: (...args: unknown[]) => void): unknown;
}

interface RealtimeValue {
  socket: RealtimeSocket | null;
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeValue>({ socket: null, connected: false });

/**
 * Kết nối Socket.IO (withCredentials → cookie httpOnly đi kèm; server đọc cookie để xác thực).
 * CHỈ kết nối khi NEXT_PUBLIC_SOCKET_URL được đặt: backend chưa có gateway, quay số vào
 * API sẽ 404 handshake và socket.io-client retry mãi — spam console. Khi gateway lên,
 * đặt env là realtime tự chạy, không cần đổi code.
 * Luật 9: consumer chỉ được invalidate query, không setQueryData.
 */
export function RealtimeProvider({
  children,
  socket: injected,
}: {
  children: ReactNode;
  /** Test/Storybook: truyền socket giả. */
  socket?: RealtimeSocket;
}) {
  const [connected, setConnected] = useState(false);
  const real = useMemo<Socket | null>(() => {
    if (injected || typeof window === 'undefined') return null;
    const url = publicEnv.NEXT_PUBLIC_SOCKET_URL;
    if (!url) return null;
    return io(url, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket'],
      reconnectionDelayMax: 10_000,
    });
  }, [injected]);

  useEffect(() => {
    if (!real) return;
    const onUp = () => setConnected(true);
    const onDown = () => setConnected(false);
    real.on('connect', onUp);
    real.on('disconnect', onDown);
    real.on('connect_error', onDown);
    real.connect();
    return () => {
      real.off('connect', onUp);
      real.off('disconnect', onDown);
      real.off('connect_error', onDown);
      real.disconnect();
    };
  }, [real]);

  const value = useMemo<RealtimeValue>(
    () => ({ socket: injected ?? real, connected: injected ? true : connected }),
    [injected, real, connected],
  );
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeValue {
  return useContext(RealtimeContext);
}
