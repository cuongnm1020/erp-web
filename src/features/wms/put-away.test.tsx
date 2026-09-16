import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PutAwayScreen } from './components/put-away-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/pda/put-away',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const TASK_ID = '00000000-0000-4000-8000-00000000e101';
const LINE_1 = '00000000-0000-4000-8000-00000000f101';
const LINE_2 = '00000000-0000-4000-8000-00000000f102';
const LINE_3 = '00000000-0000-4000-8000-00000000f103';

interface LineOver {
  taskLineId: string;
  lineNo: number;
  status?: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  barcodes: string[];
  toLocationId: string | null;
  toLocationCode: string | null;
  pickSequence: number | null;
  qtyPlanned: string;
  qtyRemaining: string;
  exceptionNote?: string | null;
}

const line = (over: LineOver) => ({
  status: 'PENDING',
  lotId: null,
  lotNumber: null,
  expiryDate: null,
  locationId: 'dock',
  locationCode: 'DOCK',
  qtyDone: '0.000000',
  exceptionNote: null,
  ...over,
});

const PUT_TASK = {
  taskId: TASK_ID,
  docNumber: 'PUT2609-00003',
  type: 'PUT_AWAY',
  status: 'ASSIGNED',
  priority: 0,
  warehouseId: 'wh-1',
  refType: 'GoodsReceipt',
  refId: 'grn-3',
  refDocNumber: null,
  assignedTo: 'u-admin',
  createdAt: new Date(Date.UTC(2026, 8, 16)).toISOString(),
  lines: [
    line({
      taskLineId: LINE_1,
      lineNo: 1,
      skuId: 'sku-X',
      skuCode: 'SP-0002',
      skuName: '50 gói PURGER',
      barcodes: ['BC-X'],
      toLocationId: 'loc-1',
      toLocationCode: 'A01-01',
      pickSequence: 10,
      qtyPlanned: '3.000000',
      qtyRemaining: '3.000000',
    }),
    line({
      taskLineId: LINE_2,
      lineNo: 2,
      skuId: 'sku-Y',
      skuCode: 'SP-0003',
      skuName: 'Khăn giấy',
      barcodes: ['BC-Y'],
      toLocationId: 'loc-2',
      toLocationCode: 'A01-02',
      pickSequence: 20,
      qtyPlanned: '1.000000',
      qtyRemaining: '1.000000',
    }),
    line({
      taskLineId: LINE_3,
      lineNo: 3,
      status: 'EXCEPTION',
      skuId: 'sku-Z',
      skuCode: 'SP-0004',
      skuName: 'Bao tải',
      barcodes: ['BC-Z'],
      toLocationId: null,
      toLocationCode: null,
      pickSequence: null,
      qtyPlanned: '2.000000',
      qtyRemaining: '2.000000',
      exceptionNote: 'Không còn vị trí trống trong kho — supervisor chỉ định vị trí thủ công',
    }),
  ],
};

const QUEUE = {
  type: 'PUT_AWAY',
  warehouseId: null,
  items: [
    {
      taskId: TASK_ID,
      docNumber: 'PUT2609-00003',
      status: 'PENDING',
      assignedToMe: false,
      refDocNumber: null,
      lineCount: 3,
      createdAt: new Date(Date.UTC(2026, 8, 16)).toISOString(),
      ageMinutes: 12,
    },
  ],
  waiting: 1,
  mine: 0,
};

/** Server giả: cộng dồn qtyDone theo dòng, complete đánh dấu dòng; task xong khi hết dòng mở. */
function usePutAwayServer() {
  const done: Record<string, number> = {};
  const completed = new Set<string>();
  const completes: string[] = [];
  server.use(
    http.get('/api/pda/queue', () => HttpResponse.json(QUEUE)),
    http.post('/api/pda/tasks/:id/claim', () => HttpResponse.json(PUT_TASK)),
    http.get('/api/pda/resolve/:code', ({ params }) => {
      const code = String(params.code);
      const empty = {
        code,
        sku: null,
        order: null,
        task: null,
        wave: null,
        location: null,
        shipment: null,
      };
      if (code === 'LOC-A01-05') {
        return HttpResponse.json({
          ...empty,
          kind: 'location',
          location: {
            id: 'loc-5',
            code: 'A01-05',
            type: 'BIN',
            warehouseId: 'wh-1',
            warehouseCode: 'WH01',
            pickSequence: 50,
          },
        });
      }
      if (code === 'LOC-A01-02') {
        return HttpResponse.json({
          ...empty,
          kind: 'location',
          location: {
            id: 'loc-2',
            code: 'A01-02',
            type: 'BIN',
            warehouseId: 'wh-1',
            warehouseCode: 'WH01',
            pickSequence: 20,
          },
        });
      }
      return HttpResponse.json({ ...empty, kind: 'sku', sku: null });
    }),
    http.post('/api/pda/scan', async ({ request }) => {
      const body = (await request.json()) as { taskLineId: string; barcode: string; qty: string };
      const l = PUT_TASK.lines.find((x) => x.taskLineId === body.taskLineId)!;
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
      completed.add(body.taskLineId);
      completes.push(body.taskLineId);
      const last = completed.size === 2; // dòng 3 là EXCEPTION, không tính
      return HttpResponse.json({
        taskLineId: body.taskLineId,
        taskId: TASK_ID,
        taskDocNumber: 'PUT2609-00003',
        lineStatus: 'COMPLETED',
        taskStatus: last ? 'COMPLETED' : 'IN_PROGRESS',
        taskCompleted: last,
        reservationId: null,
        movementId: '77',
        skuId: 'x',
        locationId: 'loc-1',
        lotId: null,
        qty: '3.000000',
        costAmount: null,
        replayed: false,
        waybill: null,
      });
    }),
  );
  return { completes };
}

describe('Màn cất hàng trên PDA — hàng đợi → nhận → quét SKU đủ → quét ô kệ → tồn về bin', () => {
  const scan = (code: string) => {
    const input = screen.getByLabelText(/Quét/);
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('chạm việc trong hàng đợi → dòng đầu: lấy ở DOCK cất vào A01-01; quét đủ → đòi ô kệ; quét đúng ô kệ → dòng kế; xong việc', async () => {
    const { completes } = usePutAwayServer();
    renderApp(<PutAwayScreen />);
    expect(screen.getByText('Chạm một việc để cất hàng')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Mở PUT2609-00003' }));
    const card = await screen.findByRole('region', { name: 'Dòng đang cất' });
    expect(card).toHaveTextContent('DOCK');
    expect(card).toHaveTextContent('A01-01');
    expect(card).toHaveTextContent('50 gói PURGER');
    expect(screen.getByRole('img', { name: 'Mã vạch BC-X' })).toBeInTheDocument();
    // Dòng EXCEPTION (kho hết chỗ) hiện để biết, không làm được trên máy quét
    expect(screen.getByText(/chưa có ô kệ — điều phối chỉ định/)).toBeInTheDocument();
    // Chưa quét đủ thì không xác nhận được
    expect(screen.getByRole('button', { name: 'Đã cất vào A01-01' })).toBeDisabled();

    // Quét ô kệ khi chưa đủ hàng → báo mã không thuộc việc, KHÔNG complete
    scan('A01-01');
    expect(await screen.findByRole('alert')).toHaveTextContent(/không thuộc PUT2609-00003/);
    expect(completes).toEqual([]);

    scan('BC-X');
    scan('BC-X');
    scan('BC-X');
    await screen.findByText(/SP-0002 đủ 3.000000\/3.000000 — quét ô kệ A01-01/);
    expect(screen.getByLabelText('Quét ô kệ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đã cất vào A01-01' })).toBeEnabled();

    // Quét mã ô kệ đúng → complete dòng 1 → sang dòng 2
    scan('A01-01');
    await waitFor(() => expect(completes).toEqual([LINE_1]));
    await screen.findByText('Đã cất SP-0002 vào A01-01.');
    const card2 = screen.getByRole('region', { name: 'Dòng đang cất' });
    expect(card2).toHaveTextContent('A01-02');
    expect(card2).toHaveTextContent('Khăn giấy');

    scan('BC-Y');
    await screen.findByText(/SP-0003 đủ 1.000000\/1.000000/);
    // Quét SAI ô kệ (barcode vị trí, resolve ra loc-5) → báo sai chỗ, không complete
    scan('LOC-A01-05');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sai ô kệ: đang ở A01-05, cần cất SP-0003 vào A01-02.',
    );
    expect(completes).toEqual([LINE_1]);
    // Mã lạ (resolve 404) → nói thẳng phải quét tem ô kệ đích, không hiện "Không tìm thấy dữ liệu"
    server.use(
      http.get('/api/pda/resolve/:code', ({ params }) =>
        params.code === 'XYZ'
          ? HttpResponse.json(
              { statusCode: 404, code: 'NOT_FOUND', message: 'x' },
              { status: 404, headers: { 'x-request-id': 'trace-404' } },
            )
          : HttpResponse.json({
              kind: 'location',
              code: String(params.code),
              sku: null,
              order: null,
              task: null,
              wave: null,
              shipment: null,
              location: {
                id: 'loc-2',
                code: 'A01-02',
                type: 'BIN',
                warehouseId: 'wh-1',
                warehouseCode: 'WH01',
                pickSequence: 20,
              },
            }),
      ),
    );
    scan('XYZ');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mã XYZ không phải sản phẩm trong PUT2609-00003 hay ô kệ A01-02. Quét tem trên ô kệ đích.',
    );
    expect(completes).toEqual([LINE_1]);
    // Barcode vị trí đúng (khác code) → resolve ra loc-2 → complete → hết dòng mở → xong việc
    scan('LOC-A01-02');
    await waitFor(() => expect(completes).toEqual([LINE_1, LINE_2]));
    expect(await screen.findByText('Xong PUT2609-00003')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Việc kế tiếp' }));
    expect(screen.getByText('Chạm một việc để cất hàng')).toBeInTheDocument();
  });

  it('nút "Đã cất vào …" thay cho quét ô kệ khi tem mờ; quét mã việc PUT trực tiếp cũng nhận được', async () => {
    const { completes } = usePutAwayServer();
    server.use(
      http.get('/api/pda/resolve/:code', ({ params }) =>
        HttpResponse.json({
          kind: 'task',
          code: String(params.code),
          sku: null,
          order: null,
          wave: null,
          location: null,
          shipment: null,
          task: {
            id: TASK_ID,
            docNumber: 'PUT2609-00003',
            type: 'PUT_AWAY',
            status: 'PENDING',
            warehouseId: 'wh-1',
            assignedTo: null,
            assignedToMe: false,
            lineCount: 3,
          },
        }),
      ),
    );
    renderApp(<PutAwayScreen />);
    scan('PUT2609-00003');
    await screen.findByRole('region', { name: 'Dòng đang cất' });

    scan('BC-X');
    scan('BC-X');
    scan('BC-X');
    const confirm = await screen.findByRole('button', { name: 'Đã cất vào A01-01' });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(completes).toEqual([LINE_1]));
    expect(screen.getByRole('region', { name: 'Dòng đang cất' })).toHaveTextContent('A01-02');
  });

  it('quét mã việc không phải cất hàng → báo rõ, không nhận', async () => {
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
            id: 'task-pick',
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
    );
    renderApp(<PutAwayScreen />);
    scan('PICK2609-00009');
    expect(
      await screen.findByText('PICK2609-00009 không phải việc cất hàng đang mở.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Chạm một việc để cất hàng')).toBeInTheDocument();
  });
});
