import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeTasks, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { makeTestQueryClient, renderApp } from '@/test/render';
import { toast } from '@/components/ui/toaster';
import { DispatchScreen } from './components/dispatch-screen';

// Radix Select cần ResizeObserver khi mở — jsdom không có
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
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/dispatch',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const ALL = makeTasks(40);
const PENDING = ALL.filter((t) => t.status === 'PENDING');

describe('DispatchScreen — GET /tasks (P1-12)', () => {
  it('loading → MỘT bảng của tab đang mở (mặc định Chưa gán), chỉ tải bảng cho tab đó; tab nào cũng có số đếm (2026-10-08)', async () => {
    search = '';
    const seen: string[] = [];
    const counted: string[] = [];
    server.use(
      http.get('/api/tasks', ({ request }) => {
        const q = new URL(request.url).searchParams;
        (q.get('take') === '1' ? counted : seen).push(q.get('status') ?? '');
        const items = ALL.filter((t) => t.status === q.get('status'));
        return HttpResponse.json({
          items: items.slice(0, Number(q.get('take'))),
          total: items.length,
        });
      }),
    );
    renderApp(<DispatchScreen />);
    expect(screen.getAllByRole('status', { name: 'Đang tải việc' }).length).toBe(1);
    expect(await screen.findByText(PENDING[0]!.docNumber)).toBeInTheDocument();
    for (const label of ['Chưa gán', 'Đã giao', 'Đang làm', 'Ngoại lệ']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    }
    // Chỉ tab Chưa gán tải bảng; số đếm của cả bốn tab = total của API (take=1).
    expect(new Set(seen)).toEqual(new Set(['PENDING']));
    expect(new Set(counted)).toEqual(new Set(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'EXCEPTION']));
    expect(screen.getByRole('tab', { name: /Chưa gán/ })).toHaveAttribute('aria-selected', 'true');
    for (const [label, st] of [
      ['Chưa gán', 'PENDING'],
      ['Đã giao', 'ASSIGNED'],
      ['Đang làm', 'IN_PROGRESS'],
      ['Ngoại lệ', 'EXCEPTION'],
    ] as const) {
      const n = ALL.filter((t) => t.status === st).length;
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: new RegExp(label) })).toHaveTextContent(String(n)),
      );
    }
    // Bảng phân trang phía server (luật 8): 20 dòng / trang.
    expect(screen.getAllByRole('row').length).toBe(Math.min(PENDING.length, 20) + 1);
    // Bấm tab khác → ghi ?status= lên URL (tab chỉ tải khi mở).
    fireEvent.click(screen.getByRole('tab', { name: /Đã giao/ }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/wms/dispatch?status=ASSIGNED', { scroll: false }),
    );
  });

  it('tab trên URL: ?status=EXCEPTION → chỉ tải bảng ngoại lệ, tab đó được chọn', async () => {
    search = 'status=EXCEPTION';
    const seen: string[] = [];
    server.use(
      http.get('/api/tasks', ({ request }) => {
        const q = new URL(request.url).searchParams;
        if (q.get('take') !== '1') seen.push(q.get('status') ?? '');
        const items = ALL.filter((t) => t.status === q.get('status'));
        return HttpResponse.json({ items, total: items.length });
      }),
    );
    renderApp(<DispatchScreen />);
    const exc = ALL.find((t) => t.status === 'EXCEPTION')!;
    expect(await screen.findByText(exc.docNumber)).toBeInTheDocument();
    expect(new Set(seen)).toEqual(new Set(['EXCEPTION']));
    expect(screen.getByRole('tab', { name: /Ngoại lệ/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(PENDING[0]!.docNumber)).not.toBeInTheDocument();
  });

  it('dòng việc hiện tuổi việc và thời gian nằm im, KHÔNG có cờ quá hạn SLA', async () => {
    search = '';
    renderApp(<DispatchScreen />);
    await screen.findByText(PENDING[0]!.docNumber);
    expect(screen.getAllByText(/tuổi \d+ phút/).length).toBeGreaterThan(0);
    // Không dòng việc nào được gắn cờ trễ hạn: wms.Task không có cột hạn chót.
    for (const row of screen.getAllByRole('row')) {
      expect(row.textContent).not.toMatch(/quá hạn|SLA|trễ/i);
    }
  });

  it('lọc loại việc đọc từ URL và gửi xuống server (luật 8)', async () => {
    search = 'type=PICK';
    renderApp(<DispatchScreen />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Loại việc' })).toHaveTextContent('Lấy hàng'),
    );
  });

  it('tab rỗng nói rõ là rỗng, không dựng dòng giả', async () => {
    search = '';
    server.use(scenario.tasksEmpty);
    renderApp(<DispatchScreen />);
    await waitFor(() =>
      expect(screen.getAllByText('Không có việc nào ở trạng thái này.')).toHaveLength(1),
    );
  });

  it('error 500: ErrorState có traceId', async () => {
    search = '';
    server.use(scenario.tasksError);
    renderApp(<DispatchScreen />);
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    expect(screen.getAllByText('trace-db_error')).toHaveLength(1);
  });

  it('403: màn không có quyền, không đá về đăng nhập (luật 6)', async () => {
    search = '';
    server.use(scenario.tasksForbidden);
    renderApp(<DispatchScreen />);
    await waitFor(() =>
      expect(screen.getAllByText('Bạn không có quyền xem mục này')).toHaveLength(1),
    );
  });

  it('luật 9: sự kiện socket chỉ invalidate, không vá cache bằng payload', async () => {
    search = '';
    const handlers = new Map<string, (p: unknown) => void>();
    const socket = {
      on: (e: string, h: (p: unknown) => void) => handlers.set(e, h),
      off: (e: string) => handlers.delete(e),
    };
    const queryClient = makeTestQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const setSpy = vi.spyOn(queryClient, 'setQueryData');
    renderApp(<DispatchScreen />, { socket, queryClient });
    await screen.findByText(PENDING[0]!.docNumber);

    handlers.get('task.completed')?.({ id: 'x', docNumber: 'GIẢ MẠO' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['wms', 'tasks'] });
    expect(setSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('GIẢ MẠO')).not.toBeInTheDocument();
  });
});

describe('DispatchScreen — gán / trả việc (POST /tasks/:id/assign|unassign)', () => {
  it('thẻ PENDING có ô "Gán cho…" → chọn người → POST assign đúng body', async () => {
    search = '';
    const assigned: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.post('/api/tasks/:id/assign', async ({ request, params }) => {
        assigned.push({ id: params.id as string, body: await request.json() });
        return HttpResponse.json({
          taskId: params.id,
          docNumber: 'x',
          status: 'ASSIGNED',
          assignedTo: 'staff-1',
        });
      }),
    );
    renderApp(<DispatchScreen />);
    const first = PENDING[0]!;
    await screen.findByText(first.docNumber);
    fireEvent.click(screen.getByRole('combobox', { name: `Gán ${first.docNumber}` }));
    // Danh bạ giờ kèm vai trò: WAREHOUSE → "· kho", PICKER → "· lấy hàng", PACKER → "· đóng hàng".
    fireEvent.click(await screen.findByRole('option', { name: 'Phạm Thị Hoa · kho' }));
    await waitFor(() => expect(assigned).toEqual([{ id: first.id, body: { userId: 'staff-1' } }]));
    fireEvent.click(screen.getByRole('combobox', { name: `Gán ${first.docNumber}` }));
    expect(
      await screen.findByRole('option', { name: 'Lê Văn Lấy · lấy hàng' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ngô Thị Đóng · đóng hàng' })).toBeInTheDocument();
  });

  it('tick nhiều thẻ (PENDING + ASSIGNED) → "Gán cho…" một người → POST /tasks/assign { taskIds, userId }; việc lỗi báo riêng', async () => {
    search = '';
    const success = vi.spyOn(toast, 'success').mockImplementation(() => '' as never);
    const error = vi.spyOn(toast, 'error').mockImplementation(() => '' as never);
    const posted: unknown[] = [];
    server.use(
      http.post('/api/tasks/assign', async ({ request }) => {
        const body = (await request.json()) as { taskIds: string[]; userId: string };
        posted.push(body);
        return HttpResponse.json({
          userId: body.userId,
          assigned: body.taskIds.slice(0, 2).map((id) => ({
            taskId: id,
            docNumber: 'x',
            status: 'ASSIGNED',
            assignedTo: body.userId,
          })),
          failed: body.taskIds.slice(2).map((id) => ({
            taskId: id,
            docNumber: 'PICK-LOI',
            code: 'TASK_INVALID_TRANSITION',
            reason: 'đang làm dở',
          })),
        });
      }),
    );
    renderApp(<DispatchScreen />);
    // Lô 3 việc chưa gán, cố ý có việc KHÔNG phải lấy hàng → không gộp lượt được, nhưng gán được.
    const lot = PENDING.slice(0, 3);
    expect(lot.some((t) => t.type !== 'PICK')).toBe(true);
    await screen.findByText(lot[0]!.docNumber);
    for (const t of lot) {
      fireEvent.click(screen.getByRole('checkbox', { name: `Chọn ${t.docNumber}` }));
    }
    const region = screen.getByRole('region', { name: 'Việc đã chọn' });
    expect(region).toHaveTextContent('Đã chọn 3 việc');
    expect(screen.getByRole('button', { name: 'Gộp thành một lượt' })).toBeDisabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'Gán việc đã chọn cho' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Lê Văn Lấy · lấy hàng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gán 3 việc' }));
    await waitFor(() =>
      expect(posted).toEqual([{ taskIds: lot.map((t) => t.id), userId: 'staff-3' }]),
    );
    // Toaster không render trong test harness → khẳng định qua spy.
    await waitFor(() => expect(success).toHaveBeenCalledWith('Đã gán 2 việc cho Lê Văn Lấy'));
    expect(error).toHaveBeenCalledWith('PICK-LOI: đang làm dở');
    // Thanh công cụ đóng sau khi gán.
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Việc đã chọn' })).not.toBeInTheDocument(),
    );
  });

  it('lọc số dòng SKU: ?lines=1 → gửi lineCount=1, ?lines=5+ → lineCountMin=5; chọn ở ô → ghi URL (luật 8)', async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/tasks', ({ request }) => {
        const q = new URL(request.url).searchParams;
        seen.push(q);
        const n = q.get('lineCount');
        const min = q.get('lineCountMin');
        let all = ALL.filter((t) => t.status === q.get('status'));
        if (n) all = all.filter((t) => t.lineCount === Number(n));
        if (min) all = all.filter((t) => t.lineCount >= Number(min));
        return HttpResponse.json({ items: all, total: all.length });
      }),
    );
    search = 'lines=1';
    const { unmount } = renderApp(<DispatchScreen />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Số dòng SKU' })).toHaveTextContent('1 SKU'),
    );
    await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(1));
    expect(seen.every((q) => q.get('lineCount') === '1' && q.get('lineCountMin') === null)).toBe(
      true,
    );
    // Chỉ còn dòng 1 SKU trong bảng.
    const one = PENDING.find((t) => t.lineCount === 1)!;
    const two = PENDING.find((t) => t.lineCount === 2)!;
    expect(await screen.findByText(one.docNumber)).toBeInTheDocument();
    expect(screen.queryByText(two.docNumber)).not.toBeInTheDocument();
    unmount();

    seen.length = 0;
    search = 'lines=5%2B';
    renderApp(<DispatchScreen />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Số dòng SKU' })).toHaveTextContent('5+ SKU'),
    );
    await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(1));
    expect(seen.every((q) => q.get('lineCountMin') === '5' && q.get('lineCount') === null)).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Số dòng SKU' }));
    fireEvent.click(await screen.findByRole('option', { name: '2 SKU' }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/wms/dispatch?lines=2', { scroll: false }),
    );
  });

  it('"Chọn tất cả" ở đầu bảng tick mọi dòng đang hiện của trang; bỏ tick trả về rỗng; tab Đang làm không có ô', async () => {
    search = '';
    const { unmount } = renderApp(<DispatchScreen />);
    await screen.findByText(PENDING[0]!.docNumber);
    const pendingShown = Math.min(PENDING.length, 20);
    // Ô đầu bảng vẽ lại sau mỗi lần tick (cột theo lô chọn) → tra lại mỗi lần.
    const all = () => screen.getByRole('checkbox', { name: 'Chọn tất cả Chưa gán' });
    await screen.findByRole('checkbox', { name: 'Chọn tất cả Chưa gán' });
    fireEvent.click(all());
    const region = await screen.findByRole('region', { name: 'Việc đã chọn' });
    expect(region).toHaveTextContent(`Đã chọn ${pendingShown} việc`);
    expect(all()).toHaveAttribute('aria-checked', 'true');
    // Bỏ tick một dòng → ô đầu bảng thành "một phần".
    fireEvent.click(screen.getByRole('checkbox', { name: `Chọn ${PENDING[0]!.docNumber}` }));
    expect(region).toHaveTextContent(`Đã chọn ${pendingShown - 1} việc`);
    expect(all()).toHaveAttribute('aria-checked', 'mixed');
    // Tick lại cả trang rồi bỏ tick cả trang → thanh công cụ đóng.
    fireEvent.click(all());
    expect(all()).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(all());
    expect(screen.queryByRole('region', { name: 'Việc đã chọn' })).not.toBeInTheDocument();
    unmount();

    // Tab Đã giao cũng tick được (đổi người); tab Đang làm / Ngoại lệ không có ô.
    search = 'status=ASSIGNED';
    const assignedShown = Math.min(ALL.filter((t) => t.status === 'ASSIGNED').length, 20);
    const r2 = renderApp(<DispatchScreen />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Chọn tất cả Đã giao' }));
    expect(await screen.findByRole('region', { name: 'Việc đã chọn' })).toHaveTextContent(
      `Đã chọn ${assignedShown} việc`,
    );
    r2.unmount();

    search = 'status=IN_PROGRESS';
    renderApp(<DispatchScreen />);
    await screen.findByText(ALL.find((t) => t.status === 'IN_PROGRESS')!.docNumber);
    expect(screen.queryByRole('checkbox', { name: /Chọn tất cả/ })).not.toBeInTheDocument();
  });

  it('việc đã thuộc lượt gộp: không có ô tick, "Chọn tất cả" bỏ qua, không có "Gán cho…" / "Trả về" lẻ mà chỉ dẫn sang bảng lượt', async () => {
    search = '';
    const WAVE_ID = '00000000-0000-4000-8000-00000000e777';
    const inWavePending = PENDING[0]!;
    const inWaveAssigned = ALL.find((t) => t.status === 'ASSIGNED')!;
    server.use(
      http.get('/api/tasks', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        const items = ALL.filter((t) => t.status === status).map((t) =>
          t.id === inWavePending.id || t.id === inWaveAssigned.id ? { ...t, waveId: WAVE_ID } : t,
        );
        return HttpResponse.json({ items, total: items.length });
      }),
    );
    const { unmount } = renderApp(<DispatchScreen />);
    await screen.findByText(inWavePending.docNumber);
    // Không tick lẻ được, không gán lẻ được — server sẽ từ chối "thuộc lượt pick gộp".
    expect(
      screen.queryByRole('checkbox', { name: `Chọn ${inWavePending.docNumber}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: `Gán ${inWavePending.docNumber}` }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/Gán \/ đổi người cả lượt/).length).toBe(1);
    // Dòng thường cùng tab vẫn tick / gán được.
    expect(
      screen.getByRole('checkbox', { name: `Chọn ${PENDING[1]!.docNumber}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: `Gán ${PENDING[1]!.docNumber}` }),
    ).toBeInTheDocument();
    // "Chọn tất cả" đếm đúng số dòng tick được (bỏ dòng thuộc lượt).
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả Chưa gán' }));
    const shown = Math.min(PENDING.length, 20) - 1;
    expect(await screen.findByRole('region', { name: 'Việc đã chọn' })).toHaveTextContent(
      `Đã chọn ${shown} việc`,
    );
    unmount();
    // Dòng ASSIGNED thuộc lượt: không có "Trả về hàng đợi" lẻ.
    search = 'status=ASSIGNED';
    renderApp(<DispatchScreen />);
    const assignedRow = (await screen.findByText(inWaveAssigned.docNumber)).closest('tr')!;
    expect(assignedRow).not.toHaveTextContent('Trả về hàng đợi');
    expect(assignedRow).toHaveTextContent('Gán / đổi người cả lượt');
  });

  it('dòng ASSIGNED (tab Đã giao) có "Trả về hàng đợi" → POST unassign', async () => {
    search = 'status=ASSIGNED';
    const unassigned: string[] = [];
    server.use(
      http.post('/api/tasks/:id/unassign', ({ params }) => {
        unassigned.push(params.id as string);
        return HttpResponse.json({
          taskId: params.id,
          docNumber: 'x',
          status: 'PENDING',
          assignedTo: null,
        });
      }),
    );
    renderApp(<DispatchScreen />);
    const buttons = await screen.findAllByRole('button', { name: 'Trả về hàng đợi' });
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(unassigned).toHaveLength(1));
  });
});

describe('Lập lại dòng thiếu tồn (POST /tasks/:id/replan-shortages, 2026-10-05)', () => {
  it('việc PICK có dòng thiếu → nút "Lập lại" → POST → toast theo kết quả; việc đã xong / thuộc lượt không có nút', async () => {
    search = 'status=ASSIGNED';
    const base = ALL.find((t) => t.status === 'ASSIGNED')!;
    const short = {
      ...base,
      id: 'short-1',
      docNumber: 'PICK2610-00005',
      type: 'PICK',
      waveId: null,
      exceptionLineCount: 1,
    };
    const inWave = {
      ...base,
      id: 'wave-t',
      docNumber: 'PICK-W',
      type: 'PICK',
      waveId: 'w1',
      exceptionLineCount: 1,
    };
    const posted: string[] = [];
    server.use(
      http.get('/api/tasks', () => HttpResponse.json({ items: [short, inWave], total: 2 })),
      http.post('/api/tasks/:id/replan-shortages', ({ params }) => {
        posted.push(params.id as string);
        return HttpResponse.json(
          { taskId: params.id, docNumber: 'PICK2610-00005', replanned: 1, shortages: [] },
          { status: 201 },
        );
      }),
    );
    const success = vi.spyOn(toast, 'success');
    renderApp(<DispatchScreen />);
    const btn = await screen.findByRole('button', { name: 'Lập lại việc lấy hàng PICK2610-00005' });
    expect(
      screen.queryByRole('button', { name: 'Lập lại việc lấy hàng PICK-W' }),
    ).not.toBeInTheDocument();
    fireEvent.click(btn);
    await waitFor(() => expect(posted).toEqual(['short-1']));
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith('Đã lập lại 1 dòng — PICK2610-00005 lấy được rồi'),
    );
  });

  it('replanMessage: vẫn thiếu / không có dòng thiếu tồn → câu rõ ràng, không báo thành công', async () => {
    const { replanMessage } = await import('./components/dispatch-screen');
    const r = (replanned: number, left: number) => ({
      taskId: 't',
      docNumber: 'P',
      replanned,
      shortages: Array.from({ length: left }, (_, i) => ({
        sourceLineNo: i + 1,
        skuId: 's',
        qty: '1.000000',
      })),
    });
    expect(replanMessage('P', r(1, 1))).toEqual({
      ok: true,
      text: 'Đã lập lại 1 dòng, P vẫn thiếu 1 dòng',
    });
    expect(replanMessage('P', r(0, 1)).ok).toBe(false);
    expect(replanMessage('P', r(0, 1)).text).toContain('kho vẫn chưa đủ hàng');
    expect(replanMessage('P', r(0, 0)).text).toContain('không có dòng thiếu tồn');
  });
});

describe('Gợi ý gộp theo cấp đóng gói (PLAN-packaging-hierarchy §12, 2026-09-22)', () => {
  const CARTON_WAVE = {
    id: '00000000-0000-4000-8000-00000000e701',
    docNumber: 'WAVE2609-00031',
    warehouseId: 'wh-1',
    warehouseCode: 'WH01',
    strategy: 'BATCH',
    status: 'PENDING',
    assignedTo: null,
    assigneeName: null,
    taskCount: 4,
    taskDoneCount: 0,
    qtyPlanned: '400.000000',
    qtyDone: '0.000000',
    createdAt: '2026-09-22T01:00:00.000Z',
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    packLevel: 'CARTON',
    skuId: 'sku-a',
    skuCode: 'SKU-A',
    packCount: 4,
    mergedIntoId: null,
  };
  const TASK_IDS = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000f10${n}`);
  const GROUP = {
    key: `sku-a|CARTON|${TASK_IDS[0]}`,
    warehouseId: 'wh-1',
    skuId: 'sku-a',
    skuCode: 'SKU-A',
    skuName: 'Nước suối 500ml',
    packLevel: 'CARTON',
    packCount: 4,
    unitsPerPack: '100.000000',
    qtyPlanned: '400.000000',
    taskCount: 4,
    oldestCreatedAt: '2026-09-22T01:00:00.000Z',
    tasks: TASK_IDS.map((taskId, i) => ({
      taskId,
      docNumber: `PICK2609-0010${i + 1}`,
      refDocNumber: `SO2609-0010${i + 1}`,
      qtyPlanned: ['30.000000', '70.000000', '50.000000', '250.000000'][i]!,
      createdAt: `2026-09-22T01:0${i}:00.000Z`,
    })),
  };
  const SUGGESTIONS = { items: [GROUP], cartonCount: 1, palletCount: 0 };

  it('tab "Đủ gộp thùng" / "Đủ gộp pallet" hiện số nhóm ngay cả khi chưa mở; bấm → ?merge=CARTON', async () => {
    search = '';
    server.use(http.get('/api/waves/suggestions', () => HttpResponse.json(SUGGESTIONS)));
    renderApp(<DispatchScreen />);
    await screen.findByText(PENDING[0]!.docNumber);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Đủ gộp thùng/ })).toHaveTextContent('1'),
    );
    expect(screen.getByRole('tab', { name: /Đủ gộp pallet/ })).toHaveTextContent('0');
    expect(screen.getByRole('tab', { name: /Đủ gộp thùng/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    fireEvent.click(screen.getByRole('tab', { name: /Đủ gộp thùng/ }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/wms/dispatch?merge=CARTON', { scroll: false }),
    );
  });

  it('?merge=CARTON: bảng nhóm (SKU · Trọn thùng × 4 · 4 đơn) bung ra thấy đơn con; "Gộp và gán" → chọn người → POST /waves/merge đúng body → toast', async () => {
    search = 'merge=CARTON';
    const levels: string[] = [];
    const posts: unknown[] = [];
    server.use(
      http.get('/api/waves/suggestions', ({ request }) => {
        levels.push(new URL(request.url).searchParams.get('packLevel') ?? '');
        return HttpResponse.json(SUGGESTIONS);
      }),
      http.post('/api/waves/merge', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json({
          ...CARTON_WAVE,
          id: '00000000-0000-4000-8000-00000000e702',
          docNumber: 'WAVE2609-00040',
          status: 'ASSIGNED',
          tasks: [],
          lines: [],
        });
      }),
    );
    renderApp(<DispatchScreen />);
    expect(await screen.findByText('SKU-A')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Đủ gộp thùng/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Chưa gán/ })).toHaveAttribute('aria-selected', 'false');
    expect(levels).toContain('CARTON');
    expect(screen.getByText('Trọn thùng × 4')).toBeInTheDocument();
    // Bảng việc không hiện ở tab gợi ý.
    expect(screen.queryByText(PENDING[0]!.docNumber)).not.toBeInTheDocument();
    // Bung đơn con.
    const expand = screen.getByRole('button', { name: '4 đơn' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expand);
    expect(await screen.findByText('PICK2609-00101')).toBeInTheDocument();
    expect(screen.getByText('đơn SO2609-00104')).toBeInTheDocument();
    expect(expand).toHaveAttribute('aria-expanded', 'true');
    // Gộp và gán → dialog chọn người → POST /waves/merge.
    fireEvent.click(screen.getByRole('button', { name: 'Gộp và gán' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Giao lượt cho' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Phạm Thị Hoa · kho' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gộp và gán' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      skuId: 'sku-a',
      packLevel: 'CARTON',
      packCount: 4,
      taskIds: TASK_IDS,
      assignedTo: 'staff-1',
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Đã gộp 4 đơn thành lượt WAVE2609-00040'),
    );
  });

  it('409 WAVE_SUGGESTION_STALE → toast nêu mã việc không còn hợp lệ, tải lại gợi ý, không gộp phần còn lại', async () => {
    search = 'merge=CARTON';
    let gets = 0;
    const posts: unknown[] = [];
    server.use(
      http.get('/api/waves/suggestions', () => {
        gets += 1;
        return HttpResponse.json(SUGGESTIONS);
      }),
      http.post('/api/waves/merge', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(
          {
            statusCode: 409,
            code: 'WAVE_SUGGESTION_STALE',
            message: 'stale',
            details: {
              tasks: [{ id: TASK_IDS[0], docNumber: 'PICK2609-00101', status: 'CANCELLED' }],
            },
          },
          { status: 409 },
        );
      }),
    );
    renderApp(<DispatchScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gộp và gán' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gộp và gán' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/Nhóm này đã thay đổi.*Đơn không còn hợp lệ: PICK2609-00101\./),
      ),
    );
    // Chỉ MỘT lần gộp (không tự gộp phần còn lại) và gợi ý được tải lại.
    expect(posts).toHaveLength(1);
    await waitFor(() => expect(gets).toBeGreaterThanOrEqual(2));
  });

  it('tab gợi ý rỗng: lời mời một hành động "Xem Chưa gán"', async () => {
    search = 'merge=PALLET';
    renderApp(<DispatchScreen />);
    expect(
      await screen.findByText(/Chưa có nhóm đơn nào cộng đúng một pallet/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem Chưa gán' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/wms/dispatch', { scroll: false }));
  });

  it('lượt theo cấp đóng gói hiện "Trọn thùng × 4 · SKU-A"; không còn nút "Gộp tự động"', async () => {
    search = '';
    server.use(http.get('/api/waves', () => HttpResponse.json({ items: [CARTON_WAVE], total: 1 })));
    renderApp(<DispatchScreen />);
    expect(await screen.findByText('Trọn thùng × 4 · SKU-A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gộp tự động/ })).not.toBeInTheDocument();
  });
});
