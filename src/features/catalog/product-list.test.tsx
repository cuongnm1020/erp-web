import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ProductListScreen } from './components/product-list-screen';

// Radix (checkbox, dialog) đo kích thước qua ResizeObserver — jsdom không có sẵn.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

let search = '';
// router.replace ghi lại query để rerender mô phỏng URL đổi (useListState, luật 8).
const replace = vi.fn((url: string) => {
  const i = url.indexOf('?');
  search = i === -1 ? '' : url.slice(i + 1);
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/catalog/products',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const uuid = (i: number) => `00000020-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** Đúng shape `SkuListRowDto` trong openapi.json — đổi DTO ở backend thì sửa cả đây. */
const ROWS = [
  {
    skuId: uuid(1),
    code: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    productId: uuid(101),
    productCode: 'SP-TL08',
    productName: 'Bút bi Thiên Long TL-08',
    categoryName: 'Bút viết / Bút bi',
    brandName: 'Thiên Long',
    baseUomCode: 'cái',
    barcodeCount: 3,
    isActive: true,
    thumbnailUrl: 'https://s3.local/erp-images/skus/tl08-blue.jpg?sig=abc',
    onHand: '31200.000000',
    reserved: '1240.000000',
    available: '29960.000000',
  },
  {
    skuId: uuid(2),
    code: 'TP-BK48-100',
    name: 'Băng keo trong 48mm × 100y Tiến Phát',
    productId: uuid(102),
    productCode: 'SP-BK48',
    productName: 'Băng keo trong 48mm × 100y Tiến Phát',
    categoryName: 'Băng keo',
    brandName: 'Tiến Phát',
    baseUomCode: 'cây',
    barcodeCount: 2,
    isActive: true,
    thumbnailUrl: null,
    // Khả dụng ÂM: đã giữ cho đơn nhiều hơn tồn thực → phải hiện chữ đỏ.
    onHand: '46.000000',
    reserved: '60.000000',
    available: '-14.000000',
  },
  {
    skuId: uuid(3),
    code: 'DL-25K',
    name: 'Sổ da Deli 25K bìa cứng',
    productId: uuid(103),
    productCode: 'SP-DL25',
    productName: 'Sổ da Deli 25K bìa cứng',
    categoryName: null,
    brandName: null,
    baseUomCode: 'cuốn',
    barcodeCount: 1,
    isActive: false,
    thumbnailUrl: null,
    onHand: '0.000000',
    reserved: '0.000000',
    available: '0.000000',
  },
];

const FIRST = ROWS[0]!;

// formatQuantity dùng dấu trừ typographic U+2212, không phải dấu gạch ASCII.
const MINUS_14 = '−14';

/** Request danh sách (take ≠ 1) — hai query đếm take=1 không tính vào đây. */
let listCalls: URLSearchParams[] = [];

const skuHandlers = [
  http.get('/api/skus', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const take = Number(url.searchParams.get('take') ?? 50);
    if (take === 1) {
      // Hai query đếm cho dòng mô tả trên tiêu đề.
      return HttpResponse.json({ items: [], total: status === 'active' ? 312 : 18 });
    }
    listCalls.push(url.searchParams);
    let items = ROWS;
    if (status === 'active') items = ROWS.filter((r) => r.isActive);
    if (status === 'inactive') items = ROWS.filter((r) => !r.isActive);
    return HttpResponse.json({ items, total: items.length });
  }),
];

describe('ProductListScreen — GET /skus (design/Products/ProductList)', () => {
  beforeEach(() => {
    search = '';
    listCalls = [];
    replace.mockClear();
    server.use(...skuHandlers);
  });

  it('render dòng: SKU dẫn tới sản phẩm theo productId, tên cắt bằng title, đếm trên tiêu đề', async () => {
    renderApp(<ProductListScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText(FIRST.code)).toBeInTheDocument();
    // Đếm từ hai query take=1 theo trạng thái.
    expect(await screen.findByText('312 SKU đang bán · 18 ngừng bán')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: FIRST.code });
    expect(link).toHaveAttribute('href', `/catalog/products/${FIRST.productId}`);
    // Tên dài cắt bằng … — hover hiện đủ qua title.
    expect(screen.getByTitle(FIRST.name)).toBeInTheDocument();
    // Tên sản phẩm cha hiện dòng phụ khi khác tên SKU.
    expect(screen.getByText(FIRST.productName)).toBeInTheDocument();
    // Thumbnail: dòng có thumbnailUrl hiện <img> presigned; dòng không có → ô placeholder
    const imgs = document.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute('src')).toContain('s3.local/erp-images');
  });

  it('khả dụng âm hiện chữ đỏ (giữ nhiều hơn tồn thực)', async () => {
    renderApp(<ProductListScreen />);
    const cell = await screen.findByText(MINUS_14);
    expect(cell.className).toContain('text-destructive');
    expect(cell.className).toContain('font-semibold');
  });

  it('bấm tab "Đang bán" → refetch với status=active (lọc phía server, luật 8)', async () => {
    const { rerender } = renderApp(<ProductListScreen />);
    await screen.findByText(FIRST.code);
    fireEvent.click(screen.getByRole('tab', { name: 'Đang bán' }));
    expect(replace).toHaveBeenCalledWith('/catalog/products?status=active', { scroll: false });
    rerender(<ProductListScreen />);
    await waitFor(() => {
      expect(listCalls.at(-1)?.get('status')).toBe('active');
    });
    expect(screen.getByRole('tab', { name: 'Đang bán' })).toHaveAttribute('aria-selected', 'true');
  });

  it('bulk Ngừng bán: chọn 2 dòng → xác nhận → PATCH /skus/:id từng SKU, bỏ chọn sau khi xong', async () => {
    const patched: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.patch('/api/skus/:id', async ({ params, request }) => {
        patched.push({ id: params.id as string, body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    renderApp(<ProductListScreen />);
    await screen.findByText(FIRST.code);
    // Query lại giữa hai lần bấm — bảng re-render sau mỗi lần chọn.
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[1]!);
    // "Đã chọn 2" hiện cả ở footer phân trang — chỉ nhìn trong thanh bulk.
    const bulkBar = screen.getByRole('toolbar', { name: 'Hành động hàng loạt' });
    expect(within(bulkBar).getByText('Đã chọn 2')).toBeInTheDocument();
    fireEvent.click(within(bulkBar).getByRole('button', { name: 'Ngừng bán' }));
    expect(await screen.findByText('Ngừng bán 2 SKU?')).toBeInTheDocument();
    expect(
      screen.getByText('SKU chuyển Ngừng bán — tồn kho và chứng từ giữ nguyên.'),
    ).toBeInTheDocument();
    // Nút xác nhận trong dialog trùng tên nút bulk — là nút cuối cùng.
    const buttons = screen.getAllByRole('button', { name: 'Ngừng bán' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(patched).toHaveLength(2));
    expect(patched.map((p) => p.id).sort()).toEqual([ROWS[0]!.skuId, ROWS[1]!.skuId].sort());
    expect(patched.every((p) => JSON.stringify(p.body) === '{"isActive":false}')).toBe(true);
    // Xong thì bỏ chọn — thanh bulk biến mất.
    await waitFor(() =>
      expect(
        screen.queryByRole('toolbar', { name: 'Hành động hàng loạt' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('không có product.update → không có bulk Ngừng bán, không có nút sửa trên dòng (luật 7)', async () => {
    renderApp(<ProductListScreen />, { me: { ...ME_SALE, permissions: ['product.read'] } });
    await screen.findByText(FIRST.code);
    expect(screen.queryByRole('link', { name: 'Sửa' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    expect(screen.queryByRole('button', { name: 'Ngừng bán' })).not.toBeInTheDocument();
  });

  it('Xuất CSV là anchor thật tới endpoint export (cookie đi kèm)', async () => {
    renderApp(<ProductListScreen />);
    await screen.findByText(FIRST.code);
    const csv = screen.getByRole('link', { name: 'Xuất CSV' });
    expect(csv).toHaveAttribute('href', '/api/exports/skus?format=csv');
  });
});
