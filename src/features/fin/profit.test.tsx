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
  returnedOrderCount: 1,
  awaitingReturnReceiptCount: 1,
  returnedRevenue: '100000.0000',
  returnedCogs: '50000.0000',
  shippingCharged: '25000.0000',
  shippingCost: '35000.0000',
  shippingCostMissingCount: 0,
  taxAmount: '10000.0000',
  netProfit: '370000.0000',
  netMarginPct: '51.03',
  missingCostSkuCount: 0,
};

const ORDER_EXTRA = {
  returnStatus: 'NONE',
  returnedRevenue: '0.0000',
  shippingCharged: '0.0000',
  shippingCost: '0.0000',
  shippingCostMissing: false,
  taxAmount: '0.0000',
} as const;

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
      ...ORDER_EXTRA,
      shippingCharged: '25000.0000',
      shippingCost: '30000.0000',
      netProfit: '275000.0000',
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
      ...ORDER_EXTRA,
      returnStatus: 'PARTIAL',
      returnedRevenue: '20000.0000',
      shippingCostMissing: true,
      netProfit: '-50000.0000',
    },
    {
      orderId: 'o-3',
      docNumber: 'SO2610-00003',
      orderDate: '2026-10-01T05:00:00.000Z',
      status: 'APPROVED',
      customerCode: 'KH01',
      customerName: 'Đại lý Hưng Phát',
      revenue: '0.0000',
      cogs: '0.0000',
      grossProfit: '0.0000',
      marginPct: null,
      costStatus: 'ACTUAL',
      ...ORDER_EXTRA,
      returnStatus: 'AWAITING_RECEIPT',
      returnedRevenue: '100000.0000',
      shippingCost: '5000.0000',
      netProfit: '-5000.0000',
    },
  ],
  skus: [],
  total: 3,
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

  it('cước, phí ship thu khách, thuế, đơn hoàn: KPI lãi sau vận chuyển + nhãn trên dòng', async () => {
    search = 'from=2026-10-01&to=2026-10-01';
    server.use(http.get('/api/reports/profit', () => HttpResponse.json(BY_ORDER)));
    renderApp(<ProfitScreen />);
    await screen.findByText('SO2610-00001');
    expect(screen.getByText('Lãi sau vận chuyển')).toBeInTheDocument();
    expect(screen.getByText(/51,03%/)).toBeInTheDocument();
    expect(screen.getByText('1 đơn có hàng hoàn')).toBeInTheDocument();
    expect(screen.getByText(/chưa post\s+phiếu nhập hàng hoàn/)).toBeInTheDocument();
    expect(screen.getByText(/Thuế trên đơn/)).toBeInTheDocument();

    const shipped = screen.getByText('SO2610-00001').closest('tr')!;
    expect(within(shipped).getByText(/thu khách/)).toBeInTheDocument();
    const noFee = screen.getByText('SO2610-00002').closest('tr')!;
    expect(within(noFee).getByText('Chưa có cước')).toBeInTheDocument();
    const returned = screen.getByText('SO2610-00003').closest('tr')!;
    expect(within(returned).getByText('Hoàn · chờ nhập kho')).toBeInTheDocument();
    expect(within(returned).queryByText('Đã chốt')).not.toBeInTheDocument();
    expect(within(noFee).getByText('Hoàn một phần')).toBeInTheDocument();
    expect(within(noFee).getByText(/hoàn$/)).toBeInTheDocument();
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
              returnedQtyBase: '2.000000',
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
    expect(screen.getByText('hoàn 2')).toBeInTheDocument();
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
        return HttpResponse.json({ scanned: 10, costed: 8, shippingRefreshed: 6 });
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
