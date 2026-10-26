import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftDay } from '@/components/data/date-range-picker';
import { toLocalDateKey } from '@/lib/format';
import { errorEnvelope } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type {
  OrderFlowCounts,
  Replenishment,
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
const YESTERDAY = shiftDay(TODAY, -1);
const MONTH_START = `${TODAY.slice(0, 8)}01`;
const CHART_FROM = shiftDay(TODAY, -29);

/** Quản lý: báo cáo doanh thu + đơn + giao hàng + tồn kho. */
const ME_MANAGER = {
  permissions: ['report.sales', 'sales_order.read', 'shipment.read', 'customer.read', 'stock.read'],
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
      carrierAccountId: null,
      senderPhone: null,
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
      flow: 'PENDING_APPROVAL',
      fulfilmentStatus: null,
      statusChangedAt: null,
      sameDayCount: 0,
      phone: null,
      recipientName: null,
      addressLine: null,
      province: null,
      product: null,
      shipment: null,
      ownerName: null,
      facebookPageName: null,
      note: null,
      shortage: null,
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

const flow = (over: Partial<OrderFlowCounts> = {}): OrderFlowCounts => ({
  total: 0,
  PENDING_APPROVAL: 0,
  WAREHOUSE: 0,
  WAITING_STOCK: 0,
  PICKING: 0,
  PACKED: 0,
  PICKED_UP: 0,
  IN_TRANSIT: 0,
  OUT_FOR_DELIVERY: 0,
  DELIVERED: 0,
  RETURNED: 0,
  CARRIER_CANCELLED: 0,
  CANCELLED: 0,
  ...over,
});

/** flow-counts theo bộ lọc: hôm nay / hôm qua cùng giờ / cả ngày hôm qua / chưa gán hãng / toàn bộ. */
const flowHandler = http.get('/api/sales-orders/flow-counts', ({ request }) => {
  const q = new URL(request.url).searchParams;
  const from = q.get('from');
  const to = q.get('to');
  if (from === TODAY && to === TODAY)
    return HttpResponse.json(flow({ total: 1240, CANCELLED: 18 }));
  if (from === YESTERDAY && to === YESTERDAY) return HttpResponse.json(flow({ total: 1500 }));
  if (from === YESTERDAY) return HttpResponse.json(flow({ total: 1000 }));
  if (q.get('noCarrier') === 'true')
    return HttpResponse.json(flow({ WAREHOUSE: 5, PICKING: 2, PACKED: 1, DELIVERED: 40 }));
  return HttpResponse.json(flow({ total: 9000, PENDING_APPROVAL: 7, WAREHOUSE: 48 }));
});

const LOW_STOCK: Replenishment = {
  items: [
    {
      skuId: 'sku-ga3',
      skuCode: 'AMN-GA3',
      skuName: 'Amino GA3 kích ra rễ, chai 500 ml',
      productId: 'p-ga3',
      productName: 'Amino GA3',
      baseUomCode: 'CHAI',
      reorderLevel: '50.000000',
      onHand: '0.000000',
      reserved: '0.000000',
      available: '0.000000',
      soldToday: '20.000000',
      sold1d: '210.000000',
      sold2d: '214.000000',
      avgDaily: '212.000000',
      daysLeft: null,
      projectedOutDate: null,
      status: 'OUT',
    },
  ],
  total: 1,
  alertCount: 14,
  asOf: TODAY,
};
const stockHandler = http.get('/api/stock/replenishment', () => HttpResponse.json(LOW_STOCK));

const summaryCalls: URLSearchParams[] = [];
const salesHandlers = (opts: { empty?: boolean } = {}) => [
  http.get('/api/reports/sales/summary', ({ request }) => {
    const q = new URL(request.url).searchParams;
    summaryCalls.push(q);
    const from = q.get('from')!;
    const to = q.get('to')!;
    if (opts.empty)
      return HttpResponse.json(
        summary(from, to, kpis({ orderCount: 0, revenue: '0' }), kpis({ orderCount: 0 })),
      );
    if (from === to)
      return HttpResponse.json(
        summary(from, to, kpis(), kpis({ revenue: '2400000.0000', orderCount: 10 })),
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
  flowHandler,
  stockHandler,
];

const section = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  replace.mockReset();
  summaryCalls.length = 0;
});

describe('DashboardScreen — số thật theo quyền (RPT-08)', () => {
  it('report.sales: bảng doanh số hôm nay | tháng này, biểu đồ 30 ngày, top 5 — link đúng tab/khoảng', async () => {
    server.use(...salesHandlers(), ...opsHandlers);
    renderApp(<DashboardScreen />, { me: ME_MANAGER });

    const sales = await screen.findByRole('region', { name: 'Doanh số' });
    const revenueRow = (await within(sales).findByRole('rowheader', { name: /Doanh thu/ }))
      .parentElement!;
    // Hôm nay 3tr (▲25% so hôm qua, tô xám vì ngày chưa hết) | tháng 90tr (▼10% so kỳ trước)
    expect(within(revenueRow).getByText('3.000.000 ₫')).toBeInTheDocument();
    expect(within(revenueRow).getByLabelText('Tăng 25,00% so kỳ trước')).toHaveClass(
      'text-muted-foreground',
    );
    expect(within(revenueRow).getByText('90.000.000 ₫')).toBeInTheDocument();
    expect(within(revenueRow).getByLabelText('Giảm 10,00% so kỳ trước')).toHaveClass(
      'text-destructive',
    );
    // Lãi gộp hôm nay = % trên doanh thu
    const profitRow = within(sales).getByRole('rowheader', { name: /Lãi gộp/ }).parentElement!;
    expect(within(profitRow).getByText('30,00% doanh thu')).toBeInTheDocument();
    expect(within(sales).getAllByRole('link', { name: 'Xem báo cáo' })[0]).toHaveAttribute(
      'href',
      `/reports/sales?from=${MONTH_START}&to=${TODAY}`,
    );
    expect(summaryCalls.map((q) => `${q.get('from')}..${q.get('to')}`).sort()).toEqual(
      [`${TODAY}..${TODAY}`, `${MONTH_START}..${TODAY}`].sort(),
    );

    const chart = section('Doanh thu 30 ngày');
    await within(chart).findByText('1.500.000 ₫');
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
    server.use(opsHandlers[0]!, flowHandler);
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
    expect(within(pending).getByText('3 đơn')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Doanh số' })).not.toBeInTheDocument();
    // Không có stock.read: không có ô sắp hết hàng / SKU cần nhập
    expect(screen.queryByRole('region', { name: 'Sản phẩm sắp hết hàng' })).not.toBeInTheDocument();
    expect(screen.queryByText('SKU cần nhập thêm')).not.toBeInTheDocument();
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
    expect(within(ship).getByText('3')).toHaveClass('text-warning');
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
    expect(within(section('Doanh số')).getAllByRole('status').length).toBeGreaterThan(0);
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
      http.get('/api/stock/replenishment', () =>
        HttpResponse.json({ ...LOW_STOCK, items: [], total: 0, alertCount: 0 }),
      ),
      ...salesHandlers({ empty: true }),
      flowHandler,
    );
    renderApp(<DashboardScreen />, { me: ME_MANAGER });
    expect(
      await screen.findByText('Tháng này và kỳ trước chưa có đơn đã chốt'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Không có sản phẩm nào dưới mức tồn')).toBeInTheDocument();
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
    await within(section('Doanh số')).findByText('3.000.000 ₫');
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    await within(top).findByText('Phân bón NPK 1');
  });

  it('tổng đơn hôm nay (gồm đơn hủy) so hôm qua cùng giờ, dải Cần xử lý, sắp hết hàng', async () => {
    server.use(...salesHandlers(), ...opsHandlers);
    renderApp(<DashboardScreen />, { me: ME_MANAGER });

    const today = await screen.findByRole('region', { name: 'Đơn hôm nay' });
    expect(await within(today).findByRole('link', { name: '1.240' })).toHaveAttribute(
      'href',
      `/crm/orders?from=${TODAY}&to=${TODAY}`,
    );
    expect(
      await within(today).findByText(/so với hôm qua cùng giờ \(1\.000\)/),
    ).toBeInTheDocument();
    expect(within(today).getByLabelText('Tăng 24,00% so kỳ trước')).toBeInTheDocument();
    expect(await within(today).findByText('1.500')).toBeInTheDocument();
    expect(within(today).getByText('gồm 18 đơn đã hủy')).toBeInTheDocument();
    expect(
      within(today).getByText('Biểu đồ theo giờ sẽ hiện khi có API đếm đơn theo giờ.'),
    ).toBeInTheDocument();

    const low = section('Sản phẩm sắp hết hàng');
    await within(low).findByText('Amino GA3 kích ra rễ, chai 500 ml');
    expect(within(low).getByText('Hết hàng')).toBeInTheDocument();

    const todo = section('Cần xử lý');
    const tile = async (label: string) =>
      (await within(todo).findByText(label)).closest('a') as HTMLAnchorElement | null;
    expect(await tile('Đơn chờ duyệt')).toHaveAttribute(
      'href',
      '/crm/orders?flow=PENDING_APPROVAL',
    );
    await within(todo).findByText('48');
    expect(await tile('Chờ xử lý kho')).toHaveTextContent('48');
    // Chưa gán hãng = đơn còn ở kho chưa chọn hãng (5 + 2 + 1), không tính đơn đã giao
    expect(await tile('Chưa gán ĐVVC')).toHaveTextContent('8');
    expect(await tile('SKU cần nhập thêm')).toHaveAttribute('href', '/wms/reorder-points');
    expect(within(todo).getByText('14')).toBeInTheDocument();
    // Sự cố chưa có API: không link, không số giả
    expect(await tile('Sự cố / hoàn hàng · chờ API')).toBeNull();
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
