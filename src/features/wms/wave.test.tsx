import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeTasks } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { DispatchScreen } from './components/dispatch-screen';
import { PickScreen } from './components/pick-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/dispatch',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const WAVE_ID = '00000000-0000-4000-8000-00000000e001';
const T1 = '00000000-0000-4000-8000-00000000f001';
const T2 = '00000000-0000-4000-8000-00000000f002';
const L1 = '00000000-0000-4000-8000-00000000f101';
const L2 = '00000000-0000-4000-8000-00000000f102';

const WAVE = {
  id: WAVE_ID,
  docNumber: 'WAVE2609-00001',
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
  createdAt: new Date(Date.UTC(2026, 8, 14)).toISOString(),
  assignedAt: null,
  startedAt: null,
  completedAt: null,
  tasks: [
    {
      id: T1,
      docNumber: 'PICK-1',
      status: 'ASSIGNED',
      refType: 'SalesOrder',
      refId: 'o1',
      refDocNumber: 'SO-1',
      lineCount: 1,
      qtyPlanned: '2.000000',
      qtyDone: '0.000000',
    },
    {
      id: T2,
      docNumber: 'PICK-2',
      status: 'ASSIGNED',
      refType: 'SalesOrder',
      refId: 'o2',
      refDocNumber: 'SO-2',
      lineCount: 1,
      qtyPlanned: '1.000000',
      qtyDone: '0.000000',
    },
  ],
  lines: [
    {
      key: 'sku-W|loc-1|-',
      skuId: 'sku-W',
      skuCode: 'SKU-W',
      skuName: 'Nước suối',
      barcodes: ['BC-W'],
      locationId: 'loc-1',
      locationCode: 'A-01-01',
      pickSequence: 100,
      lotId: null,
      lotNumber: null,
      qtyPlanned: '3.000000',
      qtyDone: '0.000000',
      qtyRemaining: '3.000000',
      complete: false,
      shares: [
        {
          taskId: T1,
          taskDocNumber: 'PICK-1',
          refDocNumber: 'SO-1',
          taskLineId: L1,
          qtyPlanned: '2.000000',
          qtyDone: '0.000000',
          lineStatus: 'ASSIGNED',
        },
        {
          taskId: T2,
          taskDocNumber: 'PICK-2',
          refDocNumber: 'SO-2',
          taskLineId: L2,
          qtyPlanned: '1.000000',
          qtyDone: '0.000000',
          lineStatus: 'ASSIGNED',
        },
      ],
    },
  ],
  assignedToMe: true,
};

describe('Bảng điều phối — gộp thẻ PICK chưa gán thành lượt (E3)', () => {
  it('tick 2 thẻ PICK PENDING → "Gộp thành một lượt" → POST /waves { taskIds }; panel lượt hiện lượt vừa tạo', async () => {
    const posted: unknown[] = [];
    let created = false;
    server.use(
      http.post('/api/waves', async ({ request }) => {
        posted.push(await request.json());
        created = true;
        return HttpResponse.json(WAVE);
      }),
      http.get('/api/waves', () =>
        HttpResponse.json(created ? { items: [WAVE], total: 1 } : { items: [], total: 0 }),
      ),
    );
    const picks = makeTasks(2).map((t, i) => ({
      ...t,
      id: [T1, T2][i]!,
      docNumber: `PICK-PEND-${i + 1}`,
      type: 'PICK',
      status: 'PENDING',
      assigneeId: null,
      waveId: null,
    }));
    server.use(
      http.get('/api/tasks', ({ request }) =>
        new URL(request.url).searchParams.get('status') === 'PENDING'
          ? HttpResponse.json({ items: picks, total: 2 })
          : HttpResponse.json({ items: [], total: 0 }),
      ),
    );
    renderApp(<DispatchScreen />);
    await screen.findByText(picks[0]!.docNumber);
    fireEvent.click(
      screen.getByRole('checkbox', { name: `Chọn ${picks[0]!.docNumber} để gộp lượt` }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: `Chọn ${picks[1]!.docNumber} để gộp lượt` }),
    );
    expect(screen.getByRole('region', { name: 'Gộp lượt pick' })).toHaveTextContent(
      'Đã chọn 2 việc',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gộp thành một lượt' }));
    await screen.findByRole('dialog');
    const buttons = screen.getAllByRole('button', { name: 'Gộp thành một lượt' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(posted).toEqual([{ taskIds: [picks[0]!.id, picks[1]!.id] }]));
    expect(await screen.findByText('WAVE2609-00001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /In phiếu lượt/ })).toBeInTheDocument();
  });

  it('thẻ có dòng báo thiếu hiện cảnh báo "thiếu N dòng"', async () => {
    const one = { ...makeTasks(1)[0]!, status: 'COMPLETED', exceptionLineCount: 2 };
    server.use(
      http.get('/api/tasks', ({ request }) =>
        new URL(request.url).searchParams.get('status') === 'EXCEPTION'
          ? HttpResponse.json({ items: [one], total: 1 })
          : HttpResponse.json({ items: [], total: 0 }),
      ),
    );
    renderApp(<DispatchScreen />);
    expect(await screen.findByText('thiếu 2 dòng')).toBeInTheDocument();
  });
});

describe('Màn pick — lượt gộp: quét mã WAVE → nhận lượt → quét SKU chia về từng đơn; báo thiếu cả nhóm', () => {
  const scan = (code: string) => {
    const input = screen.getByLabelText(/Quét/);
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };
  const resolveWave = http.get('/api/pda/resolve/:code', () =>
    HttpResponse.json({
      kind: 'wave',
      code: 'WAVE2609-00001',
      sku: null,
      order: null,
      task: null,
      location: null,
      shipment: null,
      wave: {
        id: WAVE_ID,
        docNumber: 'WAVE2609-00001',
        status: 'PENDING',
        warehouseId: 'wh-1',
        taskCount: 2,
        assignedTo: null,
        assignedToMe: false,
      },
    }),
  );

  it('quét 3 ở nhóm A-01-01 → POST /pda/waves/:id/scan kèm locationId → xong lượt', async () => {
    const scans: unknown[] = [];
    server.use(
      resolveWave,
      http.post('/api/pda/waves/:id/claim', () => HttpResponse.json(WAVE)),
      http.post('/api/pda/waves/:id/scan', async ({ request }) => {
        scans.push(await request.json());
        return HttpResponse.json({
          waveId: WAVE_ID,
          waveDocNumber: 'WAVE2609-00001',
          barcode: 'BC-W',
          skuId: 'sku-W',
          skuCode: 'SKU-W',
          uomCode: 'PCS',
          factor: '1',
          qtyScanned: '3.000000',
          qtyBase: '3.000000',
          groupKey: 'sku-W|loc-1|-',
          locationId: 'loc-1',
          lotId: null,
          groupRemaining: '0.000000',
          groupComplete: true,
          shares: [
            {
              taskId: T1,
              taskDocNumber: 'PICK-1',
              refDocNumber: 'SO-1',
              taskLineId: L1,
              qtyAdded: '2.000000',
              qtyDone: '2.000000',
              qtyPlanned: '2.000000',
              lineCompleted: true,
              taskCompleted: true,
            },
            {
              taskId: T2,
              taskDocNumber: 'PICK-2',
              refDocNumber: 'SO-2',
              taskLineId: L2,
              qtyAdded: '1.000000',
              qtyDone: '1.000000',
              qtyPlanned: '1.000000',
              lineCompleted: true,
              taskCompleted: true,
            },
          ],
          waveStatus: 'COMPLETED',
          waveCompleted: true,
          replayed: false,
        });
      }),
    );
    renderApp(<PickScreen />);
    scan('WAVE2609-00001');
    expect(await screen.findByText('Lượt lấy gộp')).toBeInTheDocument();
    expect(screen.getAllByText('A-01-01').length).toBeGreaterThan(0);
    expect(screen.getByText('SO-1 0/2')).toBeInTheDocument();
    for (let i = 0; i < 2; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    scan('BC-W');
    await waitFor(() =>
      expect(scans).toEqual([
        expect.objectContaining({ barcode: 'BC-W', qty: '3', locationId: 'loc-1' }),
      ]),
    );
    expect(await screen.findByText('Xong lượt WAVE2609-00001')).toBeInTheDocument();
  });

  it('bấm "Thiếu hàng" ở nhóm → POST /pda/waves/:id/short → cảnh báo vàng liệt kê thiếu, lượt xong với cảnh báo', async () => {
    const shorts: unknown[] = [];
    server.use(
      resolveWave,
      http.post('/api/pda/waves/:id/claim', () => HttpResponse.json(WAVE)),
      http.post('/api/pda/waves/:id/short', async ({ request }) => {
        shorts.push(await request.json());
        return HttpResponse.json({
          waveId: WAVE_ID,
          waveDocNumber: 'WAVE2609-00001',
          skuId: 'sku-W',
          locationId: 'loc-1',
          lotId: null,
          lines: [
            {
              taskLineId: L1,
              taskId: T1,
              taskDocNumber: 'PICK-1',
              skuId: 'sku-W',
              skuCode: 'SKU-W',
              lineStatus: 'EXCEPTION',
              qtyDone: '0.000000',
              qtyPlanned: '2.000000',
              shortageQty: '2.000000',
              exceptionNote: 'Kệ trống',
              taskStatus: 'COMPLETED',
              taskCompleted: true,
              replayed: false,
            },
            {
              taskLineId: L2,
              taskId: T2,
              taskDocNumber: 'PICK-2',
              skuId: 'sku-W',
              skuCode: 'SKU-W',
              lineStatus: 'EXCEPTION',
              qtyDone: '0.000000',
              qtyPlanned: '1.000000',
              shortageQty: '1.000000',
              exceptionNote: 'Kệ trống',
              taskStatus: 'COMPLETED',
              taskCompleted: true,
              replayed: false,
            },
          ],
          waveStatus: 'COMPLETED',
          waveCompleted: true,
          replayed: false,
        });
      }),
    );
    renderApp(<PickScreen />);
    scan('WAVE2609-00001');
    await screen.findByText('Lượt lấy gộp');
    fireEvent.click(screen.getByRole('button', { name: 'Thiếu hàng' }));
    fireEvent.change(await screen.findByLabelText('Lý do thiếu hàng'), {
      target: { value: 'Kệ trống' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Báo thiếu hàng' }));
    await waitFor(() =>
      expect(shorts).toEqual([
        expect.objectContaining({ skuId: 'sku-W', locationId: 'loc-1', note: 'Kệ trống' }),
      ]),
    );
    const warn = await screen.findByRole('status', { name: 'Cảnh báo thiếu hàng' });
    expect(warn).toHaveTextContent('Thiếu hàng 1 nhóm');
    expect(warn).toHaveTextContent('thiếu 3');
    expect(await screen.findByText(/Có 1 nhóm thiếu hàng/)).toBeInTheDocument();
  });
});
