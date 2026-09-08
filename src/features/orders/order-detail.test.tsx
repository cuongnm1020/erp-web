import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CARRIERS, ME_SALE, makeOrderDetail, makeOrders, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderDetailScreen } from './components/order-detail-screen';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders/x',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
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
    expect(await screen.findByText('Không có đơn hàng này')).toBeInTheDocument();
    expect(screen.getByText(`Mã lỗi 404 · /crm/orders/${ORDER.id}`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách Đơn hàng' })).toBeInTheDocument();
    // "Có phải bạn tìm": gợi ý từ danh sách TRONG scope (GET /sales-orders mặc định)
    expect(await screen.findByText('Có phải bạn tìm:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ORDER.docNumber })).toBeInTheDocument();
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

  it('Sửa = hủy & tạo lại: xác nhận → cancel rồi chuyển sang form tạo đơn ?from=<id>', async () => {
    push.mockClear();
    server.use(
      http.post('/api/sales-orders/:id/cancel', ({ params }) =>
        HttpResponse.json({ orderId: params.id, status: 'CANCELLED' }),
      ),
    );
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (hủy & tạo lại)' }));
    expect(
      await screen.findByText(`Sửa đơn ${ORDER.docNumber} — hủy & tạo lại?`),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy & tạo lại' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/new?from=${ORDER.id}`));
  });

  it('không có sales_order.update → không thấy nút Sửa đơn (luật 7); admin thấy', async () => {
    renderApp(<OrderDetailScreen orderId={ORDER.id} />, { me: ME_SALE });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Sửa đơn' })).not.toBeInTheDocument();
  });

  it('Sửa đơn (DRAFT, admin): chỉ hiện đích được phép; chọn Đã duyệt + hãng GHN → PATCH body đúng 2 trường', async () => {
    const calls: Array<{ id: string; body: Record<string, unknown> }> = [];
    server.use(
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        calls.push({ id: params.id as string, body });
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: body.status ?? ORDER.status,
          carrierId: body.carrierId ?? null,
          changed: Object.keys(body),
        });
      }),
    );
    expect(ORDER.status).toBe('DRAFT');
    renderApp(<OrderDetailScreen orderId={ORDER.id} />); // ME_ADMIN: manage all
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('chưa chọn — chọn ở Sửa đơn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa đơn' }));
    expect(await screen.findByText(`Sửa đơn ${ORDER.docNumber}`)).toBeInTheDocument();

    // Trạng thái: DRAFT chỉ được sửa tay sang Đã duyệt / Đã hủy — không có "Chờ duyệt", "Đã chốt"
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Nháp (hiện tại)', 'Đã duyệt', 'Đã hủy']);
    fireEvent.click(screen.getByRole('option', { name: 'Đã duyệt' }));

    // Hãng: chỉ hãng đang hoạt động (hãng đã tắt không hiện)
    fireEvent.click(screen.getByRole('combobox', { name: 'Hãng vận chuyển' }));
    const carrierOptions = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(carrierOptions).toEqual([
      '— Chưa chọn —',
      `${CARRIERS[0]!.name} (MANUAL)`,
      `${CARRIERS[1]!.name} (GHN)`,
    ]);
    fireEvent.click(screen.getByRole('option', { name: `${CARRIERS[1]!.name} (GHN)` }));

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(calls).toEqual([{ id: ORDER.id, body: { status: 'APPROVED', carrierId: 'c-ghn' } }]),
    );
    await waitFor(() =>
      expect(screen.queryByText(`Sửa đơn ${ORDER.docNumber}`)).not.toBeInTheDocument(),
    );
  });

  it('Sửa đơn: không đổi gì → Lưu chỉ đóng dialog, KHÔNG gọi API', async () => {
    let calls = 0;
    server.use(
      http.patch('/api/sales-orders/:id', () => {
        calls += 1;
        return HttpResponse.json({});
      }),
    );
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Sửa đơn' }));
    await screen.findByText(`Sửa đơn ${ORDER.docNumber}`);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(screen.queryByText(`Sửa đơn ${ORDER.docNumber}`)).not.toBeInTheDocument(),
    );
    expect(calls).toBe(0);
  });

  it('đơn đã POSTED: hiện hãng đã chọn + mốc chốt; dialog khóa hãng, chỉ còn Đã hủy', async () => {
    const posted = makeOrders(60).find((o) => o.status === 'POSTED')!;
    const detail = {
      ...makeOrderDetail(posted.id)!,
      carrierId: 'c-ghn',
      carrier: { id: 'c-ghn', code: 'GHN', name: CARRIERS[1]!.name },
    };
    server.use(http.get('/api/sales-orders/:id', () => HttpResponse.json(detail)));
    renderApp(<OrderDetailScreen orderId={posted.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(CARRIERS[1]!.name)).toBeInTheDocument();
    expect(screen.getByText('Đã chốt lúc')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa đơn' }));
    await screen.findByText(`Sửa đơn ${posted.docNumber}`);
    expect(screen.getByRole('combobox', { name: 'Hãng vận chuyển' })).toBeDisabled();
    expect(screen.getByText('Đơn đã kết thúc — không đổi hãng.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Đã chốt (hiện tại)', 'Đã hủy']);
  });
});
