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
