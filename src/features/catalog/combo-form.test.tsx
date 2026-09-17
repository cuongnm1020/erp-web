import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ComboFormScreen } from './components/combo-form-screen';
import { comboAvailableFromRows } from './schema';

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
  usePathname: () => '/catalog/combos/new',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const uuid = (i: number) => `00000030-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** Đúng shape `SkuListRowDto` — dòng 3 là SKU combo, picker phải loại (không lồng combo). */
const SKUS = {
  items: [
    {
      skuId: uuid(1),
      code: 'SKU-A',
      name: 'Thuốc trừ sâu A',
      productId: uuid(101),
      productCode: 'SP-A',
      productName: 'Thuốc trừ sâu A',
      categoryName: null,
      brandName: null,
      baseUomCode: 'chai',
      trackingMode: 'NONE',
      barcodeCount: 1,
      isActive: true,
      isCombo: false,
      version: 0,
      thumbnailUrl: null,
      onHand: '100',
      reserved: '0',
      available: '100',
    },
    {
      skuId: uuid(2),
      code: 'SKU-B',
      name: 'Bình xịt B',
      productId: uuid(102),
      productCode: 'SP-B',
      productName: 'Bình xịt B',
      categoryName: null,
      brandName: null,
      baseUomCode: 'cái',
      trackingMode: 'NONE',
      barcodeCount: 1,
      isActive: true,
      isCombo: false,
      version: 0,
      thumbnailUrl: null,
      onHand: '10',
      reserved: '3',
      available: '7',
    },
    {
      skuId: uuid(3),
      code: 'CB-0001',
      name: 'Combo cũ',
      productId: uuid(103),
      productCode: 'CB-0001',
      productName: 'Combo cũ',
      categoryName: null,
      brandName: null,
      baseUomCode: 'PCS',
      trackingMode: 'NONE',
      barcodeCount: 1,
      isActive: true,
      isCombo: true,
      version: 0,
      thumbnailUrl: null,
      onHand: '0',
      reserved: '0',
      available: '0',
    },
  ],
  total: 3,
};

function baseHandlers() {
  return [
    http.get('/api/brands', () => HttpResponse.json([])),
    http.get('/api/categories', () => HttpResponse.json([])),
    http.get('/api/skus', () => HttpResponse.json(SKUS)),
  ];
}

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('comboAvailableFromRows — cùng công thức với server', () => {
  it('min floor(khả dụng ÷ định mức); thiếu tồn → null; âm → 0', () => {
    expect(
      comboAvailableFromRows([
        { qty: '2', available: '100' },
        { qty: '1', available: '7' },
      ]),
    ).toBe('7');
    expect(comboAvailableFromRows([{ qty: '2', available: '' }])).toBeNull();
    expect(comboAvailableFromRows([{ qty: '2', available: '-5' }])).toBe('0');
    expect(comboAvailableFromRows([])).toBeNull();
  });
});

describe('ComboFormScreen — tạo combo (POST /combos)', () => {
  it('validate chặn submit rỗng, KHÔNG gọi API', async () => {
    const posts: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/combos', () => {
        posts.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<ComboFormScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Lưu combo/ }));
    expect(await screen.findByText('Nhập tên combo')).toBeInTheDocument();
    expect(screen.getByText('Chọn SKU thành phần')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('happy path: chọn 2 thành phần (picker loại SKU combo), định mức, giá → POST đúng body, điều hướng về danh sách', async () => {
    push.mockClear();
    const bodies: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/combos', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          { id: uuid(200), code: 'CB-0002', name: 'Combo A+B', components: [] },
          { status: 201 },
        );
      }),
    );
    renderApp(<ComboFormScreen />);
    fill('Tên combo *', 'Combo A+B');
    fill('Giá bán', '150000');

    // Dòng 1: chọn SKU-A qua picker — SKU combo không được liệt kê
    fireEvent.click(screen.getAllByRole('combobox', { name: 'SKU thành phần' })[0]!);
    expect(await screen.findByText('Thuốc trừ sâu A')).toBeInTheDocument();
    expect(screen.queryByText('Combo cũ')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Thuốc trừ sâu A'));
    // Mã / ĐVT / khả dụng lấy từ option, không gọi thêm API
    expect(await screen.findByText('SKU-A')).toBeInTheDocument();
    expect(screen.getByText('chai')).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText('Định mức')[0]!, { target: { value: '2' } });

    // Dòng 2
    fireEvent.click(screen.getByRole('button', { name: 'Thêm thành phần' }));
    fireEvent.click(screen.getAllByRole('combobox', { name: 'SKU thành phần' })[1]!);
    fireEvent.click(await screen.findByText('Bình xịt B'));
    await screen.findByText('SKU-B');

    // Còn bán được = min(floor(100/2), floor(7/1)) = 7
    await waitFor(() => expect(screen.getByText('7 combo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Lưu combo/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      name: 'Combo A+B',
      searchAliases: [],
      salePrice: '150000',
      components: [
        { skuId: uuid(1), qty: '2' },
        { skuId: uuid(2), qty: '1' },
      ],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/combos'));
  });

  it('trùng SKU ở hai dòng → lỗi ngay trên dòng sau, không gọi API', async () => {
    const posts: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.post('/api/combos', () => {
        posts.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<ComboFormScreen />);
    fill('Tên combo *', 'Trùng');
    fireEvent.click(screen.getAllByRole('combobox', { name: 'SKU thành phần' })[0]!);
    fireEvent.click(await screen.findByText('Thuốc trừ sâu A'));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm thành phần' }));
    fireEvent.click(screen.getAllByRole('combobox', { name: 'SKU thành phần' })[1]!);
    // Dòng 1 đã hiện tên SKU trên nút chọn → option trong popover là phần tử CUỐI.
    const options = await screen.findAllByText('Thuốc trừ sâu A');
    fireEvent.click(options[options.length - 1]!);
    await waitFor(() => expect(screen.getAllByText('SKU-A')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: /Lưu combo/ }));
    expect(await screen.findByText('SKU này đã có ở dòng trên')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });
});

describe('ComboFormScreen — sửa combo (PATCH /combos/{id})', () => {
  it('đổ sẵn thành phần từ chi tiết; lưu gửi version + components thay toàn bộ', async () => {
    push.mockClear();
    const patches: unknown[] = [];
    server.use(
      ...baseHandlers(),
      http.get('/api/combos/:id', () =>
        HttpResponse.json({
          id: uuid(300),
          skuId: uuid(301),
          code: 'CB-0001',
          name: 'Combo A+B',
          isActive: true,
          baseUomCode: 'PCS',
          baseUomId: uuid(9),
          salePrice: '150000',
          componentCount: 1,
          available: '50',
          version: 3,
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
          categoryId: null,
          brandId: null,
          description: null,
          searchAliases: ['combo a'],
          components: [
            {
              skuId: uuid(1),
              code: 'SKU-A',
              name: 'Thuốc trừ sâu A',
              baseUomCode: 'chai',
              qty: '2',
              available: '100',
              isActive: true,
            },
          ],
        }),
      ),
      http.patch('/api/combos/:id', async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({ id: uuid(300), code: 'CB-0001', name: 'Combo A+B v2' });
      }),
    );
    renderApp(<ComboFormScreen comboId={uuid(300)} />);
    expect(await screen.findByDisplayValue('Combo A+B')).toBeInTheDocument();
    expect(screen.getByText('SKU-A')).toBeInTheDocument();
    expect(screen.getByLabelText('Mã combo')).toBeDisabled();
    fill('Tên combo *', 'Combo A+B v2');
    fireEvent.change(screen.getAllByLabelText('Định mức')[0]!, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      version: 3,
      name: 'Combo A+B v2',
      categoryId: null,
      brandId: null,
      searchAliases: ['combo a'],
      salePrice: '150000',
      isActive: true,
      components: [{ skuId: uuid(1), qty: '5' }],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/catalog/combos'));
  });
});
