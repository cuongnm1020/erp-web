import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { GrnCreateScreen } from './components/grn-create-screen';
import { GrnDetailScreen } from './components/grn-detail-screen';
import { GrnListScreen } from './components/grn-list-screen';

// Radix Select cần ResizeObserver — jsdom không có
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Toast không render trong harness → mock để kiểm câu báo khi quét mã lạ.
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/grn',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const WAREHOUSES = [{ id: 'wh-1', code: 'WH01', name: 'Kho HN-1', address: null, isActive: true }];

const LIST = {
  items: [
    {
      id: 'r-1',
      docNumber: 'GRN2608-00087',
      status: 'DRAFT',
      warehouseId: 'wh-1',
      warehouseName: 'Kho HN-1',
      poNumber: 'PO2608-00041',
      supplierName: 'Công ty TNHH Giấy Double A VN',
      receivedAt: '2026-08-23T08:00:00.000Z',
      createdByName: 'Trần Văn Bảo',
      lineCount: 3,
      totalQty: '120',
    },
    {
      id: 'r-2',
      docNumber: 'GRN2608-00084',
      status: 'POSTED',
      warehouseId: 'wh-1',
      warehouseName: 'Kho HN-1',
      poNumber: null,
      supplierName: null,
      receivedAt: '2026-08-22T17:57:00.000Z',
      createdByName: 'Hoàng Văn Long',
      lineCount: 4,
      totalQty: '753',
    },
  ],
  total: 2,
  statusCounts: { DRAFT: 1, POSTED: 1, CANCELLED: 0 },
};

const DETAIL_DRAFT = {
  id: 'r-1',
  docNumber: 'GRN2608-00087',
  status: 'DRAFT',
  warehouseId: 'wh-1',
  warehouseName: 'Kho HN-1',
  poId: null,
  poNumber: null,
  supplierName: null,
  receivedAt: '2026-08-23T08:00:00.000Z',
  postedAt: null,
  postedByName: null,
  createdByName: 'Trần Văn Bảo',
  note: 'Xe 29H-512.44',
  lineCount: 1,
  totalQty: '50',
  totalValue: '17000000',
  lines: [
    {
      id: 'l-1',
      lineNo: 1,
      skuId: 'sku-1',
      skuCode: 'DA-A4-80',
      skuName: 'Giấy A4 Double A 80gsm',
      baseUomCode: 'REAM',
      lotNumber: 'L2608',
      expiryDate: null,
      qtyBase: '50',
      qtyRejected: '0',
      unitCost: '340000',
      lineValue: '17000000',
    },
  ],
};

const CONTAINER_TYPES = [
  { id: 'ct-1', code: 'PALLET', name: 'Pallet', sortOrder: 10, isActive: true },
  { id: 'ct-2', code: 'CARTON', name: 'Thùng', sortOrder: 30, isActive: true },
];

const DETAIL_PACKED = {
  ...DETAIL_DRAFT,
  lines: [
    {
      ...DETAIL_DRAFT.lines[0],
      packaging: {
        containerType: 'CARTON',
        qtyPerContainer: '25',
        count: 2,
        wrapper: { id: 'c-w', barcode: 'SUPPLIER-PLT-1' },
        containers: [
          { id: 'c-1', barcode: 'LPN2609-00001' },
          { id: 'c-2', barcode: 'LPN2609-00002' },
        ],
      },
    },
  ],
};

/**
 * GET /skus/:id/conversions — 1 BOX = 10 REAM (CARTON), 1 PLT = 100 REAM (PALLET); 1 GOI = 5 REAM
 * là ĐVT phụ thường (không phải cấp đóng gói) → không được chọn làm ĐVT nhập.
 */
const CONVERSIONS = [
  {
    id: 'cv-3',
    uomId: 'u-goi',
    factor: '5.000000',
    containerTypeId: null,
    uom: { id: 'u-goi', code: 'GOI', name: 'Gói', decimals: 0 },
  },
  {
    id: 'cv-2',
    uomId: 'u-plt',
    factor: '100.000000',
    containerTypeId: 'ct-1',
    uom: { id: 'u-plt', code: 'PLT', name: 'Pallet', decimals: 0 },
  },
  {
    id: 'cv-1',
    uomId: 'u-box',
    factor: '10.000000',
    containerTypeId: 'ct-2',
    uom: { id: 'u-box', code: 'BOX', name: 'Thùng', decimals: 0 },
  },
];

const SKU_LIST = {
  items: [
    {
      skuId: 'sku-1',
      code: 'DA-A4-80',
      name: 'Giấy A4 Double A 80gsm',
      productId: 'p-1',
      productCode: 'DA-A4',
      productName: 'Giấy A4 Double A',
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
};

describe('GrnListScreen — GET /goods-receipts', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)),
      http.get('/api/goods-receipts', () => HttpResponse.json(LIST)),
    );
  });

  it('render danh sách thật: số phiếu, NCC, loại, trạng thái, tổng SL, tab đếm từ statusCounts', async () => {
    renderApp(<GrnListScreen />);
    expect(await screen.findByText('GRN2608-00087')).toBeInTheDocument();
    expect(screen.getByText('Công ty TNHH Giấy Double A VN')).toBeInTheDocument();
    expect(screen.getByText('Từ PO')).toBeInTheDocument();
    expect(screen.getByText('Nhập khác')).toBeInTheDocument();
    // 'Nháp'/'Đã post' xuất hiện ở cả tab lẫn badge trạng thái dòng
    expect(screen.getAllByText('Nháp').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Đã post').length).toBeGreaterThan(1);
    // Tab "Tất cả" đếm tổng ba trạng thái
    expect(within(screen.getByRole('tablist')).getByText('2')).toBeInTheDocument();
  });

  it('hủy nháp: chỉ dòng DRAFT có nút, xác nhận → DELETE /goods-receipts/:id', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete('/api/goods-receipts/:id', ({ params }) => {
        deleted.push(params.id as string);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<GrnListScreen />);
    await screen.findByText('GRN2608-00087');
    const buttons = screen.getAllByRole('button', { name: 'Hủy nháp' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(await screen.findByText('Hủy nháp phiếu nhập GRN2608-00087?')).toBeInTheDocument();
    const confirm = screen.getAllByRole('button', { name: 'Hủy nháp' });
    fireEvent.click(confirm[confirm.length - 1]!);
    await waitFor(() => expect(deleted).toEqual(['r-1']));
  });
});

describe('GrnCreateScreen — POST /goods-receipts (+ post)', () => {
  beforeEach(() => {
    push.mockClear();
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)),
      http.get('/api/skus', () => HttpResponse.json(SKU_LIST)),
      http.get('/api/container-types', () => HttpResponse.json(CONTAINER_TYPES)),
      http.get('/api/skus/:id/conversions', () => HttpResponse.json(CONVERSIONS)),
    );
  });

  it('nhập theo thùng / pallet: ĐVT nhập chỉ có đơn vị bán chính + thùng / pallet đã khai; chọn pallet → SL quy đổi, body gửi uom + packaging suy từ ĐVT', async () => {
    const posts: Array<{ body: unknown }> = [];
    server.use(
      http.post('/api/goods-receipts', async ({ request }) => {
        posts.push({ body: await request.json() });
        return HttpResponse.json(
          { receiptId: 'r-8', docNumber: 'GRN2610-00001', status: 'DRAFT', warehouseId: 'wh-1' },
          { status: 201 },
        );
      }),
    );
    renderApp(<GrnCreateScreen />);
    fireEvent.click(await screen.findByRole('combobox', { name: 'Kho nhận *' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));
    fireEvent.click(screen.getByText('Tìm SKU…'));
    fireEvent.click(await screen.findByText('Giấy A4 Double A 80gsm'));
    fireEvent.change(screen.getByLabelText('Số lượng dòng 1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT nhập dòng 1' }));
    await waitFor(() =>
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'REAM',
        'Thùng (10 REAM)',
        'Pallet (100 REAM)',
      ]),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Pallet (100 REAM)' }));
    // 2 pallet × 100 = 200 REAM; khối "Đóng gói" không còn hiện trên form
    expect(await screen.findByText('= 200 REAM')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loại thùng dòng 1')).not.toBeInTheDocument();
    fireEvent.change(screen.getAllByPlaceholderText('0')[1]!, { target: { value: '5000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.body).toMatchObject({
      lines: [
        {
          skuId: 'sku-1',
          qty: '2',
          uom: 'PLT',
          unitCost: '5000000',
          packaging: { containerType: 'PALLET', qtyPerContainer: '100' },
        },
      ],
    });
  });

  it('nhập theo thùng mà SL lẻ (1.5 thùng) → lỗi ngay ô số lượng, không gọi API', async () => {
    const posts: unknown[] = [];
    server.use(
      http.post(
        '/api/goods-receipts',
        () => (posts.push(1), HttpResponse.json({}, { status: 201 })),
      ),
    );
    renderApp(<GrnCreateScreen />);
    fireEvent.click(await screen.findByRole('combobox', { name: 'Kho nhận *' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));
    fireEvent.click(screen.getByText('Tìm SKU…'));
    fireEvent.click(await screen.findByText('Giấy A4 Double A 80gsm'));
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT nhập dòng 1' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Thùng (10 REAM)' }));
    fireEvent.change(screen.getByLabelText('Số lượng dòng 1'), { target: { value: '1.5' } });
    fireEvent.change(screen.getAllByPlaceholderText('0')[1]!, { target: { value: '340000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(await screen.findByText('Nhập số BOX nguyên')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('quét barcode: mã thùng thêm dòng theo thùng (packaging CARTON), quét lại +1; mã lẻ thêm dòng ĐVT cơ sở; mã lạ báo lỗi', async () => {
    const posts: Array<{ body: unknown }> = [];
    const LOOKUP = {
      type: 'EAN13',
      sku: {
        id: 'sku-1',
        code: 'A4-DA80',
        name: 'Giấy A4 Double A 80gsm',
        productCode: 'A4',
        trackingMode: 'NONE',
      },
      baseUom: { id: 'u-ream', code: 'REAM' },
    };
    server.use(
      http.get('/api/barcodes/:code', ({ params }) => {
        if (params.code === 'THUNG-A4')
          return HttpResponse.json({
            ...LOOKUP,
            barcode: 'THUNG-A4',
            uom: { id: 'u-box', code: 'BOX', name: 'Thùng' },
            factor: '10',
          });
        if (params.code === '8850000000001')
          return HttpResponse.json({
            ...LOOKUP,
            barcode: '8850000000001',
            uom: { id: 'u-ream', code: 'REAM', name: 'Ram' },
            factor: '1',
          });
        return HttpResponse.json(
          { code: 'NOT_FOUND', message: 'x', details: null, traceId: 't' },
          { status: 404 },
        );
      }),
      http.post('/api/goods-receipts', async ({ request }) => {
        posts.push({ body: await request.json() });
        return HttpResponse.json(
          { receiptId: 'r-10', docNumber: 'GRN2610-00002', status: 'DRAFT', warehouseId: 'wh-1' },
          { status: 201 },
        );
      }),
    );
    renderApp(<GrnCreateScreen />);
    fireEvent.click(await screen.findByRole('combobox', { name: 'Kho nhận *' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));
    const scan = (code: string) => {
      const input = screen.getByLabelText('Quét barcode sản phẩm / thùng / pallet');
      fireEvent.change(input, { target: { value: code } });
      fireEvent.keyDown(input, { key: 'Enter' });
    };
    scan('THUNG-A4');
    // Dòng trống đầu tiên được điền, không thêm dòng mới
    await waitFor(() => expect(screen.getByLabelText('Số lượng dòng 1')).toHaveValue('1'));
    scan('THUNG-A4');
    await waitFor(() => expect(screen.getByLabelText('Số lượng dòng 1')).toHaveValue('2'));
    expect(await screen.findByText('= 20 REAM')).toBeInTheDocument();
    scan('8850000000001');
    await waitFor(() => expect(screen.getByLabelText('Số lượng dòng 2')).toHaveValue('1'));
    scan('KHONG-CO');
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('Không tìm thấy barcode KHONG-CO'),
      ),
    );
    expect(screen.queryByLabelText('Số lượng dòng 3')).not.toBeInTheDocument();

    const costs = screen
      .getAllByPlaceholderText('0')
      .filter((el) => el.getAttribute('inputmode') === 'decimal' && !el.getAttribute('aria-label'));
    fireEvent.change(costs[0]!, { target: { value: '3400000' } });
    fireEvent.change(costs[1]!, { target: { value: '340000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.body).toMatchObject({
      lines: [
        {
          skuId: 'sku-1',
          qty: '2',
          uom: 'BOX',
          packaging: { containerType: 'CARTON', qtyPerContainer: '10' },
        },
        { skuId: 'sku-1', qty: '1', unitCost: '340000' },
      ],
    });
    expect((posts[0]!.body as { lines: object[] }).lines[1]).not.toHaveProperty('uom');
  });

  it('lưu nháp: body đúng + Idempotency-Key có mặt → chuyển sang trang chi tiết', async () => {
    const posts: Array<{ body: unknown; key: string | null }> = [];
    server.use(
      http.post('/api/goods-receipts', async ({ request }) => {
        posts.push({
          body: await request.json(),
          key: request.headers.get('idempotency-key'),
        });
        return HttpResponse.json(
          { receiptId: 'r-9', docNumber: 'GRN2608-00099', status: 'DRAFT', warehouseId: 'wh-1' },
          { status: 201 },
        );
      }),
    );
    renderApp(<GrnCreateScreen />);
    fireEvent.click(await screen.findByRole('combobox', { name: 'Kho nhận *' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));

    fireEvent.click(screen.getByText('Tìm SKU…'));
    fireEvent.click(await screen.findByText('Giấy A4 Double A 80gsm'));
    const qty = screen.getAllByPlaceholderText('0');
    fireEvent.change(qty[0]!, { target: { value: '50' } });
    fireEvent.change(qty[1]!, { target: { value: '340000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.key).toBeTruthy();
    expect(posts[0]!.body).toMatchObject({
      warehouseId: 'wh-1',
      lines: [{ skuId: 'sku-1', qty: '50', unitCost: '340000' }],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/wms/grn/r-9'));
  });

  it('Post phiếu: tạo xong gọi tiếp POST :id/post', async () => {
    const posted: string[] = [];
    server.use(
      http.post('/api/goods-receipts', () =>
        HttpResponse.json(
          { receiptId: 'r-9', docNumber: 'GRN2608-00099', status: 'DRAFT', warehouseId: 'wh-1' },
          { status: 201 },
        ),
      ),
      http.post('/api/goods-receipts/:id/post', ({ params }) => {
        posted.push(params.id as string);
        return HttpResponse.json({ receiptId: params.id, status: 'POSTED' });
      }),
    );
    renderApp(<GrnCreateScreen />);
    fireEvent.click(await screen.findByRole('combobox', { name: 'Kho nhận *' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));
    fireEvent.click(screen.getByText('Tìm SKU…'));
    fireEvent.click(await screen.findByText('Giấy A4 Double A 80gsm'));
    const qty = screen.getAllByPlaceholderText('0');
    fireEvent.change(qty[0]!, { target: { value: '50' } });
    fireEvent.change(qty[1]!, { target: { value: '340000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post phiếu' }));
    await waitFor(() => expect(posted).toEqual(['r-9']));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/wms/grn/r-9'));
  });
});

describe('GrnDetailScreen — GET /goods-receipts/:id', () => {
  beforeEach(() => {
    push.mockClear();
    server.use(http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)));
  });

  it('phiếu nháp: đủ trường + dòng nhập; nút Post gọi POST :id/post', async () => {
    const posted: string[] = [];
    server.use(
      http.get('/api/goods-receipts/:id', () => HttpResponse.json(DETAIL_DRAFT)),
      http.post('/api/goods-receipts/:id/post', ({ params }) => {
        posted.push(params.id as string);
        return HttpResponse.json({ receiptId: params.id, status: 'POSTED' });
      }),
    );
    renderApp(<GrnDetailScreen id="r-1" />);
    expect(await screen.findByText('Giấy A4 Double A 80gsm')).toBeInTheDocument();
    expect(screen.getByText('Xe 29H-512.44')).toBeInTheDocument();
    expect(screen.getByText('— (nhập tự do)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Post phiếu' }));
    await waitFor(() => expect(posted).toEqual(['r-1']));
  });

  it('phiếu đã post: banner bất biến + sổ cái movements, không còn nút Post/Hủy', async () => {
    server.use(
      http.get('/api/goods-receipts/:id', () =>
        HttpResponse.json({
          ...DETAIL_DRAFT,
          status: 'POSTED',
          postedAt: '2026-08-23T10:12:00.000Z',
          postedByName: 'Trần Văn Bảo',
        }),
      ),
      http.get('/api/goods-receipts/:id/movements', () =>
        HttpResponse.json([
          {
            id: '8842171',
            createdAt: '2026-08-23T10:12:04.000Z',
            movementType: 'RECEIPT',
            skuCode: 'DA-A4-80',
            lotNumber: 'L2608',
            locationCode: 'B-01-01-A',
            qtyDelta: '50',
            actorName: 'Trần Văn Bảo',
          },
        ]),
      ),
    );
    renderApp(<GrnDetailScreen id="r-1" />);
    expect(await screen.findByText(/Chứng từ bất biến/)).toBeInTheDocument();
    expect(await screen.findByText('B-01-01-A')).toBeInTheDocument();
    expect(screen.getByText('+ Nhập')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post phiếu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy phiếu' })).not.toBeInTheDocument();
  });
});

describe('GrnDetailScreen — đóng gói (PLAN-packaging-hierarchy D)', () => {
  it('dòng có packaging → cột "Đóng gói" nêu số thùng, mã pallet bọc, nút in tem', async () => {
    server.use(http.get('/api/goods-receipts/:id', () => HttpResponse.json(DETAIL_PACKED)));
    renderApp(<GrnDetailScreen id="r-1" />);
    expect(await screen.findByText(/2 CARTON ×/)).toBeInTheDocument();
    expect(screen.getByText('SUPPLIER-PLT-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In tem thùng dòng 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In tất cả tem thùng' })).toBeInTheDocument();
  });
  it('dòng hàng rời → "Hàng rời", không có nút in', async () => {
    server.use(http.get('/api/goods-receipts/:id', () => HttpResponse.json(DETAIL_DRAFT)));
    renderApp(<GrnDetailScreen id="r-1" />);
    expect(await screen.findByText('Hàng rời')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /In tem/ })).toBeNull();
  });
});
