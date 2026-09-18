import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  it('loading → bốn làn theo trạng thái thật, đếm bằng total của API', async () => {
    search = '';
    renderApp(<DispatchScreen />);
    expect(screen.getAllByRole('status', { name: 'Đang tải việc' }).length).toBe(4);
    expect(await screen.findByText(PENDING[0]!.docNumber)).toBeInTheDocument();
    for (const label of ['Chưa gán', 'Đã giao', 'Đang làm', 'Ngoại lệ']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('thẻ việc hiện tuổi việc và thời gian nằm im, KHÔNG có cờ quá hạn SLA', async () => {
    search = '';
    renderApp(<DispatchScreen />);
    await screen.findByText(PENDING[0]!.docNumber);
    expect(screen.getAllByText(/tuổi \d+ phút/).length).toBeGreaterThan(0);
    // Không thẻ việc nào được gắn cờ trễ hạn: wms.Task không có cột hạn chót.
    for (const card of screen.getAllByRole('article')) {
      expect(card.textContent).not.toMatch(/quá hạn|SLA|trễ/i);
    }
  });

  it('lọc loại việc đọc từ URL và gửi xuống server (luật 8)', async () => {
    search = 'type=PICK';
    renderApp(<DispatchScreen />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Loại việc' })).toHaveTextContent('Lấy hàng'),
    );
  });

  it('làn rỗng nói rõ là rỗng, không dựng thẻ giả', async () => {
    search = '';
    server.use(scenario.tasksEmpty);
    renderApp(<DispatchScreen />);
    await waitFor(() =>
      expect(screen.getAllByText('Không có việc nào ở trạng thái này.')).toHaveLength(4),
    );
  });

  it('error 500: ErrorState có traceId ở từng làn', async () => {
    search = '';
    server.use(scenario.tasksError);
    renderApp(<DispatchScreen />);
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(4));
    expect(screen.getAllByText('trace-db_error')).toHaveLength(4);
  });

  it('403: màn không có quyền, không đá về đăng nhập (luật 6)', async () => {
    search = '';
    server.use(scenario.tasksForbidden);
    renderApp(<DispatchScreen />);
    await waitFor(() =>
      expect(screen.getAllByText('Bạn không có quyền xem mục này')).toHaveLength(4),
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
    const pending = PENDING.slice(0, 2);
    const assignedTask = ALL.find((t) => t.status === 'ASSIGNED')!;
    await screen.findByText(pending[0]!.docNumber);
    for (const t of [...pending, assignedTask]) {
      fireEvent.click(screen.getByRole('checkbox', { name: `Chọn ${t.docNumber}` }));
    }
    // Có thẻ ASSIGNED trong lô → không gộp lượt được, nhưng gán được.
    const region = screen.getByRole('region', { name: 'Việc đã chọn' });
    expect(region).toHaveTextContent('Đã chọn 3 việc');
    expect(screen.getByRole('button', { name: 'Gộp thành một lượt' })).toBeDisabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'Gán việc đã chọn cho' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Lê Văn Lấy · lấy hàng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gán 3 việc' }));
    await waitFor(() =>
      expect(posted).toEqual([
        { taskIds: [pending[0]!.id, pending[1]!.id, assignedTask.id], userId: 'staff-3' },
      ]),
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
    await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(4));
    expect(seen.every((q) => q.get('lineCount') === '1' && q.get('lineCountMin') === null)).toBe(
      true,
    );
    // Chỉ còn thẻ 1 dòng trong làn.
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
    await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(4));
    expect(seen.every((q) => q.get('lineCountMin') === '5' && q.get('lineCount') === null)).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Số dòng SKU' }));
    fireEvent.click(await screen.findByRole('option', { name: '2 SKU' }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/wms/dispatch?lines=2', { scroll: false }),
    );
  });

  it('"Chọn tất cả" ở đầu làn tick mọi thẻ đang hiện của làn đó; bỏ tick trả về rỗng; làn Đang làm không có ô', async () => {
    search = '';
    renderApp(<DispatchScreen />);
    await screen.findByText(PENDING[0]!.docNumber);
    const pendingShown = Math.min(PENDING.length, 20);
    const all = await screen.findByRole('checkbox', { name: 'Chọn tất cả Chưa gán' });
    fireEvent.click(all);
    const region = await screen.findByRole('region', { name: 'Việc đã chọn' });
    expect(region).toHaveTextContent(`Đã chọn ${pendingShown} việc`);
    expect(all).toHaveAttribute('aria-checked', 'true');
    // Bỏ tick một thẻ → ô đầu làn thành "một phần".
    fireEvent.click(screen.getByRole('checkbox', { name: `Chọn ${PENDING[0]!.docNumber}` }));
    expect(region).toHaveTextContent(`Đã chọn ${pendingShown - 1} việc`);
    expect(all).toHaveAttribute('aria-checked', 'mixed');
    // Tick cả làn Đã giao nữa → cộng dồn.
    const assignedShown = Math.min(ALL.filter((t) => t.status === 'ASSIGNED').length, 20);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả Đã giao' }));
    expect(region).toHaveTextContent(`Đã chọn ${pendingShown - 1 + assignedShown} việc`);
    expect(
      screen.queryByRole('checkbox', { name: 'Chọn tất cả Đang làm' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Chọn tất cả Ngoại lệ' }),
    ).not.toBeInTheDocument();
    // Bỏ tick cả làn Chưa gán → chỉ còn lô Đã giao.
    fireEvent.click(all);
    fireEvent.click(all);
    expect(region).toHaveTextContent(`Đã chọn ${assignedShown} việc`);
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
    renderApp(<DispatchScreen />);
    await screen.findByText(inWavePending.docNumber);
    // Không tick lẻ được, không gán lẻ được — server sẽ từ chối "thuộc lượt pick gộp".
    expect(
      screen.queryByRole('checkbox', { name: `Chọn ${inWavePending.docNumber}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: `Gán ${inWavePending.docNumber}` }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/Gán \/ đổi người cả lượt/).length).toBe(2);
    // Thẻ thường cùng làn vẫn tick / gán được.
    expect(
      screen.getByRole('checkbox', { name: `Chọn ${PENDING[1]!.docNumber}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: `Gán ${PENDING[1]!.docNumber}` }),
    ).toBeInTheDocument();
    // "Chọn tất cả" đếm đúng số thẻ tick được (bỏ thẻ thuộc lượt).
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả Chưa gán' }));
    const shown = Math.min(PENDING.length, 20) - 1;
    expect(await screen.findByRole('region', { name: 'Việc đã chọn' })).toHaveTextContent(
      `Đã chọn ${shown} việc`,
    );
    // Thẻ ASSIGNED thuộc lượt: không có "Trả về hàng đợi" lẻ.
    const assignedCard = screen.getByText(inWaveAssigned.docNumber).closest('article')!;
    expect(assignedCard).not.toHaveTextContent('Trả về hàng đợi');
  });

  it('thẻ ASSIGNED có "Trả về hàng đợi" → POST unassign', async () => {
    search = '';
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

describe('WavePanel — auto-wave theo cấp đóng gói (2026-09-19)', () => {
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
    qtyPlanned: '100.000000',
    qtyDone: '0.000000',
    createdAt: '2026-09-19T01:00:00.000Z',
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    packLevel: 'CARTON',
    skuId: 'sku-a',
    skuCode: 'SKU-A',
    mergedIntoId: null,
  };

  it('lượt CARTON hiện nhãn "Trọn thùng · SKU"; bấm "Gộp tự động" → POST /waves/auto-merge → toast tổng kết', async () => {
    const posts: unknown[] = [];
    server.use(
      http.get('/api/waves', () => HttpResponse.json({ items: [CARTON_WAVE], total: 1 })),
      http.post('/api/waves/auto-merge', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json({
          cartonWaves: [
            { waveId: 'w-2', docNumber: 'WAVE2609-00032', skuId: 'sku-a', taskCount: 2 },
          ],
          palletWaves: [],
        });
      }),
    );
    renderApp(<DispatchScreen />);
    expect(await screen.findByText('Trọn thùng · SKU-A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gộp tự động thùng / pallet' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ warehouseId: expect.any(String) });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Đã gộp tự động 1 lượt thùng, 0 lượt pallet'),
    );
  });
});
