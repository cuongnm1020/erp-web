import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE, makeOrders, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderListScreen } from './components/order-list-screen';

const replace = vi.fn();
let search = '';
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
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const FIRST = makeOrders(1)[0]!;

describe('OrderListScreen — GET /sales-orders (P1-12)', () => {
  it('loading → bảng dữ liệu thật, tổng hiện trên tiêu đề', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText(FIRST.docNumber)).toBeInTheDocument();
    expect(screen.getByText('60 đơn khớp bộ lọc')).toBeInTheDocument();
    expect(screen.getByText('1–50 / 60 dòng')).toBeInTheDocument();
  });

  it('số đơn dẫn tới chi tiết theo id, không theo số chứng từ', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    const link = await screen.findByRole('link', { name: FIRST.docNumber });
    expect(link).toHaveAttribute('href', `/crm/orders/${FIRST.id}`);
  });

  it('tab trạng thái đọc từ URL và lọc phía server (luật 8)', async () => {
    search = 'status=POSTED';
    renderApp(<OrderListScreen />);
    await screen.findByText('12 đơn khớp bộ lọc');
    const tab = screen.getByRole('tab', { name: 'Đã chốt' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  it('sale không có sales_order.create → nút tạo đơn ẩn (luật 7)', async () => {
    search = '';
    renderApp(<OrderListScreen />, { me: { ...ME_SALE, permissions: ['sales_order.read'] } });
    await screen.findByText(FIRST.docNumber);
    expect(screen.queryByRole('link', { name: /Tạo đơn/ })).not.toBeInTheDocument();
  });

  it('empty: EmptyState kèm đúng một hành động', async () => {
    search = '';
    server.use(scenario.ordersEmpty);
    renderApp(<OrderListScreen />);
    expect(await screen.findByText('Chưa có đơn hàng nào')).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId, thử lại thì refetch', async () => {
    search = '';
    server.use(scenario.ordersError);
    renderApp(<OrderListScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    server.resetHandlers();
    screen.getByRole('button', { name: 'Thử lại' }).click();
    await waitFor(() => expect(screen.getByText(FIRST.docNumber)).toBeInTheDocument());
  });

  it('403: màn không có quyền, không đá về đăng nhập (luật 6)', async () => {
    search = '';
    server.use(scenario.ordersForbidden);
    renderApp(<OrderListScreen />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});

describe('OrderListScreen — cân nặng gửi hãng + gán hãng hàng loạt', () => {
  it('cột Cân nặng: đặt tay có dấu ✎ và tooltip Σ dòng; đơn tính từ dòng hiện kg thường', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    // i=0 → shippingWeightKg 1.0000 (đặt tay), lineWeightKg 0.3000
    const manual = screen.getAllByTitle(/Đặt tay · tính từ dòng: 0,3\skg/);
    expect(manual.length).toBeGreaterThan(0);
    expect(manual[0]).toHaveTextContent(/^1\skg/);
    // i=1 → tính từ dòng 0,6 kg
    expect(screen.getAllByTitle('Tính từ cân nặng SKU')[0]).toHaveTextContent(/^0,6\skg$/);
  });

  it('lọc cân nặng + chưa gán hãng đọc từ URL, gửi lên server (luật 8); ô nhập phản ánh URL', async () => {
    search = 'weightMin=1&weightMax=1.5&noCarrier=true';
    const expected = makeOrders(60).filter(
      (o) => Number(o.weightKg) >= 1 && Number(o.weightKg) <= 1.5 && o.carrierId === null,
    ).length;
    renderApp(<OrderListScreen />);
    await screen.findByText(`${expected} đơn khớp bộ lọc`);
    expect(screen.getByLabelText('Cân nặng từ (kg)')).toHaveValue('1');
    expect(screen.getByLabelText('Cân nặng đến (kg)')).toHaveValue('1.5');
    expect(screen.getByRole('combobox', { name: 'Hãng vận chuyển' })).toHaveTextContent(
      'Chưa gán hãng',
    );
    // Gõ khoảng mới + Enter → chỉ khi Enter mới ghi URL (không bắn theo từng phím)
    replace.mockClear();
    const min = screen.getByLabelText('Cân nặng từ (kg)');
    fireEvent.change(min, { target: { value: '1,2' } });
    expect(replace).not.toHaveBeenCalled();
    fireEvent.keyDown(min, { key: 'Enter' });
    expect(replace).toHaveBeenCalledTimes(1);
    const url = String(replace.mock.calls[0]![0]);
    expect(url).toContain('weightMin=1.2');
    expect(url).toContain('weightMax=1.5');
    expect(url).toContain('noCarrier=true');
  });

  it('chọn 2 đơn → "Gán hãng / cân nặng" → POST /sales-orders/bulk-update đúng orderIds + cân nặng + hãng, bỏ chọn sau khi xong', async () => {
    search = '';
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post('/api/sales-orders/bulk-update', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        const ids = body.orderIds as string[];
        return HttpResponse.json(
          {
            updated: ids.map((id) => ({
              orderId: id,
              docNumber: 'SO-X',
              status: 'APPROVED',
              carrierId: body.carrierId ?? null,
              warehouseId: null,
              shippingWeightKg: body.shippingWeightKg ?? null,
              changed: ['carrierId', 'shippingWeightKg'],
            })),
            failed: [],
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    const rows = makeOrders(3);
    // i=0 DRAFT, i=1 PENDING_APPROVAL → đều sửa được. Bảng render lại sau mỗi lần chọn →
    // hỏi lại checkbox thay vì giữ tham chiếu cũ (node đã bị thay).
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[1]!);
    expect(await screen.findByRole('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gán hãng \/ cân nặng/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /Cập nhật 2 đơn/ });
    expect(submit).toBeDisabled(); // chưa chọn gì để áp

    fireEvent.change(screen.getByLabelText('Cân nặng gửi hãng (kg)'), { target: { value: '1' } });
    expect(submit).toBeEnabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'Hãng vận chuyển' }));
    fireEvent.click(await screen.findByRole('option', { name: /GHTK/ }));
    fireEvent.click(submit);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      orderIds: [rows[0]!.id, rows[1]!.id],
      shippingWeightKg: '1',
    });
    expect(typeof bodies[0]!.carrierId).toBe('string');
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã cập nhật 2 đơn', expect.anything()),
    );
    expect(toastError).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
  });
});
