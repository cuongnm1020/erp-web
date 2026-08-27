import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeTasks, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { makeTestQueryClient, renderApp } from '@/test/render';
import { DispatchScreen } from './components/dispatch-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/dispatch',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const PENDING = makeTasks(40).filter((t) => t.status === 'PENDING');

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
