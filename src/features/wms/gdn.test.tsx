import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { GdnDetailScreen } from './components/gdn-detail-screen';
import { GdnListScreen } from './components/gdn-list-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/gdn',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  docNumber: `GDN2609-0000${id}`,
  kind: 'SALES',
  status: 'DRAFT',
  warehouseId: 'wh-1',
  warehouseName: 'Kho HN-1',
  refType: 'SalesOrder',
  refId: `so-${id}`,
  lineCount: 2,
  totalQtyPlanned: '120',
  totalQtyDone: '0',
  pickStatus: 'PENDING',
  packStatus: null,
  createdAt: '2026-09-02T08:00:00.000Z',
  postedAt: null,
  ...extra,
});

const LIST = {
  items: [
    row('1'), // Chờ pick
    row('2', { pickStatus: 'IN_PROGRESS' }), // Đang pick
    row('3', { pickStatus: 'COMPLETED', packStatus: 'PENDING' }), // Đang đóng gói
    row('4', {
      status: 'POSTED',
      pickStatus: 'COMPLETED',
      packStatus: 'COMPLETED',
      totalQtyDone: '118',
      postedAt: '2026-09-02T10:00:00.000Z',
    }),
  ],
  total: 4,
  statusCounts: { DRAFT: 3, POSTED: 1, CANCELLED: 0 },
};

const DETAIL = {
  id: 'gi-4',
  docNumber: 'GDN2609-00004',
  kind: 'SALES',
  status: 'POSTED',
  warehouseId: 'wh-1',
  warehouseName: 'Kho HN-1',
  refType: 'SalesOrder',
  refId: 'so-4',
  note: null,
  createdAt: '2026-09-02T08:00:00.000Z',
  postedAt: '2026-09-02T10:00:00.000Z',
  postedByName: 'Phạm Thị Hoa',
  pickStatus: 'COMPLETED',
  packStatus: 'COMPLETED',
  lineCount: 2,
  lines: [
    {
      id: 'l-1',
      lineNo: 1,
      skuId: 'sku-1',
      skuCode: 'TL08-BLUE',
      skuName: 'Bút bi Thiên Long TL-08 xanh',
      lotNumber: 'L2605',
      locationCode: 'A-03-02-B',
      qtyPlanned: '48',
      qtyDone: '48',
      exceptionNote: null,
    },
    {
      id: 'l-2',
      lineNo: 2,
      skuId: 'sku-2',
      skuCode: 'TL08-RED',
      skuName: 'Bút bi Thiên Long TL-08 đỏ',
      lotNumber: null,
      locationCode: null,
      qtyPlanned: '72',
      qtyDone: '0',
      exceptionNote: 'Thiếu tồn 72 (dòng 2)',
    },
  ],
};

describe('GdnListScreen — GET /goods-issues', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/warehouses', () =>
        HttpResponse.json([
          { id: 'wh-1', code: 'WH01', name: 'Kho HN-1', address: null, isActive: true },
        ]),
      ),
      http.get('/api/goods-issues', () => HttpResponse.json(LIST)),
    );
  });

  it('vòng đời suy từ task: Chờ pick / Đang pick / Đang đóng gói / Đã post — không đọc cột nào khác', async () => {
    renderApp(<GdnListScreen />);
    expect(await screen.findByText('GDN2609-00001')).toBeInTheDocument();
    expect(screen.getByText('Chờ pick')).toBeInTheDocument();
    expect(screen.getByText('Đang pick')).toBeInTheDocument();
    expect(screen.getByText('Đang đóng gói')).toBeInTheDocument();
    expect(screen.getAllByText('Đã post').length).toBeGreaterThan(0);
    // SL đã xuất chỉ hiện với phiếu đã post
    expect(screen.getByText('118')).toBeInTheDocument();
    // Tab đếm từ statusCounts
    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getByText('4')).toBeInTheDocument();
    expect(within(tablist).getByText('3')).toBeInTheDocument();
  });

  it('màn chỉ đọc: không có nút tạo phiếu; tham chiếu link sang đơn bán theo id', async () => {
    renderApp(<GdnListScreen />);
    await screen.findByText('GDN2609-00001');
    expect(screen.queryByRole('button', { name: /Tạo phiếu/ })).not.toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Đơn bán' });
    expect(links[0]).toHaveAttribute('href', '/crm/orders/so-1');
  });
});

describe('GdnDetailScreen — GET /goods-issues/:id', () => {
  it('phiếu POSTED: banner bất biến, dòng ngoại lệ thiếu tồn nói thật qtyDone=0', async () => {
    server.use(http.get('/api/goods-issues/:id', () => HttpResponse.json(DETAIL)));
    renderApp(<GdnDetailScreen id="gi-4" />);
    expect(await screen.findByText('Bút bi Thiên Long TL-08 xanh')).toBeInTheDocument();
    expect(screen.getByText(/Tồn đã trừ trong chính transaction đóng gói/)).toBeInTheDocument();
    expect(screen.getByText(/1 dòng ngoại lệ/)).toBeInTheDocument();
    expect(screen.getByText('Thiếu tồn 72 (dòng 2)')).toBeInTheDocument();
    expect(screen.getByText('A-03-02-B')).toBeInTheDocument();
    expect(screen.getByText('Phạm Thị Hoa', { exact: false })).toBeInTheDocument();
  });

  it('phiếu DRAFT: không có banner post, trạng thái Đang đóng gói (chưa trừ tồn)', async () => {
    server.use(
      http.get('/api/goods-issues/:id', () =>
        HttpResponse.json({
          ...DETAIL,
          status: 'DRAFT',
          postedAt: null,
          postedByName: null,
          packStatus: 'PENDING',
          lines: [{ ...DETAIL.lines[0], qtyDone: '0' }],
        }),
      ),
    );
    renderApp(<GdnDetailScreen id="gi-4" />);
    await screen.findByText('Bút bi Thiên Long TL-08 xanh');
    expect(screen.getByText('Đang đóng gói')).toBeInTheDocument();
    // Chưa post → không khoe số đã xuất
    expect(screen.queryByText(/Tồn đã trừ trong chính transaction/)).not.toBeInTheDocument();
  });
});
