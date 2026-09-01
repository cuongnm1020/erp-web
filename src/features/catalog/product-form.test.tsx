import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ProductFormScreen } from './components/product-form-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/catalog/products/new',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const UOMS = [
  { id: 'u-pcs', code: 'PCS', name: 'Cái', decimals: 0 },
  { id: 'u-box', code: 'BOX', name: 'Thùng', decimals: 0 },
];

function baseHandlers() {
  return [
    http.get('/api/uoms', () => HttpResponse.json(UOMS)),
    http.get('/api/brands', () => HttpResponse.json([])),
    http.get('/api/categories', () => HttpResponse.json([])),
  ];
}

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ProductFormScreen — tạo (design/Products/ProductForm)', () => {
  it('validate chặn submit rỗng, KHÔNG gọi API', async () => {
    const posts: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/products', () => {
        posts.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<ProductFormScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    expect(await screen.findByText('Nhập tên sản phẩm')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('happy path: POST /products rồi POST từng SKU (kèm baseUom + barcode) → điều hướng về danh sách', async () => {
    push.mockClear();
    const skuBodies: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/products', () =>
        HttpResponse.json(
          {
            id: 'p-1',
            code: 'TL08',
            name: 'Bút bi TL-08',
            categoryId: null,
            brandId: null,
            trackingMode: 'NONE',
            shelfLifeDays: null,
            isActive: true,
          },
          { status: 201 },
        ),
      ),
      http.post('/api/products/:id/skus', async ({ request, params }) => {
        skuBodies.push({ productId: params.id, body: await request.json() });
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên sản phẩm *', 'Bút bi TL-08');
    fill('Mã cha *', 'TL08');
    fill('Mã SKU', 'TL08-BLUE');
    fill('Tên biến thể', 'Bút bi TL-08 xanh');
    fill('Barcode lẻ', '8934567801234');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    await waitFor(() => expect(skuBodies).toHaveLength(1));
    expect(skuBodies[0]).toEqual({
      productId: 'p-1',
      body: {
        code: 'TL08-BLUE',
        name: 'Bút bi TL-08 xanh',
        baseUom: 'PCS',
        barcodes: [{ code: '8934567801234' }],
      },
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
  });

  it('lưu không atomic: dòng SKU lỗi → banner + lỗi đúng dòng, Lưu lại KHÔNG tạo trùng sản phẩm cha', async () => {
    push.mockClear();
    let productPosts = 0;
    let skuPosts = 0;
    server.use(
      ...baseHandlers(),
      http.post('/api/products', () => {
        productPosts += 1;
        return HttpResponse.json(
          {
            id: 'p-2',
            code: 'TL09',
            name: 'x',
            categoryId: null,
            brandId: null,
            trackingMode: 'NONE',
            shelfLifeDays: null,
            isActive: true,
          },
          { status: 201 },
        );
      }),
      http.post('/api/products/:id/skus', () => {
        skuPosts += 1;
        if (skuPosts === 1) {
          return HttpResponse.json(
            { code: 'UNIQUE_VIOLATION', message: 'duplicate', details: [], traceId: 't' },
            { status: 409 },
          );
        }
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên sản phẩm *', 'Bút bi TL-09');
    fill('Mã cha *', 'TL09');
    fill('Mã SKU', 'TL09-DUP');
    fill('Tên biến thể', 'Bút TL-09');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    expect(await screen.findByText(/1 dòng chưa hợp lệ — chưa lưu hết/)).toBeInTheDocument();
    expect(productPosts).toBe(1);
    expect(push).not.toHaveBeenCalled();
    // Sửa mã rồi lưu lại → cha không POST lần hai, chỉ SKU đi tiếp
    fill('Mã SKU', 'TL09-OK');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
    expect(productPosts).toBe(1);
    expect(skuPosts).toBe(2);
  });
});

describe('ProductFormScreen — sửa', () => {
  const DETAIL = {
    id: 'p-9',
    code: 'TL08',
    name: 'Bút bi TL-08',
    categoryId: null,
    brandId: null,
    trackingMode: 'NONE',
    shelfLifeDays: null,
    isActive: true,
    category: null,
    brand: null,
    skus: [
      {
        id: 's-1',
        productId: 'p-9',
        code: 'TL08-BLUE',
        name: 'Bút bi TL-08 xanh',
        baseUomId: 'u-pcs',
        isActive: true,
        baseUom: UOMS[0],
        barcodes: [
          { id: 'b1', code: '8934567801234', uomId: 'u-pcs', type: 'EAN13', uom: UOMS[0] },
        ],
        uomConversions: [],
      },
    ],
  };

  it('prefill từ GET /products/:id; đổi Ngừng bán → PATCH /skus/:id; barcode đã có chỉ đọc', async () => {
    push.mockClear();
    const patches: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.get('/api/products/:id', () => HttpResponse.json(DETAIL)),
      http.patch('/api/products/:id', () => HttpResponse.json({})),
      http.patch('/api/skus/:id', async ({ request, params }) => {
        patches.push({ skuId: params.id, body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    renderApp(<ProductFormScreen productId="p-9" />);
    expect(await screen.findByDisplayValue('Bút bi TL-08 xanh')).toBeInTheDocument();
    // Barcode sẵn có hiển thị chỉ đọc, không phải input
    expect(screen.queryByLabelText('Barcode lẻ')).not.toBeInTheDocument();
    expect(screen.getByText('8934567801234')).toBeInTheDocument();
    // Mã SKU đã lưu bị khóa
    expect(screen.getByDisplayValue('TL08-BLUE')).toBeDisabled();

    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ngừng bán' }));
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      skuId: 's-1',
      body: { name: 'Bút bi TL-08 xanh', isActive: false },
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
  });
});
