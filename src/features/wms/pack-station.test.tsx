import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
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
// Các test ở đây soi nhãn PDF của hãng (iframe A6); nhãn ERP 100×75 có test riêng
// (label-print-dialog.test.tsx).
beforeEach(() => localStorage.setItem('erp.pack.labelPageSize', 'A6'));
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
  productName: `Sản phẩm ${code}`,
  imageUrl: null,
  binOnHand: null,
  binRemaining: null,
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
  /** Quét SKU → ô số lượng nhận focus → Enter với số mặc định 1 (2026-09-22). */
  const scanSku = (code: string, qty = '1') => {
    scan(code);
    const q = screen.getByLabelText('Số lượng lần quét này');
    fireEvent.change(q, { target: { value: qty } });
    fireEvent.keyDown(q, { key: 'Enter' });
  };

  it('happy path: quét mã đơn → nhận PACK → 3 lần quét đúng → 2 complete → iframe nhãn GHTK A6', async () => {
    server.use(
      ...scanFlow(WAYBILL_ISSUED),
      http.get('/api/shipments/:id', () => HttpResponse.json(SHIPMENT('S00000001.SG.A1'))),
    );
    renderApp(<PackStationScreen />);
    expect(screen.getByText('Quét mã đơn để nhận việc')).toBeInTheDocument();

    scan('SO2609-00007');
    // Thẻ dòng đang đóng (to) + danh sách dòng — cùng bố cục màn pick PDA
    expect((await screen.findAllByText('Sản phẩm A')).length).toBeGreaterThan(0);
    const card = screen.getByRole('region', { name: 'Dòng đang đóng' });
    expect(card).toHaveTextContent('SKU-A');
    // Vị trí đã lấy hàng hiện trên thẻ để đối chiếu (2026-09-22)
    expect(card).toHaveTextContent('Đã lấy từ');
    expect(card).toHaveTextContent('PACK-01');
    expect(screen.getByRole('img', { name: 'Mã vạch BC-A' })).toBeInTheDocument();
    expect(screen.getByText('Công ty Mai Linh', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('0/2 dòng')).toBeInTheDocument();
    // URL giữ đơn đang mở (luật 8)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/wms/pack?order=SO2609-00007', { scroll: false }),
    );

    scanSku('BC-A');
    await waitFor(() => expect(completes).toHaveLength(1));
    // Dòng A đủ → thẻ chuyển sang dòng B, tiến độ 1/2
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Dòng đang đóng' })).toHaveTextContent('SKU-B'),
    );
    expect(screen.getByText('1/2 dòng')).toBeInTheDocument();
    scanSku('BC-B');
    await waitFor(() => expect(scans).toHaveLength(2));
    expect(completes).toHaveLength(1); // B mới 1/2 — chưa đóng dòng
    scanSku('BC-B');
    await waitFor(() => expect(completes).toHaveLength(2));
    expect(await screen.findByText('Xong đơn SO2609-00007')).toBeInTheDocument();

    // Popup nhãn: iframe trỏ vào proxy nhãn, khổ A6 dọc
    const frame = await screen.findByTitle('Nhãn vận đơn S00000001.SG.A1');
    // Đúng nguyên URL — API chặn query lạ (forbidNonWhitelisted), thêm `&n=` là 400.
    expect(frame.getAttribute('src')).toBe(
      `/api/shipments/${SHIPMENT_ID}/label?pageSize=A6&orientation=portrait`,
    );
    expect(screen.getByText('Đóng và quét đơn tiếp')).toBeInTheDocument();
    // Mọi lần quét mang idempotencyKey riêng
    const keys = new Set((scans as Array<{ idempotencyKey: string }>).map((s) => s.idempotencyKey));
    expect(keys.size).toBe(3);
  });

  /** Máy quét bắn mã vào ô đang focus (ô số lượng sau lần quét đầu) rồi Enter. */
  const scanIntoQty = async (code: string) => {
    const q = await screen.findByLabelText('Số lượng lần quét này');
    fireEvent.change(q, { target: { value: code } });
    fireEvent.keyDown(q, { key: 'Enter' });
  };
  const scanBodies = () => scans as Array<{ barcode: string; qty?: string }>;

  it('mỗi lần quét gửi ngay +1, ô số lượng đếm tổng (2026-10-12)', async () => {
    server.use(...scanFlow(WAYBILL_ISSUED));
    renderApp(<PackStationScreen />);
    scan('SO2609-00007');
    await screen.findAllByText('Sản phẩm A');

    scan('BC-B');
    await waitFor(() => expect(scans).toHaveLength(1));
    expect(scanBodies()[0]).toMatchObject({ barcode: 'BC-B', qty: '1' });
    expect(await screen.findByText(/Đang đếm BC-B/)).toBeInTheDocument();
    expect(await screen.findByLabelText('Số lượng lần quét này')).toHaveValue('1');

    // Lần 2: máy quét bắn mã vào ô số lượng đang focus → gửi tiếp +1 (B đủ 2 → dòng tự đóng)
    await scanIntoQty('BC-B');
    await waitFor(() => expect(scans).toHaveLength(2));
    expect(scanBodies()[1]).toMatchObject({ barcode: 'BC-B', qty: '1' });
  });

  it('quét một lần + gõ tổng + Enter → gửi phần còn thiếu để tổng đúng số đã gõ', async () => {
    server.use(...scanFlow(WAYBILL_ISSUED));
    renderApp(<PackStationScreen />);
    scan('SO2609-00007');
    await screen.findAllByText('Sản phẩm A');

    scanSku('BC-B', '2');
    await waitFor(() => expect(scans).toHaveLength(2));
    expect(scanBodies()).toMatchObject([
      { barcode: 'BC-B', qty: '1' },
      { barcode: 'BC-B', qty: '1' },
    ]);
  });

  it('gõ tổng nhỏ hơn số đã gửi → báo lỗi, không gửi', async () => {
    server.use(...scanFlow(WAYBILL_ISSUED));
    renderApp(<PackStationScreen />);
    scan('SO2609-00007');
    await screen.findAllByText('Sản phẩm A');

    scan('BC-B');
    await waitFor(() => expect(scans).toHaveLength(1));
    const q = await screen.findByLabelText('Số lượng lần quét này');
    fireEvent.change(q, { target: { value: '0.5' } });
    fireEvent.keyDown(q, { key: 'Enter' });
    expect(await screen.findByText(/Đã ghi nhận 1/)).toBeInTheDocument();
    expect(scans).toHaveLength(1);
  });

  it('sai SKU → banner đỏ, không cộng; mã lạ của đơn → không gọi server', async () => {
    server.use(...scanFlow(WAYBILL_ISSUED));
    renderApp(<PackStationScreen />);
    scan('SO2609-00007');
    await screen.findAllByText('Sản phẩm A');

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
    await screen.findAllByText('Sản phẩm A');
    scanSku('BC-A');
    scanSku('BC-B');
    await waitFor(() => expect(scans).toHaveLength(2));
    scanSku('BC-B');
    expect(await screen.findByText(/Hãng chưa cấp vận đơn/)).toBeInTheDocument();
    // Lần poll thứ hai có vận đơn → iframe nhãn
    expect(
      await screen.findByTitle('Nhãn vận đơn S00000009.SG', undefined, { timeout: 8000 }),
    ).toBeInTheDocument();
  }, 15000);

  it('FAILED CARRIER_REJECTED → câu theo mã + NGUYÊN VĂN lời hãng (DN2610-00007), link sửa đơn', async () => {
    server.use(
      ...scanFlow({
        ...WAYBILL_ISSUED,
        outcome: 'FAILED',
        trackingNo: null,
        reason: 'Địa chỉ nhận hàng không hợp lệ',
        errorCode: 'CARRIER_REJECTED',
      }),
    );
    renderApp(<PackStationScreen />);
    scan('SO2609-00007');
    await screen.findAllByText('Sản phẩm A');
    scanSku('BC-A');
    scanSku('BC-B');
    await waitFor(() => expect(scans).toHaveLength(2));
    scanSku('BC-B');
    expect(await screen.findByText(/chưa xin được vận đơn/)).toBeInTheDocument();
    expect(screen.getByText(/Hãng vận chuyển từ chối dữ liệu đơn/)).toBeInTheDocument();
    expect(screen.getByText('Hãng báo: “Địa chỉ nhận hàng không hợp lệ”.')).toBeInTheDocument();
  });

  it('messageFor: CARRIER_REJECTED kèm lời hãng; mã khác không lộ message thô (luật 6)', () => {
    const rejected = new ApiError(
      422,
      'CARRIER_REJECTED',
      'Hãng GHTK từ chối tạo vận đơn: Sai xã',
      { carrierMessage: 'Sai xã' },
      't-1',
    );
    expect(messageFor(rejected)).toBe(
      'Hãng vận chuyển từ chối dữ liệu đơn (thường là địa chỉ giao). Sửa đơn theo lý do hãng báo rồi xin vận đơn lại. Hãng báo: “Sai xã”.',
    );
    const other = new ApiError(502, 'CARRIER_API_ERROR', 'raw', { carrierMessage: 'x' }, 't-2');
    expect(messageFor(other)).not.toContain('x”');
    expect(messageFor(other)).not.toContain('raw');
  });

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
    await screen.findAllByText('Sản phẩm A');
    scanSku('BC-A');
    scanSku('BC-B');
    await waitFor(() => expect(scans).toHaveLength(2));
    scanSku('BC-B');
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

describe('Trạm đóng gói — màn chờ hai cột "Chờ đóng gói" / "Đã đóng gói hôm nay" (cùng bố cục màn pick PDA)', () => {
  it('lúc chưa mở đơn: cột hàng đợi từ GET /pda/queue?type=PACK, bấm một dòng → mở đơn (resolve mã đơn); cột đã đóng từ GET /pda/stats?type=PACK', async () => {
    const resolved: string[] = [];
    server.use(
      http.get('/api/pda/queue', () =>
        HttpResponse.json({
          type: 'PACK',
          warehouseId: null,
          waiting: 2,
          mine: 1,
          items: [
            {
              taskId: 'pack-q1',
              docNumber: 'PACK2609-00011',
              status: 'PENDING',
              assignedToMe: false,
              refDocNumber: 'SO2609-00011',
              lineCount: 3,
              createdAt: '2026-09-15T02:00:00.000Z',
              ageMinutes: 12,
            },
            {
              taskId: 'pack-q2',
              docNumber: 'PACK2609-00012',
              status: 'ASSIGNED',
              assignedToMe: true,
              refDocNumber: 'SO2609-00012',
              lineCount: 1,
              createdAt: '2026-09-15T02:10:00.000Z',
              ageMinutes: 2,
            },
          ],
        }),
      ),
      http.get('/api/pda/stats', () =>
        HttpResponse.json({
          userId: 'u-admin',
          type: 'PACK',
          date: '2026-09-15',
          from: '2026-09-14T17:00:00.000Z',
          to: '2026-09-15T17:00:00.000Z',
          completed: 7,
          items: [
            {
              taskId: 'pack-d1',
              docNumber: 'PACK2609-00001',
              refDocNumber: 'SO2609-00001',
              completedAt: '2026-09-15T03:00:00.000Z',
            },
          ],
        }),
      ),
      http.get('/api/pda/resolve/:code', ({ params }) => {
        resolved.push(String(params.code));
        return HttpResponse.json({ kind: 'unknown' }, { status: 404 });
      }),
    );
    renderApp(<PackStationScreen />);
    expect(screen.getByText('Quét mã đơn để nhận việc')).toBeInTheDocument();
    const queue = await screen.findByRole('region', { name: 'Chờ đóng gói' });
    await waitFor(() => expect(queue).toHaveTextContent('2 chờ · 1 của tôi'));
    expect(queue).toHaveTextContent('Chờ đóng gói · 2');
    expect(queue).toHaveTextContent('SO2609-00011');
    expect(queue).toHaveTextContent('Chưa nhận');
    expect(queue).toHaveTextContent('Của tôi');
    const done = screen.getByRole('region', { name: 'Đã đóng gói hôm nay' });
    await waitFor(() => expect(done).toHaveTextContent('Đã đóng gói hôm nay · 7'));
    expect(done).toHaveTextContent('2026-09-15');
    expect(done).toHaveTextContent('SO2609-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Mở SO2609-00011' }));
    await waitFor(() => expect(resolved).toEqual(['SO2609-00011']));
  });
});

describe('Trạm đóng gói — xem lại đơn đã đóng, in lại nhãn (2026-10-12)', () => {
  const PACKED = (trackingNo: string | null, carrierCode: string | null = 'GHTK') => ({
    task: {
      ...PACK_TASK,
      taskId: 'pack-d1',
      docNumber: 'PACK2609-00001',
      status: 'COMPLETED',
      lines: PACK_TASK.lines.map((l) => ({ ...l, status: 'COMPLETED', qtyDone: l.qtyPlanned })),
    },
    order: { id: ORDER_ID, docNumber: 'SO2609-00001', customerName: 'Công ty Mai Linh' },
    packedByName: 'packer.01',
    completedAt: '2026-09-15T03:00:00.000Z',
    shipment: { ...SHIPMENT(trackingNo), carrierCode, carrierId: carrierCode ? 'c-ghtk' : null },
  });
  const idle = (packed: ReturnType<typeof PACKED>) => [
    http.get('/api/pda/queue', () =>
      HttpResponse.json({ type: 'PACK', warehouseId: null, waiting: 0, mine: 0, items: [] }),
    ),
    http.get('/api/pda/stats', () =>
      HttpResponse.json({
        userId: 'u-admin',
        type: 'PACK',
        date: '2026-09-15',
        from: '2026-09-14T17:00:00.000Z',
        to: '2026-09-15T17:00:00.000Z',
        completed: 1,
        items: [
          {
            taskId: 'pack-d1',
            docNumber: 'PACK2609-00001',
            refDocNumber: 'SO2609-00001',
            completedAt: '2026-09-15T03:00:00.000Z',
          },
        ],
      }),
    ),
    http.get('/api/pda/packed/:taskId', ({ params }) =>
      params.taskId === 'pack-d1'
        ? HttpResponse.json(packed)
        : HttpResponse.json(
            { statusCode: 404, code: 'TASK_NOT_FOUND', message: 'x' },
            { status: 404, headers: { 'x-request-id': 'trace-404' } },
          ),
    ),
  ];

  it('bấm đơn trong "Đã đóng gói hôm nay" → xem dòng + vận đơn → "In lại nhãn vận đơn" → iframe nhãn', async () => {
    server.use(...idle(PACKED('S00000001.SG.A1')));
    renderApp(<PackStationScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem lại SO2609-00001' }));
    const dialog = await screen.findByRole('dialog', { name: /SO2609-00001 · đã đóng gói/ });
    await waitFor(() => expect(dialog).toHaveTextContent('S00000001.SG.A1'));
    expect(dialog).toHaveTextContent('Công ty Mai Linh');
    expect(dialog).toHaveTextContent('đóng bởi packer.01');
    expect(dialog).toHaveTextContent('Sản phẩm A');
    expect(dialog).toHaveTextContent('DN2609-00001');
    expect(replace).toHaveBeenCalledWith('/wms/pack?packed=pack-d1', { scroll: false });

    fireEvent.click(screen.getByRole('button', { name: /In lại nhãn vận đơn/ }));
    const frame = await screen.findByTitle('Nhãn vận đơn S00000001.SG.A1');
    expect(frame.getAttribute('src')).toContain(`/api/shipments/${SHIPMENT_ID}/label?pageSize=A6`);
    // Đóng popup nhãn → quay lại màn xem đơn
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(
      await screen.findByRole('dialog', { name: /SO2609-00001 · đã đóng gói/ }),
    ).toBeInTheDocument();
  });

  it('hãng chưa cấp vận đơn lúc đóng → "Xin vận đơn và in nhãn" → chọn sẵn hãng cũ → POST waybill → nhãn', async () => {
    const requests: unknown[] = [];
    server.use(
      ...idle(PACKED(null)),
      http.post('/api/shipments/:id/waybill', async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({
          shipmentId: SHIPMENT_ID,
          shipmentDocNumber: 'DN2609-00001',
          carrierCode: 'GHTK',
          outcome: 'ISSUED',
          trackingNo: 'S00000003.SG',
          reason: null,
          jobId: null,
        });
      }),
    );
    renderApp(<PackStationScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem lại SO2609-00001' }));
    const dialog = await screen.findByRole('dialog', { name: /đã đóng gói/ });
    await waitFor(() => expect(dialog).toHaveTextContent('Chưa có — cần xin lại'));
    fireEvent.click(screen.getByRole('button', { name: /Xin vận đơn và in nhãn/ }));
    expect(await screen.findByText(/Hãng GHTK chưa cấp vận đơn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xin vận đơn' }));
    await waitFor(() => expect(requests).toEqual([{ carrierCode: 'GHTK' }]));
    expect(await screen.findByTitle('Nhãn vận đơn S00000003.SG')).toBeInTheDocument();
  });

  it('quét lại mã đơn đã đóng gói → mở màn xem lại thay vì báo lỗi', async () => {
    server.use(
      ...idle(PACKED('S00000001.SG.A1')),
      http.get('/api/pda/resolve/:code', () =>
        HttpResponse.json({
          ...RESOLVE_ORDER,
          code: 'SO2609-00001',
          order: {
            ...RESOLVE_ORDER.order,
            docNumber: 'SO2609-00001',
            tasks: [
              { ...RESOLVE_ORDER.order.tasks[0]!, status: 'COMPLETED' },
              { ...RESOLVE_ORDER.order.tasks[1]!, id: 'pack-d1', status: 'COMPLETED' },
            ],
          },
        }),
      ),
    );
    renderApp(<PackStationScreen />);
    const input = screen.getByLabelText(/Quét/);
    fireEvent.change(input, { target: { value: 'SO2609-00001' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const dialog = await screen.findByRole('dialog', { name: /SO2609-00001 · đã đóng gói/ });
    await waitFor(() => expect(dialog).toHaveTextContent('S00000001.SG.A1'));
  });
});
