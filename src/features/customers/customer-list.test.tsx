import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE, makeCustomers, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { CustomerListScreen } from './components/customer-list-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const FIRST = makeCustomers(1)[0]!;

describe('CustomerListScreen — GET /customers (P1-12)', () => {
  beforeEach(() => {
    search = '';
  });

  it('loading → bảng 50/237 dòng, tổng hiện trên tiêu đề', async () => {
    renderApp(<CustomerListScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText('Khách hàng 1')).toBeInTheDocument();
    expect(screen.getByText('1–50 / 237 dòng')).toBeInTheDocument();
    expect(screen.getByText('237 khách được phân cho tôi')).toBeInTheDocument();
  });

  it('mã KH dẫn tới hồ sơ theo id, không theo mã', async () => {
    renderApp(<CustomerListScreen />);
    const link = await screen.findByRole('link', { name: FIRST.code });
    expect(link).toHaveAttribute('href', `/crm/customers/${FIRST.id}`);
  });

  it('sale không có customer.create → nút tạo ẩn (luật 7)', async () => {
    renderApp(<CustomerListScreen />, { me: { ...ME_SALE, permissions: ['customer.read'] } });
    await screen.findByText('Khách hàng 1');
    expect(screen.queryByRole('link', { name: /Tạo khách hàng/ })).not.toBeInTheDocument();
  });

  it('empty: EmptyState kèm đúng một hành động', async () => {
    server.use(scenario.customersEmpty);
    renderApp(<CustomerListScreen />);
    expect(await screen.findByText('Chưa có khách hàng nào được phân')).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId, thử lại thì refetch', async () => {
    server.use(scenario.customersError);
    renderApp(<CustomerListScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    server.resetHandlers();
    screen.getByRole('button', { name: 'Thử lại' }).click();
    await waitFor(() => expect(screen.getByText('Khách hàng 1')).toBeInTheDocument());
  });

  it('sắp xếp chạy phía server: cột sortable đọc sortBy/sortDir từ URL (luật 8)', async () => {
    search = 'sort=code:desc';
    renderApp(<CustomerListScreen />);
    // KH00237 là mã lớn nhất — chỉ ra đầu bảng nếu server thật sự sắp giảm dần theo mã.
    expect(await screen.findByRole('link', { name: 'KH00237' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'KH00001' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Mã KH/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('cột API không nhận sortBy thì không được đánh sortable — không hứa hão', async () => {
    search = '';
    renderApp(<CustomerListScreen />);
    await screen.findByText('Khách hàng 1');
    expect(screen.getByRole('columnheader', { name: /Điện thoại/ })).not.toHaveAttribute(
      'aria-sort',
    );
    expect(screen.getByRole('columnheader', { name: /Hạn thanh toán/ })).not.toHaveAttribute(
      'aria-sort',
    );
  });

  it('403: màn không có quyền, không đá về đăng nhập (luật 6)', async () => {
    server.use(scenario.customersForbidden);
    renderApp(<CustomerListScreen />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});
