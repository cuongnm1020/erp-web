import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetWarehouseSelection, WarehouseProvider } from '@/lib/warehouse';
import { ME_ADMIN, makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { SalesOrder } from './api/use-orders';
import { BulkMoveWarehouseDialog } from './components/bulk-move-warehouse-dialog';

/** Chuyển đơn sang kho khác hàng loạt (PLAN-warehouse-context K3). */

const toastSuccess = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn(), info: vi.fn() },
}));

const ME = {
  ...ME_ADMIN,
  managesDepartments: false,
  managesCareTeam: false,
  warehouseIds: null,
  warehouses: [
    { id: 'wh-tt', code: 'KHO-TT-01', name: 'Kho Thạch Thất' },
    { id: 'wh-la', code: 'KHO-LA-01', name: 'Kho Long An' },
  ],
  defaultWarehouseId: 'wh-tt',
  defaultPosShopId: null,
  selectedWarehouseId: null,
  mustChangePassword: false,
};

afterEach(() => forgetWarehouseSelection());

describe('BulkMoveWarehouseDialog', () => {
  it('bỏ qua đơn đã bắt đầu lấy hàng; gửi đơn chưa xử lý; đơn server từ chối hiện kèm lý do', async () => {
    const all = makeOrders(10);
    const fresh = all.filter((o) => o.status === 'APPROVED').slice(0, 2);
    const started = {
      ...all[0]!,
      status: 'APPROVED' as const,
      fulfilmentStatus: 'PICKING' as const,
    };
    // Fixture chỉ có phần trường danh sách cần — đủ cho dialog (status, fulfilmentStatus, id, docNumber).
    const rows = [
      ...fresh.map((o) => ({ ...o, fulfilmentStatus: 'NOT_STARTED' as const })),
      started,
    ] as unknown as SalesOrder[];
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/sales-orders/move-warehouse', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          moved: [
            {
              orderId: fresh[0]!.id,
              docNumber: fresh[0]!.docNumber,
              fromWarehouseId: 'wh-tt',
              outcome: 'MOVED',
              pick: 'replanned',
              awaitingStock: false,
            },
          ],
          failed: [
            {
              orderId: fresh[1]!.id,
              docNumber: fresh[1]!.docNumber,
              code: 'ORDER_WAREHOUSE_MOVE_LOCKED',
              message: 'x',
            },
          ],
        });
      }),
    );
    const onDone = vi.fn();
    renderApp(
      <WarehouseProvider me={ME}>
        <BulkMoveWarehouseDialog rows={rows} onDone={onDone} />
      </WarehouseProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển kho' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1 đơn đã bắt đầu lấy hàng/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Chuyển tới kho' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho Long An' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Chuyển 2 đơn' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ orderIds: fresh.map((o) => o.id), warehouseId: 'wh-la' }]),
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      'Đã chuyển 1 đơn sang Kho Long An',
      expect.anything(),
    );
    expect(await within(dialog).findByText('1 đơn không chuyển được:')).toBeInTheDocument();
    expect(within(dialog).getByText(fresh[1]!.docNumber)).toBeInTheDocument();
    expect(within(dialog).getByText(/Trả việc về hàng đợi ở Điều phối/)).toBeInTheDocument();
    // Nút "Đóng" ở chân dialog (nút X góc trên cũng tên "Đóng" — đứng sau).
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]!);
    expect(onDone).toHaveBeenCalled();
  });
});
