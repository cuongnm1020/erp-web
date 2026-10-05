import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftDay } from '@/components/data/date-range-picker';
import type { CsvCell } from '@/lib/export-csv';
import { toLocalDateKey } from '@/lib/format';
import { errorEnvelope, ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type {
  SalesByProduct,
  SalesByStaff,
  SalesKpis,
  SalesSummary,
  SalesTimeseries,
  SalesTopProducts,
} from './api/use-sales-report';
import { SalesReportScreen } from './components/sales-report-screen';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/reports/sales',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

/** Trưởng nhóm: xem báo cáo (phạm vi team do API scope), không có report.sales_all. */
const ME_LEADER = { permissions: ['report.sales', 'customer.read'], hasGlobalAccess: false };

const RANGE = { from: '2026-10-01', to: '2026-10-03' };
const PREV = { previousFrom: '2026-09-28', previousTo: '2026-09-30' };

const kpis = (over: Partial<SalesKpis> = {}): SalesKpis => ({
  revenue: '3000000.0000',
  orderCount: 12,
  aov: '250000.0000',
  grossProfit: '900000.0000',
  cogs: '2100000.0000',
  returnedRevenue: '100000.0000',
  customerCount: 9,
  newCustomerCount: 2,
  ...over,
});

const SUMMARY: SalesSummary = {
  ...RANGE,
  ...PREV,
  current: kpis(),
  previous: kpis({
    revenue: '2400000.0000',
    orderCount: 10,
    aov: '240000.0000',
    returnedRevenue: '50000.0000',
  }),
  dataAsOf: '2026-10-03T08:15:00.000Z',
};

const point = (period: string, revenue: string, orderCount: number) => ({
  period,
  revenue,
  orderCount,
  aov: '250000.0000',
  grossProfit: '300000.0000',
  returnedRevenue: '0.0000',
});

const SERIES: SalesTimeseries = {
  ...RANGE,
  ...PREV,
  granularity: 'day',
  points: [
    point('2026-10-01', '1000000.0000', 4),
    point('2026-10-02', '1500000.0000', 6),
    point('2026-10-03', '500000.0000', 2),
  ],
  previousPoints: [
    point('2026-09-28', '800000.0000', 3),
    point('2026-09-29', '1000000.0000', 4),
    point('2026-09-30', '600000.0000', 3),
  ],
  totals: {
    revenue: '3000000.0000',
    orderCount: 12,
    aov: '250000.0000',
    grossProfit: '900000.0000',
    returnedRevenue: '100000.0000',
  },
  previousTotals: {
    revenue: '2400000.0000',
    orderCount: 10,
    aov: '240000.0000',
    grossProfit: '700000.0000',
    returnedRevenue: '50000.0000',
  },
  dataAsOf: null,
};

const productItem = (i: number, over: Partial<SalesByProduct['items'][number]> = {}) => ({
  key: { id: `cat-${i}`, code: `DM${i}`, name: `Danh mục ${i}` },
  qty: '10.000000',
  revenue: `${1000000 - i * 1000}.0000`,
  cogs: '600000.0000',
  grossProfit: '400000.0000',
  marginPct: '40.00',
  sharePct: '25.00',
  orderCount: 5,
  previousRevenue: '800000.0000',
  growthPct: '25.00',
  ...over,
});

const byProduct = (items: SalesByProduct['items'], total = items.length): SalesByProduct => ({
  ...RANGE,
  ...PREV,
  groupBy: 'category',
  items,
  total,
  totals: {
    qty: '30.000000',
    revenue: '3000000.0000',
    cogs: '1800000.0000',
    grossProfit: '1200000.0000',
    marginPct: '40.00',
    previousRevenue: '2400000.0000',
    growthPct: '25.00',
  },
  dataAsOf: null,
});

const staffItem = (id: string | null, name: string, revenue: string) => ({
  key: { id, name },
  revenue,
  orderCount: 4,
  aov: '250000.0000',
  grossProfit: '300000.0000',
  customerCount: 3,
  newCustomerCount: 1,
  returnedRevenue: '0.0000',
  returnedOrderCount: 0,
  returnRate: null,
  previousRevenue: '900000.0000',
  growthPct: '-10.00',
});

const BY_STAFF: SalesByStaff = {
  ...RANGE,
  ...PREV,
  groupBy: 'owner',
  items: [
    staffItem('u-1', 'Trần Thị Sale', '2000000.0000'),
    staffItem(null, 'Chưa gán', '1000000.0000'),
  ],
  totals: {
    revenue: '3000000.0000',
    orderCount: 8,
    aov: '375000.0000',
    grossProfit: '600000.0000',
    customerCount: 6,
    newCustomerCount: 2,
    returnedRevenue: '0.0000',
    returnedOrderCount: 0,
    returnRate: null,
    previousRevenue: '1800000.0000',
    growthPct: '66.67',
  },
  dataAsOf: null,
};

const topItem = (rank: number, previousRank: number | null) => ({
  rank,
  sku: { id: `sku-${rank}`, code: `SKU-${rank}`, name: `Phân bón NPK ${rank}` },
  product: { id: `p-${rank}`, name: `NPK ${rank}` },
  qty: '20.000000',
  revenue: '500000.0000',
  grossProfit: '100000.0000',
  orderCount: 6,
  customerCount: 4,
  value: '500000.0000',
  previousRank,
  previousValue: previousRank === null ? null : '400000.0000',
  growthPct: previousRank === null ? null : '25.00',
});

const TOP: SalesTopProducts = {
  ...RANGE,
  ...PREV,
  rankBy: 'revenue',
  items: [topItem(1, 3), topItem(2, 1), topItem(3, null)],
  dataAsOf: null,
};

const optionHandlers = [
  http.get('/api/teams', () =>
    HttpResponse.json([
      { id: 't-1', code: 'HN', name: 'Team Hà Nội', type: 'SALES', parentId: null },
      { id: 't-wh', code: 'WH', name: 'Kho', type: 'WAREHOUSE', parentId: null },
    ]),
  ),
];

/** downloadCsv bị mock (jsdom không tải file được) — giữ nội dung CSV thật qua toCsv. */
const downloads: Array<{ filename: string; text: string }> = [];
vi.mock('@/lib/export-csv', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/export-csv')>();
  return {
    ...real,
    downloadCsv: (filename: string, header: string[], rows: CsvCell[][]) =>
      downloads.push({ filename, text: real.toCsv(header, rows) }),
  };
});

beforeEach(() => {
  replace.mockReset();
  downloads.length = 0;
  server.use(...optionHandlers);
});

const lastUrl = () => new URLSearchParams(String(replace.mock.calls.at(-1)?.[0]).split('?')[1]);

describe('SalesReportScreen — quyền + bộ lọc chung', () => {
  it('thiếu report.sales → màn không có quyền, không gọi API', () => {
    search = '';
    renderApp(<SalesReportScreen />, { me: ME_SALE });
    expect(screen.getByText(/không có quyền/i)).toBeInTheDocument();
  });

  it('preset "Hôm qua" ghi from = to = hôm qua lên URL (một ngày)', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}`;
    server.use(
      http.get('/api/reports/sales/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await screen.findByText('Doanh thu theo thời gian');
    fireEvent.click(screen.getByRole('button', { name: 'Hôm qua' }));
    const y = shiftDay(toLocalDateKey(new Date())!, -1);
    expect(lastUrl().get('from')).toBe(y);
    expect(lastUrl().get('to')).toBe(y);
    // Khoảng không khớp preset → hiện "Tùy chọn"
    expect(screen.getByText('Tùy chọn')).toBeInTheDocument();
  });

  it('kênh / team trên URL đi vào query; trưởng nhóm không có ô chọn team nhưng thấy chip + bỏ được', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}&channel=MARKETPLACE&teamId=t-1&teamName=Team%20H%C3%A0%20N%E1%BB%99i`;
    const calls: URLSearchParams[] = [];
    server.use(
      http.get('/api/reports/sales/summary', ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return HttpResponse.json(SUMMARY);
      }),
      http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await screen.findByText('Doanh thu theo thời gian');
    expect(calls[0]!.get('channel')).toBe('MARKETPLACE');
    expect(calls[0]!.get('teamId')).toBe('t-1');
    expect(screen.queryByRole('combobox', { name: 'Team' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Team: Team Hà Nội' }));
    expect(lastUrl().get('teamId')).toBeNull();
    expect(lastUrl().get('channel')).toBe('MARKETPLACE');
  });

  it('"Tính lại số liệu" chỉ cho report.sales_all: POST khoảng đang xem → toast', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}`;
    let body: unknown = null;
    server.use(
      http.get('/api/reports/sales/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
      http.post('/api/reports/sales/rollup/rebuild', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...RANGE, days: 3 }, { status: 202 });
      }),
    );
    const { unmount } = renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await screen.findByText('Doanh thu theo thời gian');
    expect(screen.queryByRole('button', { name: /Tính lại số liệu/ })).not.toBeInTheDocument();
    unmount();

    renderApp(<SalesReportScreen />);
    // Admin có ô chọn team (chỉ team bán hàng) + nhân viên
    expect(await screen.findByRole('combobox', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Nhân viên phụ trách' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tính lại số liệu/ }));
    await waitFor(() => expect(body).toEqual(RANGE));
  });

  it('URL quá 366 ngày → cắt from cho vừa trần API (không bắn 422)', async () => {
    search = 'from=2024-01-01&to=2026-10-03';
    const calls: URLSearchParams[] = [];
    server.use(
      http.get('/api/reports/sales/summary', ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return HttpResponse.json(SUMMARY);
      }),
      http.get('/api/reports/sales/timeseries', ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return HttpResponse.json({ ...SERIES, granularity: 'month' });
      }),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(2));
    expect(calls[0]!.get('from')).toBe('2025-10-03');
    expect(calls.find((c) => c.has('granularity'))!.get('granularity')).toBe('month');
  });
});

describe('Tab Tổng quan theo thời gian', () => {
  it('KPI so kỳ trước (▲ %), biểu đồ, bảng từng kỳ, dataAsOf', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}`;
    server.use(
      http.get('/api/reports/sales/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(await screen.findByText('Doanh thu theo thời gian')).toBeInTheDocument();
    // Doanh thu 3.000.000 vs 2.400.000 → ▲ 25,00%
    expect(screen.getAllByLabelText('Tăng 25,00% so kỳ trước').length).toBeGreaterThan(0);
    // Hàng hoàn tăng (100k vs 50k) là xấu → vẫn ▲ nhưng đỏ
    const returned = screen.getByLabelText('Tăng 100,00% so kỳ trước');
    expect(returned).toHaveClass('text-destructive');
    expect(screen.getByText(/Số liệu tính đến/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /kỳ này so kỳ trước/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-hit')).toHaveLength(3);
    // Bảng: kỳ 02/10 doanh thu 1.500.000 so 1.000.000 → ▲ 50%
    const row = screen.getByRole('cell', { name: '02/10' }).closest('tr')!;
    expect(within(row).getByLabelText('Tăng 50,00% so kỳ trước')).toBeInTheDocument();
  });

  it('hover điểm biểu đồ → tooltip kỳ này / kỳ trước', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}`;
    server.use(
      http.get('/api/reports/sales/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await screen.findByText('Doanh thu theo thời gian');
    fireEvent.mouseEnter(screen.getAllByTestId('chart-hit')[1]!);
    const tip = screen.getByRole('tooltip');
    expect(within(tip).getByText('Kỳ trước (29/09)')).toBeInTheDocument();
    expect(within(tip).getByText(/1\.500\.000/)).toBeInTheDocument();
  });

  it('đổi chỉ số / độ chia ghi lên URL; độ chia đi vào query', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}&gran=week`;
    const grans: string[] = [];
    server.use(
      http.get('/api/reports/sales/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/api/reports/sales/timeseries', ({ request }) => {
        grans.push(new URL(request.url).searchParams.get('granularity')!);
        return HttpResponse.json({ ...SERIES, granularity: 'week' });
      }),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await screen.findByText('Doanh thu theo thời gian');
    expect(grans[0]).toBe('week');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Chỉ số trên biểu đồ' })).getByRole('button', {
        name: 'Lãi gộp',
      }),
    );
    expect(lastUrl().get('metric')).toBe('grossProfit');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Độ chia' })).getByRole('button', { name: 'Tháng' }),
    );
    expect(lastUrl().get('gran')).toBe('month');
  });

  it('xuất CSV bảng kỳ: BOM + tiêu đề + số thô', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}`;
    server.use(
      http.get('/api/reports/sales/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await screen.findByText('Doanh thu theo thời gian');
    fireEvent.click(screen.getByRole('button', { name: /Xuất CSV/ }));
    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.filename).toBe('doanh-thu-theo-ngay_2026-10-01_2026-10-03');
    const text = downloads[0]!.text;
    expect(text).toContain('Kỳ (ngày đầu),Doanh thu,Số đơn');
    expect(text).toContain('2026-10-02,1500000,6,250000,300000,0,2026-09-29,1000000,50.00');
  });

  it('kỳ này và kỳ trước đều không có đơn → EmptyState kèm một hành động', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}`;
    const zero = kpis({ revenue: '0.0000', orderCount: 0, customerCount: 0 });
    server.use(
      http.get('/api/reports/sales/summary', () =>
        HttpResponse.json({ ...SUMMARY, current: zero, previous: zero }),
      ),
      http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(await screen.findByText(/Chưa có đơn đã chốt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem từ đầu năm' }));
    expect(lastUrl().get('from')).toMatch(/^\d{4}-01-01$/);
  });

  it('đang tải → skeleton; lỗi 500 → ErrorState có traceId', async () => {
    search = `from=${RANGE.from}&to=${RANGE.to}`;
    server.use(
      http.get('/api/reports/sales/summary', () => errorEnvelope(500, 'DB_ERROR')),
      http.get('/api/reports/sales/timeseries', () => HttpResponse.json(SERIES)),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(screen.getByRole('status', { name: 'Đang tải báo cáo' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });
});

describe('Tab Sản phẩm', () => {
  afterEach(() => {
    search = '';
  });

  it('nhóm theo danh mục, dòng "Chưa phân loại", sắp xếp + phân trang phía server', async () => {
    search = `tab=product&group=category&from=${RANGE.from}&to=${RANGE.to}&sort=qty:desc&page=2&size=20`;
    const calls: URLSearchParams[] = [];
    server.use(
      http.get('/api/reports/sales/by-product', ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return HttpResponse.json(
          byProduct(
            [
              productItem(1),
              productItem(2, {
                key: { id: null, code: null, name: 'Chưa phân loại' },
                growthPct: null,
                previousRevenue: '0.0000',
              }),
            ],
            42,
          ),
        );
      }),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(await screen.findByRole('cell', { name: /Danh mục 1/ })).toBeInTheDocument();
    expect(calls[0]!.get('groupBy')).toBe('category');
    expect(calls[0]!.get('sort')).toBe('qty');
    expect(calls[0]!.get('order')).toBe('desc');
    expect(calls[0]!.get('skip')).toBe('20');
    expect(calls[0]!.get('take')).toBe('20');
    const unassigned = screen.getAllByText('Chưa phân loại').find((el) => el.closest('td'))!;
    expect(unassigned).toHaveClass('italic');
    // growthPct null nhưng có doanh thu → "Mới"
    expect(within(unassigned.closest('tr')!).getByText('Mới')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /SL bán/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    fireEvent.click(screen.getByRole('button', { name: /Sắp xếp theo Lãi gộp/ }));
    expect(lastUrl().get('sort')).toBe('grossProfit');
    expect(lastUrl().get('page')).toBeNull();
  });

  it('xuất CSV lặp trang 200 tới hết total', async () => {
    search = `tab=product&from=${RANGE.from}&to=${RANGE.to}`;
    const skips: string[] = [];
    server.use(
      http.get('/api/reports/sales/by-product', ({ request }) => {
        const sp = new URL(request.url).searchParams;
        const take = Number(sp.get('take'));
        const skip = Number(sp.get('skip'));
        if (take === 200) skips.push(String(skip));
        const n = Math.max(0, Math.min(take, 250 - skip));
        return HttpResponse.json(
          byProduct(
            Array.from({ length: n }, (_, i) => productItem(skip + i)),
            250,
          ),
        );
      }),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await screen.findByRole('cell', { name: /Danh mục 1\b/ });
    fireEvent.click(screen.getByRole('button', { name: /Xuất CSV/ }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(skips).toEqual(['0', '200']);
    const lines = downloads[0]!.text.split('\r\n');
    expect(lines).toHaveLength(251);
  });

  it('không có kết quả cho từ khóa → EmptyState "Xóa từ khóa"', async () => {
    search = `tab=product&q=xyz&from=${RANGE.from}&to=${RANGE.to}`;
    server.use(http.get('/api/reports/sales/by-product', () => HttpResponse.json(byProduct([]))));
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(await screen.findByText(/Không có SKU khớp/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa từ khóa' }));
    expect(lastUrl().get('q')).toBeNull();
  });

  it('lỗi 500 → ErrorState có traceId', async () => {
    search = `tab=product&from=${RANGE.from}&to=${RANGE.to}`;
    server.use(http.get('/api/reports/sales/by-product', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText('trace-db_error')).toBeInTheDocument();
  });
});

describe('Tab Nhân viên', () => {
  it('dòng "Chưa gán" không có nút Lọc; bấm Lọc trên người → ownerId + tên lên URL', async () => {
    search = `tab=staff&from=${RANGE.from}&to=${RANGE.to}`;
    const groups: string[] = [];
    server.use(
      http.get('/api/reports/sales/by-staff', ({ request }) => {
        groups.push(new URL(request.url).searchParams.get('groupBy')!);
        return HttpResponse.json(BY_STAFF);
      }),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    const cell = await screen.findByRole('cell', { name: 'Trần Thị Sale' });
    expect(groups[0]).toBe('owner');
    const unassigned = screen.getAllByText('Chưa gán').find((el) => el.closest('td'))!;
    expect(within(unassigned.closest('tr')!).queryByRole('button')).not.toBeInTheDocument();
    expect(
      within(cell.closest('tr')!).getByLabelText('Giảm 10,00% so kỳ trước'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉ xem số của Trần Thị Sale' }));
    expect(lastUrl().get('ownerId')).toBe('u-1');
    expect(lastUrl().get('ownerName')).toBe('Trần Thị Sale');
    expect(lastUrl().get('tab')).toBe('staff');
  });

  it('rỗng → EmptyState chuyển sang xem theo team; lỗi → traceId', async () => {
    search = `tab=staff&from=${RANGE.from}&to=${RANGE.to}`;
    server.use(
      http.get('/api/reports/sales/by-staff', () => HttpResponse.json({ ...BY_STAFF, items: [] })),
    );
    const { unmount } = renderApp(<SalesReportScreen />, { me: ME_LEADER });
    fireEvent.click(await screen.findByRole('button', { name: 'Xem theo team' }));
    expect(lastUrl().get('staff')).toBe('team');
    unmount();

    server.use(http.get('/api/reports/sales/by-staff', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(await screen.findByText('trace-db_error')).toBeInTheDocument();
  });
});

describe('Tab Bán chạy', () => {
  it('hạng + thay đổi hạng (▲ / ▼ / Mới), tiêu chí + top N đi vào query', async () => {
    search = `tab=top&rank=qty&limit=50&from=${RANGE.from}&to=${RANGE.to}`;
    const calls: URLSearchParams[] = [];
    server.use(
      http.get('/api/reports/sales/top-products', ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return HttpResponse.json({ ...TOP, rankBy: 'qty' });
      }),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(await screen.findByText('Phân bón NPK 1')).toBeInTheDocument();
    expect(calls[0]!.get('rankBy')).toBe('qty');
    expect(calls[0]!.get('limit')).toBe('50');
    expect(screen.getByLabelText('Lên 2 hạng, kỳ trước hạng 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Xuống 1 hạng, kỳ trước hạng 1')).toBeInTheDocument();
    expect(screen.getAllByText('Mới').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: 'Số lượng kỳ trước' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Số khách' }));
    expect(lastUrl().get('rank')).toBe('customers');
  });

  it('rỗng → EmptyState; lỗi → traceId', async () => {
    search = `tab=top&from=${RANGE.from}&to=${RANGE.to}`;
    server.use(
      http.get('/api/reports/sales/top-products', () => HttpResponse.json({ ...TOP, items: [] })),
    );
    const { unmount } = renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(await screen.findByText('Chưa có SKU nào bán ra trong khoảng này')).toBeInTheDocument();
    unmount();
    server.use(http.get('/api/reports/sales/top-products', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    expect(await screen.findByText('trace-db_error')).toBeInTheDocument();
  });

  it('đổi tab giữ bộ lọc chung, bỏ trang / tìm của tab cũ', async () => {
    search = `tab=product&q=abc&page=3&channel=POS&from=${RANGE.from}&to=${RANGE.to}`;
    server.use(
      http.get('/api/reports/sales/by-product', () =>
        HttpResponse.json(byProduct([productItem(1)])),
      ),
    );
    renderApp(<SalesReportScreen />, { me: ME_LEADER });
    await screen.findByRole('cell', { name: /Danh mục 1/ });
    fireEvent.click(screen.getByRole('tab', { name: 'Bán chạy' }));
    const url = lastUrl();
    expect(url.get('tab')).toBe('top');
    expect(url.get('channel')).toBe('POS');
    expect(url.get('q')).toBeNull();
    expect(url.get('page')).toBeNull();
    // Không có tab Nhà cung cấp chết (chờ RPT-05c)
    expect(screen.queryByRole('tab', { name: 'Nhà cung cấp' })).not.toBeInTheDocument();
  });
});
