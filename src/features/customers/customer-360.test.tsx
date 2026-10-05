import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CUSTOMER_TAGS, makeCustomers, scenario } from '@/test/msw/handlers';
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
    expect(screen.getByText('Đơn gần đây')).toBeInTheDocument();
    expect(screen.queryByText('Địa chỉ giao')).not.toBeInTheDocument();
    expect(screen.queryByText(/SO-2308/)).not.toBeInTheDocument();
  });

  it('CRM-04: hiện tên nhóm / cấp độ, địa chỉ giao (mặc định đầu tiên) và tag', async () => {
    renderApp(<Customer360Screen id={FIRST.id} />);
    await screen.findByRole('heading', { name: 'Khách hàng 1' });
    expect(screen.getByText('Đại lý')).toBeInTheDocument();
    expect(screen.getByText('Bạc')).toBeInTheDocument();
    expect(screen.getByText('Địa chỉ giao hàng (2)')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Thị Thu Hà')).toBeInTheDocument();
    expect(screen.getByText('Mặc định')).toBeInTheDocument();
    expect(screen.getByText('12 Lê Thanh Nghị, Phường Hai Bà Trưng, Hà Nội')).toBeInTheDocument();
    expect(screen.getByText('Khách VIP')).toBeInTheDocument();
  });

  it('CRM-04: gắn tag → POST /customer-segments/:id/tags; gỡ → DELETE', async () => {
    const calls: string[] = [];
    server.use(
      http.post('/api/customer-segments/:id/tags', async ({ request }) => {
        calls.push(`POST ${JSON.stringify(await request.json())}`);
        return HttpResponse.json([], { status: 201 });
      }),
      http.delete('/api/customer-segments/:id/tags/:tagId', ({ params }) => {
        calls.push(`DELETE ${params.tagId as string}`);
        return HttpResponse.json({ removed: 1 });
      }),
    );
    renderApp(<Customer360Screen id={FIRST.id} />);
    await screen.findByRole('heading', { name: 'Khách hàng 1' });
    fireEvent.click(screen.getByRole('button', { name: /Gắn tag/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Vụ Đông Xuân/ }));
    await waitFor(() => expect(calls).toEqual([`POST {"tagIds":["${CUSTOMER_TAGS[1]!.id}"]}`]));
    fireEvent.click(screen.getByRole('button', { name: 'Gỡ tag Khách VIP' }));
    await waitFor(() => expect(calls).toContain(`DELETE ${CUSTOMER_TAGS[0]!.id}`));
  });

  it('CRM-04: không có customer.update → tag chỉ đọc', async () => {
    renderApp(<Customer360Screen id={FIRST.id} />, {
      me: { permissions: ['customer.read'], hasGlobalAccess: false },
    });
    await screen.findByRole('heading', { name: 'Khách hàng 1' });
    expect(screen.getByText('Khách VIP')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gắn tag/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gỡ tag Khách VIP' })).not.toBeInTheDocument();
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
