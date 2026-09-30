import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ContainersScreen } from './components/containers-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/containers',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('code=LPN2609-00002'),
}));

const CONTAINER = {
  id: 'c-2',
  barcode: 'LPN2609-00002',
  typeId: 't-pkg',
  typeCode: 'PACKAGE',
  typeName: 'Kiện',
  parentId: 'c-1',
  parentBarcode: 'LPN2609-00001',
  warehouseId: 'wh-1',
  locationId: 'l-1',
  locationCode: 'A01-01',
  status: 'OPEN',
  pickedTaskId: null,
  refType: 'GoodsReceipt',
  refId: 'r-1',
  onHand: '300',
  reserved: '50',
  childCount: 3,
  createdAt: '2026-09-18T01:00:00.000Z',
  closedAt: null,
  ancestors: [{ id: 'c-1', barcode: 'LPN2609-00001', typeCode: 'PALLET' }],
  children: [
    {
      id: 'c-3',
      barcode: 'LPN2609-00003',
      typeId: 't-ctn',
      typeCode: 'CARTON',
      typeName: 'Thùng',
      parentId: 'c-2',
      parentBarcode: 'LPN2609-00002',
      warehouseId: 'wh-1',
      locationId: 'l-1',
      locationCode: 'A01-01',
      status: 'PICKED',
      pickedTaskId: 't-1',
      refType: null,
      refId: null,
      onHand: '100',
      reserved: '50',
      childCount: 0,
      createdAt: '2026-09-18T01:00:00.000Z',
      closedAt: null,
    },
  ],
  contents: [
    {
      skuId: 's-1',
      skuCode: 'SKU-A',
      skuName: 'Hàng A',
      lotId: null,
      lotNumber: null,
      onHand: '300',
      reserved: '50',
      available: '250',
      onHandDirect: '0',
    },
  ],
};

describe('ContainersScreen — tra cứu thùng theo mã (PLAN-packaging-hierarchy C)', () => {
  it('?code= → GET /containers/by-barcode → thẻ tồn, tổ tiên, hàng bên trong, thùng con, lịch sử', async () => {
    server.use(
      http.get('/api/containers/by-barcode/:barcode', ({ params }) =>
        params.barcode === 'LPN2609-00002'
          ? HttpResponse.json(CONTAINER)
          : HttpResponse.json({ code: 'CONTAINER_NOT_FOUND', message: 'x' }, { status: 404 }),
      ),
      http.get('/api/containers/:id/history', () =>
        HttpResponse.json([
          {
            movementId: '1',
            createdAt: '2026-09-18T01:00:00.000Z',
            movementType: 'RECEIPT',
            containerId: 'c-3',
            containerBarcode: 'LPN2609-00003',
            skuId: 's-1',
            skuCode: 'SKU-A',
            lotId: null,
            locationId: 'l-0',
            locationCode: 'DOCK',
            qtyDelta: '100',
            refType: 'GoodsReceipt',
            refId: 'r-1',
            taskId: null,
            actorId: null,
          },
        ]),
      ),
    );
    renderApp(<ContainersScreen />);
    expect(await screen.findByText('Đang chứa hàng')).toBeInTheDocument();
    expect(screen.getByText('LPN2609-00001')).toBeInTheDocument(); // tổ tiên
    expect(screen.getByText('Hàng A')).toBeInTheDocument();
    expect(screen.getByText('LPN2609-00003')).toBeInTheDocument(); // thùng con
    expect(screen.getByText('Đã lấy (chờ đóng gói)')).toBeInTheDocument();
    expect(await screen.findByText('+ Nhập')).toBeInTheDocument(); // lịch sử
    expect(screen.getByRole('button', { name: 'In tem' })).toBeInTheDocument();
  });
});
