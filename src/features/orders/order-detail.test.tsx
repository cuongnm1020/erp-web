import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  CARRIERS,
  ME_SALE,
  ORDER_SHIPMENT_FIXTURE,
  makeOrderDetail,
  makeOrders,
  scenario,
} from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderDetailScreen } from './components/order-detail-screen';

const push = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders/x',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
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

  it('không có sales_order.update → không thấy "Sửa đơn" (luật 7); admin thấy link tới trang sửa', async () => {
    renderApp(<OrderDetailScreen orderId={ORDER.id} />, { me: ME_SALE });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Sửa đơn' })).not.toBeInTheDocument();
  });

  it('admin: "Sửa đơn" là link sang /crm/orders/:id/edit (trang riêng, không popup); hãng chưa chọn nói rõ', async () => {
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Sửa đơn' })).toHaveAttribute(
      'href',
      `/crm/orders/${ORDER.id}/edit`,
    );
    expect(screen.getByText('chưa chọn — chọn ở trang Sửa đơn')).toBeInTheDocument();
  });

  it('đơn có hãng + đã POSTED: hiện tên hãng và mốc chốt', async () => {
    const posted = makeOrders(60).find((o) => o.status === 'POSTED')!;
    const detail = {
      ...makeOrderDetail(posted.id)!,
      carrierId: 'c-ghn',
      carrier: { id: 'c-ghn', code: 'GHN', name: CARRIERS[1]!.name },
      warehouseId: 'wh-hcm',
      warehouse: { id: 'wh-hcm', code: 'WH01', name: 'Kho trung tâm' },
    };
    server.use(http.get('/api/sales-orders/:id', () => HttpResponse.json(detail)));
    renderApp(<OrderDetailScreen orderId={posted.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(CARRIERS[1]!.name)).toBeInTheDocument();
    expect(screen.getByText('Kho trung tâm')).toBeInTheDocument();
    expect(screen.getByText('Đã chốt lúc')).toBeInTheDocument();
  });

  it('chưa có phiếu giao: thẻ Vận đơn nói rõ, không có nút In nhãn; mục "chưa nối được" không còn Vận đơn', async () => {
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(
      screen.getByText('Chưa có phiếu giao — phiếu sinh khi kho pick xong đơn này.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'In nhãn' })).not.toBeInTheDocument();
    expect(screen.queryByText('Vận đơn / tracking')).not.toBeInTheDocument();
  });

  it('phiếu giao có vận đơn: thẻ Vận đơn từ order.shipment; In nhãn → PDF /api/shipments/:id/label (khổ A6 mặc định)', async () => {
    server.use(scenario.orderWithShipment);
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(ORDER_SHIPMENT_FIXTURE.trackingNo)).toBeInTheDocument();
    expect(screen.getByText(ORDER_SHIPMENT_FIXTURE.docNumber)).toBeInTheDocument();
    expect(screen.getByText('chưa in')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'In nhãn' }));
    const frame = await screen.findByTestId('pdf-frame');
    expect(frame).toHaveAttribute(
      'src',
      `/api/shipments/${ORDER_SHIPMENT_FIXTURE.id}/label?pageSize=A6&orientation=portrait`,
    );
    // Đổi khổ A5 → iframe nạp lại URL mới
    fireEvent.click(screen.getByRole('button', { name: 'A5' }));
    await waitFor(() =>
      expect(screen.getByTestId('pdf-frame')).toHaveAttribute(
        'src',
        `/api/shipments/${ORDER_SHIPMENT_FIXTURE.id}/label?pageSize=A5&orientation=portrait`,
      ),
    );
  });

  it('không có shipment.pack → thấy vận đơn nhưng không thấy nút In nhãn (luật 7)', async () => {
    server.use(scenario.orderWithShipment);
    renderApp(<OrderDetailScreen orderId={ORDER.id} />, { me: ME_SALE });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(ORDER_SHIPMENT_FIXTURE.trackingNo)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'In nhãn' })).not.toBeInTheDocument();
  });
});

describe('OrderDetailScreen — trạng thái kho + tự mở nhãn (?printLabel=1)', () => {
  it('nhãn trạng thái kho trong tiêu đề: NOT_STARTED → "Chờ pick"; PACKED → "Đã đóng gói"', async () => {
    search = '';
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Chờ pick')).toBeInTheDocument();
  });

  it('?printLabel=1 + phiếu giao có mã → tự mở PDF nhãn (một lần), không cần bấm In nhãn', async () => {
    search = 'printLabel=1';
    window.localStorage.removeItem('erp.label.pageSize'); // test trước đã chọn A5
    server.use(scenario.orderWithShipment);
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    // Dialog nhãn mở ngay khi dữ liệu về (Radix ẩn phần còn lại khỏi cây accessibility).
    const frame = await screen.findByTestId('pdf-frame');
    expect(frame).toHaveAttribute(
      'src',
      `/api/shipments/${ORDER_SHIPMENT_FIXTURE.id}/label?pageSize=A6&orientation=portrait`,
    );
    search = '';
  });
});

describe('OrderDetailScreen — hành trình từ hãng trên thẻ Vận đơn', () => {
  it('liệt kê GET /shipments/:id/status-log: mã hãng, nguồn, kết cục, ghi chú', async () => {
    search = '';
    server.use(scenario.orderWithShipment);
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    const list = await screen.findByRole('list', { name: 'Hành trình từ hãng' });
    expect(list).toHaveTextContent('Webhook');
    expect(list).toHaveTextContent('Đã áp');
    expect(list).toHaveTextContent('45');
  });
});
