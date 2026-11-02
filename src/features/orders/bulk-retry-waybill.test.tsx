import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { SalesOrderListItem } from './api/use-orders';
import { BulkRetryWaybillDialog } from './components/bulk-retry-waybill-dialog';

/** Xin lại vận đơn hàng loạt (2026-11-02) — sau khi sửa nguyên nhân chung (kho chưa khai điểm lấy). */

vi.mock('@/components/ui/toaster', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function withError(o: SalesOrderListItem, i: number): SalesOrderListItem {
  return {
    ...o,
    status: 'APPROVED',
    waybillErrorCode: 'PICKUP_WAREHOUSE_NOT_READY',
    waybillError: 'Kho KHO-LA-01 chưa khai điểm lấy hàng',
    shipment: { ...o.shipment, id: `shp-${i}`, carrierCode: 'VTP', trackingNo: null },
  } as SalesOrderListItem;
}

describe('BulkRetryWaybillDialog', () => {
  it('xin lại lần lượt đơn lỗi vận đơn, bỏ qua đơn không lỗi, hiện kết quả từng đơn', async () => {
    const base = makeOrders(4) as unknown as SalesOrderListItem[];
    const rows = [
      withError(base[0]!, 0),
      withError(base[1]!, 1),
      withError(base[2]!, 2),
      { ...base[3]!, waybillErrorCode: null } as SalesOrderListItem,
    ];
    const calls: { id: string; body: unknown }[] = [];
    server.use(
      http.post('/api/shipments/:id/waybill', async ({ params, request }) => {
        const id = String(params.id);
        calls.push({ id, body: await request.json() });
        if (id === 'shp-0') {
          return HttpResponse.json({ shipmentId: id, outcome: 'ISSUED', trackingNo: 'VTP123' });
        }
        if (id === 'shp-1') {
          return HttpResponse.json({ shipmentId: id, outcome: 'QUEUED', trackingNo: null });
        }
        return HttpResponse.json(
          { code: 'PICKUP_WAREHOUSE_NOT_READY', message: 'x', statusCode: 422 },
          { status: 422 },
        );
      }),
    );
    const onDone = vi.fn();
    const onOpenChange = vi.fn();
    renderApp(
      <BulkRetryWaybillDialog rows={rows} open onOpenChange={onOpenChange} onDone={onDone} />,
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1 đơn không có lỗi vận đơn sẽ bị bỏ qua/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Xin lại 3 đơn/ }));

    expect(await within(dialog).findByText('1 đơn vẫn chưa có vận đơn')).toBeInTheDocument();
    expect(calls.map((c) => c.id)).toEqual(['shp-0', 'shp-1', 'shp-2']);
    expect(calls[0]!.body).toEqual({ carrierCode: 'VTP' });
    expect(within(dialog).getByText(/Kho lấy hàng chưa khai tỉnh/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Tất cả 3' }));
    expect(within(dialog).getByText('Có mã VTP123')).toBeInTheDocument();
    expect(within(dialog).getByText('Hãng chưa phản hồi')).toBeInTheDocument();

    // Nút "Đóng" ở chân (nút X góc hộp thoại cũng mang tên "Đóng").
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' }).at(-1)!);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
