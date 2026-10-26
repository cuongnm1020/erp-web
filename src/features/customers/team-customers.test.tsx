import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorEnvelope } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { toLocalDateKey } from '@/lib/format';
import { TeamCustomersScreen } from './components/team-customers-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/care/customers',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const TODAY = toLocalDateKey(new Date())!;
const DURIAN = '00000000-0000-4000-8000-0000000000d1';

const row = (i: number) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  code: `KH02480${i}`,
  name: `Khách CSKH ${i}`,
  phone: `091234567${i}`,
  assignedAt: '2026-10-21T17:05:00.000Z',
  assignedBy: 'AUTO' as const,
  createdAt: '2026-10-20T03:00:00.000Z',
  rank: i,
  revenue: i === 3 ? '0.0000' : `${4 - i}00000.0000`,
  orderCount: i === 3 ? 0 : 1,
  lastOrderAt: i === 3 ? null : '2026-10-20T08:00:00.000Z',
  lastOrderOwnerName: i === 3 ? null : 'Ngọc',
  purposes: i === 1 ? [{ id: DURIAN, name: 'Sầu riêng' }] : [],
  latestNote:
    i === 1
      ? { body: 'Vườn 3ha, hẹn gọi lại', authorName: 'Ngọc', createdAt: '2026-10-25T09:20:00.000Z' }
      : null,
});

const LIST = {
  teamId: 't-ca',
  teamName: 'CSKH LA',
  total: 3,
  items: [row(1), row(2), row(3)],
};

function capture() {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get('/api/customer-care/customers', ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json(LIST);
    }),
    http.get('/api/customer-purposes', () =>
      HttpResponse.json([{ id: DURIAN, name: 'Sầu riêng', color: null, customerCount: 12 }]),
    ),
  );
  return seen;
}

beforeEach(() => {
  search = '';
  replace.mockClear();
});

describe('TeamCustomersScreen — GET /customer-care/customers (CSKH, biên bản 2026-10-26)', () => {
  it('mặc định: đơn gần nhất, doanh thu tháng này; bảng hiện mục đích, doanh thu, ghi chú, nút Lên đơn', async () => {
    const seen = capture();
    renderApp(<TeamCustomersScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText('Khách của team · CSKH LA')).toBeInTheDocument();
    expect(seen[0]!.get('sort')).toBe('lastOrder');
    expect(seen[0]!.get('from')).toBe(`${TODAY.slice(0, 8)}01`);
    expect(seen[0]!.get('to')).toBe(TODAY);
    expect(seen[0]!.has('assignedFrom')).toBe(false);
    expect(seen[0]!.has('top')).toBe(false);

    const r1 = screen.getByRole('row', { name: /KH024801/ });
    expect(within(r1).getByText('Sầu riêng')).toBeInTheDocument();
    expect(within(r1).getByText(/300\.000/)).toBeInTheDocument();
    expect(within(r1).getByText(/Vườn 3ha, hẹn gọi lại/)).toBeInTheDocument();
    expect(within(r1).getByText(/· Ngọc/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /KH024803/ })).getByText('Chưa có đơn'),
    ).toBeInTheDocument();
    expect(within(r1).getByRole('link', { name: 'Lên đơn' })).toHaveAttribute(
      'href',
      `/crm/orders/new?customerId=${row(1).id}`,
    );
  });

  it('URL → sort=revenue, top, mục đích, sản phẩm, ngày gán, kỳ doanh thu, trang', async () => {
    search = `from=2026-10-01&to=2026-10-15&top=50&purposes=${DURIAN}&sku=sku-1&skuLabel=Phân%20bón&assigned=7&q=hung&page=2`;
    const seen = capture();
    renderApp(<TeamCustomersScreen />);
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    const p = seen.at(-1)!;
    expect(p.get('sort')).toBe('revenue');
    expect(p.get('top')).toBe('50');
    expect(p.get('purposeIds')).toBe(DURIAN);
    expect(p.get('skuIds')).toBe('sku-1');
    expect(p.get('from')).toBe('2026-10-01');
    expect(p.get('to')).toBe('2026-10-15');
    expect(p.get('assignedTo')).toBe(TODAY);
    expect(p.get('q')).toBe('hung');
    expect(p.get('skip')).toBe('50');
  });

  it('bấm "Top 10" → ghi top lên URL; "Tất cả" bỏ top', async () => {
    capture();
    renderApp(<TeamCustomersScreen />);
    await screen.findByText(/Khách của team ·/);
    fireEvent.click(screen.getByRole('button', { name: 'Top 10' }));
    expect(replace).toHaveBeenLastCalledWith(expect.stringContaining('top=10'), expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(replace).toHaveBeenLastCalledWith(
      expect.not.stringContaining('top='),
      expect.anything(),
    );
  });

  it('lọc ra 0 khách → "Xóa lọc" bỏ mục đích / Top', async () => {
    search = `purposes=${DURIAN}&top=10`;
    capture();
    server.use(
      http.get('/api/customer-care/customers', () =>
        HttpResponse.json({ ...LIST, total: 0, items: [] }),
      ),
    );
    renderApp(<TeamCustomersScreen />);
    expect(await screen.findByText('Không có khách khớp')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa lọc' }).at(-1)!);
    expect(replace).toHaveBeenLastCalledWith(
      expect.not.stringContaining('purposes='),
      expect.anything(),
    );
  });

  it('403 (không thuộc team CSKH) → màn không có quyền', async () => {
    capture();
    server.use(http.get('/api/customer-care/customers', () => errorEnvelope(403, 'FORBIDDEN')));
    renderApp(<TeamCustomersScreen />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });

  it('lỗi 500 → ErrorState có traceId', async () => {
    capture();
    server.use(http.get('/api/customer-care/customers', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<TeamCustomersScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });
});
