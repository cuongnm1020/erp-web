import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE, makeOrderDetail, makeOrders, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderDetailScreen } from './components/order-detail-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders/x',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ORDER = makeOrders(1)[0]!;
const DETAIL = makeOrderDetail(ORDER.id)!;

describe('OrderDetailScreen — GET /sales-orders/{id} (P1-12)', () => {
  it('loading → hồ sơ đơn thật với số chứng từ và khách hàng', async () => {
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    expect(screen.getByRole('status', { name: 'Đang tải chi tiết' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(ORDER.docNumber);
    expect(screen.getAllByText(ORDER.customer.name).length).toBeGreaterThan(0);
  });

  it('giữ tách "đang giữ" và "đã pick" thành hai cột (bất biến 3)', async () => {
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    expect(await screen.findByRole('columnheader', { name: 'Đang giữ' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã pick' })).toBeInTheDocument();
    // Không có cột "Đã xuất": DTO không có số đã xuất kho.
    expect(screen.queryByRole('columnheader', { name: 'Đã xuất' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(DETAIL.lines.length + 1);
  });

  it('404: một lối thoát về danh sách, không phải màn lỗi đỏ', async () => {
    server.use(scenario.orderNotFound);
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    expect(await screen.findByText('Không tìm thấy đơn hàng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách đơn' })).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId', async () => {
    server.use(scenario.orderError);
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });

  it('403: màn không có quyền (luật 6)', async () => {
    server.use(scenario.orderForbidden);
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });

  it('không có sales_order.cancel → không thấy nút Hủy đơn (luật 7)', async () => {
    renderApp(<OrderDetailScreen orderId={ORDER.id} />, { me: ME_SALE });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument();
  });

  it('Hủy đơn: xác nhận kèm lý do → POST /sales-orders/:id/cancel', async () => {
    const calls: Array<{ id: string; reason?: string }> = [];
    server.use(
      http.post('/api/sales-orders/:id/cancel', async ({ params, request }) => {
        const body = (await request.json()) as { reason?: string };
        calls.push({ id: params.id as string, reason: body.reason });
        return HttpResponse.json({ orderId: params.id, status: 'CANCELLED' });
      }),
    );
    renderApp(<OrderDetailScreen orderId={ORDER.id} />); // ME_ADMIN mặc định: manage all
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy đơn' }));
    expect(await screen.findByText(`Hủy đơn ${ORDER.docNumber}?`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Lý do hủy (tùy chọn)'), {
      target: { value: 'Khách đổi ý' },
    });
    // Trong dialog nút xác nhận cũng tên "Hủy đơn" — là nút cuối
    const buttons = screen.getAllByRole('button', { name: 'Hủy đơn' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(calls).toEqual([{ id: ORDER.id, reason: 'Khách đổi ý' }]));
    await waitFor(() =>
      expect(screen.queryByText(`Hủy đơn ${ORDER.docNumber}?`)).not.toBeInTheDocument(),
    );
  });
});
