import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { PancakeBulkPushStatus } from './api/use-pancake-push';
import { PancakeSyncButton } from './components/pancake-sync-button';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/catalog/products',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const counts = { created: 0, updated: 0, linked: 0, hidden: 0, skipped: 0, failed: 0 };
const status = (patch: Partial<PancakeBulkPushStatus>): PancakeBulkPushStatus => ({
  state: 'idle',
  done: 0,
  total: 0,
  counts,
  failures: [],
  error: null,
  startedAt: null,
  finishedAt: null,
  ...patch,
});

describe('PancakeSyncButton — đẩy toàn bộ sản phẩm lên Pancake', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('chưa chạy → bấm Bắt đầu: POST xếp job, nút hiện tiến độ, xong thì toast tóm tắt', async () => {
    let posted = 0;
    const sequence = [
      status({ state: 'active', done: 3, total: 10, counts: { ...counts, linked: 2, created: 1 } }),
      status({
        state: 'completed',
        done: 10,
        total: 10,
        counts: { ...counts, linked: 6, created: 4 },
        finishedAt: '2026-09-30T03:00:00.000Z',
      }),
    ];
    server.use(
      http.get('/api/pancake-sync/push/products/bulk', () =>
        HttpResponse.json(posted === 0 ? status({}) : (sequence.shift() ?? sequence[0])),
      ),
      http.post('/api/pancake-sync/push/products/bulk', () => {
        posted += 1;
        return HttpResponse.json(status({ state: 'waiting' }), { status: 202 });
      }),
    );
    renderApp(<PancakeSyncButton />);

    fireEvent.click(await screen.findByRole('button', { name: /Đồng bộ Pancake/ }));
    expect(await screen.findByText('Chưa chạy lần nào.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu đồng bộ/ }));

    await waitFor(() => expect(posted).toBe(1));
    // Nút ngoài bị modal che (aria-hidden) nhưng vẫn hiện tiến độ; trong dialog là thanh tiến độ.
    expect(
      await screen.findByRole('button', { name: /Đang đồng bộ 3\/10/, hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByText('3/10 sản phẩm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đang chạy/ })).toBeDisabled();

    await waitFor(
      () =>
        expect(toastSuccess).toHaveBeenCalledWith(
          'Đồng bộ Pancake xong — 10 sản phẩm: 4 tạo mới, 6 liên kết, 0 cập nhật, 0 lỗi',
        ),
      { timeout: 6_000 },
    );
    expect(screen.getByRole('button', { name: /Chạy lại/ })).toBeEnabled();
  }, 10_000);

  it('lượt gần nhất có lỗi → bảng lỗi hiện mã sản phẩm (link) và lý do', async () => {
    server.use(
      http.get('/api/pancake-sync/push/products/bulk', () =>
        HttpResponse.json(
          status({
            state: 'completed',
            done: 2,
            total: 2,
            counts: { ...counts, updated: 1, failed: 1 },
            failures: [
              {
                shopId: '407957969',
                productId: 'p-1',
                productCode: 'PHAN-NPK',
                productName: 'Phân NPK 16-16-8',
                reason: 'Pancake HTTP 422: weight is required',
              },
            ],
          }),
        ),
      ),
    );
    renderApp(<PancakeSyncButton />);
    fireEvent.click(await screen.findByRole('button', { name: /Đồng bộ Pancake/ }));
    const link = await screen.findByRole('link', { name: 'PHAN-NPK' });
    expect(link).toHaveAttribute('href', '/catalog/products/p-1');
    expect(screen.getByText('Pancake HTTP 422: weight is required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chạy lại/ })).toBeEnabled();
  });
});
