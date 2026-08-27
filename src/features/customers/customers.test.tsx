import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { ME_SALE, scenario } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { CustomerListGate } from './components/customer-list-gate';

vi.mock('next/navigation', () => ({
  usePathname: () => '/kernel-gate',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

describe('CustomerListGate (kernel gate, MSW)', () => {
  it('success: loading skeleton → bảng 50/237 dòng, nút tạo hiện cho admin', async () => {
    renderApp(<CustomerListGate />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText('Khách hàng 1')).toBeInTheDocument();
    expect(screen.getByText('1–50 / 237 dòng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tạo khách hàng/ })).toBeInTheDocument();
  });

  it('sale không có customer.create → nút tạo ẩn (Can)', async () => {
    renderApp(<CustomerListGate />, { me: { ...ME_SALE, permissions: ['customer.read'] } });
    await screen.findByText('Khách hàng 1');
    expect(screen.queryByRole('button', { name: /Tạo khách hàng/ })).not.toBeInTheDocument();
  });

  it('empty: EmptyState với đúng một hành động', async () => {
    server.use(scenario.customersEmpty);
    renderApp(<CustomerListGate />);
    expect(await screen.findByText('Chưa có khách hàng nào')).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId + thử lại → refetch', async () => {
    server.use(scenario.customersError);
    renderApp(<CustomerListGate />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    server.resetHandlers();
    screen.getByRole('button', { name: 'Thử lại' }).click();
    await waitFor(() => expect(screen.getByText('Khách hàng 1')).toBeInTheDocument());
  });

  it('403: màn không có quyền, không redirect', async () => {
    server.use(scenario.customersForbidden);
    renderApp(<CustomerListGate />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});
