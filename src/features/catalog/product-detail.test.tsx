import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ProductDetailScreen } from './components/product-detail-screen';

// Radix Select (chọn biến thể tab Tồn theo kho) đo kích thước qua ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const uuid = (i: number) => `00000030-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** Đúng shape `UomDto` trong openapi.json. */
const UOM_CAI = { id: uuid(901), code: 'cái', name: 'Cái', decimals: 0, version: 0 };
const UOM_HOP = { id: uuid(902), code: 'hộp', name: 'Hộp', decimals: 0, version: 0 };

const WAREHOUSE = {
  id: uuid(801),
  code: 'KHO1',
  name: 'Kho trung tâm',
  address: null,
  isActive: true,
};

const CATEGORY = { id: uuid(201), code: 'BUT', name: 'Bút viết', parentId: null };
const BRAND = { id: uuid(301), code: 'TL', name: 'Thiên Long', isActive: true };

/** Đúng shape `ProductSkuDetailDto` — SKU đang bán, có ĐVT phụ + barcode thùng + ĐVT bán. */
const SKU_BLUE = {
  id: uuid(1),
  productId: uuid(101),
  code: 'TL08-BLUE',
  name: 'TL-08 xanh',
  baseUomId: UOM_CAI.id,
  baseUom: UOM_CAI,
  salesUomId: UOM_HOP.id,
  salesUom: UOM_HOP,
  barcodes: [
    { id: uuid(11), code: '8935001234567', uomId: UOM_CAI.id, type: 'EAN13', uom: UOM_CAI },
    { id: uuid(12), code: 'THUNG-TL08-B', uomId: UOM_HOP.id, type: 'CODE128', uom: UOM_HOP },
  ],
  uomConversions: [{ id: uuid(21), uomId: UOM_HOP.id, factor: '24.000000', uom: UOM_HOP }],
  trackingMode: 'LOT',
  shelfLifeDays: null,
  taxRateId: null,
  images: [],
  purchasePrice: '2500.0000',
  salePrice: '4000.0000',
  weightKg: null,
  isActive: true,
  version: 3,
};

/** SKU Ngừng bán, không barcode/quy đổi — không được chọn mặc định ở tab tồn. */
const SKU_RED = {
  ...SKU_BLUE,
  id: uuid(2),
  code: 'TL08-RED',
  name: 'TL-08 đỏ',
  salesUomId: null,
  salesUom: null,
  barcodes: [],
  uomConversions: [],
  purchasePrice: null,
  salePrice: null,
  isActive: false,
  version: 0,
};

/** Đúng shape `ProductDetailDto` trong openapi.json — đổi DTO ở backend thì sửa cả đây. */
const PRODUCT = {
  id: uuid(101),
  code: 'SP-TL08',
  name: 'Bút bi Thiên Long TL-08',
  categoryId: CATEGORY.id,
  brandId: BRAND.id,
  trackingMode: 'LOT',
  shelfLifeDays: 365,
  isActive: true,
  category: CATEGORY,
  brand: BRAND,
  defaultWarehouseId: WAREHOUSE.id,
  description: 'Ngòi bi 0.8mm, mực dầu.',
  internalNote: null,
  allowNegativeStock: false,
  searchAliases: ['bút thiên long', 'tl08'],
  version: 5,
  createdAt: '2026-09-01T03:00:00.000Z',
  updatedAt: '2026-09-02T03:00:00.000Z',
  skus: [SKU_BLUE, SKU_RED],
  images: [],
};

const STOCK_SUMMARY = {
  items: [
    {
      skuId: SKU_BLUE.id,
      skuCode: SKU_BLUE.code,
      skuName: SKU_BLUE.name,
      baseUomId: UOM_CAI.id,
      baseUomCode: UOM_CAI.code,
      isActive: true,
      onHand: '31200.000000',
      reserved: '1240.000000',
      available: '29960.000000',
    },
  ],
  total: 1,
};

const locationRow = (i: number, over: Record<string, unknown>) => ({
  skuId: SKU_BLUE.id,
  skuCode: SKU_BLUE.code,
  skuName: SKU_BLUE.name,
  warehouseId: WAREHOUSE.id,
  warehouseCode: WAREHOUSE.code,
  locationId: uuid(700 + i),
  locationCode: `A-01-0${i}`,
  locationType: 'BIN',
  isPickable: true,
  pickSequence: i,
  onHand: '100.000000',
  reserved: '0.000000',
  available: '100.000000',
  ...over,
});

const BY_LOCATION = {
  items: [locationRow(1, {}), locationRow(2, { locationType: 'STAGING', isPickable: false })],
  total: 2,
};

const BY_LOT = {
  items: [
    {
      skuId: SKU_BLUE.id,
      skuCode: SKU_BLUE.code,
      skuName: SKU_BLUE.name,
      lotId: uuid(601),
      lotNumber: 'LOT-2026-09',
      expiryDate: '2027-03-15',
      mfgDate: '2026-03-15',
      onHand: '200.000000',
      reserved: '50.000000',
      available: '150.000000',
    },
  ],
  total: 1,
};

let stockCalls: URLSearchParams[] = [];
let byLocationCalls: URLSearchParams[] = [];
let byLotCalls: URLSearchParams[] = [];

const handlers = [
  http.get('/api/products/:id', ({ params }) =>
    params.id === PRODUCT.id ? HttpResponse.json(PRODUCT) : new HttpResponse(null, { status: 404 }),
  ),
  http.get('/api/warehouses', () => HttpResponse.json([WAREHOUSE])),
  http.get('/api/stock', ({ request }) => {
    stockCalls.push(new URL(request.url).searchParams);
    return HttpResponse.json(STOCK_SUMMARY);
  }),
  http.get('/api/stock/by-location', ({ request }) => {
    byLocationCalls.push(new URL(request.url).searchParams);
    return HttpResponse.json(BY_LOCATION);
  }),
  http.get('/api/stock/by-lot', ({ request }) => {
    byLotCalls.push(new URL(request.url).searchParams);
    return HttpResponse.json(BY_LOT);
  }),
];

describe('ProductDetailScreen — C-03 chi tiết sản phẩm (GET /products/:id + /stock*)', () => {
  beforeEach(() => {
    stockCalls = [];
    byLocationCalls = [];
    byLotCalls = [];
    server.use(...handlers);
  });

  it('header + cột trái: tên/mã, theo dõi lô kèm HSD, kho mặc định resolve tên, tồn tổng hợp của SKU đang bán', async () => {
    renderApp(<ProductDetailScreen productId={PRODUCT.id} />);
    expect(await screen.findByText(PRODUCT.name)).toBeInTheDocument();
    expect(
      screen.getByText(`Mã ${PRODUCT.code} · 2 biến thể · Cập nhật 02/09/2026 10:00`),
    ).toBeInTheDocument();
    expect(screen.getByText('Theo lô + hạn dùng (FEFO) · HSD 365 ngày')).toBeInTheDocument();
    // defaultWarehouseId → tên kho từ GET /warehouses, không hiện id thô.
    expect(await screen.findByText(WAREHOUSE.name)).toBeInTheDocument();
    expect(screen.getByText(CATEGORY.name)).toBeInTheDocument();
    expect(screen.getByText(BRAND.name)).toBeInTheDocument();
    // Tồn tổng hợp lấy theo SKU đang bán đầu tiên (TL08-BLUE), 3 số API trả sẵn.
    expect(await screen.findByText('31.200')).toBeInTheDocument();
    expect(screen.getByText('1.240')).toBeInTheDocument();
    expect(screen.getByText('29.960')).toBeInTheDocument();
    expect(stockCalls.at(-1)?.get('q')).toBe(SKU_BLUE.code);
    // Đếm trên tab: 2 biến thể, 2 barcode, 3 dòng đơn vị (2 base + 1 quy đổi).
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Thông tin',
      'Biến thể2',
      'Barcode2',
      'Đơn vị & quy đổi3',
      'Tồn theo kho',
    ]);
  });

  it('tab Biến thể: giá qua formatMoney, ĐVT bán = salesUom (fallback baseUom), trạng thái từng SKU', async () => {
    renderApp(<ProductDetailScreen productId={PRODUCT.id} />);
    await screen.findByText(PRODUCT.name);
    fireEvent.click(screen.getByRole('tab', { name: /Biến thể/ }));
    const blueRow = screen.getByText(SKU_BLUE.code).closest('tr')!;
    expect(within(blueRow).getByText('2.500 ₫')).toBeInTheDocument();
    expect(within(blueRow).getByText('4.000 ₫')).toBeInTheDocument();
    // ĐVT bán mặc định là hộp (salesUom), không phải ĐVT cơ sở.
    expect(within(blueRow).getByText('hộp')).toBeInTheDocument();
    expect(within(blueRow).getByText('Đang bán')).toBeInTheDocument();
    const redRow = screen.getByText(SKU_RED.code).closest('tr')!;
    // Giá null → dấu gạch, không render '0 ₫'.
    expect(within(redRow).getAllByText('—')).toHaveLength(2);
    expect(within(redRow).getByText('cái')).toBeInTheDocument();
    expect(within(redRow).getByText('Ngừng bán')).toBeInTheDocument();
  });

  it('tab Barcode: gộp mọi SKU, hiện loại mã và ĐVT gắn', async () => {
    renderApp(<ProductDetailScreen productId={PRODUCT.id} />);
    await screen.findByText(PRODUCT.name);
    fireEvent.click(screen.getByRole('tab', { name: /Barcode/ }));
    expect(screen.getByText(/2 barcode\./)).toBeInTheDocument();
    const eanRow = screen.getByText('8935001234567').closest('tr')!;
    expect(within(eanRow).getByText('EAN13')).toBeInTheDocument();
    expect(within(eanRow).getByText('cái')).toBeInTheDocument();
    const caseRow = screen.getByText('THUNG-TL08-B').closest('tr')!;
    expect(within(caseRow).getByText('CODE128')).toBeInTheDocument();
    expect(within(caseRow).getByText('hộp')).toBeInTheDocument();
  });

  it('tab Đơn vị & quy đổi: dòng cơ bản + dòng quy đổi 1 hộp = 24 cái, chip bán mặc định theo salesUomId', async () => {
    renderApp(<ProductDetailScreen productId={PRODUCT.id} />);
    await screen.findByText(PRODUCT.name);
    fireEvent.click(screen.getByRole('tab', { name: /Đơn vị & quy đổi/ }));
    expect(screen.getByText('1 hộp = 24 cái')).toBeInTheDocument();
    // TL08-BLUE bán mặc định theo hộp; TL08-RED (salesUomId null) bán theo ĐVT cơ sở.
    expect(screen.getAllByText('bán mặc định')).toHaveLength(2);
    const convRow = screen.getByText('1 hộp = 24 cái').closest('tr')!;
    expect(within(convRow).getByText('bán mặc định')).toBeInTheDocument();
    // Barcode thùng hiện đúng trên dòng ĐVT hộp.
    expect(within(convRow).getByText('THUNG-TL08-B')).toBeInTheDocument();
  });

  it('tab Tồn theo kho: by-location gọi đúng skuId SKU đang bán, gom theo kho; sản phẩm LOT hiện thêm bảng lô FEFO', async () => {
    renderApp(<ProductDetailScreen productId={PRODUCT.id} />);
    await screen.findByText(PRODUCT.name);
    fireEvent.click(screen.getByRole('tab', { name: 'Tồn theo kho' }));
    // Chờ bảng by-location về rồi mới soi nhóm (tên kho ở sidebar match trước).
    expect(await screen.findByText('A-01-01')).toBeInTheDocument();
    // Nhóm theo kho: tên kho resolve từ GET /warehouses + đếm vị trí.
    const groupCell = screen.getByText('· 2 vị trí').closest('td')!;
    expect(groupCell.textContent).toContain(WAREHOUSE.name);
    await waitFor(() => expect(byLocationCalls.at(-1)?.get('skuId')).toBe(SKU_BLUE.id));
    // trackingMode LOT → có bảng tồn theo lô, HSD hiện theo formatDate.
    expect(screen.getByText('Tồn theo lô (FEFO)')).toBeInTheDocument();
    expect(await screen.findByText('LOT-2026-09')).toBeInTheDocument();
    expect(screen.getByText('15/03/2027')).toBeInTheDocument();
    await waitFor(() => expect(byLotCalls.at(-1)?.get('skuId')).toBe(SKU_BLUE.id));
  });

  it('chỉ product.read → không có nút Sửa (luật 7); In tem vẫn hiện', async () => {
    renderApp(<ProductDetailScreen productId={PRODUCT.id} />, {
      me: { ...ME_SALE, permissions: ['product.read', 'stock.read'] },
    });
    await screen.findByText(PRODUCT.name);
    expect(screen.queryByRole('link', { name: 'Sửa' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'In tem' })).toBeInTheDocument();
  });
});
