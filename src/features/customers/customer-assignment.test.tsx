import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorEnvelope, makeCustomers, ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { CustomerAssignmentScreen } from './components/customer-assignment-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// Toast không render trong harness → mock để bắt action "Hoàn tác" và gọi tay.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers/assign',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const TEAM = {
  teamId: 't-hn',
  code: 'SALES-HN',
  name: 'Kinh doanh Hà Nội',
  parentId: null,
  customersInTeam: 5,
  unassigned: 2,
};
const MEMBERS = [
  {
    userId: 'u-lead',
    code: 'sale.hn.lead',
    fullName: 'Trần Thị Bình',
    role: 'LEADER',
    joinedAt: '2026-01-01T00:00:00.000Z',
    holding: 3,
  },
  {
    userId: 'u-ha',
    code: 'sale.hn.1',
    fullName: 'Lê Thu Hà',
    role: 'MEMBER',
    joinedAt: '2026-08-01T00:00:00.000Z',
    holding: 0,
  },
];
const ME_LEADER = {
  ...ME_SALE,
  userId: 'u-lead',
  code: 'sale.hn.lead',
  roles: ['SALES_LEADER'],
  permissions: ['customer.read', 'customer.assign', 'customer.update'],
  leaderTeamIds: ['t-hn'],
};

const [C1, C2] = makeCustomers(2) as [
  ReturnType<typeof makeCustomers>[number],
  ReturnType<typeof makeCustomers>[number],
];

/** Ghi lại query của GET /customers và body của POST /customer-assignments. */
function wire() {
  const listQueries: URLSearchParams[] = [];
  const posts: Record<string, unknown>[] = [];
  server.use(
    http.get('/api/customer-assignments/teams', () => HttpResponse.json([TEAM])),
    http.get('/api/customer-assignments/teams/:teamId/members', () => HttpResponse.json(MEMBERS)),
    http.get('/api/customers', ({ request }) => {
      const q = new URL(request.url).searchParams;
      listQueries.push(q);
      const unassigned = q.get('unassigned') === 'true';
      const items = [C1, C2].map((c) => ({
        ...c,
        teamIds: ['t-hn'],
        ownerIds: unassigned ? [] : ['u-lead'],
      }));
      return HttpResponse.json({ items, total: items.length });
    }),
    http.post('/api/customer-assignments', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      posts.push(body);
      const ids = body.customerIds as string[];
      return HttpResponse.json(
        {
          teamId: body.teamId,
          userId: body.userId ?? null,
          assigned: ids.length,
          unchanged: 0,
          items: ids.map((customerId) => ({
            customerId,
            previousTeamId: 't-hn',
            previousUserId: body.reason === 'Hoàn tác' ? 'u-ha' : null,
            changed: true,
          })),
        },
        { status: 201 },
      );
    }),
  );
  return { listQueries, posts };
}

describe('CustomerAssignmentScreen — P2-04', () => {
  beforeEach(() => {
    search = '';
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('không có customer.assign → màn không có quyền (luật 7), không gọi API', async () => {
    const { listQueries } = wire();
    renderApp(<CustomerAssignmentScreen />, { me: ME_SALE });
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
    expect(listQueries).toHaveLength(0);
  });

  it('leader: header đếm từ /teams, tab Chưa phân gọi GET /customers?teamId&unassigned=true, panel thành viên có tải', async () => {
    const { listQueries } = wire();
    renderApp(<CustomerAssignmentScreen />, { me: ME_LEADER });
    expect(await screen.findByText(C1.name)).toBeInTheDocument();
    expect(
      screen.getByText('Kinh doanh Hà Nội · 2 thành viên · 5 khách trong team · 2 chưa phân'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Chưa phân/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Đã phân trong team/ })).toHaveTextContent('3');

    const q = listQueries[0]!;
    expect(q.get('teamId')).toBe('t-hn');
    expect(q.get('unassigned')).toBe('true');
    expect(q.get('isActive')).toBe('true');
    expect(q.get('sortBy')).toBe('createdAt');

    expect(screen.getByRole('meter', { name: 'Trần Thị Bình đang giữ 3 khách' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
    expect(screen.getByText('Leader')).toBeInTheDocument();
    // Chưa chọn dòng → nút Gán 0 bị khóa
    expect(screen.getByRole('button', { name: 'Gán 0 khách cho Lê Thu Hà' })).toBeDisabled();
    // Cột Phụ trách chỉ có ở tab Đã phân
    expect(screen.queryByRole('columnheader', { name: /Phụ trách/ })).not.toBeInTheDocument();
  });

  it('chọn dòng → "Gán 1" cho thành viên → POST đúng body → toast có Hoàn tác → gọi lại API với previous', async () => {
    const { posts } = wire();
    renderApp(<CustomerAssignmentScreen />, { me: ME_LEADER });
    await screen.findByText(C1.name);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    expect(await screen.findByRole('toolbar', { name: 'Hành động hàng loạt' })).toHaveTextContent(
      'Đã chọn 1',
    );
    expect(screen.getByRole('button', { name: 'Gán cho' })).toBeInTheDocument();
    // Tab Chưa phân không có "Trả về chưa phân"
    expect(screen.queryByRole('button', { name: 'Trả về chưa phân' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gán 1 khách cho Lê Thu Hà' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ customerIds: [C1.id], teamId: 't-hn', userId: 'u-ha' });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    const [msg, opts] = toastSuccess.mock.calls[0] as [
      string,
      { duration: number; action: { label: string; onClick: () => void } },
    ];
    expect(msg).toBe('Đã gán 1 khách cho Lê Thu Hà');
    expect(opts.duration).toBe(10_000);
    expect(opts.action.label).toBe('Hoàn tác');
    // Selection đã được bỏ sau khi gán
    await waitFor(() =>
      expect(
        screen.queryByRole('toolbar', { name: 'Hành động hàng loạt' }),
      ).not.toBeInTheDocument(),
    );

    opts.action.onClick();
    await waitFor(() => expect(posts).toHaveLength(2));
    // Hoàn tác = gán ngược về previous (pool: userId null) kèm lý do
    expect(posts[1]).toEqual({
      customerIds: [C1.id],
      teamId: 't-hn',
      userId: null,
      reason: 'Hoàn tác',
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã hoàn tác phân công'));
  });

  it('tab Đã phân: unassigned=false, cột Phụ trách map ownerIds → tên thành viên, có "Trả về chưa phân"', async () => {
    search = 'tab=assigned';
    const { listQueries, posts } = wire();
    renderApp(<CustomerAssignmentScreen />, { me: ME_LEADER });
    await screen.findByText(C1.name);
    expect(listQueries[0]!.get('unassigned')).toBe('false');
    expect(screen.getByRole('tab', { name: /Đã phân trong team/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('columnheader', { name: /Phụ trách/ })).toBeInTheDocument();
    expect(screen.getAllByText('Trần Thị Bình').length).toBeGreaterThanOrEqual(2); // cột + panel

    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả dòng trong trang' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trả về chưa phân' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ customerIds: [C1.id, C2.id], teamId: 't-hn', userId: null });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã trả 2 khách về chưa phân', expect.anything()),
    );
  });

  it('API gán lỗi 422 USER_NOT_IN_TEAM → toast câu từ bộ dịch (luật 6), không toast thành công', async () => {
    wire();
    server.use(
      http.post('/api/customer-assignments', () =>
        errorEnvelope(422, 'USER_NOT_IN_TEAM', 'not member'),
      ),
    );
    renderApp(<CustomerAssignmentScreen />, { me: ME_LEADER });
    await screen.findByText(C1.name);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    fireEvent.click(await screen.findByRole('button', { name: 'Gán 1 khách cho Lê Thu Hà' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Người được chọn không còn thuộc team này. Tải lại danh sách thành viên.',
      ),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('empty: không còn khách chưa phân → EmptyState với đúng một hành động chuyển tab', async () => {
    wire();
    server.use(http.get('/api/customers', () => HttpResponse.json({ items: [], total: 0 })));
    renderApp(<CustomerAssignmentScreen />, { me: ME_LEADER });
    expect(await screen.findByText('Không còn khách chưa phân')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem khách đã phân' }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('tab=assigned'), {
      scroll: false,
    });
  });

  it('không lead team nào → EmptyState; /teams lỗi 500 → ErrorState có traceId', async () => {
    server.use(http.get('/api/customer-assignments/teams', () => HttpResponse.json([])));
    renderApp(<CustomerAssignmentScreen />, { me: ME_LEADER });
    expect(await screen.findByText('Bạn chưa là trưởng nhóm team nào')).toBeInTheDocument();

    server.use(http.get('/api/customer-assignments/teams', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<CustomerAssignmentScreen />, { me: ME_LEADER });
    expect(await screen.findByText('trace-db_error')).toBeInTheDocument();
  });
});
