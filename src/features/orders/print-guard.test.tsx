import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { ShipmentLabelData } from '@/features/wms/api/use-pda';
import { LabelPrintDialog } from '@/features/wms/components/label-print-dialog';
import { isPrintLocked, printLockReason } from '@/features/wms/print-guard';
import { BulkFulfilPrintDialog, type FulfilRow } from './components/bulk-fulfil-print-dialog';
import { ReprintWaybillDialog } from './components/bulk-reprint-waybill-dialog';

/**
 * PRINT-DUP-1 (2026-11-11, user chốt): đơn đã in tem + đã gán NV đóng hàng → in lẻ phải xác nhận;
 * in nhiều thì in đơn đủ điều kiện, đơn vướng sang tab "Cảnh báo" (in lại từ đó cũng xác nhận).
 * Áp dụng "Đóng gói + in vận đơn", "In lại vận đơn", tem ở trạm đóng gói.
 */
const PRINTED_AT = '2026-11-11T02:15:00.000Z';

const label = (i: number, locked = false): ShipmentLabelData =>
  ({
    facebookPageName: null,
    shipmentId: `sh-${i}`,
    shipmentDocNumber: `DN-${i}`,
    orderDocNumber: `SO-${i}`,
    carrierCode: 'VTP',
    carrierName: 'Viettel Post',
    trackingNo: `TRK${i}`,
    codAmount: '100000.0000',
    weightKg: '0.5000',
    recipient: null,
    sender: null,
    allowInspection: false,
    callShopOnFailure: null,
    items: [{ name: `Phân bón ${i}`, qty: '1.000000' }],
    note: null,
    labelPrintedAt: locked ? PRINTED_AT : null,
    packerName: locked ? 'Trần Văn Đóng' : null,
  }) as ShipmentLabelData;

let printedBodies: unknown[] = [];
beforeEach(() => {
  printedBodies = [];
  window.print = vi.fn();
  server.use(
    http.post('/api/sales-orders/labels-printed', async ({ request }) => {
      printedBodies.push(await request.json());
      return HttpResponse.json({ updated: 1 });
    }),
  );
});
afterEach(() => vi.restoreAllMocks());

describe('luật khóa in', () => {
  it('chỉ khóa khi CẢ đã in tem lẫn đã có NV đóng hàng', () => {
    expect(isPrintLocked({ labelPrintedAt: PRINTED_AT, packerName: 'A' })).toBe(true);
    expect(isPrintLocked({ labelPrintedAt: PRINTED_AT, packerName: null })).toBe(false);
    expect(isPrintLocked({ labelPrintedAt: null, packerName: 'A' })).toBe(false);
    expect(isPrintLocked(null)).toBe(false);
    expect(printLockReason({ labelPrintedAt: PRINTED_AT, packerName: 'A' })).toMatch(
      /^Đã in tem .+ · NV đóng hàng A$/,
    );
  });
});

describe('In lại vận đơn', () => {
  const render = (n: number) =>
    renderApp(
      <ReprintWaybillDialog
        shipments={Array.from({ length: n }, (_, k) => ({
          id: `sh-${k + 1}`,
          trackingNo: `TRK${k + 1}`,
          status: 'PENDING',
          orderId: `o-${k + 1}`,
        }))}
        triggerLabel="In lại vận đơn"
        open
        onOpenChange={() => undefined}
      />,
    );

  it('in nhiều: in đơn đủ điều kiện, đơn vướng sang tab Cảnh báo; in lại từ đó phải xác nhận', async () => {
    server.use(
      http.post('/api/shipments/label-data', () => HttpResponse.json([label(1, true), label(2)])),
    );
    render(2);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'In 2 tem' }));

    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(printedBodies).toEqual([{ shipmentIds: ['sh-2'] }]));
    expect(dialog).toHaveTextContent('1 đơn không in — đã in, đã có NV đóng');
    // Mở sẵn tab Cảnh báo.
    expect(within(dialog).getByRole('button', { name: 'Cảnh báo 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const list = within(dialog).getByRole('list', { name: 'Danh sách kết quả' });
    expect(list).toHaveTextContent('SO-1');
    expect(list).toHaveTextContent('NV đóng hàng Trần Văn Đóng');
    expect(list).not.toHaveTextContent('SO-2');

    fireEvent.click(within(dialog).getByRole('button', { name: /In lại 1 đơn này/ }));
    // Bấm lần đầu chỉ hỏi lại, chưa in.
    expect(window.print).toHaveBeenCalledTimes(1);
    const ask = within(dialog).getByRole('alertdialog', { name: 'In lại tem 1 đơn đã in?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'In lại 1 tem' }));
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(printedBodies).toContainEqual({ shipmentIds: ['sh-1'] }));
  });

  it('in lẻ: hỏi "In lại tem đơn …?" trước; Hủy không in, "In lại tem" mới in', async () => {
    server.use(http.post('/api/shipments/label-data', () => HttpResponse.json([label(1, true)])));
    render(1);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'In 1 tem' }));
    expect(await within(dialog).findByText('In lại tem đơn SO-1?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('NV đóng hàng Trần Văn Đóng');
    expect(window.print).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(window.print).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'In 1 tem' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'In lại tem' }));
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  });
});

describe('Đóng gói + in vận đơn', () => {
  const row = (i: number): FulfilRow =>
    ({
      id: `o-${i}`,
      docNumber: `SO-${i}`,
      status: 'APPROVED',
      carrierId: 'c-vtp',
      marketplace: null,
      customer: { id: `c-${i}`, code: `KH${i}`, name: `Khách ${i}` },
    }) as unknown as FulfilRow;
  /** Dòng GET /sales-orders?ids= — chỉ trường hộp kiểm trạng thái in đọc. */
  const listRow = (i: number, locked: boolean) => ({
    id: `o-${i}`,
    docNumber: `SO-${i}`,
    customer: { name: `Khách ${i}` },
    marketplace: null,
    labelPrintedAt: locked ? PRINTED_AT : null,
    packerName: locked ? 'Trần Văn Đóng' : null,
    shipment: locked ? { id: `sh-${i}`, trackingNo: `TRK${i}`, status: 'PENDING' } : null,
  });

  it('in nhiều: đơn vướng KHÔNG đóng gói / in, sang tab Cảnh báo; đơn khác in bình thường', async () => {
    const fulfilBodies: unknown[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        expect(new URL(request.url).searchParams.getAll('ids')).toEqual(['o-1', 'o-2']);
        return HttpResponse.json({ items: [listRow(1, true), listRow(2, false)], total: 2 });
      }),
      http.post('/api/sales-orders/bulk-fulfil', async ({ request }) => {
        fulfilBodies.push(await request.json());
        return HttpResponse.json(
          {
            done: [
              {
                orderId: 'o-2',
                docNumber: 'SO-2',
                shipmentId: 'sh-2',
                outcome: 'ISSUED',
                trackingNo: 'TRK2',
              },
            ],
            failed: [],
          },
          { status: 201 },
        );
      }),
      http.post('/api/shipments/label-data', () => HttpResponse.json([label(2)])),
    );
    renderApp(<BulkFulfilPrintDialog rows={[row(1), row(2)]} onDone={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Đóng gói \+ in vận đơn/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Đóng gói + in 2 đơn' }));

    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    expect(fulfilBodies).toEqual([{ orderIds: ['o-2'] }]);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('1 đơn không in — đã in, đã có NV đóng');
    expect(within(dialog).getByRole('button', { name: 'Cảnh báo 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(dialog).getByRole('list', { name: 'Danh sách kết quả' })).toHaveTextContent(
      'SO-1',
    );
  });

  it('in lẻ đơn đã in + có NV đóng: hỏi xác nhận, chưa đóng gói; "In lại tem" mới chạy', async () => {
    const fulfilBodies: unknown[] = [];
    server.use(
      http.get('/api/sales-orders', () =>
        HttpResponse.json({ items: [listRow(1, true)], total: 1 }),
      ),
      http.post('/api/sales-orders/bulk-fulfil', async ({ request }) => {
        fulfilBodies.push(await request.json());
        return HttpResponse.json(
          {
            done: [
              {
                orderId: 'o-1',
                docNumber: 'SO-1',
                shipmentId: 'sh-1',
                outcome: 'ALREADY_ISSUED',
                trackingNo: 'TRK1',
              },
            ],
            failed: [],
          },
          { status: 201 },
        );
      }),
      http.post('/api/shipments/label-data', () => HttpResponse.json([label(1, true)])),
    );
    renderApp(<BulkFulfilPrintDialog rows={[row(1)]} onDone={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Đóng gói \+ in vận đơn/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Đóng gói + in 1 đơn' }));
    expect(await screen.findByText('In lại tem đơn SO-1?')).toBeInTheDocument();
    expect(fulfilBodies).toEqual([]);
    expect(window.print).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'In lại tem' }));
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    expect(fulfilBodies).toEqual([{ orderIds: ['o-1'] }]);
  });
});

describe('Tem ở trạm đóng gói', () => {
  const waybill = {
    shipmentId: 'sh-1',
    shipmentDocNumber: 'DN-1',
    carrierCode: 'VTP',
    outcome: 'ISSUED' as const,
    trackingNo: 'TRK1',
    reason: null,
    errorCode: null,
  };

  it('đơn đã in + có NV đóng: KHÔNG tự in, hỏi xác nhận; bấm "In lại tem" mới in', async () => {
    server.use(
      http.get('/api/shipments/:id', () =>
        HttpResponse.json({ shipmentId: 'sh-1', trackingNo: 'TRK1' }),
      ),
      http.get('/api/shipments/:id/label-data', () => HttpResponse.json(label(1, true))),
    );
    renderApp(<LabelPrintDialog open waybill={waybill} orderId={null} onClose={() => {}} />);
    const ask = await screen.findByTestId('print-lock-confirm');
    expect(ask).toHaveTextContent('In lại tem đơn SO-1?');
    expect(window.print).not.toHaveBeenCalled();
    fireEvent.click(within(ask).getByRole('button', { name: 'In lại tem' }));
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  });

  it('đơn chưa in: tự in như cũ', async () => {
    server.use(
      http.get('/api/shipments/:id', () =>
        HttpResponse.json({ shipmentId: 'sh-1', trackingNo: 'TRK1' }),
      ),
      http.get('/api/shipments/:id/label-data', () => HttpResponse.json(label(1))),
    );
    renderApp(<LabelPrintDialog open waybill={waybill} orderId={null} onClose={() => {}} />);
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('print-lock-confirm')).toBeNull();
  });
});
