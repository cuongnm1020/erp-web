import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeCustomers, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { Customer360Screen } from './components/customer-360-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers/x',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const FIRST = makeCustomers(1)[0]!;

describe('Customer360Screen — GET /customers/{id} (P1-12)', () => {
  it('loading → hồ sơ thật: tên, mã, hạn mức, hạn thanh toán', async () => {
    renderApp(<Customer360Screen id={FIRST.id} />);
    expect(screen.getByRole('status', { name: 'Đang tải chi tiết' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Khách hàng 1' })).toBeInTheDocument();
    expect(screen.getAllByText(FIRST.code).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bán lẻ').length).toBeGreaterThan(0);
    expect(screen.getByText('Hạn mức công nợ')).toBeInTheDocument();
  });

  it('không bịa số: các thẻ thiếu API được nêu tên thay vì hiện dữ liệu mẫu', async () => {
    renderApp(<Customer360Screen id={FIRST.id} />);
    await screen.findByRole('heading', { name: 'Khách hàng 1' });
    expect(screen.getByText('Chưa nối được')).toBeInTheDocument();
    expect(screen.getByText('Công nợ theo tuổi nợ')).toBeInTheDocument();
    expect(screen.queryByText(/SO-2308/)).not.toBeInTheDocument();
  });

  it('404 → màn trống "không tìm thấy" với đúng một lối thoát', async () => {
    server.use(scenario.customerNotFound);
    renderApp(<Customer360Screen id={FIRST.id} />);
    expect(await screen.findByText('Không tìm thấy khách hàng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách khách hàng' })).toBeInTheDocument();
  });

  it('500 → ErrorState có traceId', async () => {
    server.use(scenario.customerError);
    renderApp(<Customer360Screen id={FIRST.id} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });

  it('403 → màn không có quyền', async () => {
    server.use(scenario.customerForbidden);
    renderApp(<Customer360Screen id={FIRST.id} />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});
