import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CARRIERS, ME_SALE, makeOrderDetail, makeOrders, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderEditScreen } from './components/order-edit-screen';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders/x/edit',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ORDER = makeOrders(1)[0]!; // i=0 → DRAFT
const DETAIL = makeOrderDetail(ORDER.id)!;

describe('OrderEditScreen — trang sửa đơn (D-05, PATCH /sales-orders/{id})', () => {
  it('loading → hai cột: sản phẩm + giá trị đơn (chỉ đọc) và thông tin / khách hàng / vận chuyển', async () => {
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    expect(screen.getByRole('status', { name: 'Đang tải chi tiết' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      `Sửa đơn ${ORDER.docNumber}`,
    );
    for (const t of ['Sản phẩm', 'Giá trị đơn hàng', 'Thông tin', 'Khách hàng', 'Vận chuyển']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    // Dòng hàng chỉ đọc: có mã SKU, không có ô nhập số lượng
    expect(screen.getByText(DETAIL.lines[0]!.skuCode)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText('Tiền cần thu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu thay đổi/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hủy bỏ' })).toHaveAttribute(
      'href',
      `/crm/orders/${ORDER.id}`,
    );
  });

  it('DRAFT + admin: chỉ đích Đã duyệt / Đã hủy; chọn Đã duyệt + hãng GHN → PATCH 2 trường → về chi tiết', async () => {
    push.mockClear();
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
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });

    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      'Nháp (hiện tại)',
      'Đã duyệt',
      'Đã hủy',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Đã duyệt' }));

    fireEvent.click(screen.getByRole('combobox', { name: 'Hãng vận chuyển' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      '— Chưa chọn —',
      `${CARRIERS[0]!.name} (MANUAL)`,
      `${CARRIERS[1]!.name} (GHN)`,
    ]);
    fireEvent.click(screen.getByRole('option', { name: `${CARRIERS[1]!.name} (GHN)` }));

    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() =>
      expect(calls).toEqual([{ id: ORDER.id, body: { status: 'APPROVED', carrierId: 'c-ghn' } }]),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
  });

  it('chọn Đã hủy → hiện ô lý do, lý do đi vào body; Ctrl+S lưu', async () => {
    push.mockClear();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: 'CANCELLED',
          carrierId: null,
          changed: ['status'],
        });
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByLabelText('Lý do hủy')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Đã hủy' }));
    fireEvent.change(await screen.findByLabelText('Lý do hủy'), {
      target: { value: 'Khách bom hàng' },
    });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() =>
      expect(bodies).toEqual([{ status: 'CANCELLED', reason: 'Khách bom hàng' }]),
    );
  });

  it('không đổi gì → Lưu không gọi API, về chi tiết; Esc cũng về chi tiết', async () => {
    push.mockClear();
    let calls = 0;
    server.use(
      http.patch('/api/sales-orders/:id', () => {
        calls += 1;
        return HttpResponse.json({});
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
    expect(calls).toBe(0);
    push.mockClear();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`);
  });

  it('không có sales_order.update → chỉ đọc: banner, không nút Lưu, hai select bị khóa (luật 7 + trạng thái chỉ đọc)', async () => {
    renderApp(<OrderEditScreen orderId={ORDER.id} />, { me: ME_SALE });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('Bạn chỉ có quyền xem đơn này');
    expect(screen.queryByRole('button', { name: /Lưu thay đổi/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Hãng vận chuyển' })).toBeDisabled();
  });

  it('đơn POSTED: hãng khóa, chỉ còn Đã hủy; đơn CANCELLED: banner trạng thái cuối, nút Lưu bị khóa', async () => {
    const posted = makeOrders(60).find((o) => o.status === 'POSTED')!;
    server.use(
      http.get('/api/sales-orders/:id', () =>
        HttpResponse.json({
          ...makeOrderDetail(posted.id)!,
          carrierId: 'c-ghn',
          carrier: { id: 'c-ghn', code: 'GHN', name: CARRIERS[1]!.name },
        }),
      ),
    );
    const { unmount } = renderApp(<OrderEditScreen orderId={posted.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('combobox', { name: 'Hãng vận chuyển' })).toBeDisabled();
    expect(screen.getByText('Đã chốt lúc')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      'Đã chốt (hiện tại)',
      'Đã hủy',
    ]);
    unmount();

    const cancelled = makeOrders(60).find((o) => o.status === 'CANCELLED')!;
    server.use(
      http.get('/api/sales-orders/:id', () => HttpResponse.json(makeOrderDetail(cancelled.id))),
    );
    renderApp(<OrderEditScreen orderId={cancelled.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('Đơn đã hủy');
    expect(screen.getByRole('button', { name: /Lưu thay đổi/ })).toBeDisabled();
  });

  it('404: lối về danh sách; 500: ErrorState có traceId', async () => {
    server.use(scenario.orderNotFound);
    const { unmount } = renderApp(<OrderEditScreen orderId={ORDER.id} />);
    expect(await screen.findByText('Không có đơn hàng này')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách Đơn hàng' })).toBeInTheDocument();
    unmount();
    server.use(scenario.orderError);
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });
});
