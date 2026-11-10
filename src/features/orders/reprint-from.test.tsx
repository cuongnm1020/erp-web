import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { ShipmentLabelData } from '@/features/wms/api/use-pda';
import { WaybillLabelBatchPrintSheet } from '@/features/wms/components/waybill-label';
import { ReprintWaybillDialog } from './components/bulk-reprint-waybill-dialog';

/**
 * In lại từ tem số N (2026-11-10, user: in 89 tem, máy dừng ở 47, bấm in lại thì in lại cả 89).
 * Cả lô là MỘT lệnh in nên web không biết máy dừng ở đâu — người in nhập số tem kế tiếp.
 */
const label = (i: number): ShipmentLabelData =>
  ({
    shipmentId: `sh-${i}`,
    shipmentDocNumber: `DN-${i}`,
    orderDocNumber: `SO-${i}`,
    carrierCode: 'VTP',
    carrierName: 'Viettel Post',
    trackingNo: `TRK${i}`,
    codAmount: '100000.0000',
    weightKg: '0.5000',
    recipient: {
      name: `Khách ${i}`,
      phone: '0901234567',
      address: 'Ấp 1, Xã A, Tỉnh B',
      street: 'Ấp 1',
      locality: 'Xã A, Tỉnh B',
      fromWard: 'Xã A, Tỉnh B',
      fromDistrict: 'Tỉnh B',
      province: 'Tỉnh B',
    },
    sender: {
      name: 'Shop',
      phone: '0339213208',
      address: 'Kho, Xã C, Hà Nội',
      street: 'Kho',
      locality: 'Xã C, Hà Nội',
      fromWard: 'Xã C, Hà Nội',
      fromDistrict: 'Hà Nội',
      province: 'Hà Nội',
      warehouseName: 'Kho Long An',
    },
    allowInspection: false,
    callShopOnFailure: null,
    // Tên SP theo abc = thứ tự in (sortLabelsForPrint).
    items: [{ name: `Phân bón ${String.fromCharCode(64 + i)}`, qty: '1.000000' }],
    note: null,
  }) as ShipmentLabelData;

beforeEach(() => {
  vi.spyOn(window, 'print').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('In lại từ tem số N', () => {
  it('tờ in từ tem 3/4: chỉ in tem 3, 4 và giữ số "#x/4" của cả lô', () => {
    render(
      <WaybillLabelBatchPrintSheet
        labels={[label(1), label(2), label(3), label(4)]}
        orientation="landscape"
        printedAt={new Date('2026-11-10T03:00:00.000Z')}
        printer={{ open: true, print: vi.fn(), done: vi.fn() }}
        fromSeq={3}
      />,
    );
    expect(screen.getByText('#3/4')).toBeInTheDocument();
    expect(screen.getByText('#4/4')).toBeInTheDocument();
    expect(screen.queryByText('#1/4')).not.toBeInTheDocument();
    expect(screen.queryByText('#2/4')).not.toBeInTheDocument();
  });

  it('hộp In lại vận đơn: nhập từ tem 3 → in 2 tem, báo các phiếu tem 1–2 để bỏ tích', async () => {
    server.use(
      http.post('/api/shipments/label-data', () =>
        // Server trả lộn thứ tự — số tem theo thứ tự in, không theo thứ tự trả về.
        HttpResponse.json([label(4), label(2), label(1), label(3)]),
      ),
      http.post('/api/sales-orders/labels-printed', () => HttpResponse.json({ updated: 4 })),
    );
    const onSkipped = vi.fn();
    renderApp(
      <ReprintWaybillDialog
        shipments={[1, 2, 3, 4].map((i) => ({
          id: `sh-${i}`,
          trackingNo: `TRK${i}`,
          status: 'PENDING',
        }))}
        triggerLabel="In lại vận đơn"
        open
        onOpenChange={() => undefined}
        onSkipped={onSkipped}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /In 4 tem/ })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Bắt đầu từ tem số'), {
      target: { value: '3' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'In 2 tem (từ tem 3)' }));
    await waitFor(() => expect(onSkipped).toHaveBeenCalledWith(['sh-1', 'sh-2']));
  });

  it('số tem ngoài khoảng → in cả lô, không bỏ tích', async () => {
    server.use(
      http.post('/api/shipments/label-data', () => HttpResponse.json([label(1), label(2)])),
      http.post('/api/sales-orders/labels-printed', () => HttpResponse.json({ updated: 2 })),
    );
    const onSkipped = vi.fn();
    renderApp(
      <ReprintWaybillDialog
        shipments={[1, 2].map((i) => ({ id: `sh-${i}`, trackingNo: `TRK${i}`, status: 'PENDING' }))}
        triggerLabel="In lại vận đơn"
        open
        onOpenChange={() => undefined}
        onSkipped={onSkipped}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Bắt đầu từ tem số'), {
      target: { value: '9' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'In 2 tem' }));
    await waitFor(() => expect(window.print).toHaveBeenCalled());
    expect(onSkipped).not.toHaveBeenCalled();
  });
});
