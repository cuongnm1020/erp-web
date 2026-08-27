'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useRealtime } from './socket-provider';

/**
 * Luật 9: socket event → invalidateQueries theo prefix. KHÔNG setQueryData từ payload
 * (payload chưa qua lớp scope quyền của user hiện tại).
 *
 *   useInvalidateOn('ticket.updated', [['crm', 'tickets']]);
 *   useInvalidateOn(['order.created', 'order.updated'], [['crm', 'orders', 'list']]);
 *
 * `filter` (tùy chọn) nhận payload để bỏ qua event không liên quan (ví dụ id khác) — vẫn chỉ
 * quyết định CÓ invalidate hay không, không dùng payload để vá cache.
 */
export function useInvalidateOn(
  event: string | string[],
  keys: QueryKey[],
  opts: { filter?: (payload: unknown) => boolean; enabled?: boolean } = {},
): void {
  const { socket } = useRealtime();
  const qc = useQueryClient();
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const filterRef = useRef(opts.filter);
  filterRef.current = opts.filter;
  const events = Array.isArray(event) ? event : [event];
  const eventsKey = events.join('|');

  useEffect(() => {
    if (!socket || opts.enabled === false) return;
    const handler = (payload: unknown) => {
      if (filterRef.current && !filterRef.current(payload)) return;
      for (const k of keysRef.current) void qc.invalidateQueries({ queryKey: k });
    };
    const names = eventsKey.split('|');
    for (const n of names) socket.on(n, handler);
    return () => {
      for (const n of names) socket.off(n, handler);
    };
  }, [socket, qc, eventsKey, opts.enabled]);
}
