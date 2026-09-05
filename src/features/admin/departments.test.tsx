import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE, makeUsers } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { TeamsScreen } from './components/teams-screen';

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
  usePathname: () => '/admin/teams',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const SALES = {
  id: '00000000-0000-4000-8000-00000000d001',
  code: 'SALES',
  name: 'Kinh doanh',
  parentId: null,
  managerId: '00000000-0000-4000-8000-0000000b0001',
  isActive: true,
  _count: { members: 2 },
};
const SALES_HN = {
  id: '00000000-0000-4000-8000-00000000d002',
  code: 'SALES-HN',
  name: 'Kinh doanh Hà Nội',
  parentId: SALES.id,
  managerId: null,
  isActive: false,
  _count: { members: 0 },
};
const TEAMS = [{ id: 't1', code: 'SALES-HN', name: 'Sale Hà Nội', type: 'SALES', parentId: null }];
const USERS = makeUsers(4).map((u, i) => ({
  ...u,
  departmentId: i < 2 ? SALES.id : null,
  departmentName: i < 2 ? SALES.name : null,
}));

function wire() {
  const userQueries: URLSearchParams[] = [];
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  server.use(
    http.get('/api/departments', () => HttpResponse.json([SALES, SALES_HN])),
    http.get('/api/teams', () => HttpResponse.json(TEAMS)),
    http.get('/api/users', ({ request }) => {
      const q = new URL(request.url).searchParams;
      userQueries.push(q);
      const dept = q.get('departmentId');
      const text = (q.get('q') ?? '').toLowerCase();
      let items = USERS;
      if (dept) items = items.filter((u) => u.departmentId === dept);
      if (text) items = items.filter((u) => `${u.code} ${u.fullName}`.toLowerCase().includes(text));
      return HttpResponse.json({ items, total: items.length });
    }),
    http.post('/api/departments', async ({ request }) => {
      const body = await request.json();
      calls.push({ method: 'POST', url: '/departments', body });
      return HttpResponse.json(
        { ...SALES_HN, id: 'new', code: 'CSKH', name: 'CSKH' },
        { status: 201 },
      );
    }),
    http.patch('/api/departments/:id', async ({ request, params }) => {
      calls.push({ method: 'PATCH', url: `/departments/${params.id}`, body: await request.json() });
      return HttpResponse.json(SALES);
    }),
    http.put('/api/departments/:id/users/:userId', ({ params }) => {
      calls.push({
        method: 'PUT',
        url: `/departments/${params.id}/users/${params.userId}`,
        body: null,
      });
      return HttpResponse.json({ id: params.userId, code: 'x', departmentId: params.id });
    }),
    http.patch('/api/users/:id', async ({ request, params }) => {
      calls.push({ method: 'PATCH', url: `/users/${params.id}`, body: await request.json() });
      return HttpResponse.json({});
    }),
  );
  return { userQueries, calls };
}

describe('TeamsScreen — Phòng ban & team (I-05)', () => {
  beforeEach(() => {
    search = '';
    replace.mockClear();
  });

  it('cây phòng ban từ GET /departments, chọn gốc mặc định, nhân viên lọc theo departmentId, team chỉ đọc', async () => {
    const { userQueries } = wire();
    renderApp(<TeamsScreen />);
    expect(
      await screen.findByText('2 phòng ban · 1 team · 2 nhân viên có phòng ban'),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Phòng ban' });
    const items = within(nav).getAllByRole('button');
    expect(items[0]).toHaveTextContent('Kinh doanh');
    expect(items[0]).toHaveAttribute('aria-current', 'true');
    expect(items[1]).toHaveTextContent('Kinh doanh Hà Nội');
    expect(items[1]).toHaveTextContent('Ngừng');

    // Bảng nhân viên: đúng 2 người thuộc SALES, trưởng phòng gắn badge, query có departmentId
    expect(await screen.findByText('Nhân viên 1')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên 2')).toBeInTheDocument();
    expect(screen.queryByText('Nhân viên 3')).not.toBeInTheDocument();
    expect(screen.getByText('Trưởng phòng')).toBeInTheDocument();
    expect(userQueries.some((q) => q.get('departmentId') === SALES.id)).toBe(true);

    // Team chỉ đọc
    expect(screen.getByText('Sale Hà Nội')).toBeInTheDocument();
    expect(screen.getByText(/chưa có API/)).toBeInTheDocument();

    // Chọn phòng ban con → ghi lên URL ?dept=
    fireEvent.click(items[1]!);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining(`dept=${SALES_HN.id}`), {
      scroll: false,
    });
  });

  it('Thêm phòng ban: dialog → POST /departments đúng body (không gửi parent/manager rỗng)', async () => {
    const { calls } = wire();
    renderApp(<TeamsScreen />);
    await screen.findByText('Nhân viên 1');
    fireEvent.click(screen.getByRole('button', { name: /Thêm phòng ban/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Mã phòng ban/), { target: { value: 'CSKH' } });
    fireEvent.change(within(dialog).getByLabelText(/Tên phòng ban/), {
      target: { value: 'Chăm sóc khách hàng' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm phòng ban' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      method: 'POST',
      url: '/departments',
      body: { code: 'CSKH', name: 'Chăm sóc khách hàng' },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Sửa: dialog prefill, không có ô mã, PATCH gửi parentId/managerId null khi bỏ trống', async () => {
    const { calls } = wire();
    search = `dept=${SALES_HN.id}`;
    renderApp(<TeamsScreen />);
    expect(await screen.findByText('Chưa có nhân viên trong phòng ban')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/Mã phòng ban/)).not.toBeInTheDocument();
    const name = within(dialog).getByLabelText(/Tên phòng ban/);
    expect(name).toHaveValue('Kinh doanh Hà Nội');
    fireEvent.change(name, { target: { value: 'KD Hà Nội' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Đang hoạt động' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      method: 'PATCH',
      url: `/departments/${SALES_HN.id}`,
      body: { name: 'KD Hà Nội', parentId: SALES.id, managerId: null, isActive: true },
    });
  });

  it('Thêm thành viên: panel tìm nhân viên ngoài phòng ban, cảnh báo đang ở phòng khác, PUT từng người', async () => {
    const { calls } = wire();
    renderApp(<TeamsScreen />);
    await screen.findByText('Nhân viên 1');
    fireEvent.click(screen.getByRole('button', { name: /Thêm thành viên/ }));
    const panel = await screen.findByRole('complementary', {
      name: 'Thêm thành viên vào Kinh doanh',
    });
    // Chỉ nhân viên chưa thuộc SALES (3, 4)
    expect(await within(panel).findByText('Nhân viên 3')).toBeInTheDocument();
    expect(within(panel).queryByText('Nhân viên 1')).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Chọn Nhân viên 3' }));
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Chọn Nhân viên 4' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Thêm 2 thành viên' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls.map((c) => c.url)).toEqual([
      `/departments/${SALES.id}/users/${USERS[2]!.id}`,
      `/departments/${SALES.id}/users/${USERS[3]!.id}`,
    ]);
    await waitFor(() =>
      expect(
        screen.queryByRole('complementary', { name: 'Thêm thành viên vào Kinh doanh' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('Gỡ khỏi phòng ban: qua hộp xác nhận → PATCH /users/:id departmentId null', async () => {
    const { calls } = wire();
    renderApp(<TeamsScreen />);
    await screen.findByText('Nhân viên 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Gỡ khỏi phòng ban' })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gỡ khỏi phòng ban' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      method: 'PATCH',
      url: `/users/${USERS[0]!.id}`,
      body: { departmentId: null },
    });
  });

  it('không có user.update → không có nút Thêm / Sửa / Gỡ (luật 7)', async () => {
    wire();
    renderApp(<TeamsScreen />, { me: { ...ME_SALE, permissions: ['user.read'] } });
    await screen.findByText('Nhân viên 1');
    expect(screen.queryByRole('button', { name: /Thêm phòng ban/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gỡ khỏi phòng ban' })).not.toBeInTheDocument();
  });

  it('empty: chưa có phòng ban → EmptyState với đúng một hành động tạo', async () => {
    wire();
    server.use(http.get('/api/departments', () => HttpResponse.json([])));
    renderApp(<TeamsScreen />);
    expect(await screen.findByText('Chưa có phòng ban')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Thêm phòng ban/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Thêm phòng ban');
  });
});
