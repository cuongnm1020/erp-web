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
    http.get('/api/warehouses', () =>
      HttpResponse.json([{ id: 'wh-1', code: 'WH01', name: 'Kho HN-1' }]),
    ),
  ];
}

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

// jsdom không có object URL — stub cho hàng chờ ảnh của upload zone
let objectUrlSeq = 0;
URL.createObjectURL = vi.fn(() => `blob:preview-${(objectUrlSeq += 1)}`);
URL.revokeObjectURL = vi.fn();

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

  it('trường mới: kho mặc định + mô tả + tồn âm vào body product; giá nhập/bán + gram→kg + tồn đầu kỳ vào body SKU', async () => {
    push.mockClear();
    const bodies: { product?: unknown; sku?: unknown } = {};
    server.use(
      ...baseHandlers(),
      http.post('/api/products', async ({ request }) => {
        bodies.product = await request.json();
        return HttpResponse.json(
          {
            id: 'p-4',
            code: 'TL11',
            name: 'x',
            categoryId: null,
            brandId: null,
            trackingMode: 'NONE',
            shelfLifeDays: null,
            isActive: true,
            defaultWarehouseId: 'wh-1',
            description: 'Mô tả',
            internalNote: null,
            allowNegativeStock: true,
          },
          { status: 201 },
        );
      }),
      http.post('/api/products/:id/skus', async ({ request }) => {
        bodies.sku = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên sản phẩm *', 'Bút TL-11');
    fill('Mã cha *', 'TL11');
    fill('Mô tả', 'Mô tả bán hàng');
    fill('Ghi chú nội bộ', 'Ghi chú riêng');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cho phép bán tồn kho âm' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Kho mặc định' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));

    fill('Mã SKU', 'TL11-A');
    fill('Tên biến thể', 'Bút TL-11 A');
    fill('Giá nhập', '12000');
    fill('Giá bán', '19000');
    fill('Trọng lượng (g)', '250');
    fill('Tồn đầu kỳ', '50');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));

    await waitFor(() => expect(bodies.sku).toBeDefined());
    expect(bodies.product).toMatchObject({
      code: 'TL11',
      defaultWarehouseId: 'wh-1',
      description: 'Mô tả bán hàng',
      internalNote: 'Ghi chú riêng',
      allowNegativeStock: true,
    });
    expect(bodies.sku).toEqual({
      code: 'TL11-A',
      name: 'Bút TL-11 A',
      baseUom: 'PCS',
      purchasePrice: '12000',
      salePrice: '19000',
      weightKg: '0.25', // 250g → kg qua decimal.js
      openingQty: '50',
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
  });

  it('tồn đầu kỳ thiếu giá nhập / thiếu kho mặc định → chặn ngay ở client, không gọi API', async () => {
    const posts: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/products', () => {
        posts.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên sản phẩm *', 'Bút TL-12');
    fill('Mã cha *', 'TL12');
    fill('Mã SKU', 'TL12-A');
    fill('Tên biến thể', 'Bút TL-12 A');
    fill('Tồn đầu kỳ', '10'); // không giá nhập, không kho mặc định
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    expect(
      await screen.findByText('Nhập giá nhập để ghi giá vốn cho tồn đầu kỳ'),
    ).toBeInTheDocument();
    expect(screen.getByText('Chọn kho mặc định để ghi tồn đầu kỳ')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('upload zone: kéo thả ảnh vào hàng chờ (ảnh đầu = Ảnh chính), bỏ bớt được, lưu xong tự tải lên sản phẩm mới', async () => {
    push.mockClear();
    const imagePosts: Array<{ productId: string; size: number | null }> = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/products', () =>
        HttpResponse.json(
          {
            id: 'p-3',
            code: 'TL10',
            name: 'x',
            categoryId: null,
            brandId: null,
            trackingMode: 'NONE',
            shelfLifeDays: null,
            isActive: true,
          },
          { status: 201 },
        ),
      ),
      http.post('/api/products/:id/skus', () => HttpResponse.json({}, { status: 201 })),
      http.post('/api/products/:id/images', async ({ request, params }) => {
        const fd = await request.formData();
        const f = fd.get('file') as { size?: number } | null;
        imagePosts.push({ productId: params.id as string, size: f?.size ?? null });
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(<ProductFormScreen />);

    const dropzone = screen.getByRole('button', { name: 'Kéo thả ảnh vào đây hoặc bấm để chọn' });
    const a = new File([new Uint8Array([1, 2, 3, 4])], 'a.png', { type: 'image/png' });
    const b = new File([new Uint8Array([5, 6])], 'b.png', { type: 'image/png' });
    const bad = new File([new Uint8Array([7])], 'c.gif', { type: 'image/gif' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [a, b, bad] } });

    // gif bị loại kèm toast; 2 ảnh hợp lệ vào hàng chờ, ảnh đầu gắn badge Ảnh chính
    expect(await screen.findByText('2 ảnh chờ', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Ảnh chính')).toBeInTheDocument();
    expect(screen.getByAltText('a.png')).toBeInTheDocument();

    // Bỏ ảnh b khỏi hàng chờ
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ảnh khỏi hàng chờ: b.png' }));
    expect(screen.queryByAltText('b.png')).not.toBeInTheDocument();

    fill('Tên sản phẩm *', 'Bút TL-10');
    fill('Mã cha *', 'TL10');
    fill('Mã SKU', 'TL10-A');
    fill('Tên biến thể', 'Bút TL-10 A');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    // Sau khi tạo sản phẩm + SKU, ảnh còn trong hàng chờ tự POST lên đúng productId mới
    await waitFor(() => expect(imagePosts).toEqual([{ productId: 'p-3', size: 4 }]));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
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
    images: [
      {
        id: 'img-1',
        url: 'https://s3.local/erp-images/products/p-9/a.jpg?sig=x',
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
        isPrimary: true,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ],
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
        images: [],
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
    // Chỉ gửi field dirty — tên không đổi thì không nằm trong PATCH
    expect(patches[0]).toEqual({ skuId: 's-1', body: { isActive: false } });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
  });

  it('ảnh: gallery cha hiện ảnh chính; upload ảnh cha + ảnh biến thể gửi multipart field "file" lên S3 API', async () => {
    const uploads: Array<{ url: string; size: number | null }> = [];
    const NEW_IMG = {
      id: 'img-2',
      url: 'https://s3.local/erp-images/x.png?sig=y',
      fileName: 'x.png',
      mimeType: 'image/png',
      sizeBytes: 10,
      isPrimary: false,
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    server.use(
      ...baseHandlers(),
      http.get('/api/products/:id', () => HttpResponse.json(DETAIL)),
      // jsdom File → undici mất filename (thành 'blob') — môi trường test; browser thật giữ tên.
      // Vì vậy khẳng định theo SIZE, còn multipart field 'file' + content-type do msw parse được.
      http.post('/api/products/:id/images', async ({ request }) => {
        const fd = await request.formData();
        const f = fd.get('file') as { size?: number } | null;
        uploads.push({ url: 'product', size: f?.size ?? null });
        return HttpResponse.json(NEW_IMG, { status: 201 });
      }),
      http.post('/api/skus/:id/images', async ({ request }) => {
        const fd = await request.formData();
        const f = fd.get('file') as { size?: number } | null;
        uploads.push({ url: 'sku', size: f?.size ?? null });
        return HttpResponse.json(NEW_IMG, { status: 201 });
      }),
    );
    renderApp(<ProductFormScreen productId="p-9" />);
    await screen.findByDisplayValue('Bút bi TL-08 xanh');
    // Gallery cha: ảnh chính có badge
    expect(screen.getByText('Ảnh chính')).toBeInTheDocument();
    expect(screen.getByAltText('a.jpg')).toBeInTheDocument();

    const png = new File([new Uint8Array([1, 2, 3])], 'new.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Chọn ảnh sản phẩm'), { target: { files: [png] } });
    await waitFor(() => expect(uploads).toContainEqual({ url: 'product', size: 3 }));

    const skuPng = new File([new Uint8Array([4, 5])], 'sku.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Chọn ảnh biến thể'), { target: { files: [skuPng] } });
    await waitFor(() => expect(uploads).toContainEqual({ url: 'sku', size: 2 }));
  });
});
