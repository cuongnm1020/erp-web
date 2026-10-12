import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE, makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderListScreen } from './components/order-list-screen';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const FIRST = makeOrders(1)[0]!;
const ME_SYNC = { ...ME_SALE, permissions: ['sales_order.read', 'sync.map'] };

describe('Danh sách đơn — Đồng bộ đơn từ Pancake theo POS', () => {
  it('không có sync.map → không thấy nút (luật 7)', async () => {
    renderApp(<OrderListScreen />, { me: { ...ME_SALE, permissions: ['sales_order.read'] } });
    await screen.findByText(FIRST.docNumber);
    expect(screen.queryByRole('button', { name: /Đồng bộ đơn Pancake/ })).not.toBeInTheDocument();
  });

  it('chọn POS → POST đúng shopId; kết quả lượt hiện số đơn ghi đè, bỏ qua, lỗi kèm lý do', async () => {
    let posted: unknown = null;
    server.use(
      http.post('/api/pancake-sync/transform/orders/resync', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          {
            shopId: '715130909',
            state: 'waiting',
            done: 0,
            total: 0,
            counts: { updated: 0, skipped: 0, pickReplanned: 0, failed: 0 },
            failures: [],
            skippedOrders: [],
            error: null,
            startedAt: null,
            finishedAt: null,
          },
          { status: 202 },
        );
      }),
      http.get('/api/pancake-sync/transform/orders/resync', ({ request }) => {
        const shopId = new URL(request.url).searchParams.get('shopId');
        if (!posted) {
          return HttpResponse.json({
            shopId,
            state: 'idle',
            done: 0,
            total: 0,
            counts: { updated: 0, skipped: 0, pickReplanned: 0, failed: 0 },
            failures: [],
            skippedOrders: [],
            error: null,
            startedAt: null,
            finishedAt: null,
          });
        }
        return HttpResponse.json({
          shopId,
          state: 'completed',
          done: 4,
          total: 4,
          counts: { updated: 2, skipped: 1, pickReplanned: 1, failed: 1 },
          failures: [
            { orderId: 'o-9', docNumber: 'SOP2610-00009', externalId: '7009', reason: 'not found' },
          ],
          skippedOrders: [
            {
              orderId: 'o-8',
              docNumber: 'SOP2610-00008',
              externalId: '7008',
              reason: 'Kho đã nhận việc lấy hàng PK2610-00001',
            },
          ],
          error: null,
          startedAt: '2026-10-12T08:00:00.000Z',
          finishedAt: '2026-10-12T08:00:05.000Z',
        });
      }),
    );

    renderApp(<OrderListScreen />, { me: ME_SYNC });
    fireEvent.click(await screen.findByRole('button', { name: /Đồng bộ đơn Pancake/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Đồng bộ đơn từ Pancake' });

    // Chỉ POS đang kết nối được liệt kê; có đúng một → chọn sẵn.
    const radio = await within(dialog).findByRole('radio', { name: /Thiên Nông chính/ });
    expect(radio).toBeChecked();
    expect(within(dialog).queryByText('407957969')).not.toBeInTheDocument();
    await within(dialog).findByText('POS này chưa đồng bộ lần nào.');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Đồng bộ đơn' }));
    await waitFor(() => expect(posted).toEqual({ shopId: 715130909 }));
    expect(toastSuccess).toHaveBeenCalledWith(
      'Đã bắt đầu đồng bộ đơn từ Pancake · Thiên Nông chính',
    );

    await within(dialog).findByText('4/4 đơn');
    expect(within(dialog).getByText('Đã ghi đè').nextSibling).toHaveTextContent('2');
    expect(within(dialog).getByText('Bỏ qua — kho đã làm').nextSibling).toHaveTextContent('1');
    expect(within(dialog).getByRole('link', { name: 'SOP2610-00009' })).toHaveAttribute(
      'href',
      '/crm/orders/o-9',
    );
    expect(within(dialog).getByText('Kho đã nhận việc lấy hàng PK2610-00001')).toBeInTheDocument();
  });
});
