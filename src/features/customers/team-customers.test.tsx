import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorEnvelope } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { toLocalDateKey } from '@/lib/format';
import { careRangePresets, TeamCustomersScreen } from './components/team-customers-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/care/customers',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const TODAY = toLocalDateKey(new Date())!;

const row = (i: number, assignedBy: 'AUTO' | 'ORDER' | 'OTHER') => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  code: `KH02480${i}`,
  name: `Khách CSKH ${i}`,
  phone: `091234567${i}`,
  assignedAt: '2026-10-21T17:05:00.000Z',
  assignedBy,
  createdAt: '2026-10-20T03:00:00.000Z',
  lastOrderAt: i === 3 ? null : '2026-10-20T08:00:00.000Z',
  orderCount: i === 3 ? 0 : i,
});

const LIST = {
  teamId: 't-ca',
  teamName: 'Phòng ban · CSKH Miền Bắc',
  total: 3,
  items: [row(1, 'AUTO'), row(2, 'ORDER'), row(3, 'OTHER')],
};

function capture() {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get('/api/customer-care/customers', ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json(LIST);
    }),
  );
  return seen;
}

beforeEach(() => {
  search = '';
  replace.mockClear();
});

describe('TeamCustomersScreen — GET /customer-care/customers (CSKH)', () => {
  it('mặc định "1 ngày" = khách gán hôm nay; bảng: nguồn gán, số đơn, nút Lên đơn mở đơn mới cho khách', async () => {
    const seen = capture();
    renderApp(<TeamCustomersScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(
      await screen.findByText('Khách của team · Phòng ban · CSKH Miền Bắc'),
    ).toBeInTheDocument();
    expect(seen[0]!.get('assignedFrom')).toBe(TODAY);
    expect(seen[0]!.get('assignedTo')).toBe(TODAY);
    expect(screen.getByRole('button', { name: '1 ngày' })).toHaveAttribute('aria-pressed', 'true');

    const r1 = screen.getByRole('row', { name: /KH024801/ });
    expect(within(r1).getByText('Chia tự động')).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /KH024802/ })).getByText('CSKH lên đơn'),
    ).toBeInTheDocument();
    const r3 = screen.getByRole('row', { name: /KH024803/ });
    expect(within(r3).getByText('Gán tay')).toBeInTheDocument();
    expect(within(r3).getByText('Chưa có đơn')).toBeInTheDocument();
    expect(within(r1).getByRole('link', { name: 'Lên đơn' })).toHaveAttribute(
      'href',
      `/crm/orders/new?customerId=${row(1, 'AUTO').id}`,
    );
  });

  it('khoảng ngày trên URL → assignedFrom/To; "Tất cả" (all=1) → không gửi khoảng', async () => {
    search = 'from=2026-10-15&to=2026-10-21&q=hung&page=2';
    const seen = capture();
    renderApp(<TeamCustomersScreen />);
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.at(-1)!.get('assignedFrom')).toBe('2026-10-15');
    expect(seen.at(-1)!.get('assignedTo')).toBe('2026-10-21');
    expect(seen.at(-1)!.get('q')).toBe('hung');
    expect(seen.at(-1)!.get('skip')).toBe('50');

    search = 'all=1';
    const seenAll = capture();
    renderApp(<TeamCustomersScreen />);
    await waitFor(() => expect(seenAll.length).toBeGreaterThan(0));
    expect(seenAll.at(-1)!.has('assignedFrom')).toBe(false);
  });

  it('bấm preset "7 ngày" / "Tất cả" → ghi khoảng lên URL', async () => {
    capture();
    renderApp(<TeamCustomersScreen />);
    await screen.findByText(/Khách của team ·/);
    fireEvent.click(screen.getByRole('button', { name: '7 ngày' }));
    const seven = careRangePresets(TODAY)[2]!;
    expect(replace).toHaveBeenLastCalledWith(
      expect.stringContaining(`from=${seven.from}`),
      expect.anything(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(replace).toHaveBeenLastCalledWith(expect.stringContaining('all=1'), expect.anything());
  });

  it('trống → lời mời xem tất cả khách của team', async () => {
    server.use(
      http.get('/api/customer-care/customers', () =>
        HttpResponse.json({ ...LIST, total: 0, items: [] }),
      ),
    );
    renderApp(<TeamCustomersScreen />);
    expect(await screen.findByText(/Chưa có khách nào được gán/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả khách của team' }));
    expect(replace).toHaveBeenLastCalledWith(expect.stringContaining('all=1'), expect.anything());
  });

  it('403 (không thuộc team CSKH) → màn không có quyền', async () => {
    server.use(http.get('/api/customer-care/customers', () => errorEnvelope(403, 'FORBIDDEN')));
    renderApp(<TeamCustomersScreen />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });

  it('lỗi 500 → ErrorState có traceId', async () => {
    server.use(http.get('/api/customer-care/customers', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<TeamCustomersScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });
});
