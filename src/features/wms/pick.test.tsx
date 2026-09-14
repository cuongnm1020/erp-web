import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PickScreen } from './components/pick-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/pda/pick',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const TASK_ID = '00000000-0000-4000-8000-00000000c101';
const LINE_1 = '00000000-0000-4000-8000-00000000d101';
const LINE_2 = '00000000-0000-4000-8000-00000000d102';

const PICK_TASK = {
  taskId: TASK_ID,
  docNumber: 'PICK2609-00009',
  type: 'PICK',
  status: 'ASSIGNED',
  priority: 0,
  warehouseId: 'wh-1',
  refType: 'SalesOrder',
  refId: 'order-9',
  refDocNumber: 'SO2609-00009',
  assignedTo: 'u-admin',
  createdAt: new Date(Date.UTC(2026, 8, 14)).toISOString(),
  lines: [
    {
      taskLineId: LINE_1,
      lineNo: 2,
      status: 'PENDING',
      skuId: 'sku-X',
      skuCode: 'SKU-X',
      skuName: 'Nước rửa chén',
      barcodes: ['BC-X'],
      lotId: null,
      lotNumber: null,
      expiryDate: null,
      locationId: 'l1',
      locationCode: 'A-01-03',
      toLocationId: null,
      toLocationCode: null,
      pickSequence: 100,
      qtyPlanned: '2.000000',
      qtyDone: '0.000000',
      qtyRemaining: '2.000000',
      exceptionNote: null,
    },
    {
      taskLineId: LINE_2,
      lineNo: 1,
      status: 'PENDING',
      skuId: 'sku-Y',
      skuCode: 'SKU-Y',
      skuName: 'Khăn giấy',
      barcodes: ['BC-Y'],
      lotId: null,
      lotNumber: null,
      expiryDate: null,
      locationId: 'l2',
      locationCode: 'B-02-01',
      toLocationId: null,
      toLocationCode: null,
      pickSequence: 200,
      qtyPlanned: '1.000000',
      qtyDone: '0.000000',
      qtyRemaining: '1.000000',
      exceptionNote: null,
    },
  ],
};

describe('Màn pick trên PDA — quét đơn → dòng theo lối đi → quét SKU → xong đơn (D2)', () => {
  const scan = (code: string) => {
    const input = screen.getByLabelText(/Quét/);
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('quét mã việc PICK → claim → vị trí đầu tiên theo pickSequence; quét 2+1 → Xong đơn', async () => {
    const done: Record<string, number> = {};
    server.use(
      http.get('/api/pda/resolve/:code', () =>
        HttpResponse.json({
          kind: 'task',
          code: 'PICK2609-00009',
          sku: null,
          order: null,
          wave: null,
          location: null,
          shipment: null,
          task: {
            id: TASK_ID,
            docNumber: 'PICK2609-00009',
            type: 'PICK',
            status: 'PENDING',
            warehouseId: 'wh-1',
            assignedTo: null,
            assignedToMe: false,
            lineCount: 2,
          },
        }),
      ),
      http.post('/api/pda/tasks/:id/claim', () => HttpResponse.json(PICK_TASK)),
      http.post('/api/pda/scan', async ({ request }) => {
        const body = (await request.json()) as { taskLineId: string; barcode: string; qty: string };
        const l = PICK_TASK.lines.find((x) => x.taskLineId === body.taskLineId)!;
        done[l.taskLineId] = (done[l.taskLineId] ?? 0) + Number(body.qty);
        const d = done[l.taskLineId]!;
        return HttpResponse.json({
          taskLineId: l.taskLineId,
          taskId: TASK_ID,
          barcode: body.barcode,
          skuId: l.skuId,
          skuCode: l.skuCode,
          uomCode: 'PCS',
          factor: '1',
          qtyScanned: body.qty,
          qtyBase: body.qty,
          qtyDone: d.toFixed(6),
          qtyPlanned: l.qtyPlanned,
          qtyRemaining: (Number(l.qtyPlanned) - d).toFixed(6),
          lineStatus: 'IN_PROGRESS',
          taskStatus: 'IN_PROGRESS',
          complete: d >= Number(l.qtyPlanned),
          replayed: false,
        });
      }),
      http.post('/api/pda/complete', async ({ request }) => {
        const body = (await request.json()) as { taskLineId: string };
        const last = Object.keys(done).length === 2;
        return HttpResponse.json({
          taskLineId: body.taskLineId,
          taskId: TASK_ID,
          taskDocNumber: 'PICK2609-00009',
          lineStatus: 'COMPLETED',
          taskStatus: last ? 'COMPLETED' : 'IN_PROGRESS',
          taskCompleted: last,
          reservationId: null,
          movementId: null,
          skuId: 'x',
          locationId: null,
          lotId: null,
          qty: '1.000000',
          costAmount: null,
          replayed: false,
          waybill: null,
        });
      }),
    );
    renderApp(<PickScreen />);
    expect(screen.getByText('Quét mã đơn để nhận việc')).toBeInTheDocument();

    scan('PICK2609-00009');
    // Dòng hiện tại = vị trí có pickSequence nhỏ nhất (A-01-03), không phải lineNo 1
    expect((await screen.findAllByText('A-01-03')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nước rửa chén').length).toBeGreaterThan(0);

    // Tăng số lượng lên 2 rồi quét một lần
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    scan('BC-X');
    // Dòng X đủ → dòng hiện tại chuyển sang B-02-01
    await waitFor(() => expect(screen.getAllByText('B-02-01').length).toBeGreaterThan(0));
    scan('BC-Y');
    expect(await screen.findByText('Xong đơn SO2609-00009')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quét đơn kế tiếp' })).toBeInTheDocument();
  });

  it('việc của người khác → 409 hiện câu từ bộ dịch, không nhận', async () => {
    server.use(
      http.get('/api/pda/resolve/:code', () =>
        HttpResponse.json({
          kind: 'task',
          code: 'PICK2609-00010',
          sku: null,
          order: null,
          wave: null,
          location: null,
          shipment: null,
          task: {
            id: TASK_ID,
            docNumber: 'PICK2609-00010',
            type: 'PICK',
            status: 'ASSIGNED',
            warehouseId: 'wh-1',
            assignedTo: 'u-other',
            assignedToMe: false,
            lineCount: 2,
          },
        }),
      ),
      http.post('/api/pda/tasks/:id/claim', () =>
        HttpResponse.json(
          { statusCode: 409, code: 'PDA_TASK_ASSIGNED_TO_OTHER', message: 'x' },
          { status: 409, headers: { 'x-request-id': 'trace-other' } },
        ),
      ),
    );
    renderApp(<PickScreen />);
    scan('PICK2609-00010');
    expect(await screen.findByRole('alert')).toHaveTextContent(/đang do người khác làm/);
    expect(screen.getByText('Quét mã đơn để nhận việc')).toBeInTheDocument();
  });
});
