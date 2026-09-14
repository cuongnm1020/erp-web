import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PackStationScreen } from './components/pack-station-screen';

// Radix Select cần ResizeObserver; jsdom không có.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/pack',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ORDER_ID = '00000000-0000-4000-8000-00000000a001';
const SHIPMENT_ID = '00000000-0000-4000-8000-00000000b001';
const TASK_ID = '00000000-0000-4000-8000-00000000c001';
const LINE_A = '00000000-0000-4000-8000-00000000d001';
const LINE_B = '00000000-0000-4000-8000-00000000d002';

const line = (id: string, code: string, planned: string, done = '0.000000') => ({
  taskLineId: id,
  lineNo: id === LINE_A ? 1 : 2,
  status: 'PENDING',
  skuId: `sku-${code}`,
  skuCode: `SKU-${code}`,
  skuName: `Sản phẩm ${code}`,
  barcodes: [`BC-${code}`],
  lotId: null,
  lotNumber: null,
  expiryDate: null,
  locationId: 'loc-pack',
  locationCode: 'PACK-01',
  toLocationId: null,
  toLocationCode: null,
  pickSequence: 10,
  qtyPlanned: planned,
  qtyDone: done,
  qtyRemaining: planned,
  exceptionNote: null,
});

const PACK_TASK = {
  taskId: TASK_ID,
  docNumber: 'PACK2609-00001',
  type: 'PACK',
  status: 'ASSIGNED',
  priority: 0,
  warehouseId: 'wh-1',
  refType: 'SalesOrder',
  refId: ORDER_ID,
  refDocNumber: 'SO2609-00007',
  assignedTo: 'u-admin',
  createdAt: new Date(Date.UTC(2026, 8, 14)).toISOString(),
  lines: [line(LINE_A, 'A', '1.000000'), line(LINE_B, 'B', '2.000000')],
};

const RESOLVE_ORDER = {
  kind: 'order',
  code: 'SO2609-00007',
  sku: null,
  task: null,
  wave: null,
  location: null,
  shipment: null,
  order: {
    id: ORDER_ID,
    docNumber: 'SO2609-00007',
    status: 'APPROVED',
    channel: 'DIRECT',
    orderDate: new Date(Date.UTC(2026, 8, 14)).toISOString(),
    warehouseId: 'wh-1',
    lineCount: 2,
    customer: { id: 'c1', code: 'KH-0001', name: 'Công ty Mai Linh' },
    tasks: [
      {
        id: 'pick-1',
        docNumber: 'PICK2609-00001',
        type: 'PICK',
        status: 'COMPLETED',
        warehouseId: 'wh-1',
        assignedTo: 'u-x',
        assignedToMe: false,
        lineCount: 2,
      },
      {
        id: TASK_ID,
        docNumber: 'PACK2609-00001',
        type: 'PACK',
        status: 'PENDING',
        warehouseId: 'wh-1',
        assignedTo: null,
        assignedToMe: false,
        lineCount: 2,
      },
    ],
  },
};

const scanResult = (taskLineId: string, code: string, done: string, planned: string) => ({
  taskLineId,
  taskId: TASK_ID,
  barcode: `BC-${code}`,
  skuId: `sku-${code}`,
  skuCode: `SKU-${code}`,
  uomCode: 'PCS',
  factor: '1',
  qtyScanned: '1.000000',
  qtyBase: '1.000000',
  qtyDone: done,
  qtyPlanned: planned,
  qtyRemaining: (Number(planned) - Number(done)).toFixed(6),
  lineStatus: 'IN_PROGRESS',
  taskStatus: 'IN_PROGRESS',
  complete: done === planned,
  replayed: false,
});

const completeResult = (taskLineId: string, taskCompleted: boolean, waybill: unknown) => ({
  taskLineId,
  taskId: TASK_ID,
  taskDocNumber: 'PACK2609-00001',
  lineStatus: 'COMPLETED',
  taskStatus: taskCompleted ? 'COMPLETED' : 'IN_PROGRESS',
  taskCompleted,
  reservationId: 'r1',
  movementId: '1',
  skuId: 'sku-A',
  locationId: 'loc-pack',
  lotId: null,
  qty: '1.000000',
  costAmount: '50000.0000',
  replayed: false,
  waybill,
});

const WAYBILL_ISSUED = {
  shipmentId: SHIPMENT_ID,
  shipmentDocNumber: 'DN2609-00001',
  carrierCode: 'GHTK',
  outcome: 'ISSUED',
  trackingNo: 'S00000001.SG.A1',
  reason: null,
  errorCode: null,
};

const SHIPMENT = (trackingNo: string | null) => ({
  shipmentId: SHIPMENT_ID,
  docNumber: 'DN2609-00001',
  status: 'PENDING',
  orderId: ORDER_ID,
  carrierId: 'c-ghtk',
  carrierCode: 'GHTK',
  trackingNo,
  weightKg: '1.5000',
  codAmount: null,
  shippedAt: null,
  deliveredAt: null,
  labelPrintedAt: null,
  labelPrintCount: 0,
  packTask: { taskId: TASK_ID, docNumber: 'PACK2609-00001', status: 'COMPLETED' },
});

const scans: unknown[] = [];
const completes: unknown[] = [];
const scanFlow = (waybill: unknown) => {
  const doneByLine: Record<string, number> = {};
  return [
    http.get('/api/pda/resolve/:code', ({ params }) =>
      params.code === 'SO2609-00007'
        ? HttpResponse.json(RESOLVE_ORDER)
        : HttpResponse.json(
            { statusCode: 404, code: 'NOT_FOUND', message: 'x' },
            { status: 404, headers: { 'x-request-id': 'trace-not_found' } },
          ),
    ),
    http.post('/api/pda/tasks/:id/claim', () => HttpResponse.json(PACK_TASK)),
    http.post('/api/pda/scan', async ({ request }) => {
      const body = (await request.json()) as { taskLineId: string; barcode: string };
      scans.push(body);
      const l = PACK_TASK.lines.find((x) => x.taskLineId === body.taskLineId)!;
      if (!l.barcodes.includes(body.barcode)) {
        return HttpResponse.json(
          { statusCode: 422, code: 'PDA_SCAN_WRONG_SKU', message: 'x' },
          { status: 422, headers: { 'x-request-id': 'trace-wrong' } },
        );
      }
      doneByLine[l.taskLineId] = (doneByLine[l.taskLineId] ?? 0) + 1;
      const code = l.skuCode.slice(4);
      return HttpResponse.json(
        scanResult(l.taskLineId, code, doneByLine[l.taskLineId]!.toFixed(6), l.qtyPlanned),
      );
    }),
    http.post('/api/pda/complete', async ({ request }) => {
      const body = (await request.json()) as { taskLineId: string };
      completes.push(body);
      const last = body.taskLineId === LINE_B;
      return HttpResponse.json(completeResult(body.taskLineId, last, last ? waybill : null));
    }),
  ];
};

describe('Trạm đóng gói — quét đơn → quét SKU → tự đóng dòng → popup nhãn (PLAN-barcode-pick-pack D1)', () => {
  beforeEach(() => {
    scans.length = 0;
    completes.length = 0;
    replace.mockReset();
  });

  const scan = (code: string) => {
    const input = screen.getByLabelText(/Quét/);
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('happy path: quét mã đơn → nhận PACK → 3 lần quét đúng → 2 complete → iframe nhãn GHTK A6', async () => {
    server.use(
      ...scanFlow(WAYBILL_ISSUED),
      http.get('/api/shipments/:id', () => HttpResponse.json(SHIPMENT('S00000001.SG.A1'))),
    );
    renderApp(<PackStationScreen />);
    expect(screen.getByText('Chưa có đơn nào đang đóng')).toBeInTheDocument();

    scan('SO2609-00007');
    expect(await screen.findByText('Sản phẩm A')).toBeInTheDocument();
    expect(screen.getByText('Công ty Mai Linh', { exact: false })).toBeInTheDocument();
    // URL giữ đơn đang mở (luật 8)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/wms/pack?order=SO2609-00007', { scroll: false }),
    );

    scan('BC-A');
    await waitFor(() => expect(completes).toHaveLength(1));
    scan('BC-B');
    await waitFor(() => expect(scans).toHaveLength(2));
    expect(completes).toHaveLength(1); // B mới 1/2 — chưa đóng dòng
    scan('BC-B');
    await waitFor(() => expect(completes).toHaveLength(2));

    // Popup nhãn: iframe trỏ vào proxy nhãn, khổ A6 dọc
    const frame = await screen.findByTitle('Nhãn vận đơn S00000001.SG.A1');
    expect(frame.getAttribute('src')).toContain(
      `/api/shipments/${SHIPMENT_ID}/label?pageSize=A6&orientation=portrait`,
    );
    expect(screen.getByText('Đóng và quét đơn tiếp')).toBeInTheDocument();
    // Mọi lần quét mang idempotencyKey riêng
    const keys = new Set((scans as Array<{ idempotencyKey: string }>).map((s) => s.idempotencyKey));
    expect(keys.size).toBe(3);
  });

  it('sai SKU → banner đỏ, không cộng; mã lạ của đơn → không gọi server', async () => {
    server.use(...scanFlow(WAYBILL_ISSUED));
    renderApp(<PackStationScreen />);
    scan('SO2609-00007');
    await screen.findByText('Sản phẩm A');

    scan('BC-KHONG-CO');
    expect(await screen.findByRole('alert')).toHaveTextContent(/không thuộc SO2609-00007/);
    expect(scans).toHaveLength(0);
    expect(completes).toHaveLength(0);
  });

  it('QUEUED → popup chờ hãng, poll GET /shipments/:id, có vận đơn thì hiện iframe', async () => {
    let calls = 0;
    server.use(
      ...scanFlow({
        ...WAYBILL_ISSUED,
        outcome: 'QUEUED',
        trackingNo: null,
        reason: 'GHTK timeout',
      }),
      http.get('/api/shipments/:id', () => {
        calls += 1;
        return HttpResponse.json(SHIPMENT(calls >= 2 ? 'S00000009.SG' : null));
      }),
    );
    renderApp(<PackStationScreen />);
    scan('SO2609-00007');
    await screen.findByText('Sản phẩm A');
    scan('BC-A');
    scan('BC-B');
    await waitFor(() => expect(scans).toHaveLength(2));
    scan('BC-B');
    expect(await screen.findByText(/Hãng chưa cấp vận đơn/)).toBeInTheDocument();
    // Lần poll thứ hai có vận đơn → iframe nhãn
    expect(
      await screen.findByTitle('Nhãn vận đơn S00000009.SG', undefined, { timeout: 8000 }),
    ).toBeInTheDocument();
  }, 15000);

  it('NO_CARRIER → chọn hãng tại chỗ → POST /shipments/:id/waybill → iframe nhãn', async () => {
    const requests: unknown[] = [];
    server.use(
      ...scanFlow({
        ...WAYBILL_ISSUED,
        outcome: 'NO_CARRIER',
        carrierCode: null,
        trackingNo: null,
      }),
      http.get('/api/shipments/:id', () => HttpResponse.json(SHIPMENT(null))),
      http.post('/api/shipments/:id/waybill', async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({
          shipmentId: SHIPMENT_ID,
          shipmentDocNumber: 'DN2609-00001',
          carrierCode: 'GHTK',
          outcome: 'ISSUED',
          trackingNo: 'S00000002.SG',
          reason: null,
          jobId: null,
        });
      }),
    );
    renderApp(<PackStationScreen />);
    scan('SO2609-00007');
    await screen.findByText('Sản phẩm A');
    scan('BC-A');
    scan('BC-B');
    await waitFor(() => expect(scans).toHaveLength(2));
    scan('BC-B');
    expect(await screen.findByText(/Đơn chưa gán hãng vận chuyển/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Hãng vận chuyển' }));
    fireEvent.click(await screen.findByRole('option', { name: /Giao Hàng Tiết Kiệm/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Xin vận đơn' }));
    await waitFor(() => expect(requests).toEqual([{ carrierCode: 'GHTK' }]));
    expect(await screen.findByTitle('Nhãn vận đơn S00000002.SG')).toBeInTheDocument();
  });

  it('không có task.execute → màn không có quyền (luật 6/7)', () => {
    renderApp(<PackStationScreen />, { me: { ...ME_SALE, permissions: ['stock.read'] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền/i);
  });
});
