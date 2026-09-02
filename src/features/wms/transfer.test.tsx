import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { TransferScreen } from './components/transfer-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/transfers',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  docNumber: `TRF2609-0000${id}`,
  status: 'DRAFT',
  stage: 'DRAFT',
  fromWarehouseName: 'Kho HN-1',
  toWarehouseName: 'Kho HCM-2',
  lineCount: 2,
  totalQtyShipped: '1064',
  discrepancyLineCount: 0,
  createdAt: '2026-09-02T08:00:00.000Z',
  dispatchedAt: null,
  postedAt: null,
  ...extra,
});

const LIST = {
  items: [
    row('1'),
    row('2', { stage: 'IN_TRANSIT', dispatchedAt: '2026-09-02T09:00:00.000Z' }),
    row('3', { status: 'POSTED', stage: 'POSTED', discrepancyLineCount: 1 }),
  ],
  total: 3,
  stageCounts: { DRAFT: 1, IN_TRANSIT: 1, POSTED: 1, CANCELLED: 0 },
};

const line = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  lineNo: 1,
  skuId: `sku-${id}`,
  skuCode: `DA-A4-80`,
  skuName: 'Giấy A4 Double A 80gsm',
  lotNumber: 'L2608',
  fromLocationCode: 'B-01-01-A',
  toLocationCode: null,
  qtyShipped: '120',
  qtyReceived: null,
  discrepancy: null,
  discrepancyNote: null,
  ...extra,
});

const DETAIL_IN_TRANSIT = {
  id: 'trf-2',
  docNumber: 'TRF2609-00002',
  status: 'DRAFT',
  stage: 'IN_TRANSIT',
  fromWarehouseId: 'wh-1',
  fromWarehouseName: 'Kho HN-1',
  toWarehouseId: 'wh-2',
  toWarehouseName: 'Kho HCM-2',
  issueDocNumber: 'GDN2609-00080',
  receiptDocNumber: null,
  expectedAt: null,
  note: null,
  createdAt: '2026-09-02T08:00:00.000Z',
  createdByName: 'Lê Minh Hùng',
  dispatchedAt: '2026-09-02T09:00:00.000Z',
  dispatchedByName: 'Trần Văn Bảo',
  postedAt: null,
  postedByName: null,
  lineCount: 1,
  totalQtyShipped: '120',
  totalQtyReceived: null,
  lines: [line('l1')],
};

const DEST_TREE = [
  {
    id: 'loc-b02',
    warehouseId: 'wh-2',
    parentId: null,
    code: 'HCM-B-02',
    type: 'BIN',
    barcode: null,
    pickSequence: 10,
    isPickable: true,
    isActive: true,
    fixedSkuIds: [],
    fixedSkus: [],
    children: [],
  },
];

describe('TransferScreen — /transfers', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/warehouses', () =>
        HttpResponse.json([
          { id: 'wh-1', code: 'WH01', name: 'Kho HN-1', address: null, isActive: true },
          { id: 'wh-2', code: 'WH02', name: 'Kho HCM-2', address: null, isActive: true },
          { id: 'wh-t', code: 'TRANSIT', name: 'Kho trung chuyển', address: null, isActive: true },
        ]),
      ),
      http.get('/api/transfers', () => HttpResponse.json(LIST)),
    );
  });

  it('danh sách: tuyến kho, dòng lệch đỏ, tab đếm theo stageCounts (DRAFT/IN_TRANSIT tách nhau)', async () => {
    search = '';
    renderApp(<TransferScreen />);
    expect(await screen.findByText('TRF2609-00001')).toBeInTheDocument();
    // 'Nháp'/'Đã nhận' xuất hiện ở cả tab lẫn badge dòng
    expect(screen.getAllByText('Nháp').length).toBeGreaterThan(1);
    expect(screen.getByText('Đã xuất · chờ nhận')).toBeInTheDocument();
    expect(screen.getAllByText('Đã nhận').length).toBeGreaterThan(1);
    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getByText('3')).toBeInTheDocument(); // Tất cả
    expect(within(tablist).getByText('Đang trung chuyển')).toBeInTheDocument();
  });

  it('tạo phiếu: chọn kho (KHÔNG có kho trung chuyển), SKU + vị trí nguồn + SL → POST /transfers', async () => {
    search = '';
    const posts: unknown[] = [];
    server.use(
      http.get('/api/skus', () =>
        HttpResponse.json({
          items: [
            {
              skuId: 'sku-1',
              code: 'DA-A4-80',
              name: 'Giấy A4 Double A 80gsm',
              productId: 'p1',
              productCode: 'DA',
              productName: 'Giấy A4',
              categoryName: null,
              brandName: null,
              baseUomCode: 'REAM',
              barcodeCount: 0,
              isActive: true,
              thumbnailUrl: null,
              onHand: '0',
              reserved: '0',
              available: '0',
            },
          ],
          total: 1,
        }),
      ),
      http.get('/api/warehouses/:id/locations/tree', () =>
        HttpResponse.json([
          { ...DEST_TREE[0], id: 'loc-a01', warehouseId: 'wh-1', code: 'HN-A-01' },
        ]),
      ),
      http.post('/api/transfers', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(
          { transferId: 'trf-9', docNumber: 'TRF2609-00009', stage: 'DRAFT', legDocNumber: null },
          { status: 201 },
        );
      }),
    );
    renderApp(<TransferScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Tạo phiếu chuyển/ }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Từ kho' }));
    // Kho ảo bị loại khỏi lựa chọn
    expect(screen.queryByRole('option', { name: 'Kho trung chuyển' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Đến kho' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HCM-2' }));

    fireEvent.click(within(dialog).getByText('Tìm SKU…'));
    fireEvent.click(await screen.findByText('Giấy A4 Double A 80gsm'));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Vị trí nguồn dòng 1' }));
    fireEvent.click(await screen.findByRole('option', { name: 'HN-A-01' }));
    fireEvent.change(within(dialog).getByLabelText('Số lượng dòng 1'), {
      target: { value: '120' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo phiếu chuyển' }));
    await waitFor(() =>
      expect(posts).toEqual([
        {
          fromWarehouseId: 'wh-1',
          toWarehouseId: 'wh-2',
          lines: [{ skuId: 'sku-1', fromLocationId: 'loc-a01', qty: '120' }],
        },
      ]),
    );
  });

  it('đang trung chuyển: banner kho ảo + nhận thiếu kèm lý do → POST :id/receive đúng body', async () => {
    search = 'trf=trf-2';
    const receives: unknown[] = [];
    server.use(
      http.get('/api/transfers/:id', () => HttpResponse.json(DETAIL_IN_TRANSIT)),
      http.get('/api/warehouses/:id/locations/tree', () => HttpResponse.json(DEST_TREE)),
      http.post('/api/transfers/:id/receive', async ({ request }) => {
        receives.push(await request.json());
        return HttpResponse.json({
          transferId: 'trf-2',
          docNumber: 'TRF2609-00002',
          stage: 'POSTED',
          legDocNumber: 'GRN2609-00120',
        });
      }),
    );
    renderApp(<TransferScreen />);
    expect(await screen.findByText(/Hàng đang trung chuyển/)).toBeInTheDocument();
    expect(screen.getByText(/tổng tồn toàn hệ thống không đổi/)).toBeInTheDocument();
    // Bước 1 đã xong, chứng từ chân xuất hiện trên strip
    expect(screen.getByText(/GDN2609-00080 đã post/)).toBeInTheDocument();

    // Nhận thiếu 118/120 kèm lý do + vị trí đích
    fireEvent.change(screen.getByLabelText('SL nhận dòng 1'), { target: { value: '118' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Vị trí đích dòng 1' }));
    fireEvent.click(await screen.findByRole('option', { name: 'HCM-B-02' }));
    fireEvent.change(screen.getByLabelText('Lý do dòng 1'), {
      target: { value: 'Vỡ 2 thùng trên xe' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đã nhận tại Kho HCM-2/ }));
    await waitFor(() =>
      expect(receives).toEqual([
        {
          lines: [
            {
              lineId: 'l1',
              qtyReceived: '118',
              toLocationId: 'loc-b02',
              discrepancyNote: 'Vỡ 2 thùng trên xe',
            },
          ],
        },
      ]),
    );
  });

  it('phiếu nháp: nút Xuất khỏi kho → POST :id/dispatch; không có form nhận', async () => {
    search = 'trf=trf-1';
    const dispatched: string[] = [];
    server.use(
      http.get('/api/transfers/:id', () =>
        HttpResponse.json({
          ...DETAIL_IN_TRANSIT,
          id: 'trf-1',
          docNumber: 'TRF2609-00001',
          stage: 'DRAFT',
          issueDocNumber: null,
          dispatchedAt: null,
          dispatchedByName: null,
        }),
      ),
      http.post('/api/transfers/:id/dispatch', ({ params }) => {
        dispatched.push(params.id as string);
        return HttpResponse.json({
          transferId: params.id,
          docNumber: 'TRF2609-00001',
          stage: 'IN_TRANSIT',
          legDocNumber: 'GDN2609-00081',
        });
      }),
    );
    renderApp(<TransferScreen />);
    await screen.findByText('Giấy A4 Double A 80gsm');
    expect(screen.queryByLabelText('SL nhận dòng 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xuất khỏi Kho HN-1/ }));
    await waitFor(() => expect(dispatched).toEqual(['trf-1']));
  });

  it('không có stock.transfer → không thấy nút tạo/xuất (luật 7)', async () => {
    search = 'trf=trf-1';
    server.use(
      http.get('/api/transfers/:id', () =>
        HttpResponse.json({ ...DETAIL_IN_TRANSIT, id: 'trf-1', stage: 'DRAFT' }),
      ),
    );
    renderApp(<TransferScreen />, {
      me: { ...ME_SALE, permissions: ['stock.read'] },
    });
    await screen.findByText('Giấy A4 Double A 80gsm');
    expect(screen.queryByRole('button', { name: /Tạo phiếu chuyển/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xuất khỏi/ })).not.toBeInTheDocument();
  });
});
