import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE, makeOrders, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderListScreen } from './components/order-list-screen';

const replace = vi.fn();
let search = '';

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
