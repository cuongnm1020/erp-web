import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { ProfitReport } from './api/use-profit';
import { ProfitScreen } from './components/profit-screen';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/fin/profit',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const SUMMARY: ProfitReport['summary'] = {
  orderCount: 2,
  goodsRevenue: '700000.0000',
  orderDiscount: '0.0000',
  revenue: '700000.0000',
  actualCogs: '220000.0000',
  estimatedCogs: '100000.0000',
  cogs: '320000.0000',
  grossProfit: '380000.0000',
  marginPct: '54.29',
  missingCostSkuCount: 0,
};

/** Đúng shape `ProfitReportDto` (GET /reports/profit). */
const BY_ORDER: ProfitReport = {
  from: '2026-10-01',
  to: '2026-10-01',
  groupBy: 'order',
  summary: SUMMARY,
  orders: [
    {
      orderId: 'o-1',
      docNumber: 'SO2610-00001',
      orderDate: '2026-10-01T03:00:00.000Z',
      status: 'APPROVED',
      customerCode: 'KH01',
      customerName: 'Đại lý Hưng Phát',
      revenue: '500000.0000',
      cogs: '220000.0000',
      grossProfit: '280000.0000',
      marginPct: '56.00',
      costStatus: 'ACTUAL',
    },
    {
      orderId: 'o-2',
      docNumber: 'SO2610-00002',
      orderDate: '2026-10-01T04:00:00.000Z',
      status: 'APPROVED',
      customerCode: 'KH02',
      customerName: 'Cửa hàng Minh Tâm',
      revenue: '200000.0000',
      cogs: '250000.0000',
      grossProfit: '-50000.0000',
      marginPct: '-25.00',
      costStatus: 'ESTIMATED',
    },
  ],
  skus: [],
  total: 2,
};

describe('ProfitScreen — GET /reports/profit', () => {
  it('theo đơn: KPI tổng + bảng từng đơn, nhãn Đã chốt / Tạm tính, lỗ tô đỏ', async () => {
    search = 'from=2026-10-01&to=2026-10-01';
    const calls: URLSearchParams[] = [];
    server.use(
      http.get('/api/reports/profit', ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return HttpResponse.json(BY_ORDER);
      }),
    );
    renderApp(<ProfitScreen />);
    expect(await screen.findByText('SO2610-00001')).toBeInTheDocument();
    expect(calls[0]!.get('groupBy')).toBe('order');
    expect(calls[0]!.get('from')).toBe('2026-10-01');
    expect(screen.getByText('54,29%')).toBeInTheDocument();
    const lossRow = screen.getByText('SO2610-00002').closest('tr')!;
    expect(within(lossRow).getByText('Tạm tính')).toBeInTheDocument();
    expect(within(lossRow).getByText('-25,00%')).toBeInTheDocument();
    const okRow = screen.getByText('SO2610-00001').closest('tr')!;
    expect(within(okRow).getByText('Đã chốt')).toBeInTheDocument();
  });

  it('theo SKU: gửi groupBy=sku, hiện giá vốn bình quân', async () => {
    search = 'from=2026-10-01&to=2026-10-01&view=sku';
    const calls: URLSearchParams[] = [];
    server.use(
      http.get('/api/reports/profit', ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          ...BY_ORDER,
          groupBy: 'sku',
          orders: [],
          total: 1,
          skus: [
            {
              skuId: 's-1',
              skuCode: 'VBC-40G',
              skuName: 'Vua Bật Chồi 40gr',
              qtyBase: '7.000000',
              revenue: '700000.0000',
              cogs: '320000.0000',
              grossProfit: '380000.0000',
              marginPct: '54.29',
              avgUnitCost: '45714.2857',
              costStatus: 'ESTIMATED',
            },
          ],
        } satisfies ProfitReport);
      }),
    );
    renderApp(<ProfitScreen />);
    expect(await screen.findByText('VBC-40G')).toBeInTheDocument();
    expect(calls[0]!.get('groupBy')).toBe('sku');
    expect(screen.getByText('Giá vốn BQ')).toBeInTheDocument();
  });

  it('không đơn nào trong khoảng → trạng thái trống kèm một hành động', async () => {
    search = 'from=2026-10-01&to=2026-10-01';
    server.use(
      http.get('/api/reports/profit', () =>
        HttpResponse.json({
          ...BY_ORDER,
          summary: { ...SUMMARY, orderCount: 0 },
          orders: [],
          total: 0,
        }),
      ),
    );
    renderApp(<ProfitScreen />);
    expect(await screen.findByText('Chưa có đơn đã chốt trong khoảng này')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở danh sách đơn' })).toBeInTheDocument();
  });

  it('"Chốt giá vốn đơn cũ" gọi POST /reports/profit/backfill với khoảng ngày đang xem', async () => {
    search = 'from=2026-09-01&to=2026-09-30';
    const bodies: unknown[] = [];
    server.use(
      http.get('/api/reports/profit', () => HttpResponse.json(BY_ORDER)),
      http.post('/api/reports/profit/backfill', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ scanned: 10, costed: 8 });
      }),
    );
    renderApp(<ProfitScreen />);
    await screen.findByText('SO2610-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Chốt giá vốn đơn cũ' }));
    await waitFor(() => expect(bodies).toEqual([{ from: '2026-09-01', to: '2026-09-30' }]));
  });

  it('không có quyền report.profit → màn "không có quyền", không gọi API', async () => {
    search = '';
    const calls: unknown[] = [];
    server.use(
      http.get('/api/reports/profit', () => {
        calls.push(1);
        return HttpResponse.json(BY_ORDER);
      }),
    );
    renderApp(<ProfitScreen />, { me: { ...ME_SALE, permissions: ['sales_order.read'] } });
    expect(await screen.findByText(/không có quyền/i)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
