import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftDay } from '@/components/data/date-range-picker';
import { toLocalDateKey } from '@/lib/format';
import { errorEnvelope } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type {
  SalesKpis,
  SalesOrderList,
  SalesSummary,
  SalesTimeseries,
  SalesTopProducts,
  ShipmentMonitorSummary,
} from './api/use-dashboard';
import { DashboardScreen, floorRoute } from './components/dashboard-screen';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const TODAY = toLocalDateKey(new Date())!;
const MONTH_START = `${TODAY.slice(0, 8)}01`;
const CHART_FROM = shiftDay(TODAY, -29);

/** Quản lý: báo cáo doanh thu + đơn + giao hàng. */
const ME_MANAGER = {
  permissions: ['report.sales', 'sales_order.read', 'shipment.read', 'customer.read'],
  hasGlobalAccess: false,
};
/** Sale thường: không có report.sales. */
const ME_SALE_ONLY = { permissions: ['customer.read', 'sales_order.read'], hasGlobalAccess: false };

const kpis = (over: Partial<SalesKpis> = {}): SalesKpis => ({
  revenue: '3000000.0000',
  orderCount: 12,
  aov: '250000.0000',
  grossProfit: '900000.0000',
  cogs: '2100000.0000',
  returnedRevenue: '0.0000',
  customerCount: 9,
  newCustomerCount: 2,
  ...over,
});

const summary = (from: string, to: string, current: SalesKpis, previous: SalesKpis) =>
  ({
    from,
    to,
    previousFrom: shiftDay(from, -1),
    previousTo: shiftDay(from, -1),
    current,
    previous,
    dataAsOf: null,
  }) satisfies SalesSummary;

const point = (period: string, revenue: string, orderCount: number) => ({
  period,
  revenue,
  orderCount,
  aov: '0.0000',
  grossProfit: '0.0000',
  returnedRevenue: '0.0000',
});

const SERIES: SalesTimeseries = {
  from: CHART_FROM,
  to: TODAY,
  previousFrom: shiftDay(CHART_FROM, -30),
  previousTo: shiftDay(CHART_FROM, -1),
  granularity: 'day',
  points: [point(CHART_FROM, '1000000.0000', 4), point(TODAY, '500000.0000', 2)],
  previousPoints: [point(shiftDay(CHART_FROM, -30), '800000.0000', 3)],
  totals: {
    revenue: '1500000.0000',
    orderCount: 6,
    aov: '250000.0000',
    grossProfit: '0.0000',
    returnedRevenue: '0.0000',
  },
  previousTotals: {
    revenue: '800000.0000',
    orderCount: 3,
    aov: '266666.6667',
    grossProfit: '0.0000',
    returnedRevenue: '0.0000',
  },
  dataAsOf: null,
};

const topItem = (rank: number) => ({
  rank,
  sku: { id: `sku-${rank}`, code: `SKU-${rank}`, name: `Phân bón NPK ${rank}` },
  product: { id: `p-${rank}`, name: `NPK ${rank}` },
  qty: '20.000000',
  revenue: `${600000 - rank * 100000}.0000`,
  grossProfit: '100000.0000',
  orderCount: 6,
  customerCount: 4,
  value: `${600000 - rank * 100000}.0000`,
  previousRank: rank === 1 ? null : rank,
  previousValue: rank === 1 ? null : '100000.0000',
  growthPct: rank === 1 ? null : '25.00',
});

const TOP: SalesTopProducts = {
  from: MONTH_START,
  to: TODAY,
  previousFrom: MONTH_START,
  previousTo: MONTH_START,
  rankBy: 'revenue',
  items: [1, 2, 3, 4, 5].map(topItem),
  dataAsOf: null,
};

const ORDERS: SalesOrderList = {
  total: 3,
  items: [
    {
      id: 'so-1',
      docNumber: 'SO-2610-00001',
      customer: { id: 'c-1', code: 'KH1', name: 'Cửa hàng VTNN Minh Tâm' },
      channel: 'DIRECT',
      orderDate: '2026-10-05T02:00:00.000Z',
      status: 'PENDING_APPROVAL',
      lineCount: 2,
      subtotal: '1596400.0000',
      discount: '0.0000',
      manualDiscount: '0.0000',
      manualDiscountRate: null,
      taxAmount: '0.0000',
      shippingFee: '0.0000',
      total: '1596400.0000',
      currencyCode: 'VND',
      ownerId: null,
      teamId: null,
      carrierId: null,
      warehouseId: null,
      addressId: null,
      shippingWeightKg: null,
      lineWeightKg: '0',
      weightKg: '0',
      shippingOptions: null,
      pancakeOrderId: null,
      pancakeOrderLink: null,
      postedAt: null,
      createdAt: '2026-10-05T02:00:00.000Z',
      updatedAt: '2026-10-05T02:00:00.000Z',
    },
  ],
};

const SHIPPING: ShipmentMonitorSummary = {
  date: TODAY,
  from: `${TODAY}T00:00:00+07:00`,
  to: `${TODAY}T23:59:59+07:00`,
  holdDays: 5,
  asOf: new Date().toISOString(),
  totals: { packed: 41, handedOver: 37, holding: 120, holdingOverdue: 3 },
  byCarrier: [],
};

const summaryCalls: URLSearchParams[] = [];
const salesHandlers = (opts: { emptyToday?: boolean } = {}) => [
  http.get('/api/reports/sales/summary', ({ request }) => {
    const q = new URL(request.url).searchParams;
    summaryCalls.push(q);
    const from = q.get('from')!;
    const to = q.get('to')!;
    if (from === to)
      return HttpResponse.json(
        opts.emptyToday
          ? summary(from, to, kpis({ orderCount: 0, revenue: '0' }), kpis({ orderCount: 0 }))
          : summary(from, to, kpis(), kpis({ revenue: '2400000.0000', orderCount: 10 })),
      );
    return HttpResponse.json(
      summary(from, to, kpis({ revenue: '90000000.0000' }), kpis({ revenue: '100000000.0000' })),
    );
  }),
  http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
  http.get('/api/reports/sales/top-products', () => HttpResponse.json(TOP)),
];
const opsHandlers = [
  http.get('/api/sales-orders', () => HttpResponse.json(ORDERS)),
  http.get('/api/shipment-monitor/summary', () => HttpResponse.json(SHIPPING)),
];

const section = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  replace.mockReset();
  summaryCalls.length = 0;
});

describe('DashboardScreen — số thật theo quyền (RPT-08)', () => {
  it('report.sales: KPI hôm nay so hôm qua + tháng này, biểu đồ 30 ngày, top 5 — link đúng tab/khoảng', async () => {
    server.use(...salesHandlers(), ...opsHandlers);
    renderApp(<DashboardScreen />, { me: ME_MANAGER });

    const today = await screen.findByRole('region', { name: 'Hôm nay' });
    await within(today).findByText('3.000.000 ₫');
    expect(within(today).getByText('Hôm qua 2.400.000 ₫')).toBeInTheDocument();
    expect(within(today).getByLabelText('Tăng 25,00% so kỳ trước')).toBeInTheDocument();
    expect(within(today).getByRole('link', { name: 'Xem báo cáo' })).toHaveAttribute(
      'href',
      `/reports/sales?from=${TODAY}&to=${TODAY}`,
    );

    const month = section(`Tháng ${TODAY.slice(5, 7)}/${TODAY.slice(0, 4)}`);
    await within(month).findByText('90.000.000 ₫');
    expect(within(month).getByLabelText('Giảm 10,00% so kỳ trước')).toBeInTheDocument();
    expect(within(month).getByRole('link', { name: 'Xem báo cáo' })).toHaveAttribute(
      'href',
      `/reports/sales?from=${MONTH_START}&to=${TODAY}`,
    );
    expect(summaryCalls.map((q) => `${q.get('from')}..${q.get('to')}`).sort()).toEqual(
      [`${TODAY}..${TODAY}`, `${MONTH_START}..${TODAY}`].sort(),
    );

    const chart = section('Doanh thu 30 ngày');
    await within(chart).findByText(/Tổng 1\.500\.000 ₫/);
    expect(within(chart).getByRole('link', { name: 'Xem báo cáo' })).toHaveAttribute(
      'href',
      `/reports/sales?gran=day&from=${CHART_FROM}&to=${TODAY}`,
    );

    const top = section('Bán chạy tháng này');
    await within(top).findByText('Phân bón NPK 1');
    expect(within(top).getAllByRole('listitem')).toHaveLength(5);
    expect(within(top).getByText('Mới')).toBeInTheDocument();
    expect(within(top).getByRole('link', { name: 'Xem báo cáo' })).toHaveAttribute(
      'href',
      `/reports/sales?tab=top&from=${MONTH_START}&to=${TODAY}`,
    );

    // Không còn số mẫu cứng của bản UI-first.
    expect(screen.queryByText(/Mục tiêu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Công nợ quá hạn/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ngoại lệ/)).not.toBeInTheDocument();
  });

  it('không có report.sales: không gọi API báo cáo, chỉ thấy đơn chờ duyệt', async () => {
    // onUnhandledRequest: 'error' — gọi /reports/* sẽ làm test lỗi.
    server.use(opsHandlers[0]!);
    renderApp(<DashboardScreen />, { me: ME_SALE_ONLY });
    const pending = await screen.findByRole('region', { name: 'Đơn chờ duyệt' });
    await within(pending).findByText('Cửa hàng VTNN Minh Tâm');
    expect(within(pending).getByRole('link', { name: 'SO-2610-00001' })).toHaveAttribute(
      'href',
      '/crm/orders/so-1',
    );
    expect(within(pending).getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute(
      'href',
      '/crm/orders?status=PENDING_APPROVAL',
    );
    expect(within(pending).getByText('· 3 đơn')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Hôm nay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Giao hàng hôm nay' })).not.toBeInTheDocument();
  });

  it('shipment.read: 4 ô giao hàng trong ngày, bấm mở đúng danh sách bên màn theo dõi', async () => {
    server.use(...salesHandlers(), ...opsHandlers);
    renderApp(<DashboardScreen />, { me: ME_MANAGER });
    const ship = await screen.findByRole('region', { name: 'Giao hàng hôm nay' });
    await within(ship).findByText('41');
    expect(within(ship).getByRole('link', { name: /Giữ quá 5 ngày/ })).toHaveAttribute(
      'href',
      '/wms/shipping?view=OVERDUE',
    );
    expect(within(ship).getByText('3')).toHaveClass('text-destructive');
  });

  it('loading: skeleton trong từng ô trước khi có số', async () => {
    server.use(
      http.get('/api/reports/sales/summary', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
      http.get('/api/reports/sales/timeseries', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
      http.get('/api/reports/sales/top-products', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    renderApp(<DashboardScreen />, {
      me: { permissions: ['report.sales'], hasGlobalAccess: false },
    });
    expect(within(section('Hôm nay')).getByRole('status')).toBeInTheDocument();
    expect(within(section('Doanh thu 30 ngày')).getByRole('status')).toBeInTheDocument();
    expect(within(section('Bán chạy tháng này')).getByRole('status')).toBeInTheDocument();
  });

  it('empty: không có đơn đã chốt / không bán được SKU / không đơn chờ duyệt / không có giao hàng', async () => {
    // MSW: handler đứng trước trong cùng một server.use() thắng → override đặt trước.
    server.use(
      http.get('/api/reports/sales/top-products', () => HttpResponse.json({ ...TOP, items: [] })),
      http.get('/api/reports/sales/timeseries', () =>
        HttpResponse.json({
          ...SERIES,
          totals: { ...SERIES.totals, orderCount: 0 },
          previousTotals: { ...SERIES.previousTotals, orderCount: 0 },
        }),
      ),
      http.get('/api/sales-orders', () => HttpResponse.json({ items: [], total: 0 })),
      http.get('/api/shipment-monitor/summary', () =>
        HttpResponse.json({
          ...SHIPPING,
          totals: { packed: 0, handedOver: 0, holding: 0, holdingOverdue: 0 },
        }),
      ),
      ...salesHandlers({ emptyToday: true }),
    );
    renderApp(<DashboardScreen />, { me: ME_MANAGER });
    expect(await screen.findByText('Hôm nay và hôm qua chưa có đơn đã chốt')).toBeInTheDocument();
    expect(
      await screen.findByText('Chưa có đơn đã chốt trong 60 ngày gần đây'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Tháng này chưa bán được sản phẩm nào')).toBeInTheDocument();
    expect(await screen.findByText('Không có đơn nào chờ duyệt')).toBeInTheDocument();
    expect(
      await screen.findByText(/Hôm nay chưa có đơn đóng gói hay bàn giao/),
    ).toBeInTheDocument();
  });

  it('error: ô lỗi hiện traceId + thử lại gọi lại API, các ô khác vẫn chạy', async () => {
    let fail = true;
    server.use(
      http.get('/api/reports/sales/top-products', () =>
        fail ? errorEnvelope(500, 'DB_ERROR') : HttpResponse.json(TOP),
      ),
      ...salesHandlers(),
    );
    renderApp(<DashboardScreen />, {
      me: { permissions: ['report.sales'], hasGlobalAccess: false },
    });
    const top = section('Bán chạy tháng này');
    const alert = await within(top).findByRole('alert');
    expect(within(alert).getByText('trace-db_error')).toBeInTheDocument();
    await within(section('Hôm nay')).findByText('3.000.000 ₫');
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    await within(top).findByText('Phân bón NPK 1');
  });

  it('không có quyền xem chỉ số nào → màn trống hướng dẫn, không gọi API', () => {
    renderApp(<DashboardScreen />, {
      me: { permissions: ['product.read'], hasGlobalAccess: false },
    });
    expect(screen.getByText('Chưa có chỉ số tổng quan cho vai trò của bạn')).toBeInTheDocument();
  });

  it('nhân viên kho sàn → chuyển thẳng màn làm việc, không render dashboard', async () => {
    renderApp(<DashboardScreen />, {
      me: { permissions: ['task.execute', 'shipment.pack'], hasGlobalAccess: false },
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/wms/pack'));
    expect(screen.queryByText('Tổng quan')).not.toBeInTheDocument();
  });
});

describe('floorRoute', () => {
  const ab = (perms: string[]) => ({ can: (a: string, s: string) => perms.includes(`${s}:${a}`) });
  it('chỉ có task.execute → /pda/pick; có quyền văn phòng → null', () => {
    expect(floorRoute(ab(['Task:execute']))).toBe('/pda/pick');
    expect(floorRoute(ab(['Task:execute', 'SalesOrder:read']))).toBeNull();
    expect(floorRoute(ab([]))).toBeNull();
  });
});
