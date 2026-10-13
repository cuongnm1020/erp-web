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
const ZERO = {
  updated: 0,
  created: 0,
  skipped: 0,
  pickReplanned: 0,
  shippedExternal: 0,
  failed: 0,
};

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
            counts: ZERO,
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
            counts: ZERO,
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
          counts: { ...ZERO, updated: 2, skipped: 1, pickReplanned: 1, failed: 1 },
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
    expect(within(dialog).getByText('Đã cập nhật').nextSibling).toHaveTextContent('2');
    expect(within(dialog).getByText('Đơn bỏ qua').nextSibling).toHaveTextContent('1');
    expect(within(dialog).getByRole('link', { name: 'SOP2610-00009' })).toHaveAttribute(
      'href',
      '/crm/orders/o-9',
    );
    expect(within(dialog).getByText('Kho đã nhận việc lấy hàng PK2610-00001')).toBeInTheDocument();
  });

  it('khoảng ngày: POST kèm fromDate/toDate; khoảng sai → báo + khóa nút; đếm đơn mới / đã gửi qua Pancake', async () => {
    const posted: unknown[] = [];
    server.use(
      http.post('/api/pancake-sync/transform/orders/resync', async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json(
          {
            shopId: '715130909',
            state: 'completed',
            done: 3,
            total: 3,
            counts: { ...ZERO, created: 2, updated: 1, shippedExternal: 1 },
            failures: [
              // Đơn chưa vào hệ thống (lỗi lúc tạo): không có số đơn → chỉ mã Pancake, không link.
              { orderId: '', docNumber: '', externalId: '7044', reason: 'SKU chưa khai báo' },
            ],
            skippedOrders: [],
            error: null,
            startedAt: '2026-10-12T08:00:00.000Z',
            finishedAt: '2026-10-12T08:00:05.000Z',
          },
          { status: 202 },
        );
      }),
    );

    renderApp(<OrderListScreen />, { me: ME_SYNC });
    fireEvent.click(await screen.findByRole('button', { name: /Đồng bộ đơn Pancake/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Đồng bộ đơn từ Pancake' });
    await within(dialog).findByRole('radio', { name: /Thiên Nông chính/ });

    fireEvent.click(within(dialog).getByRole('radio', { name: /Mọi đơn Pancake cập nhật/ }));
    const from = within(dialog).getByLabelText('Từ ngày');
    const to = within(dialog).getByLabelText('Đến ngày');
    const startBtn = within(dialog).getByRole('button', { name: 'Đồng bộ đơn' });

    // Ngược chiều → báo, khóa nút.
    fireEvent.change(from, { target: { value: '2026-10-12' } });
    fireEvent.change(to, { target: { value: '2026-10-01' } });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Từ ngày phải trước hoặc bằng đến ngày',
    );
    expect(startBtn).toBeDisabled();
    // Quá 31 ngày → báo.
    fireEvent.change(from, { target: { value: '2026-08-01' } });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Khoảng ngày tối đa 31 ngày');

    fireEvent.change(from, { target: { value: '2026-10-11' } });
    fireEvent.change(to, { target: { value: '2026-10-12' } });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(startBtn);
    await waitFor(() =>
      expect(posted).toEqual([{ shopId: 715130909, fromDate: '2026-10-11', toDate: '2026-10-12' }]),
    );
  });

  it('kết quả lượt có đơn mới + đã gửi qua Pancake + lỗi đơn chưa có số', async () => {
    server.use(
      http.get('/api/pancake-sync/transform/orders/resync', ({ request }) =>
        HttpResponse.json({
          shopId: new URL(request.url).searchParams.get('shopId'),
          state: 'completed',
          done: 3,
          total: 3,
          counts: { ...ZERO, created: 2, updated: 1, shippedExternal: 1, failed: 1 },
          failures: [
            { orderId: '', docNumber: '', externalId: '7044', reason: 'SKU chưa khai báo' },
          ],
          skippedOrders: [],
          error: null,
          startedAt: '2026-10-12T08:00:00.000Z',
          finishedAt: '2026-10-12T08:00:05.000Z',
        }),
      ),
    );
    renderApp(<OrderListScreen />, { me: ME_SYNC });
    fireEvent.click(await screen.findByRole('button', { name: /Đồng bộ đơn Pancake/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Đồng bộ đơn từ Pancake' });
    await within(dialog).findByText('3/3 đơn');
    expect(within(dialog).getByText('Đơn mới tạo').nextSibling).toHaveTextContent('2');
    expect(
      within(dialog).getByText('Theo trạng thái Pancake (đóng gói / gửi ngoài ERP, không trừ tồn)').nextSibling,
    ).toHaveTextContent('1');
    const row = within(dialog).getByText('Pancake #7044').closest('tr')!;
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    expect(row).toHaveTextContent('SKU chưa khai báo');
  });
});
