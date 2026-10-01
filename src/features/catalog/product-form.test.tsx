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
  { id: 'u-plt', code: 'PLT', name: 'Pallet', decimals: 0 },
];

const CONTAINER_TYPES = [
  { id: 'ct-carton', code: 'CARTON', name: 'Thùng', isActive: true },
  { id: 'ct-pallet', code: 'PALLET', name: 'Pallet', isActive: true },
];

function baseHandlers() {
  return [
    http.get('/api/uoms', () => HttpResponse.json(UOMS)),
    http.get('/api/container-types', () => HttpResponse.json(CONTAINER_TYPES)),
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
    expect(await screen.findByText('Nhập tên thương mại')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('ô mã sản phẩm + tên xuất hóa đơn + mức tồn kho có mặt (2026-09-22); mã SKU / barcode lẻ vẫn ẩn; cân nặng (g) + ĐVT phụ có mặt', async () => {
    server.use(...baseHandlers());
    renderApp(<ProductFormScreen />);
    await screen.findByLabelText('Tên thương mại *');
    expect(screen.getByLabelText('Mã sản phẩm')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên xuất hóa đơn')).toBeInTheDocument();
    expect(screen.getByLabelText('Mức tồn kho')).toBeInTheDocument();
    for (const label of ['Mã SKU', 'Barcode lẻ']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText('Cân nặng (g)')).toBeInTheDocument();
    // Quy cách nhập kho cấp sản phẩm (§12): thùng luôn chọn được; pallet khoá tới khi khai thùng.
    expect(screen.getByRole('combobox', { name: 'ĐVT thùng' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'ĐVT pallet' })).toBeDisabled();
    expect(screen.getByText('Khai thùng trước')).toBeInTheDocument();
    // 2026-10-01: không còn giá nhập / tồn đầu kỳ / ĐVT bán mặc định trên form sản phẩm
    for (const label of ['Giá nhập', 'Tồn đầu kỳ', 'ĐVT bán mặc định']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
    expect(screen.getByRole('combobox', { name: 'Đơn vị bán chính *' })).toBeEnabled();
    expect(screen.queryByRole('combobox', { name: 'Theo dõi lô / HSD' })).not.toBeInTheDocument();
  });

  it('happy path (sản phẩm đơn, mặc định): POST /products rồi POST một SKU KHÔNG code/name (API thừa kế mã + tên) → điều hướng về danh sách', async () => {
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
    fill('Tên thương mại *', 'Bút bi TL-08');
    // Sản phẩm đơn: không có ô "Tên biến thể", không có nút "Thêm biến thể"
    expect(screen.queryByLabelText('Tên biến thể')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm biến thể' })).not.toBeInTheDocument();
    expect(screen.getByText('Giá & tồn kho', { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    await waitFor(() => expect(skuBodies).toHaveLength(1));
    // Không gửi code/name — API lấy mã + tên sản phẩm; không barcode (backend tự sinh QR = mã SKU)
    expect(skuBodies[0]).toEqual({ productId: 'p-1', body: { baseUom: 'PCS' } });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
  });

  it('đóng gói hai cấp (§12): BOX = 10 PCS rồi PLT = 5 BOX → conversions [BOX 10 CARTON, PLT 50 PALLET] (factor về ĐVT cơ sở) + barcode theo ĐVT', async () => {
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
      http.post('/api/products/:id/skus', async ({ request }) => {
        skuBodies.push(await request.json());
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên thương mại *', 'Bút bi TL-08');
    // Chưa chọn ĐVT thùng → số lượng / barcode thùng bị khoá, pallet bị khoá
    expect(screen.getByLabelText('Số PCS trong 1 thùng')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'ĐVT pallet' })).toBeDisabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT thùng' }));
    fireEvent.click(await screen.findByRole('option', { name: 'BOX — Thùng' }));
    fill('Số PCS trong 1 thùng', '10');
    expect(screen.getByText('1 BOX = ? PCS')).toBeInTheDocument();
    fill('Barcode BOX', '8930000000012');
    // Có thùng → chọn được pallet; số thùng / pallet nhập theo chuỗi, form tự nhân ra ĐVT cơ sở
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'ĐVT pallet' })).toBeEnabled());
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT pallet' }));
    fireEvent.click(await screen.findByRole('option', { name: 'PLT — Pallet' }));
    fill('Số thùng trong 1 pallet', '5');
    expect(screen.getByText('1 PLT = ? BOX = 50 PCS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    await waitFor(() => expect(skuBodies).toHaveLength(1));
    expect(skuBodies[0]).toEqual({
      baseUom: 'PCS',
      conversions: [
        { uom: 'BOX', factor: '10', containerType: 'CARTON' },
        { uom: 'PLT', factor: '50', containerType: 'PALLET' },
      ],
      barcodes: [{ code: '8930000000012', uom: 'BOX' }],
    });
  });

  it('đóng gói: số lượng trong thùng phải nguyên > 0, số thùng trong pallet phải nguyên ≥ 2 — chặn submit, KHÔNG gọi API', async () => {
    const posts: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/products', () => {
        posts.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên thương mại *', 'Bút bi TL-08');
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT thùng' }));
    fireEvent.click(await screen.findByRole('option', { name: 'BOX — Thùng' }));
    fill('Số PCS trong 1 thùng', '2.5');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'ĐVT pallet' })).toBeEnabled());
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT pallet' }));
    fireEvent.click(await screen.findByRole('option', { name: 'PLT — Pallet' }));
    fill('Số thùng trong 1 pallet', '1');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    expect(
      await screen.findByText('Số lượng trong thùng phải là số nguyên lớn hơn 0'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Số thùng trong pallet phải là số nguyên từ 2 trở lên'),
    ).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('nhiều biến thể: "Thêm biến thể" copy tên sản phẩm, mã SKU đánh số theo dòng, xóa được dòng chưa lưu', async () => {
    push.mockClear();
    const skuCodes: string[] = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/products', () =>
        HttpResponse.json(
          {
            id: 'p-6',
            code: 'BVTV-0007',
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
      http.post('/api/products/:id/skus', async ({ request }) => {
        skuCodes.push(((await request.json()) as { code: string }).code);
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên thương mại *', 'Thuốc trĩ');
    fireEvent.click(screen.getByRole('checkbox', { name: /Có nhiều biến thể/ }));
    expect(await screen.findByLabelText('Tên biến thể')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm biến thể' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm biến thể' }));
    expect(screen.getByText('3 dòng · 3 mới', { exact: false })).toBeInTheDocument();
    // Dòng thêm mới đã điền sẵn tên sản phẩm
    const names = screen.getAllByLabelText('Tên biến thể');
    expect(names).toHaveLength(3);
    expect(names[1]).toHaveValue('Thuốc trĩ');
    fireEvent.change(names[0]!, { target: { value: 'Chai 100ml' } });
    fireEvent.change(names[1]!, { target: { value: 'Chai 500ml' } });
    // Xóa dòng 3 (chưa lưu)
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa dòng' })[2]!);
    expect(screen.getAllByLabelText('Tên biến thể')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    await waitFor(() => expect(skuCodes).toEqual(['BVTV-0007-1', 'BVTV-0007-2']));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
  });

  it('bỏ trống mã → POST không có code (backend tự sinh); tên gọi khác tách theo phẩy, bỏ trùng/rỗng', async () => {
    push.mockClear();
    let productBody: Record<string, unknown> | undefined;
    server.use(
      ...baseHandlers(),
      http.post('/api/products', async ({ request }) => {
        productBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: 'p-5',
            code: 'SP-0001',
            name: 'Thuốc bật chồi X',
            categoryId: null,
            brandId: null,
            trackingMode: 'NONE',
            shelfLifeDays: null,
            isActive: true,
            searchAliases: ['thuốc bật chồi', 'cheshaland'],
            version: 0,
          },
          { status: 201 },
        );
      }),
      http.post('/api/products/:id/skus', () => HttpResponse.json({}, { status: 201 })),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên thương mại *', 'Thuốc bật chồi X');
    fill('Tên gọi khác', 'thuốc bật chồi, cheshaland, , thuốc bật chồi');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    await waitFor(() => expect(productBody).toBeDefined());
    expect(productBody).not.toHaveProperty('code');
    expect(productBody!.searchAliases).toEqual(['thuốc bật chồi', 'cheshaland']);
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
    fill('Tên thương mại *', 'Bút bi TL-09');
    fireEvent.click(screen.getByRole('checkbox', { name: /Có nhiều biến thể/ }));
    fill('Tên biến thể', 'Bút TL-09');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    expect(await screen.findByText(/1 dòng chưa hợp lệ — chưa lưu hết/)).toBeInTheDocument();
    expect(productPosts).toBe(1);
    expect(push).not.toHaveBeenCalled();
    // Ô mã SKU ẩn → lỗi dòng gắn vào "Tên biến thể" (aria-invalid) và focus vào đó
    const nameInput = screen.getByLabelText('Tên biến thể');
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveFocus();
    // Lưu lại → cha không POST lần hai, chỉ SKU đi tiếp
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
    expect(productPosts).toBe(1);
    expect(skuPosts).toBe(2);
  });

  it('trường mới: kho mặc định + mô tả + tồn âm vào body product; chỉ giá bán vào body SKU (không giá nhập / tồn đầu kỳ)', async () => {
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
    fill('Tên thương mại *', 'Bút TL-11');
    // 2026-09-22: mã nhập tay, tên xuất hóa đơn, mức tồn kho (string decimal — luật 10)
    fill('Mã sản phẩm', 'TL11');
    fill('Tên xuất hóa đơn', 'Bút bi Thiên Long TL-11 (hộp 20)');
    fill('Mức tồn kho', '500');
    fill('Mô tả', 'Mô tả bán hàng');
    fill('Ghi chú nội bộ', 'Ghi chú riêng');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cho phép bán tồn kho âm' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Kho mặc định' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));

    fill('Giá bán / PCS', '19000');
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));

    await waitFor(() => expect(bodies.sku).toBeDefined());
    expect(bodies.product).toMatchObject({
      code: 'TL11',
      invoiceName: 'Bút bi Thiên Long TL-11 (hộp 20)',
      reorderLevel: '500',
      defaultWarehouseId: 'wh-1',
      description: 'Mô tả bán hàng',
      internalNote: 'Ghi chú riêng',
      allowNegativeStock: true,
    });
    expect(bodies.sku).toEqual({ baseUom: 'PCS', salePrice: '19000' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
  });

  it('nhiều biến thể kế thừa quy cách sản phẩm (BOX = 10 PCS); dòng tick "Quy cách riêng" gửi BOX = 12', async () => {
    const skuBodies: Array<Record<string, unknown>> = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/products', () =>
        HttpResponse.json(
          {
            id: 'p-7',
            code: 'BVTV-0008',
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
      http.post('/api/products/:id/skus', async ({ request }) => {
        skuBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(<ProductFormScreen />);
    fill('Tên thương mại *', 'Vua Bật Chồi');
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT thùng' }));
    fireEvent.click(await screen.findByRole('option', { name: 'BOX — Thùng' }));
    fill('Số PCS trong 1 thùng', '10');
    fireEvent.click(screen.getByRole('checkbox', { name: /Có nhiều biến thể/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm biến thể' }));
    const names = screen.getAllByLabelText('Tên biến thể');
    fireEvent.change(names[0]!, { target: { value: 'Gói 40gr' } });
    fireEvent.change(names[1]!, { target: { value: 'Gói 100gr' } });
    expect(screen.getAllByText('Theo sản phẩm: 1 BOX = 10 PCS')).toHaveLength(2);
    // Dòng 2 khai riêng: 1 BOX = 12 PCS
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Quy cách riêng' })[1]!);
    fireEvent.click(await screen.findByRole('combobox', { name: 'ĐVT thùng riêng' }));
    fireEvent.click(await screen.findByRole('option', { name: 'BOX — Thùng' }));
    const perInputs = screen.getAllByLabelText('Số PCS trong 1 thùng');
    fireEvent.change(perInputs[1]!, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu sản phẩm/ }));
    await waitFor(() => expect(skuBodies).toHaveLength(2));
    expect(skuBodies[0]!.conversions).toEqual([
      { uom: 'BOX', factor: '10', containerType: 'CARTON' },
    ]);
    expect(skuBodies[1]!.conversions).toEqual([
      { uom: 'BOX', factor: '12', containerType: 'CARTON' },
    ]);
    expect(skuBodies[0]).not.toHaveProperty('salesUom');
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

    fill('Tên thương mại *', 'Bút TL-10');
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
    searchAliases: ['bút tl'],
    invoiceName: 'Bút bi Thiên Long TL-08 (hộp)',
    reorderLevel: '120.000000',
    version: 7,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
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
    hasVariants: true,
    skus: [
      {
        id: 's-1',
        productId: 'p-9',
        code: 'TL08-BLUE',
        name: 'Bút bi TL-08 xanh',
        baseUomId: 'u-pcs',
        isActive: true,
        version: 5,
        trackingMode: 'NONE',
        shelfLifeDays: null,
        taxRateId: null,
        salesUomId: null,
        salesUom: null,
        baseUom: UOMS[0],
        barcodes: [
          { id: 'b1', code: '8934567801234', uomId: 'u-pcs', type: 'EAN13', uom: UOMS[0] },
        ],
        uomConversions: [],
        images: [],
      },
    ],
  };

  it('prefill từ GET /products/:id; đổi Ngừng bán → PATCH /skus/:id kèm version; barcode đã có chỉ đọc', async () => {
    push.mockClear();
    const patches: unknown[] = [];
    const productPatches: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.get('/api/products/:id', () => HttpResponse.json(DETAIL)),
      http.patch('/api/products/:id', async ({ request }) => {
        productPatches.push(await request.json());
        return HttpResponse.json({});
      }),
      http.patch('/api/skus/:id', async ({ request, params }) => {
        patches.push({ skuId: params.id, body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    renderApp(<ProductFormScreen productId="p-9" />);
    expect(await screen.findByDisplayValue('Bút bi TL-08 xanh')).toBeInTheDocument();
    // Alias prefill vào ô "Tên gọi khác".
    expect(screen.getByDisplayValue('bút tl')).toBeInTheDocument();
    // Mã sản phẩm sửa được (2026-09-22); mã SKU / barcode vẫn ẩn — mã hiện ở mô tả header
    expect(screen.getByText('Sản phẩm cha TL08 · 1 biến thể')).toBeInTheDocument();
    expect(screen.getByLabelText('Mã sản phẩm')).toHaveValue('TL08');
    expect(screen.getByLabelText('Tên xuất hóa đơn')).toHaveValue('Bút bi Thiên Long TL-08 (hộp)');
    expect(screen.getByLabelText('Mức tồn kho')).toHaveValue('120.000000');
    expect(screen.queryByDisplayValue('TL08-BLUE')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Barcode lẻ')).not.toBeInTheDocument();
    // Đơn vị bán chính khóa khi sửa
    expect(screen.getByRole('combobox', { name: 'Đơn vị bán chính *' })).toBeDisabled();

    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ngừng bán' }));
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    // PATCH product mang version của detail (optimistic locking); code không dirty → không gửi;
    // tên xuất hóa đơn / mức tồn kho gửi lại nguyên giá trị đang có
    expect(productPatches[0]).toMatchObject({
      version: 7,
      searchAliases: ['bút tl'],
      invoiceName: 'Bút bi Thiên Long TL-08 (hộp)',
      reorderLevel: '120.000000',
    });
    expect(productPatches[0]).not.toHaveProperty('code');
    // Chỉ gửi field dirty — tên không đổi thì không nằm trong PATCH; version luôn kèm
    expect(patches[0]).toEqual({ skuId: 's-1', body: { version: 5, isActive: false } });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/products'));
  });

  it('409 version lệch (người khác vừa sửa) → banner xung đột + nút tải lại, KHÔNG điều hướng', async () => {
    push.mockClear();
    server.use(
      ...baseHandlers(),
      http.get('/api/products/:id', () => HttpResponse.json(DETAIL)),
      http.patch('/api/products/:id', () =>
        HttpResponse.json(
          { code: 'CONFLICT', message: 'đã bị sửa', details: [], traceId: 't1' },
          { status: 409 },
        ),
      ),
    );
    renderApp(<ProductFormScreen productId="p-9" />);
    await screen.findByDisplayValue('Bút bi TL-08 xanh');
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    // Câu từ bộ dịch (luật 6) — không render message thô của server.
    expect(
      await screen.findByText('Dữ liệu đã thay đổi ở nơi khác. Tải lại rồi thao tác lại.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải lại dữ liệu' })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('ảnh: gallery cha hiện ảnh chính; upload ảnh cha gửi multipart field "file" lên S3 API (ô ảnh biến thể đang ẩn)', async () => {
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

    // Ô ảnh biến thể (SkuImageCell) đang ẩn trên form — không có input upload theo SKU
    expect(screen.queryByLabelText('Chọn ảnh biến thể')).not.toBeInTheDocument();
    expect(uploads.filter((u) => u.url === 'sku')).toHaveLength(0);
  });
});
