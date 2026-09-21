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
      productName: 'Nước rửa chén Sunlight',
      imageUrl: 'https://s3.local/erp-images/sku-x.jpg?sig=x',
      binOnHand: '40.000000',
      binRemaining: '35.000000',
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
      productName: 'Khăn giấy',
      imageUrl: null,
      binOnHand: '3.000000',
      binRemaining: '3.000000',
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

/** Quét mã SKU → ô số lượng nhận focus → gõ số → Enter (2026-09-22). */
const scanQty = (code: string, qty: string) => {
  const input = screen.getByLabelText(/Quét/);
  fireEvent.change(input, { target: { value: code } });
  fireEvent.keyDown(input, { key: 'Enter' });
  const q = screen.getByLabelText('Số lượng lần quét này');
  fireEvent.change(q, { target: { value: qty } });
  fireEvent.keyDown(q, { key: 'Enter' });
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
          binRemaining: (Number(l.binRemaining) - d).toFixed(6),
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
    // Tên THƯƠNG MẠI + tên biến thể + ảnh SKU + "trên kệ còn" trên thẻ dòng đang lấy (2026-09-22)
    expect(screen.getAllByText('Nước rửa chén Sunlight').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nước rửa chén').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('img', { name: 'Nước rửa chén Sunlight' })[0]).toHaveAttribute(
      'src',
      'https://s3.local/erp-images/sku-x.jpg?sig=x',
    );
    expect(screen.getByText('Trên kệ còn', { exact: false })).toHaveTextContent('35');
    // Mã vạch SKU đang lấy hiện để đối chiếu với tem trên hàng
    expect(screen.getByRole('img', { name: 'Mã vạch BC-X' })).toBeInTheDocument();

    // Quét SKU → ô số lượng chờ → gõ 2 → Enter = lấy 2 một lần (không bấm +/−)
    scan('BC-X');
    expect(screen.getByText(/Đã quét BC-X/)).toBeInTheDocument();
    const q = screen.getByLabelText('Số lượng lần quét này');
    fireEvent.change(q, { target: { value: '2' } });
    fireEvent.keyDown(q, { key: 'Enter' });
    // Dòng X đủ → dòng hiện tại chuyển sang B-02-01
    await waitFor(() => expect(screen.getAllByText('B-02-01').length).toBeGreaterThan(0));
    scanQty('BC-Y', '1');
    expect(await screen.findByText('Xong đơn SO2609-00009')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quét đơn kế tiếp' })).toBeInTheDocument();
  });

  it('ô số lượng: Enter với giá trị ≤ 0 → báo lỗi, không gọi server; Esc → bỏ mã đang chờ', async () => {
    const bodies: unknown[] = [];
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
        bodies.push(await request.json());
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    renderApp(<PickScreen />);
    scan('PICK2609-00009');
    await screen.findAllByText('A-01-03');
    scan('BC-X');
    const q = screen.getByLabelText('Số lượng lần quét này');
    fireEvent.change(q, { target: { value: '0' } });
    fireEvent.keyDown(q, { key: 'Enter' });
    expect(await screen.findByText('Nhập số lượng lớn hơn 0')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
    fireEvent.keyDown(q, { key: 'Escape' });
    expect(screen.queryByText(/Đã quét BC-X/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Lấy/ })).toBeDisabled();
  });

  it('bấm "Thiếu hàng" ở dòng đang lấy → POST /pda/short → cảnh báo vàng, dòng đánh dấu thiếu, chuyển dòng kế', async () => {
    const shorts: unknown[] = [];
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
      http.post('/api/pda/short', async ({ request }) => {
        const body = (await request.json()) as { taskLineId: string; note?: string };
        shorts.push(body);
        return HttpResponse.json({
          taskLineId: body.taskLineId,
          taskId: TASK_ID,
          taskDocNumber: 'PICK2609-00009',
          skuId: 'sku-X',
          skuCode: 'SKU-X',
          lineStatus: 'EXCEPTION',
          qtyDone: '0.000000',
          qtyPlanned: '2.000000',
          shortageQty: '2.000000',
          exceptionNote: body.note ?? 'Thiếu hàng',
          taskStatus: 'IN_PROGRESS',
          taskCompleted: false,
          replayed: false,
        });
      }),
    );
    renderApp(<PickScreen />);
    scan('PICK2609-00009');
    await screen.findAllByText('A-01-03');
    fireEvent.click(screen.getByRole('button', { name: 'Thiếu hàng' }));
    expect(await screen.findByText(/còn thiếu 2/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Lý do thiếu hàng'), { target: { value: 'Kệ trống' } });
    fireEvent.click(screen.getByRole('button', { name: 'Báo thiếu hàng' }));
    await waitFor(() =>
      expect(shorts).toEqual([
        { taskLineId: LINE_1, note: 'Kệ trống', idempotencyKey: expect.any(String) },
      ]),
    );
    const warn = await screen.findByRole('status', { name: 'Cảnh báo thiếu hàng' });
    expect(warn).toHaveTextContent('Thiếu hàng 1 dòng');
    expect(warn).toHaveTextContent('SKU-X');
    expect(warn).toHaveTextContent('Kệ trống');
    // Dòng kế (B-02-01) thành dòng đang lấy; dòng thiếu vẫn hiện trong danh sách với nhãn "thiếu"
    await waitFor(() => expect(screen.getAllByText('B-02-01').length).toBeGreaterThan(1));
    expect(screen.getByText('· thiếu')).toBeInTheDocument();
  });

  it('màn chờ: hai cột "Việc được giao" (GET /pda/tasks, chỉ PICK) và "Đã lấy xong hôm nay" (GET /pda/stats?type=PICK); chạm việc → mở bằng mã đơn', async () => {
    const resolved: string[] = [];
    server.use(
      http.get('/api/pda/tasks', () =>
        HttpResponse.json([
          { ...PICK_TASK, status: 'IN_PROGRESS' },
          {
            ...PICK_TASK,
            taskId: 'pack-1',
            docNumber: 'PACK2609-00001',
            type: 'PACK',
            refDocNumber: 'SO2609-00001',
          },
        ]),
      ),
      http.get('/api/pda/stats', () =>
        HttpResponse.json({
          userId: 'u-admin',
          type: 'PICK',
          date: '2026-09-16',
          from: '2026-09-15T17:00:00.000Z',
          to: '2026-09-16T17:00:00.000Z',
          completed: 1,
          items: [
            {
              taskId: 'done-1',
              docNumber: 'PICK2609-00003',
              refDocNumber: 'SO2609-00003',
              completedAt: '2026-09-16T02:15:00.000Z',
            },
          ],
        }),
      ),
      http.get('/api/pda/resolve/:code', ({ params }) => {
        resolved.push(String(params.code));
        return HttpResponse.json(
          { message: 'không tìm thấy', code: 'PDA_CODE_NOT_FOUND' },
          { status: 404 },
        );
      }),
    );
    renderApp(<PickScreen />);
    const assigned = await screen.findByRole('region', { name: 'Việc được giao' });
    await waitFor(() => expect(assigned).toHaveTextContent('Việc được giao · 1'));
    expect(assigned).toHaveTextContent('SO2609-00009');
    expect(assigned).toHaveTextContent('Đang lấy');
    expect(assigned).not.toHaveTextContent('PACK2609-00001');
    const done = screen.getByRole('region', { name: 'Đã lấy xong hôm nay' });
    await waitFor(() => expect(done).toHaveTextContent('Đã lấy xong hôm nay · 1'));
    expect(done).toHaveTextContent('SO2609-00003');
    fireEvent.click(screen.getByRole('button', { name: 'Mở SO2609-00009' }));
    await waitFor(() => expect(resolved).toEqual(['SO2609-00009']));
  });

  it('lượt gộp đã giao (GET /pda/waves) hiện MỘT mục "Lượt" trong "Việc được giao", đơn con của lượt không rải ra; chạm → nhận cả lượt', async () => {
    const WAVE_ID = '00000000-0000-4000-8000-00000000e009';
    const claimed: string[] = [];
    server.use(
      http.get('/api/pda/waves', () =>
        HttpResponse.json({
          items: [
            {
              id: WAVE_ID,
              docNumber: 'WAVE2609-00009',
              warehouseId: 'wh-1',
              warehouseCode: 'WH01',
              strategy: 'BATCH',
              status: 'ASSIGNED',
              assignedTo: 'u-admin',
              assigneeName: 'Quản trị',
              taskCount: 2,
              taskDoneCount: 0,
              qtyPlanned: '3.000000',
              qtyDone: '0.000000',
              createdAt: new Date(Date.UTC(2026, 8, 18)).toISOString(),
              assignedAt: null,
              startedAt: null,
              completedAt: null,
            },
          ],
          total: 1,
        }),
      ),
      http.get('/api/pda/tasks', () =>
        HttpResponse.json([
          // Đơn con thuộc lượt → ẩn khỏi danh sách việc lẻ.
          {
            ...PICK_TASK,
            taskId: 'in-wave',
            docNumber: 'PICK2609-00021',
            refDocNumber: 'SO2609-00021',
            waveId: WAVE_ID,
            waveDocNumber: 'WAVE2609-00009',
          },
          // Việc lẻ → vẫn hiện.
          PICK_TASK,
        ]),
      ),
      http.post('/api/pda/waves/:id/claim', ({ params }) => {
        claimed.push(String(params.id));
        return HttpResponse.json({
          id: WAVE_ID,
          docNumber: 'WAVE2609-00009',
          warehouseId: 'wh-1',
          warehouseCode: 'WH01',
          strategy: 'BATCH',
          status: 'ASSIGNED',
          assignedTo: 'u-admin',
          assigneeName: 'Quản trị',
          taskCount: 2,
          taskDoneCount: 0,
          qtyPlanned: '3.000000',
          qtyDone: '0.000000',
          createdAt: new Date(Date.UTC(2026, 8, 18)).toISOString(),
          assignedAt: null,
          startedAt: null,
          completedAt: null,
          tasks: [],
          lines: [],
          assignedToMe: true,
        });
      }),
    );
    renderApp(<PickScreen />);
    const assigned = await screen.findByRole('region', { name: 'Việc được giao' });
    await waitFor(() => expect(assigned).toHaveTextContent('Việc được giao · 2'));
    expect(assigned).toHaveTextContent('WAVE2609-00009');
    expect(assigned).toHaveTextContent('Lượt gộp · 0/2 đơn');
    expect(assigned).toHaveTextContent('SO2609-00009');
    expect(assigned).not.toHaveTextContent('SO2609-00021');
    fireEvent.click(screen.getByRole('button', { name: 'Mở lượt WAVE2609-00009' }));
    await waitFor(() => expect(claimed).toEqual([WAVE_ID]));
    await waitFor(() => expect(screen.getByText('Lượt lấy gộp')).toBeInTheDocument());
    expect(screen.getByText('WAVE2609-00009')).toBeInTheDocument();
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

  it('SKU chưa có mã vạch → dòng đang lấy cảnh báo không quét được thay vì mã vạch', async () => {
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
      http.post('/api/pda/tasks/:id/claim', () =>
        HttpResponse.json({
          ...PICK_TASK,
          lines: PICK_TASK.lines.map((l) => (l.taskLineId === LINE_1 ? { ...l, barcodes: [] } : l)),
        }),
      ),
    );
    renderApp(<PickScreen />);
    scan('PICK2609-00009');
    expect((await screen.findAllByText('A-01-03')).length).toBeGreaterThan(0);
    expect(screen.getByText(/SKU chưa có mã vạch — không quét được/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^Mã vạch / })).not.toBeInTheDocument();
  });
});

describe('PLAN-packaging-hierarchy F — quét mã THÙNG ở màn pick', () => {
  const scan = (code: string) => {
    const input = screen.getByLabelText(/Quét/);
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };
  const LPN = 'LPN2609-00007';
  const TASK_WITH_BOX = {
    ...PICK_TASK,
    lines: [
      {
        ...PICK_TASK.lines[0]!,
        qtyPlanned: '100.000000',
        qtyRemaining: '100.000000',
        containerId: 'ctn-7',
        containerBarcode: LPN,
        suggested: [
          {
            uomId: 'u-box',
            uomCode: 'BOX',
            containerTypeCode: 'CARTON',
            factor: '100',
            count: '1',
          },
        ],
      },
    ],
  };

  it('dòng có thùng: hiện mã thùng + gợi ý "1 BOX"; quét LPN → POST /pda/scan KHÔNG qty → lấy trọn, xong đơn', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.get('/api/pda/resolve/:code', () =>
        HttpResponse.json({
          kind: 'task',
          code: 'PICK2609-00009',
          sku: null,
          container: null,
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
            lineCount: 1,
          },
        }),
      ),
      http.post('/api/pda/tasks/:id/claim', () => HttpResponse.json(TASK_WITH_BOX)),
      http.post('/api/pda/scan', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json({
          taskLineId: LINE_1,
          taskId: TASK_ID,
          barcode: LPN,
          skuId: 'sku-X',
          skuCode: 'SKU-X',
          uomCode: 'PCS',
          factor: '1',
          qtyScanned: '100.000000',
          qtyBase: '100.000000',
          qtyDone: '100.000000',
          qtyPlanned: '100.000000',
          qtyRemaining: '0.000000',
          lineStatus: 'IN_PROGRESS',
          taskStatus: 'IN_PROGRESS',
          complete: true,
          containerId: 'ctn-7',
          containerBarcode: LPN,
          containerPicked: true,
          replayed: false,
        });
      }),
      http.post('/api/pda/complete', () =>
        HttpResponse.json({
          taskLineId: LINE_1,
          taskId: TASK_ID,
          taskDocNumber: 'PICK2609-00009',
          lineStatus: 'COMPLETED',
          taskStatus: 'COMPLETED',
          taskCompleted: true,
          reservationId: null,
          movementId: null,
          skuId: 'sku-X',
          locationId: null,
          lotId: null,
          qty: '100.000000',
          costAmount: null,
          replayed: false,
          waybill: null,
        }),
      ),
    );
    renderApp(<PickScreen />);
    scan('PICK2609-00009');
    expect((await screen.findAllByText(LPN)).length).toBeGreaterThan(0);
    expect(screen.getByText('Thùng đã xếp — quét mã thùng để lấy trọn')).toBeInTheDocument();
    expect(screen.getByLabelText('Gợi ý lấy hàng')).toHaveTextContent('1 BOX (carton)');

    scan(LPN);
    await waitFor(() => expect(screen.getByText(/Xong đơn/)).toBeInTheDocument());
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ taskLineId: LINE_1, barcode: LPN });
    expect(bodies[0]).not.toHaveProperty('qty');
  });
});
