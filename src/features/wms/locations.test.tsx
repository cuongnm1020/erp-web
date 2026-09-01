import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { WarehousesScreen } from './components/warehouses-screen';

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

// Kho wh-1 được chọn sẵn qua ?wh= (luật 8 — trạng thái chọn kho nằm trên URL)
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/warehouses',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('wh=wh-1'),
}));

const WAREHOUSES = [
  { id: 'wh-1', code: 'WH01', name: 'Kho Hà Nội 1', address: null, isActive: true },
];

const loc = (
  id: string,
  code: string,
  type: string,
  children: unknown[] = [],
  extra: Record<string, unknown> = {},
) => ({
  id,
  warehouseId: 'wh-1',
  parentId: null,
  code,
  type,
  barcode: null,
  pickSequence: null,
  isPickable: true,
  isActive: true,
  fixedSkuId: null,
  fixedSku: null,
  children,
  ...extra,
});

const TREE = [
  loc('z-a', 'A', 'ZONE', [
    loc('a-01', 'A01', 'AISLE', [
      loc('b-01', 'A01-01', 'BIN', [], {
        barcode: 'LOC-A01-01',
        fixedSkuId: 'sku-1',
        fixedSku: { id: 'sku-1', code: 'P001-1', name: 'Bút bi xanh' },
      }),
    ]),
  ]),
  loc('st-1', 'ST', 'STAGING', [], { isActive: false }),
];

const SKU_LIST = {
  items: [
    {
      skuId: 'sku-2',
      code: 'P002-1',
      name: 'Bút bi đỏ',
      productId: 'p-2',
      productCode: 'P002',
      productName: 'Bút bi',
      categoryName: null,
      brandName: null,
      baseUomCode: 'PCS',
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

describe('LocationsPanel — cây vị trí kho + CRUD', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)),
      http.get('/api/warehouses/:id/locations/tree', () => HttpResponse.json(TREE)),
    );
  });

  it('kho chọn qua ?wh= hiện cây: node gốc mở sẵn, node sâu đóng, mở bằng chevron', async () => {
    renderApp(<WarehousesScreen />);
    expect(await screen.findByText('Vị trí kho WH01')).toBeInTheDocument();
    expect(await screen.findByText('4 vị trí')).toBeInTheDocument();
    // depth 0 mở sẵn → thấy A01; depth 1 đóng → chưa thấy BIN
    expect(screen.getByText('A01')).toBeInTheDocument();
    expect(screen.queryByText('A01-01')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng A01' }));
    expect(screen.getByText('A01-01')).toBeInTheDocument();
    // Trạng thái Ngừng dùng của khu tập kết
    expect(screen.getByText('Ngừng dùng')).toBeInTheDocument();
  });

  it('thêm vị trí gốc: dialog → POST /warehouses/:id/locations không parentId', async () => {
    const posts: unknown[] = [];
    server.use(
      http.post('/api/warehouses/:id/locations', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(loc('z-b', 'B', 'ZONE'), { status: 201 });
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Vị trí kho WH01');
    await screen.findByText('A01');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vị trí' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mã vị trí'), { target: { value: 'B' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm vị trí' }));
    await waitFor(() => expect(posts).toEqual([{ code: 'B', type: 'ZONE', isPickable: true }]));
  });

  it('thêm vị trí con từ nút trên dòng → POST kèm parentId của node đó', async () => {
    const posts: unknown[] = [];
    server.use(
      http.post('/api/warehouses/:id/locations', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(loc('b-02', 'A01-02', 'BIN'), { status: 201 });
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Vị trí kho WH01');
    await screen.findByText('A01');
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng A01' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vị trí con trong A01' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mã vị trí'), {
      target: { value: 'A01-02' },
    });
    fireEvent.change(within(dialog).getByLabelText('Thứ tự pick'), { target: { value: '7' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm vị trí' }));
    await waitFor(() =>
      expect(posts).toEqual([
        { code: 'A01-02', type: 'BIN', parentId: 'a-01', pickSequence: 7, isPickable: true },
      ]),
    );
  });

  it('sửa vị trí: mã khóa → PATCH /warehouses/locations/:id (không gửi code/type)', async () => {
    const patches: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.patch('/api/warehouses/locations/:locationId', async ({ request, params }) => {
        patches.push({ id: params.locationId as string, body: await request.json() });
        return HttpResponse.json(loc('z-a', 'A', 'ZONE'));
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Vị trí kho WH01');
    await screen.findByText('A01');
    // Nút Sửa đầu tiên là của bảng kho — trong panel vị trí, dòng đầu là zone A
    const panel = screen.getByText('Vị trí kho WH01').closest('section')!;
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Sửa' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('A')).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Barcode'), {
      target: { value: 'LOC-ZONE-A' },
    });
    fireEvent.click(within(dialog).getByLabelText('Cho phép pick hàng từ vị trí này'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(patches).toEqual([
        {
          id: 'z-a',
          body: { barcode: 'LOC-ZONE-A', isPickable: false, isActive: true, fixedSkuId: null },
        },
      ]),
    );
  });

  it('cột SKU cố định: bin đã gán hiện mã + tên SKU', async () => {
    renderApp(<WarehousesScreen />);
    await screen.findByText('Vị trí kho WH01');
    await screen.findByText('A01');
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng A01' }));
    expect(screen.getByText('P001-1')).toBeInTheDocument();
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
  });

  it('gán SKU cho bin: sửa BIN → chọn SKU từ picker → PATCH gửi fixedSkuId', async () => {
    const patches: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.get('/api/skus', () => HttpResponse.json(SKU_LIST)),
      http.patch('/api/warehouses/locations/:locationId', async ({ request, params }) => {
        patches.push({ id: params.locationId as string, body: await request.json() });
        return HttpResponse.json(loc('b-01', 'A01-01', 'BIN'));
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Vị trí kho WH01');
    await screen.findByText('A01');
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng A01' }));
    const panel = screen.getByText('Vị trí kho WH01').closest('section')!;
    // Dòng bin A01-01 là dòng thứ 3 trong panel (A, A01, A01-01, ST) — nút Sửa index 2
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Sửa' })[2]!);
    const dialog = await screen.findByRole('dialog');
    // Picker prefill SKU đang gán
    const picker = within(dialog).getByRole('combobox', { name: 'SKU cố định' });
    expect(picker).toHaveTextContent('Bút bi xanh (P001-1)');
    fireEvent.click(picker);
    fireEvent.click(await screen.findByText('Bút bi đỏ'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(patches).toEqual([
        {
          id: 'b-01',
          body: { barcode: 'LOC-A01-01', isPickable: true, isActive: true, fixedSkuId: 'sku-2' },
        },
      ]),
    );
  });

  it('xóa vị trí: xác nhận soft delete → DELETE /warehouses/locations/:id', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete('/api/warehouses/locations/:locationId', ({ params }) => {
        deleted.push(params.locationId as string);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Vị trí kho WH01');
    await screen.findByText('ST');
    // Dòng ST (không con, đang Ngừng dùng) — nút Xóa thứ hai trong panel (A, A01, ST)
    const deleteButtons = screen.getAllByRole('button', { name: 'Xóa' });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);
    expect(await screen.findByText('Xóa vị trí ST?')).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: 'Xóa' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() => expect(deleted).toEqual(['st-1']));
  });

  it('không có stock.adjust → chỉ xem cây, không có nút thêm/sửa/xóa (luật 7)', async () => {
    renderApp(<WarehousesScreen />, {
      me: { ...ME_SALE, permissions: ['stock.read'] },
    });
    await screen.findByText('Vị trí kho WH01');
    expect(await screen.findByText('A01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm vị trí' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm vị trí con/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  });
});
