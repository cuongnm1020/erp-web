import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ProductListScreen } from './components/product-list-screen';

// Radix Select (dialog sửa) đo kích thước trigger qua ResizeObserver — jsdom không có sẵn.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/catalog/products',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const uuid = (i: number) => `00000010-0000-4000-8000-${String(i).padStart(12, '0')}`;

const CATEGORY = { id: uuid(9001), code: 'PEN', name: 'Bút viết', parentId: null };
const BRAND = { id: uuid(9002), code: 'TL', name: 'Thiên Long', isActive: true };

/** Đúng shape `ProductListItemDto` trong openapi.json — đổi DTO ở backend thì sửa cả đây. */
function makeProducts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: uuid(i),
    code: `SP${String(i + 1).padStart(4, '0')}`,
    name: `Sản phẩm ${i + 1}`,
    categoryId: i % 2 === 0 ? CATEGORY.id : null,
    brandId: i % 3 === 0 ? BRAND.id : null,
    trackingMode: (['NONE', 'LOT', 'SERIAL'] as const)[i % 3]!,
    shelfLifeDays: i % 3 === 1 ? 365 : null,
    isActive: i % 10 !== 9,
    category: i % 2 === 0 ? CATEGORY : null,
    brand: i % 3 === 0 ? BRAND : null,
    skus: Array.from({ length: (i % 3) + 1 }, (_, j) => ({
      id: `${uuid(i)}-sku-${j}`,
      productId: uuid(i),
      code: `SP${String(i + 1).padStart(4, '0')}-${j + 1}`,
      name: `Sản phẩm ${i + 1} — SKU ${j + 1}`,
      baseUomId: uuid(9003),
      isActive: true,
    })),
  }));
}

const FIRST = makeProducts(1)[0]!;

/** Chưa có handler /api/products mặc định trong handlers.ts — dựng tại chỗ, chỉ cho file này. */
const productHandlers = [
  http.get('/api/products', ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    let all = makeProducts(87);
    if (q)
      all = all.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.get('/api/brands', () => HttpResponse.json([BRAND])),
  http.get('/api/categories', () => HttpResponse.json([CATEGORY])),
];

describe('ProductListScreen — CRUD /products (C-01)', () => {
  beforeEach(() => {
    search = '';
    server.use(...productHandlers);
  });

  it('loading → bảng render, tổng hiện trên tiêu đề, mã dẫn tới chi tiết theo id', async () => {
    renderApp(<ProductListScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText('Sản phẩm 1')).toBeInTheDocument();
    expect(screen.getByText('87 sản phẩm')).toBeInTheDocument();
    expect(screen.getByText('1–50 / 87 dòng')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: FIRST.code });
    expect(link).toHaveAttribute('href', `/catalog/products/${FIRST.id}`);
  });

  it('không có product.create → nút thêm ẩn (luật 7)', async () => {
    renderApp(<ProductListScreen />, { me: { ...ME_SALE, permissions: ['product.read'] } });
    await screen.findByText('Sản phẩm 1');
    expect(screen.queryByRole('button', { name: /Thêm sản phẩm/ })).not.toBeInTheDocument();
  });

  it('empty: EmptyState kèm hành động thêm sản phẩm', async () => {
    server.use(http.get('/api/products', () => HttpResponse.json({ items: [], total: 0 })));
    renderApp(<ProductListScreen />);
    expect(await screen.findByText('Chưa có sản phẩm nào')).toBeInTheDocument();
  });

  it('tạo: dialog gửi POST /products đúng CreateProductDto (không gửi field bỏ trống)', async () => {
    let body: unknown;
    server.use(
      http.post('/api/products', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 201 });
      }),
    );
    renderApp(<ProductListScreen />);
    await screen.findByText('Sản phẩm 1');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }));
    expect(await screen.findByLabelText(/Mã sản phẩm/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Mã sản phẩm/), { target: { value: 'SP-MOI' } });
    fireEvent.change(screen.getByLabelText(/Tên sản phẩm/), { target: { value: 'Bút thử API' } });
    // Nút submit trong dialog trùng tên với nút mở dialog — là nút cuối cùng
    const buttons = screen.getAllByRole('button', { name: 'Thêm sản phẩm' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({ code: 'SP-MOI', name: 'Bút thử API', trackingMode: 'NONE' });
  });

  it('sửa: dialog nạp sẵn giá trị dòng, gửi PATCH /products/:id đúng UpdateProductDto', async () => {
    let body: unknown;
    const ids: string[] = [];
    server.use(
      http.patch('/api/products/:id', async ({ params, request }) => {
        ids.push(params.id as string);
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    renderApp(<ProductListScreen />);
    await screen.findByText('Sản phẩm 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sửa' })[0]!);
    const nameInput = await screen.findByLabelText(/Tên sản phẩm/);
    expect(nameInput).toHaveValue(FIRST.name);
    expect(screen.getByLabelText(/Mã sản phẩm/)).toBeDisabled();
    fireEvent.change(nameInput, { target: { value: 'Sản phẩm 1 đổi tên' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(ids).toEqual([FIRST.id]));
    expect(body).toEqual({
      name: 'Sản phẩm 1 đổi tên',
      categoryId: CATEGORY.id,
      brandId: BRAND.id,
      trackingMode: 'NONE',
      isActive: true,
    });
  });

  it('không có product.delete → không có nút Xóa trên dòng (luật 7)', async () => {
    renderApp(<ProductListScreen />, {
      me: { ...ME_SALE, permissions: ['product.read', 'product.update'] },
    });
    await screen.findByText('Sản phẩm 1');
    expect(screen.getAllByRole('button', { name: 'Sửa' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  });

  it('xóa: qua hộp xác nhận (nêu rõ soft delete) → DELETE /products/:id', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete('/api/products/:id', ({ params }) => {
        deleted.push(params.id as string);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<ProductListScreen />);
    await screen.findByText('Sản phẩm 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa' })[0]!);
    expect(await screen.findByText(`Xóa sản phẩm ${FIRST.code}?`)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Sản phẩm và toàn bộ SKU chuyển Ngừng bán — tồn kho và chứng từ cũ giữ nguyên.',
      ),
    ).toBeInTheDocument();
    // Nút xác nhận trong dialog cũng tên "Xóa" — là nút cuối cùng
    const buttons = screen.getAllByRole('button', { name: 'Xóa' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(deleted).toEqual([FIRST.id]));
    await waitFor(() =>
      expect(screen.queryByText(`Xóa sản phẩm ${FIRST.code}?`)).not.toBeInTheDocument(),
    );
  });
});
