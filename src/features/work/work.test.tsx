import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorEnvelope } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { WorkActions, WorkItemDetail, WorkItemSummary } from './api/types';
import { MyWorkScreen } from './components/my-work-screen';
import { QueueScreen } from './components/queue-screen';
import { TeamWorkScreen } from './components/team-work-screen';
import { WorkCreateScreen } from './components/work-create-screen';
import { WorkDetailScreen } from './components/work-detail-screen';

const push = vi.fn();
const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/work',
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const NO_ACTIONS: WorkActions = {
  edit: false,
  claim: false,
  assign: false,
  reply: false,
  note: false,
  wait: false,
  resume: false,
  resolve: false,
  reopen: false,
  close: false,
  confirm: false,
  cancel: false,
  start: false,
  submit: false,
  approve: false,
  rework: false,
  requestExtension: false,
  decideExtension: false,
  reassign: false,
  checklist: false,
  watchers: false,
  createChild: false,
};

const P = (id: string, fullName: string) => ({ id, code: id, fullName });

function summary(over: Partial<WorkItemSummary> = {}): WorkItemSummary {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    docNumber: 'CV2610-00112',
    kind: 'TASK',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    title: 'Gọi lại 15 khách chưa nhận hàng',
    categoryId: null,
    categoryName: null,
    channel: null,
    customer: null,
    customerHidden: false,
    contactName: null,
    contactPhone: null,
    orderId: null,
    orderDocNumber: null,
    ownerDeptId: null,
    ownerDeptName: null,
    assignee: P('u-yen', 'Nguyễn Hải Yến'),
    assigner: P('u-ha', 'Lê Thu Hà'),
    requester: P('u-ha', 'Lê Thu Hà'),
    dueAt: '2026-10-22T05:00:00.000Z',
    originalDueAt: '2026-10-22T05:00:00.000Z',
    pendingDueAt: null,
    pendingDueReason: null,
    extensionCount: 0,
    needsApproval: true,
    firstResponseDueAt: null,
    resolveDueAt: null,
    firstReplyAt: null,
    deadline: {
      kind: 'DUE',
      at: '2026-10-22T05:00:00.000Z',
      state: 'OVERDUE',
      minutesLeft: -140,
      usedPercent: 120,
    },
    checklistTotal: 15,
    checklistDone: 9,
    parentId: null,
    openChildren: 0,
    recurrenceId: null,
    submittedAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: '2026-10-21T09:05:00.000Z',
    updatedAt: '2026-10-22T04:40:00.000Z',
    version: 3,
    ...over,
  };
}

function detail(
  over: Partial<WorkItemDetail> = {},
  can: Partial<WorkActions> = {},
): WorkItemDetail {
  return {
    ...summary(),
    description: 'Gọi từng khách, ghi kết quả.',
    resolution: null,
    outcome: null,
    resolutionRef: null,
    cancelReason: null,
    reopenCount: 0,
    remindBeforeMins: null,
    pausedMins: 0,
    pausedAt: null,
    startedAt: '2026-10-22T01:10:00.000Z',
    firstResponseBreachedAt: null,
    resolveBreachedAt: null,
    slaPolicy: null,
    events: [
      {
        id: 'e1',
        type: 'CREATED',
        fromValue: null,
        toValue: null,
        body: null,
        channel: null,
        actor: P('u-ha', 'Lê Thu Hà'),
        createdAt: '2026-10-21T09:05:00.000Z',
      },
    ],
    checklist: [
      {
        id: 'c1',
        title: 'Huỳnh Thị Nga · DN2610-00058',
        sortOrder: 10,
        refType: null,
        refId: null,
        note: null,
        doneAt: null,
        doneBy: null,
      },
    ],
    watchers: [],
    attachments: [],
    children: [],
    parent: null,
    recurrence: null,
    can: { ...NO_ACTIONS, ...can },
    ...over,
  };
}

const COUNTS = {
  mine: { open: 9, overdue: 2, dueToday: 4, submitted: 1, doneToday: 5 },
  requested: { open: 3, awaitingConfirm: 1 },
  watching: { open: 2 },
  queue: { open: 46, unassigned: 7, dueSoon: 5, overdue: 3 },
  team: { open: 64, overdue: 7, dueToday: 12, awaitingMyApproval: 3, extensionRequests: 2 },
  badge: 12,
};

function listHandler(items: WorkItemSummary[], seen: URLSearchParams[] = []) {
  return http.get('/api/work-items', ({ request }) => {
    const q = new URL(request.url).searchParams;
    seen.push(q);
    return HttpResponse.json({ items, total: items.length });
  });
}

beforeEach(() => {
  search = '';
  push.mockClear();
  replace.mockClear();
  server.use(http.get('/api/work-items/counts', () => HttpResponse.json(COUNTS)));
});

describe('Việc của tôi', () => {
  it('liệt kê việc giao cho tôi, cột hạn "Quá 2h 20m", tab có số đếm; thêm việc nhanh gửi Idempotency-Key', async () => {
    const seen: URLSearchParams[] = [];
    let posted: { body: unknown; key: string | null } | null = null;
    server.use(
      listHandler([summary()], seen),
      http.post('/api/work-items', async ({ request }) => {
        posted = { body: await request.json(), key: request.headers.get('idempotency-key') };
        return HttpResponse.json(
          { items: [summary({ id: 'n1', docNumber: 'CV2610-00200', title: 'Nhắc khách' })] },
          { status: 201 },
        );
      }),
    );
    renderApp(<MyWorkScreen />);
    const row = await screen.findByRole('row', { name: /Gọi lại 15 khách/ });
    expect(within(row).getByText('Quá 2h 20m')).toBeInTheDocument();
    expect(within(row).getByText('Đang làm')).toBeInTheDocument();
    expect(within(row).getByText('9/15')).toBeInTheDocument();
    expect(seen.some((q) => q.get('view') === 'mine')).toBe(true);
    expect(screen.getByRole('tab', { name: /Giao cho tôi 9/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const input = screen.getByRole('textbox', { name: 'Thêm việc cho mình' });
    fireEvent.change(input, { target: { value: 'Nhắc khách chuyển khoản' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.key).toMatch(/[0-9a-f-]{36}/);
    expect(posted!.body).toMatchObject({ kind: 'TASK', title: 'Nhắc khách chuyển khoản' });
  });

  it('trống → lời mời tạo việc', async () => {
    server.use(listHandler([]));
    renderApp(<MyWorkScreen />);
    expect(await screen.findByText('Bạn chưa có việc nào đang mở')).toBeInTheDocument();
  });
});

describe('Chi tiết việc', () => {
  it('nút theo `can`: người làm thấy Xin gia hạn + Báo xong; Báo xong gửi submit kèm version', async () => {
    let body: unknown = null;
    server.use(
      http.get('/api/work-items/:id', () =>
        HttpResponse.json(
          detail({}, { submit: true, requestExtension: true, note: true, checklist: true }),
        ),
      ),
      http.post('/api/work-items/:id/submit', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(detail({ status: 'SUBMITTED' }));
      }),
    );
    renderApp(<WorkDetailScreen id="00000000-0000-4000-8000-000000000001" />);
    expect(
      await screen.findByRole('heading', { name: 'Gọi lại 15 khách chưa nhận hàng' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xin gia hạn' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Duyệt/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Đã quá hạn 2h 20m/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Báo xong/ }));
    await waitFor(() => expect(body).toEqual({ version: 3 }));
  });

  it('yêu cầu khách: ghi phản hồi khách gửi reply + kênh', async () => {
    let body: unknown = null;
    server.use(
      http.get('/api/work-items/:id', () =>
        HttpResponse.json(
          detail(
            {
              kind: 'CUSTOMER',
              docNumber: 'YC2610-00042',
              title: '2 chai thuốc bị rò rỉ',
              status: 'IN_PROGRESS',
              customer: { id: 'k1', code: 'KH1', name: 'Nguyễn Văn Tâm', phone: '0912345458' },
              deadline: {
                kind: 'RESOLVE',
                at: '2026-10-23T02:52:00.000Z',
                state: 'RUNNING',
                minutesLeft: 302,
                usedPercent: 47,
              },
              resolveDueAt: '2026-10-23T02:52:00.000Z',
              firstReplyAt: '2026-10-22T02:12:00.000Z',
            },
            { reply: true, note: true, resolve: true, wait: true },
          ),
        ),
      ),
      http.post('/api/work-items/:id/reply', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(detail());
      }),
    );
    renderApp(<WorkDetailScreen id="00000000-0000-4000-8000-000000000001" />);
    const box = await screen.findByRole('textbox', { name: 'Nội dung phản hồi khách' });
    expect(screen.getByRole('button', { name: /Đã xử lý/ })).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn Tâm')).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'Dạ em đã nhận' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phản hồi' }));
    await waitFor(() => expect(body).toMatchObject({ body: 'Dạ em đã nhận', channel: 'ZALO' }));
  });

  it('404 → thẻ "Không có việc này"', async () => {
    server.use(http.get('/api/work-items/:id', () => errorEnvelope(404, 'NOT_FOUND')));
    renderApp(<WorkDetailScreen id="00000000-0000-4000-8000-000000000009" />);
    expect(await screen.findByText('Không có việc này')).toBeInTheDocument();
  });
});

describe('Tạo việc', () => {
  it('giao việc tự giao cho mình: POST kind TASK + Idempotency-Key, xong mở chi tiết', async () => {
    let posted: { body: Record<string, unknown>; key: string | null } | null = null;
    server.use(
      http.get('/api/work-items/assignees', () =>
        HttpResponse.json([
          {
            id: 'u-admin',
            code: 'admin',
            fullName: 'Quản trị',
            departmentId: null,
            departmentName: null,
            isSelf: true,
            open: 2,
            overdue: 0,
            dueTomorrow: 0,
          },
          {
            id: 'u-yen',
            code: 'yen',
            fullName: 'Nguyễn Hải Yến',
            departmentId: 'd1',
            departmentName: 'CSKH A',
            isSelf: false,
            open: 9,
            overdue: 2,
            dueTomorrow: 2,
          },
        ]),
      ),
      http.post('/api/work-items', async ({ request }) => {
        posted = {
          body: (await request.json()) as Record<string, unknown>,
          key: request.headers.get('idempotency-key'),
        };
        return HttpResponse.json({ items: [summary({ id: 'new-1' })] }, { status: 201 });
      }),
    );
    renderApp(<WorkCreateScreen />);
    fireEvent.change(await screen.findByLabelText(/Tiêu đề/), {
      target: { value: 'Đọc tài liệu phân bón mới' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Giao việc/ }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.body).toMatchObject({
      kind: 'TASK',
      title: 'Đọc tài liệu phân bón mới',
      needsApproval: false,
    });
    expect(posted!.body.assigneeIds).toBeUndefined();
    expect(posted!.key).toMatch(/[0-9a-f-]{36}/);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/work/new-1'));
  });

  it('thiếu tiêu đề → báo lỗi cạnh ô, không gửi', async () => {
    server.use(http.get('/api/work-items/assignees', () => HttpResponse.json([])));
    renderApp(<WorkCreateScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Giao việc/ }));
    expect(await screen.findByText('Nhập việc cần làm.')).toBeInTheDocument();
  });
});

describe('Hàng chờ yêu cầu', () => {
  it('tab Quá hạn gửi due=overdue; nút Nhận gửi claim', async () => {
    const seen: URLSearchParams[] = [];
    let claimed = false;
    search = 'tab=overdue';
    server.use(
      listHandler(
        [
          summary({
            id: 'y1',
            kind: 'CUSTOMER',
            docNumber: 'YC2610-00045',
            title: 'Giao thiếu 1 bao phân',
            status: 'OPEN',
            assignee: null,
            assigner: null,
            contactName: 'Đặng Văn Hùng',
            contactPhone: '0978000301',
            categoryName: 'Giao sai / thiếu hàng',
            deadline: {
              kind: 'FIRST_RESPONSE',
              at: '2026-10-22T07:38:00.000Z',
              state: 'WARNING',
              minutesLeft: 18,
              usedPercent: 85,
            },
          }),
        ],
        seen,
      ),
      http.get('/api/work-config', () =>
        HttpResponse.json({
          categories: [],
          calendar: {
            weekdays: [1],
            startMinute: 480,
            endMinute: 1050,
            warnPercent: 80,
            autoCloseDays: 3,
          },
          holidays: [],
          departments: [],
        }),
      ),
      http.get('/api/work-config/categories', () => HttpResponse.json([])),
      http.post('/api/work-items/:id/claim', () => {
        claimed = true;
        return HttpResponse.json(detail());
      }),
    );
    renderApp(<QueueScreen />);
    const row = await screen.findByRole('row', { name: /YC2610-00045/ });
    expect(seen.some((q) => q.get('view') === 'queue' && q.get('due') === 'overdue')).toBe(true);
    expect(within(row).getByText('Còn 18m')).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Nhận' }));
    await waitFor(() => expect(claimed).toBe(true));
  });
});

describe('Việc của team', () => {
  it('khối lượng theo người (dưới 90% có ↓) + duyệt nhanh việc chờ duyệt', async () => {
    let approved = false;
    server.use(
      http.get('/api/work-items', ({ request }) => {
        const q = new URL(request.url).searchParams;
        const items =
          q.get('status') === 'SUBMITTED'
            ? [
                summary({
                  id: 's1',
                  docNumber: 'CV2610-00095',
                  title: 'Rà soát 120 khách',
                  status: 'SUBMITTED',
                  submittedAt: '2026-10-22T07:05:00.000Z',
                }),
              ]
            : [];
        return HttpResponse.json({ items, total: items.length });
      }),
      http.get('/api/work-items/workload', () =>
        HttpResponse.json({
          rows: [
            {
              user: P('u-yen', 'Nguyễn Hải Yến'),
              departmentId: 'd1',
              departmentName: 'CSKH A',
              isManager: false,
              open: 9,
              overdue: 2,
              dueToday: 4,
              submitted: 1,
              done7d: 21,
              onTimePercent30d: 86,
            },
          ],
          unassigned: 7,
          departments: [{ id: 'd1', name: 'CSKH A' }],
        }),
      ),
      http.post('/api/work-items/:id/approve', () => {
        approved = true;
        return HttpResponse.json(detail());
      }),
    );
    renderApp(<TeamWorkScreen />);
    expect(await screen.findByText('↓ 86%')).toBeInTheDocument();
    const item = await screen.findByText('Rà soát 120 khách');
    const li = item.closest('li')!;
    fireEvent.click(within(li).getByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(approved).toBe(true));
  });
});
