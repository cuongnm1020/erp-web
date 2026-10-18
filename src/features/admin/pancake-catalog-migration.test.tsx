import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PANCAKE_SHOP_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PancakeCatalogMigrationDialog } from './components/pancake-catalog-migration-dialog';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const SHOP = PANCAKE_SHOP_FIXTURE.shopId;
const ARISYN = {
  skuId: '00000091-0000-4000-8000-000000000001',
  productId: '00000091-0000-4000-8000-0000000000a1',
  code: 'ARISYN-450',
  name: 'Sạch Trích Hút Arisyn 450ml',
  isCombo: false,
};
const row = (over: Record<string, unknown>) => ({
  state: 'PENDING',
  current: null,
  posPrice: null,
  suggestion: {
    action: 'NONE',
    confidence: 'NONE',
    sku: null,
    component: null,
    qty: null,
    componentPriced: null,
    targetPriced: null,
  },
  ...over,
});
const PREVIEW = {
  shopId: SHOP,
  rows: [
    row({
      externalProductId: 'nat-1',
      externalVariationId: 'nv-1',
      posCode: '001',
      posName: '1 chai Sạch Trích Hút Arisyn 450ml',
      posPrice: '120000',
      suggestion: {
        action: 'MAP',
        confidence: 'EXACT',
        sku: ARISYN,
        component: null,
        qty: null,
        componentPriced: null,
        targetPriced: true,
      },
    }),
    row({
      externalProductId: 'nat-4',
      externalVariationId: 'nv-4',
      posCode: '004',
      posName: '10 chai Sạch Trích Hút Arisyn 450ml',
      posPrice: '900000',
      suggestion: {
        action: 'NEW_COMBO',
        confidence: 'FUZZY',
        sku: null,
        component: ARISYN,
        qty: 10,
        componentPriced: true,
        targetPriced: null,
      },
    }),
    row({
      externalProductId: 'nat-9',
      externalVariationId: 'nv-9',
      posCode: '009',
      posName: '2 chai SIÊU LOANG TRẢI ARISYN 100ML',
      posPrice: '150000',
    }),
    row({
      externalProductId: 'nat-2',
      externalVariationId: 'nv-2',
      posCode: '002',
      posName: '3 chai Sạch Trích Hút Arisyn 450ml',
      state: 'MIGRATED',
      current: { ...ARISYN, code: 'CB-0003', name: '3 chai Arisyn', isCombo: true },
    }),
  ],
};
const counts = {
  combosCreated: 0,
  combosReused: 0,
  linked: 0,
  pushed: 0,
  pushFailed: 0,
  hidden: 0,
  skipped: 0,
};
const status = (over: Record<string, unknown> = {}) => ({
  state: 'idle',
  step: null,
  done: 0,
  total: 0,
  counts,
  failures: [],
  error: null,
  startedAt: null,
  finishedAt: null,
  ...over,
});

const base = `/api/pancake-sync/config/${SHOP}/catalog-migration`;

describe('PancakeCatalogMigrationDialog', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('bảng duyệt: gợi ý từng dòng, dòng đã chuyển; Chuyển danh mục → xác nhận → POST đúng các dòng → tiến độ', async () => {
    let posted: unknown = null;
    let current = status();
    server.use(
      http.get(`${base}/preview`, () => HttpResponse.json(PREVIEW)),
      http.get(base, () => HttpResponse.json(current)),
      http.post(base, async ({ request }) => {
        posted = await request.json();
        current = status({ state: 'active', step: 'push', done: 1, total: 2 });
        return HttpResponse.json(current, { status: 202 });
      }),
    );
    renderApp(
      <PancakeCatalogMigrationDialog shop={PANCAKE_SHOP_FIXTURE} open onOpenChange={() => {}} />,
    );

    const r1 = (await screen.findByText('1 chai Sạch Trích Hút Arisyn 450ml')).closest('tr')!;
    expect(within(r1).getByText('Khớp')).toBeInTheDocument();
    expect(within(r1).getByText(/ARISYN-450 · Sạch Trích Hút Arisyn 450ml/)).toBeInTheDocument();
    const r4 = screen.getByText('10 chai Sạch Trích Hút Arisyn 450ml').closest('tr')!;
    expect(within(r4).getByText('Gần khớp — kiểm tra lại')).toBeInTheDocument();
    expect(within(r4).getByLabelText(/Số lượng thành phần/)).toHaveValue('10');
    const r9 = screen.getByText('2 chai SIÊU LOANG TRẢI ARISYN 100ML').closest('tr')!;
    expect(within(r9).getByText(/Không nối/)).toBeInTheDocument();
    const r2 = screen.getByText('3 chai Sạch Trích Hút Arisyn 450ml').closest('tr')!;
    expect(within(r2).getByText('Đã chuyển')).toBeInTheDocument();
    expect(screen.getByText(/2 sản phẩm sẽ chuyển · 1 combo mới/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển danh mục' }));
    const confirm = await screen.findByRole('dialog', { name: /Chuyển 2 sản phẩm/ });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Chuyển danh mục' }));

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toEqual({
      rows: [
        {
          externalProductId: 'nat-1',
          externalVariationId: 'nv-1',
          action: 'MAP',
          skuId: ARISYN.skuId,
        },
        {
          externalProductId: 'nat-4',
          externalVariationId: 'nv-4',
          action: 'NEW_COMBO',
          componentSkuId: ARISYN.skuId,
          qty: 10,
          name: '10 chai Sạch Trích Hút Arisyn 450ml',
          salePrice: '900000',
        },
        { externalProductId: 'nat-9', externalVariationId: 'nv-9', action: 'SKIP' },
      ],
    });
    expect(await screen.findByText(/Đang chạy: Đẩy hàng ERP lên POS \(1\/2\)/)).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith('Đã bắt đầu chuyển danh mục', expect.anything());
  });

  it('combo mới thiếu giá → báo lỗi dòng, nút Chuyển danh mục bị khoá', async () => {
    server.use(
      http.get(`${base}/preview`, () =>
        HttpResponse.json({ ...PREVIEW, rows: [{ ...PREVIEW.rows[1], posPrice: null }] }),
      ),
      http.get(base, () => HttpResponse.json(status())),
    );
    renderApp(
      <PancakeCatalogMigrationDialog shop={PANCAKE_SHOP_FIXTURE} open onOpenChange={() => {}} />,
    );
    expect(await screen.findByText('Nhập giá combo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chuyển danh mục' })).toBeDisabled();
  });

  it('hàng ERP gợi ý chưa có giá bán lẻ → cảnh báo lên POS giá 0', async () => {
    const unpriced = {
      ...PREVIEW.rows[0],
      suggestion: { ...PREVIEW.rows[0]!.suggestion, targetPriced: false },
    };
    server.use(
      http.get(`${base}/preview`, () => HttpResponse.json({ ...PREVIEW, rows: [unpriced] })),
      http.get(base, () => HttpResponse.json(status())),
    );
    renderApp(
      <PancakeCatalogMigrationDialog shop={PANCAKE_SHOP_FIXTURE} open onOpenChange={() => {}} />,
    );
    expect(await screen.findByText(/chưa có giá bán lẻ — lên POS sẽ giá 0/)).toBeInTheDocument();
  });

  it('đang có lượt chạy → mở thẳng tiến độ, không cần xem trước', async () => {
    server.use(
      http.get(base, () =>
        HttpResponse.json(status({ state: 'active', step: 'hide', done: 2, total: 2 })),
      ),
    );
    renderApp(
      <PancakeCatalogMigrationDialog shop={PANCAKE_SHOP_FIXTURE} open onOpenChange={() => {}} />,
    );
    expect(await screen.findByText('Đang chạy: Ẩn sản phẩm gốc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chạy nền, đóng' })).toBeInTheDocument();
  });

  it('xong có lỗi → liệt kê dòng chưa xong (hàng ERP chưa lên POS)', async () => {
    server.use(
      http.get(`${base}/preview`, () => HttpResponse.json({ ...PREVIEW, rows: [PREVIEW.rows[0]] })),
      http.get(base, () => HttpResponse.json(status())),
      http.post(base, () =>
        HttpResponse.json(
          status({
            state: 'completed',
            step: 'done',
            counts: { ...counts, linked: 1, pushFailed: 1 },
            failures: [
              { item: 'ARISYN-450 Sạch Trích Hút', reason: 'Pancake HTTP 400: weight is required' },
            ],
          }),
          { status: 202 },
        ),
      ),
    );
    renderApp(
      <PancakeCatalogMigrationDialog shop={PANCAKE_SHOP_FIXTURE} open onOpenChange={() => {}} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển danh mục' }));
    const confirm = await screen.findByRole('dialog', { name: /Chuyển 1 sản phẩm/ });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Chuyển danh mục' }));
    expect(await screen.findByText('Đã chuyển danh mục')).toBeInTheDocument();
    expect(screen.getByText(/weight is required/)).toBeInTheDocument();
    expect(screen.getByText('Đẩy lỗi: 1')).toBeInTheDocument();
  });

  it('POS không có sản phẩm → màn trống', async () => {
    server.use(
      http.get(`${base}/preview`, () => HttpResponse.json({ shopId: SHOP, rows: [] })),
      http.get(base, () => HttpResponse.json(status())),
    );
    renderApp(
      <PancakeCatalogMigrationDialog shop={PANCAKE_SHOP_FIXTURE} open onOpenChange={() => {}} />,
    );
    expect(await screen.findByText('Shop chưa có sản phẩm nào trên POS')).toBeInTheDocument();
  });
});
