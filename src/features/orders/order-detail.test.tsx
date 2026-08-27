import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeOrderDetail, makeOrders, scenario } from '@/test/msw/handlers';
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
});
