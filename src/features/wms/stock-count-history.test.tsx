import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { StockCountHistoryScreen } from './components/stock-count-history-screen';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/stock/history',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const row = (over: Record<string, unknown>) => ({
  lineId: 'l-1',
  countId: 'c-1',
  docNumber: 'CC2611-00001',
  at: '2026-11-05T03:21:36.407Z',
  warehouseName: 'Kho Thạch Thất',
  skuId: 's-1',
  skuCode: 'SP-0108',
  skuName: 'Phân bón A',
  locationCode: 'DEFAULT',
  qtySystem: '0.000000',
  qtyCounted: '8.000000',
  variance: '8.000000',
  note: 'Nhập tồn thực tế',
  userId: 'u-admin',
  userName: 'Quản trị hệ thống',
  userCode: 'admin',
  onBehalfOfName: null,
  ...over,
});

/** Lịch sử nhập tồn theo người nhập (2026-11-05). */
describe('StockCountHistoryScreen — GET /cycle-counts/history', () => {
  it('hiện người nhập kèm mã; admin đăng nhập thay ghi "Đăng nhập thay"; chênh lệch có dấu; userId trên URL vào query', async () => {
    search = 'userId=u-admin';
    const calls: URLSearchParams[] = [];
    server.use(
      http.get('/api/cycle-counts/history', ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          total: 2,
          items: [
            row({}),
            row({
              lineId: 'l-2',
              variance: '-1.000000',
              qtyCounted: '4.000000',
              qtySystem: '5.000000',
              onBehalfOfName: 'Đỗ Văn Kho',
            }),
          ],
        });
      }),
      http.get('/api/cycle-counts/history/users', () =>
        HttpResponse.json([
          { userId: 'u-admin', name: 'Quản trị hệ thống', code: 'admin', lineCount: 2 },
        ]),
      ),
    );
    renderApp(<StockCountHistoryScreen />);
    expect(await screen.findAllByText('Quản trị hệ thống')).not.toHaveLength(0);
    expect(screen.getAllByText('(admin)')).toHaveLength(2);
    expect(screen.getByText('Đăng nhập thay Đỗ Văn Kho')).toBeInTheDocument();
    expect(screen.getByText('+8')).toBeInTheDocument();
    expect(screen.getByText('−1')).toBeInTheDocument();
    await waitFor(() => expect(calls.at(-1)?.get('userId')).toBe('u-admin'));
  });

  it('rỗng → EmptyState kèm một hành động', async () => {
    search = '';
    server.use(
      http.get('/api/cycle-counts/history', () => HttpResponse.json({ total: 0, items: [] })),
      http.get('/api/cycle-counts/history/users', () => HttpResponse.json([])),
    );
    renderApp(<StockCountHistoryScreen />);
    expect(await screen.findByText('Chưa có lần nhập tồn nào theo bộ lọc')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về màn Tồn kho' })).toHaveAttribute(
      'href',
      '/wms/stock',
    );
  });
});
