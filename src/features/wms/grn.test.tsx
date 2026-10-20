import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { GrnCreateScreen, receiptToFormValues } from './components/grn-create-screen';
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
/** Kho được phép của phiên (/auth/me) — ô Kho nhận lấy từ đây (PLAN-warehouse-context). */
const MY_WAREHOUSES = [{ id: 'wh-1', code: 'WH01', name: 'Kho HN-1' }];

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
  const skuUrls: string[] = [];
  beforeEach(() => {
    push.mockClear();
    skuUrls.length = 0;
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)),
      http.get('/api/skus', ({ request }) => {
        skuUrls.push(request.url);
        return HttpResponse.json(SKU_LIST);
      }),
      http.get('/api/container-types', () => HttpResponse.json(CONTAINER_TYPES)),
      http.get('/api/skus/:id/conversions', () => HttpResponse.json(CONVERSIONS)),
    );
  });

  it('ô tìm SKU chỉ xin hàng nhập được: bỏ combo và sản phẩm sync tự sinh từ Pancake (2026-10-20)', async () => {
    renderApp(<GrnCreateScreen />, { warehouses: MY_WAREHOUSES });
    await screen.findByRole('combobox', { name: 'Kho nhận *' });
    fireEvent.click(screen.getByText('Tìm SKU…'));
    await waitFor(() => expect(skuUrls.length).toBeGreaterThan(0));
    const params = new URL(skuUrls[0]!).searchParams;
    expect(params.get('isCombo')).toBe('false');
    expect(params.get('erpOnly')).toBe('true');
    expect(params.get('status')).toBe('active');
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
    renderApp(<GrnCreateScreen />, { warehouses: MY_WAREHOUSES });
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
    renderApp(<GrnCreateScreen />, { warehouses: MY_WAREHOUSES });
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
    renderApp(<GrnCreateScreen />, { warehouses: MY_WAREHOUSES });
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
    // Mã lạ → hộp thoại gán mã (2026-10-13); "Bỏ qua" → không thêm gì.
    scan('KHONG-CO');
    const dialog = await screen.findByRole('dialog', { name: 'Mã chưa gán cho sản phẩm nào' });
    expect(dialog).toHaveTextContent('KHONG-CO');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bỏ qua' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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

  it('quét QR chứa link chưa gán → chọn sản phẩm → POST /skus/:id/barcodes/at-receipt → quét lại tự động thêm dòng', async () => {
    const URL_CODE = 'https://www.thiennongnamviet.com.vn/combi';
    const assigned: Array<{ id: string; body: unknown }> = [];
    let known = false;
    server.use(
      http.get('/api/barcodes/:code', ({ params }) =>
        known && params.code === URL_CODE
          ? HttpResponse.json({
              barcode: URL_CODE,
              type: 'QR',
              sku: {
                id: 'sku-1',
                code: 'DA-A4-80',
                name: 'Giấy A4 Double A 80gsm',
                productCode: 'DA-A4',
                trackingMode: 'NONE',
              },
              uom: { id: 'u-ream', code: 'REAM', name: 'Ram' },
              baseUom: { id: 'u-ream', code: 'REAM' },
              factor: '1',
            })
          : HttpResponse.json(
              { code: 'NOT_FOUND', message: 'x', details: null, traceId: 't' },
              { status: 404 },
            ),
      ),
      http.post('/api/skus/:id/barcodes/at-receipt', async ({ params, request }) => {
        assigned.push({ id: String(params.id), body: await request.json() });
        known = true;
        return HttpResponse.json(
          { id: 'b-1', skuId: 'sku-1', uomId: 'u-ream', code: URL_CODE, type: 'QR' },
          { status: 201 },
        );
      }),
    );
    renderApp(<GrnCreateScreen />, { warehouses: MY_WAREHOUSES });
    fireEvent.click(await screen.findByRole('combobox', { name: 'Kho nhận *' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));
    const input = screen.getByLabelText('Quét barcode sản phẩm / thùng / pallet');
    fireEvent.change(input, { target: { value: URL_CODE } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const dialog = await screen.findByRole('dialog', { name: 'Mã chưa gán cho sản phẩm nào' });
    expect(dialog).toHaveTextContent(URL_CODE);
    const submit = within(dialog).getByRole('button', { name: 'Gán mã và thêm vào phiếu' });
    expect(submit).toBeDisabled();
    fireEvent.click(within(dialog).getByText('Chọn sản phẩm…'));
    fireEvent.click(await screen.findByText('Giấy A4 Double A 80gsm'));
    fireEvent.click(submit);

    await waitFor(() => expect(assigned).toEqual([{ id: 'sku-1', body: { code: URL_CODE } }]));
    await waitFor(() => expect(screen.getByLabelText('Số lượng dòng 1')).toHaveValue('1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mã quét bị bộ gõ tiếng Việt làm sai (có dấu) → hộp thoại cảnh báo tắt bộ gõ, không cho gán', async () => {
    server.use(
      http.get('/api/barcodes/:code', () =>
        HttpResponse.json(
          { code: 'NOT_FOUND', message: 'x', details: null, traceId: 't' },
          { status: 404 },
        ),
      ),
    );
    renderApp(<GrnCreateScreen />, { warehouses: MY_WAREHOUSES });
    const input = await screen.findByLabelText('Quét barcode sản phẩm / thùng / pallet');
    fireEvent.change(input, { target: { value: 'https://ưưư.thiennongnamviet.com.vn/combi' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const dialog = await screen.findByRole('dialog', { name: 'Mã chưa gán cho sản phẩm nào' });
    expect(dialog).toHaveTextContent('Tắt bộ gõ (Unikey/EVKey) rồi quét lại');
    expect(within(dialog).getByRole('button', { name: 'Gán mã và thêm vào phiếu' })).toBeDisabled();
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
    renderApp(<GrnCreateScreen />, { warehouses: MY_WAREHOUSES });
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
    renderApp(<GrnCreateScreen />, { warehouses: MY_WAREHOUSES });
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

describe('Nhân bản phiếu nhập (?from=) — 2026-10-12', () => {
  beforeEach(() => {
    push.mockClear();
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)),
      http.get('/api/skus', () => HttpResponse.json(SKU_LIST)),
      http.get('/api/container-types', () => HttpResponse.json(CONTAINER_TYPES)),
      http.get('/api/skus/:id/conversions', () => HttpResponse.json(CONVERSIONS)),
    );
  });

  it('receiptToFormValues: dòng theo thùng → SL thùng + đơn giá mỗi thùng + quy cách; lô để trống nhưng vẫn đòi lô', () => {
    const v = receiptToFormValues({
      ...DETAIL_DRAFT,
      status: 'POSTED',
      lines: [
        {
          ...DETAIL_PACKED.lines[0]!,
          qtyBase: '20',
          unitCost: '34000',
          uomId: 'u-box',
          uomCode: 'BOX',
          factor: '10.000000',
          packaging: { ...DETAIL_PACKED.lines[0]!.packaging, qtyPerContainer: '10' },
        },
        {
          ...DETAIL_DRAFT.lines[0]!,
          lotNumber: null,
          uomId: null,
          uomCode: null,
          factor: null,
          packaging: null,
        },
      ],
    } as Parameters<typeof receiptToFormValues>[0]);
    expect(v.warehouseId).toBe('wh-1');
    expect(v.note).toBe('Xe 29H-512.44');
    expect(v.receivedAt).toBe(new Date().toISOString().slice(0, 10));
    expect(v.lines[0]).toMatchObject({
      skuId: 'sku-1',
      qty: '2',
      uom: 'BOX',
      factor: '10',
      unitCost: '340000',
      tracking: 'LOT',
      lotNumber: '',
      expiryDate: '',
      packType: 'CARTON',
      packQtyPer: '10',
    });
    expect(v.lines[1]).toMatchObject({
      qty: '50',
      uom: '',
      factor: '1',
      tracking: 'NONE',
      packType: '',
    });
  });

  it('form nhân bản: điền sẵn kho + ghi chú + dòng; dòng có lô bắt nhập lô mới; lưu → POST phiếu mới', async () => {
    const posts: unknown[] = [];
    server.use(
      http.get('/api/goods-receipts/:id', () => HttpResponse.json(DETAIL_DRAFT)),
      http.post('/api/goods-receipts', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(
          { receiptId: 'r-10', docNumber: 'GRN2610-00010', status: 'DRAFT', warehouseId: 'wh-1' },
          { status: 201 },
        );
      }),
    );
    renderApp(<GrnCreateScreen copyFromId="r-1" />, { warehouses: MY_WAREHOUSES });
    expect(await screen.findByText(/Nhân bản từ GRN2608-00087 · 1 dòng/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Xe 29H-512.44')).toBeInTheDocument();
    expect(screen.getByText('Giấy A4 Double A 80gsm')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(await screen.findByText('SKU theo lô — bắt buộc số lô')).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    fireEvent.change(screen.getByPlaceholderText('L2608'), { target: { value: 'L2610' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      warehouseId: 'wh-1',
      receivedAt: new Date().toISOString().slice(0, 10),
      note: 'Xe 29H-512.44',
      lines: [{ skuId: 'sku-1', qty: '50', unitCost: '340000', lotNumber: 'L2610' }],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/wms/grn/r-10'));
  });

  it('chi tiết phiếu (kể cả đã post) có nút "Nhân bản" → /wms/grn/new?from=<id>', async () => {
    server.use(
      http.get('/api/goods-receipts/:id', () =>
        HttpResponse.json({
          ...DETAIL_DRAFT,
          status: 'POSTED',
          postedAt: '2026-08-23T10:12:00.000Z',
        }),
      ),
      http.get('/api/goods-receipts/:id/movements', () => HttpResponse.json([])),
    );
    renderApp(<GrnDetailScreen id="r-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nhân bản' }));
    expect(push).toHaveBeenCalledWith('/wms/grn/new?from=r-1');
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
