import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { Productivity } from './api/use-productivity';
import { formatDuration, ProductivityScreen } from './components/productivity-screen';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/productivity',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const row = (
  userId: string,
  code: string,
  fullName: string,
  done: Partial<Productivity['pick']['rows'][number]['done']>,
  open: { assigned: number; inProgress: number },
) => ({
  userId,
  code,
  fullName,
  roles: [],
  done: { orders: 0, lines: 0, qty: '0.000000', shortOrders: 0, avgSeconds: null, ...done },
  open,
});

/** Đúng shape `TaskProductivityDto` (GET /tasks/productivity). */
const DATA: Productivity = {
  from: '2026-09-21',
  to: '2026-09-27',
  warehouseId: null,
  pick: {
    totals: {
      done: { orders: 45, lines: 60, qty: '120.000000', shortOrders: 2, avgSeconds: 150 },
      open: { assigned: 20, inProgress: 3 },
      unassigned: 7,
    },
    rows: [
      row(
        'u1',
        'picker.an',
        'Nguyễn An',
        { orders: 30, lines: 40, qty: '80.000000', shortOrders: 2, avgSeconds: 95 },
        { assigned: 20, inProgress: 3 },
      ),
      row('u2', 'picker.binh', 'Trần Bình', { orders: 15 }, { assigned: 0, inProgress: 0 }),
    ],
  },
  pack: {
    totals: {
      done: { orders: 40, lines: 55, qty: '110.000000', shortOrders: 0, avgSeconds: 3900 },
      open: { assigned: 1, inProgress: 0 },
      unassigned: 5,
    },
    rows: [
      row(
        'u3',
        'packer.chi',
        'Lê Chi',
        { orders: 40, lines: 55, qty: '110.000000', avgSeconds: 3900 },
        { assigned: 1, inProgress: 0 },
      ),
    ],
  },
};

const useApi = (onQuery?: (q: URLSearchParams) => void, body: Productivity = DATA) =>
  server.use(
    http.get('/api/warehouses', () =>
      HttpResponse.json([{ id: 'wh-1', code: 'WH01', name: 'Kho Hà Nội' }]),
    ),
    http.get('/api/tasks/productivity', ({ request }) => {
      onQuery?.(new URL(request.url).searchParams);
      return HttpResponse.json(body);
    }),
  );

describe('ProductivityScreen — /wms/productivity', () => {
  it('khoảng ngày trên URL đi thẳng vào query; KPI + hai bảng theo nhân viên + cột đang giao', async () => {
    search = 'from=2026-09-21&to=2026-09-27&warehouseId=wh-1';
    const seen: URLSearchParams[] = [];
    useApi((q) => seen.push(q));
    renderApp(<ProductivityScreen />);

    const pick = await screen.findByRole('region', { name: 'Nhân viên lấy hàng' });
    expect(seen[0]?.get('from')).toBe('2026-09-21');
    expect(seen[0]?.get('to')).toBe('2026-09-27');
    expect(seen[0]?.get('warehouseId')).toBe('wh-1');

    expect(screen.getAllByText('Đơn đã lấy')[0]?.nextSibling?.textContent).toBe('45'); // KPI trước bảng
    expect(screen.getByText('Chờ giao việc').nextSibling?.textContent).toBe('12');

    const an = within(pick).getByText('Nguyễn An').closest('tr')!;
    expect(within(an).getByText('30')).toBeInTheDocument();
    expect(within(an).getByText('1 phút 35 giây')).toBeInTheDocument();
    expect(within(an).getByText('20')).toBeInTheDocument(); // đang giao
    const binh = within(pick).getByText('Trần Bình').closest('tr')!;
    expect(within(binh).getByText('rảnh')).toBeInTheDocument();

    const pack = screen.getByRole('region', { name: 'Nhân viên đóng gói' });
    expect(within(pack).getByText('1 giờ 05 phút')).toBeInTheDocument();
    expect(within(pack).queryByText('Báo thiếu')).toBeNull();
  });

  it('chọn nhanh "7 ngày" ghi from/to lên URL (luật 8)', async () => {
    search = '';
    replace.mockClear();
    useApi();
    renderApp(<ProductivityScreen />);
    await screen.findByRole('region', { name: 'Nhân viên lấy hàng' });
    fireEvent.click(screen.getByRole('button', { name: '7 ngày' }));
    const url = replace.mock.calls.at(-1)?.[0] as string;
    const q = new URLSearchParams(url.split('?')[1]);
    expect(q.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(q.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(q.get('from')! < q.get('to')!).toBe(true);
  });

  it('không có nhân viên nào → trạng thái rỗng kèm đường tới danh sách nhân viên', async () => {
    search = '';
    useApi(undefined, {
      ...DATA,
      pick: { ...DATA.pick, rows: [] },
      pack: { ...DATA.pack, rows: [] },
    });
    renderApp(<ProductivityScreen />);
    expect(await screen.findAllByText('Chưa có ai trong bảng này')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Mở danh sách nhân viên' })).toHaveLength(2);
  });

  it('lỗi server → màn lỗi có nút thử lại', async () => {
    search = '';
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json([])),
      http.get('/api/tasks/productivity', () =>
        HttpResponse.json(
          { code: 'INTERNAL', message: 'x', details: null, traceId: 'trace-1' },
          { status: 500, headers: { 'x-request-id': 'trace-1' } },
        ),
      ),
    );
    renderApp(<ProductivityScreen />);
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
  });
});

describe('formatDuration', () => {
  it('giây / phút / giờ; null → gạch', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(42)).toBe('42 giây');
    expect(formatDuration(95)).toBe('1 phút 35 giây');
    expect(formatDuration(3900)).toBe('1 giờ 05 phút');
  });
});
