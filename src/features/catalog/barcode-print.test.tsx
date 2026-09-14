import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { BarcodePrintScreen } from './components/barcode-print-screen';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/catalog/barcode-print',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const uuid = (i: number) => `00000040-0000-4000-8000-${String(i).padStart(12, '0')}`;
const UOM_CAI = { id: uuid(901), code: 'cái', name: 'Cái', decimals: 0, version: 0 };
const UOM_HOP = { id: uuid(902), code: 'hộp', name: 'Hộp', decimals: 0, version: 0 };

/** Đúng shape `ProductSkuDetailDto`. Mã EAN13 khai SAI check digit → phải in CODE128 (quyết định 3). */
const SKU_BLUE = {
  id: uuid(1),
  productId: uuid(101),
  code: 'TL08-BLUE',
  name: 'TL-08 xanh',
  baseUomId: UOM_CAI.id,
  baseUom: UOM_CAI,
  salesUomId: null,
  salesUom: null,
  barcodes: [
    { id: uuid(11), code: '8935001234567', uomId: UOM_CAI.id, type: 'EAN13', uom: UOM_CAI },
    { id: uuid(12), code: 'THUNG-TL08-B', uomId: UOM_HOP.id, type: 'CODE128', uom: UOM_HOP },
  ],
  uomConversions: [{ id: uuid(21), uomId: UOM_HOP.id, factor: '24.000000', uom: UOM_HOP }],
  trackingMode: 'NONE',
  shelfLifeDays: null,
  taxRateId: null,
  images: [],
  purchasePrice: null,
  salePrice: '4000.0000',
  weightKg: null,
  variantKey: 'blue',
  isActive: true,
  version: 1,
};
/** SKU ngừng bán, không barcode — không được chọn sẵn, checkbox bị khoá. */
const SKU_RED = {
  ...SKU_BLUE,
  id: uuid(2),
  code: 'TL08-RED',
  name: 'TL-08 đỏ',
  barcodes: [],
  uomConversions: [],
  salePrice: null,
  variantKey: 'red',
  isActive: false,
};
/** Đúng shape `ProductDetailDto` — đổi DTO ở backend thì sửa cả đây. */
const PRODUCT = {
  id: uuid(101),
  code: 'SP-TL08',
  name: 'Bút bi Thiên Long TL-08',
  categoryId: null,
  brandId: null,
  trackingMode: 'NONE',
  shelfLifeDays: null,
  isActive: true,
  category: null,
  brand: null,
  defaultWarehouseId: null,
  description: null,
  internalNote: null,
  allowNegativeStock: false,
  searchAliases: [],
  version: 1,
  createdAt: '2026-09-01T03:00:00.000Z',
  updatedAt: '2026-09-02T03:00:00.000Z',
  hasVariants: true,
  skus: [SKU_BLUE, SKU_RED],
  images: [],
};

describe('BarcodePrintScreen — in tem SKU thật (GET /products/{id} + bwip-js)', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/products/:id', ({ params }) =>
        params.id === PRODUCT.id
          ? HttpResponse.json(PRODUCT)
          : HttpResponse.json({ code: 'NOT_FOUND', message: 'x', traceId: 't' }, { status: 404 }),
      ),
    );
    window.print = vi.fn();
  });
  afterEach(() => {
    search = '';
    replace.mockReset();
  });

  it('không có ?productId → trạng thái trống mời thêm sản phẩm, nút In bị khoá', async () => {
    renderApp(<BarcodePrintScreen />);
    expect(await screen.findByText('Chưa chọn sản phẩm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^In tem/ })).toBeDisabled();
  });

  it('?productId= → mỗi SKU một dòng, SKU đang bán có barcode được chọn sẵn, preview là SVG CODE128 (EAN sai check digit)', async () => {
    search = `productId=${PRODUCT.id}`;
    renderApp(<BarcodePrintScreen />);
    // Tên xuất hiện ở dòng bảng VÀ ở preview tem (cùng một component tem)
    expect(await screen.findAllByText('Bút bi Thiên Long TL-08 — TL-08 xanh')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Chọn TL08-BLUE' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Chọn TL08-RED' })).toBeDisabled();

    const preview = screen.getByTestId('label-preview');
    const img = within(preview).getByRole('img', { name: 'Mã vạch 8935001234567' });
    expect(img).toHaveAttribute('data-barcode', 'code128');
    expect(img.querySelector('svg')).not.toBeNull();
    expect(within(preview).getByText('TL08-BLUE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In 1 tem' })).toBeEnabled();
  });

  it('số tem × dòng = số tem in; bấm In → window.print đúng một lần với đủ trang tem', async () => {
    search = `productId=${PRODUCT.id}`;
    let pages = 0;
    let labels = 0;
    (window.print as ReturnType<typeof vi.fn>).mockImplementation(() => {
      pages = document.querySelectorAll('[data-print-root] [data-print-page]').length;
      labels = document.querySelectorAll('[data-print-root] [data-sku-label]').length;
    });
    renderApp(<BarcodePrintScreen />);
    await screen.findAllByText('Bút bi Thiên Long TL-08 — TL-08 xanh');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Số tem TL08-BLUE' }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'In 5 tem' }));
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    // 5 tem, 2 cột → 3 hàng (trang)
    expect(labels).toBe(5);
    expect(pages).toBe(3);
    // Sau khi in xong tờ in được gỡ khỏi DOM
    expect(document.querySelector('[data-print-root]')).toBeNull();
  });

  it('sản phẩm không tồn tại → trạng thái lỗi có nút thử lại (luật 13)', async () => {
    search = `productId=${uuid(999)}`;
    renderApp(<BarcodePrintScreen />);
    expect(await screen.findByRole('button', { name: /Thử lại/ })).toBeInTheDocument();
  });
});
