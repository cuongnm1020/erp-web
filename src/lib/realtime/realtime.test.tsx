import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RealtimeProvider, type RealtimeSocket } from './socket-provider';
import { useInvalidateOn } from './use-invalidate-on';

/** Socket giả: emit() gọi handler đã đăng ký. */
function fakeSocket(): RealtimeSocket & { emit: (e: string, p?: unknown) => void } {
  const handlers = new Map<string, Set<(...a: unknown[]) => void>>();
  return {
    on: (e, h) => {
      if (!handlers.has(e)) handlers.set(e, new Set());
      handlers.get(e)!.add(h);
    },
    off: (e, h) => handlers.get(e)?.delete(h),
    emit: (e, p) => handlers.get(e)?.forEach((h) => h(p)),
  };
}

function Consumer() {
  useInvalidateOn('ticket.updated', [['crm', 'tickets']]);
  useInvalidateOn(['order.created', 'order.updated'], [['crm', 'orders', 'list']], {
    filter: (p) => (p as { scope?: string })?.scope !== 'ignore',
  });
  return null;
}

describe('useInvalidateOn', () => {
  it('event giả → đúng query bị invalidate, query khác không bị đụng; không setQueryData', () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, 'invalidateQueries');
    const setData = vi.spyOn(qc, 'setQueryData');
    const socket = fakeSocket();
    render(
      <QueryClientProvider client={qc}>
        <RealtimeProvider socket={socket}>
          <Consumer />
        </RealtimeProvider>
      </QueryClientProvider>,
    );

    socket.emit('ticket.updated', { id: 't1' });
    expect(inv).toHaveBeenCalledTimes(1);
    expect(inv).toHaveBeenCalledWith({ queryKey: ['crm', 'tickets'] });

    socket.emit('order.updated', { id: 'o1' });
    expect(inv).toHaveBeenCalledTimes(2);
    expect(inv).toHaveBeenLastCalledWith({ queryKey: ['crm', 'orders', 'list'] });

    socket.emit('order.created', { scope: 'ignore' });
    expect(inv).toHaveBeenCalledTimes(2);

    socket.emit('customer.updated', {});
    expect(inv).toHaveBeenCalledTimes(2);
    expect(setData).not.toHaveBeenCalled();
  });

  it('unmount → gỡ handler', () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, 'invalidateQueries');
    const socket = fakeSocket();
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <RealtimeProvider socket={socket}>
          <Consumer />
        </RealtimeProvider>
      </QueryClientProvider>,
    );
    unmount();
    socket.emit('ticket.updated', {});
    expect(inv).not.toHaveBeenCalled();
  });
});
