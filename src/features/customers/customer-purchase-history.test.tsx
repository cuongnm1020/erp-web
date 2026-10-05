import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCustomers, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { Customer360Screen } from './components/customer-360-screen';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers/x',
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const FIRST = makeCustomers(1)[0]!;

beforeEach(() => {
  nav.search = '';
  nav.replace.mockClear();
});

async function openProfile() {
  renderApp(<Customer360Screen id={FIRST.id} />);
  await screen.findByRole('heading', { name: 'Khách hàng 1' });
  return screen.getByRole('region', { name: 'Lịch sử mua hàng' });
}

describe('Lịch sử mua hàng trên hồ sơ 360 (CRM-06)', () => {
  it('chỉ số + top SKU từ GET /customers/:id/stats', async () => {
    const region = await openProfile();
    expect(await within(region).findByText('12.345.000 ₫')).toBeInTheDocument();
    expect(within(region).getByText('Số đơn')).toBeInTheDocument();
    expect(within(region).getByText('10')).toBeInTheDocument();
    expect(within(region).getByText('1.234.500 ₫')).toBeInTheDocument();
    expect(within(region).getAllByText('30/09/2026').length).toBeGreaterThan(0);
    expect(within(region).getByText('đơn đầu tiên 15/01/2026')).toBeInTheDocument();
    expect(within(region).getByText('10 %')).toBeInTheDocument();
    expect(within(region).getByText('đã trừ 150.000 ₫ hàng hoàn')).toBeInTheDocument();
    expect(within(region).getByText('Top 2 SKU mua nhiều nhất')).toBeInTheDocument();
    expect(within(region).getByText('PB-NPK-25')).toBeInTheDocument();
    expect(within(region).getByText('12,5')).toBeInTheDocument();
  });

  it('bảng đơn: link tới chi tiết đơn, netRevenue null hiện "—" kèm giải thích', async () => {
    const region = await openProfile();
    const link = await within(region).findByRole('link', { name: 'SO-2600' });
    expect(link).toHaveAttribute('href', '/crm/orders/so-0001');
    // Đơn chờ duyệt (SO-2598) chưa có doanh thu thuần.
    const row = within(region).getByRole('link', { name: 'SO-2598' }).closest('tr')!;
    expect(within(row).getByText('Chờ duyệt')).toBeInTheDocument();
    expect(within(row).getByTitle('Chưa tính — đơn chưa duyệt hoặc đã hủy')).toHaveTextContent('—');
    expect(
      within(region).getByText(/Đơn nháp, chờ duyệt hoặc đã hủy hiện “—”/),
    ).toBeInTheDocument();
    expect(within(region).getByText('1–20 / 25 dòng')).toBeInTheDocument();
  });

  it('bộ lọc + trang đọc từ URL (ord*) và gửi đúng query lên API', async () => {
    nav.search = 'ordStatus=POSTED&ordFrom=2026-09-01&ordTo=2026-09-30&ordPage=2&ordSize=50&tab=x';
    const seen: string[] = [];
    server.use(
      http.get('/api/customers/:id/orders', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    const region = await openProfile();
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    const q = new URLSearchParams(seen[0]);
    expect(q.get('status')).toBe('POSTED');
    expect(q.get('from')).toBe('2026-09-01');
    expect(q.get('to')).toBe('2026-09-30');
    expect(q.get('take')).toBe('50');
    expect(q.get('skip')).toBe('50');
    // Có lọc → màn trống mời xóa lọc; bấm thì URL chỉ còn tham số không thuộc bảng đơn.
    expect(await within(region).findByText('Không có đơn nào khớp bộ lọc')).toBeInTheDocument();
    fireEvent.click(within(region).getByRole('button', { name: 'Xóa lọc' }));
    expect(nav.replace).toHaveBeenCalledWith('/crm/customers/x?tab=x&ordSize=50', {
      scroll: false,
    });
  });

  it('giá trị lạ trên URL bị bỏ, không gửi lên API', async () => {
    nav.search = 'ordStatus=BOGUS&ordFrom=hom-qua&ordPage=-3';
    const seen: string[] = [];
    server.use(
      http.get('/api/customers/:id/orders', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    await openProfile();
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    const q = new URLSearchParams(seen[0]);
    expect(q.get('status')).toBeNull();
    expect(q.get('from')).toBeNull();
    expect(q.get('skip')).toBe('0');
    expect(q.get('take')).toBe('20');
  });

  it('chuyển trang ghi ordPage lên URL', async () => {
    const region = await openProfile();
    await within(region).findByRole('link', { name: 'SO-2600' });
    fireEvent.click(within(region).getByRole('button', { name: /Trang sau/ }));
    expect(nav.replace).toHaveBeenCalledWith('/crm/customers/x?ordPage=2', { scroll: false });
  });

  it('khách chưa có đơn: chỉ số báo trống, bảng mời tạo đơn', async () => {
    server.use(scenario.customerStatsEmpty, scenario.customerOrdersEmpty);
    const region = await openProfile();
    expect(await within(region).findByText(/Chưa có đơn đã duyệt \/ đã chốt/)).toBeInTheDocument();
    expect(await within(region).findByText('Khách chưa có đơn nào')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Tạo đơn' })).toHaveAttribute(
      'href',
      `/crm/orders/new?customerId=${FIRST.id}`,
    );
  });

  it('lỗi 500 ở chỉ số / bảng đơn → ErrorState có traceId, hồ sơ vẫn hiện', async () => {
    server.use(scenario.customerStatsError, scenario.customerOrdersError);
    const region = await openProfile();
    await waitFor(() => expect(within(region).getAllByRole('alert')).toHaveLength(2));
    expect(within(region).getAllByText('trace-db_error')).toHaveLength(2);
    expect(screen.getByText('Hạn mức công nợ')).toBeInTheDocument();
  });

  it('đang tải → skeleton chỉ số + bảng', async () => {
    const region = await openProfile();
    expect(
      within(region).getByRole('status', { name: 'Đang tải chỉ số mua hàng' }),
    ).toBeInTheDocument();
    expect(within(region).getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
  });
});
