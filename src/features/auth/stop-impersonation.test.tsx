import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { makeTestQueryClient } from '@/test/render';
import { useStopImpersonation } from './api/use-stop-impersonation';

const assign = vi.fn();
vi.stubGlobal('location', { ...window.location, assign });

afterEach(() => assign.mockReset());

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>;
}

describe('useStopImpersonation — "Quay lại tài khoản của tôi"', () => {
  it('thành công → về màn quản lý nhân viên', async () => {
    server.use(http.post('/api/auth/impersonate/stop', () => HttpResponse.json({ ok: true })));
    const { result } = renderHook(() => useStopImpersonation(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin/users'));
  });

  it('phiên superadmin đã hết hạn (401) → về đăng nhập', async () => {
    server.use(
      http.post('/api/auth/impersonate/stop', () => new HttpResponse(null, { status: 401 })),
    );
    const { result } = renderHook(() => useStopImpersonation(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/login'));
  });
});
