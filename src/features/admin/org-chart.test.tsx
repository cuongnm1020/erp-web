import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ORG_TREE_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrgTreeScreen } from './components/org-tree-screen';

const replace = vi.fn();
let search = '';
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/org-tree',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const SALES = ORG_TREE_FIXTURE.departments[0]!;
const SALES_HN = SALES.children[0]!;
/** Trưởng phòng không có user.read / user.update — chỉ thêm nhân sự vào ô mình phụ trách. */
const ME_LEADER = { permissions: [], hasGlobalAccess: false, managesDepartments: true };

const lastReplaceQuery = () => {
  const url = replace.mock.calls.at(-1)?.[0] as string;
  return Object.fromEntries(new URLSearchParams(url.split('?')[1] ?? ''));
};

beforeEach(() => {
  replace.mockClear();
  search = '';
});

describe('Sơ đồ nhân sự (/admin/org-tree, mặc định dạng sơ đồ)', () => {
  it('mỗi ô = phòng ban "Tên: số người" + trưởng phòng; bấm ô ghi ?dept= lên URL', async () => {
    renderApp(<OrgTreeScreen />);
    const chart = await screen.findByRole('region', { name: 'Sơ đồ nhân sự' });
    const sales = within(chart).getByRole('button', {
      name: 'Kinh doanh: 3 người, trưởng phòng Nguyễn Văn Lãnh',
    });
    expect(within(chart).getByRole('button', { name: 'Kinh doanh Hà Nội: 2 người' })).toBeVisible();
    fireEvent.click(sales);
    await waitFor(() => expect(lastReplaceQuery()).toEqual({ dept: SALES.id }));
    // Thu gọn nhánh → ô con biến mất
    fireEvent.click(within(chart).getByRole('button', { name: 'Thu gọn Kinh doanh' }));
    expect(
      within(chart).queryByRole('button', { name: 'Kinh doanh Hà Nội: 2 người' }),
    ).not.toBeInTheDocument();
  });

  it('chuyển sang dạng danh sách ghi ?view=list', async () => {
    renderApp(<OrgTreeScreen />);
    await screen.findByRole('region', { name: 'Sơ đồ nhân sự' });
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    await waitFor(() => expect(lastReplaceQuery()).toEqual({ view: 'list' }));
  });

  it('ô đang chọn: thông tin + nhân sự trực tiếp; admin thấy sửa / thêm con / xóa phòng ban', async () => {
    search = `dept=${SALES_HN.id}`;
    renderApp(<OrgTreeScreen />);
    expect(await screen.findByRole('heading', { name: 'Kinh doanh Hà Nội' })).toBeInTheDocument();
    expect(screen.getByText('Kinh doanh')).toBeInTheDocument(); // đường dẫn cha
    const members = screen.getByRole('list', { name: 'Nhân sự' });
    expect(within(members).getByText('Trần Thị Hoa')).toBeInTheDocument();
    expect(within(members).getByText('Lê Minh Tuấn')).toBeInTheDocument();
    for (const name of ['Thêm nhân sự', 'Sửa phòng ban', 'Thêm phòng ban con', 'Xóa phòng ban'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  it('trưởng phòng: chỉ thấy "Thêm nhân sự"; người không do mình tạo không có nút sửa / xóa; thêm gửi đúng phòng ban', async () => {
    const posts: unknown[] = [];
    server.use(
      http.get('/api/org/tree', () =>
        HttpResponse.json({
          ...ORG_TREE_FIXTURE,
          departments: [
            {
              ...SALES,
              children: [
                {
                  ...SALES_HN,
                  members: [
                    { ...SALES_HN.members[0]!, canManage: false },
                    { ...SALES_HN.members[1]!, canManage: true },
                  ],
                },
              ],
            },
          ],
        }),
      ),
      http.post('/api/users', async ({ request }) => {
        const body = await request.json();
        posts.push(body);
        return HttpResponse.json({ id: 'u-new', code: 'kho.1', fullName: 'Kho Một' });
      }),
    );
    search = `dept=${SALES_HN.id}`;
    renderApp(<OrgTreeScreen />, { me: ME_LEADER });
    await screen.findByRole('heading', { name: 'Kinh doanh Hà Nội' });
    expect(screen.queryByRole('button', { name: 'Sửa phòng ban' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa phòng ban' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Trần Thị Hoa' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa Lê Minh Tuấn' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân sự' }));
    const dialog = await screen.findByRole('dialog');
    // Phòng ban cố định, không chọn vai trò (không có role.read)
    expect(within(dialog).queryByText('Phòng ban')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Vai trò')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Mã nhân viên/), { target: { value: 'kho.1' } });
    fireEvent.change(within(dialog).getByLabelText(/Họ tên/), { target: { value: 'Kho Một' } });
    fireEvent.change(within(dialog).getByLabelText(/Email/), {
      target: { value: 'kho.1@erp.local' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Mật khẩu ban đầu/), {
      target: { value: 'Staff@1234' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo nhân viên' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      code: 'kho.1',
      fullName: 'Kho Một',
      email: 'kho.1@erp.local',
      password: 'Staff@1234',
      departmentId: SALES_HN.id,
    });
  });

  it('xóa nhân sự = khóa tài khoản (PATCH isActive=false) sau khi xác nhận', async () => {
    const patches: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.patch('/api/users/:id', async ({ params, request }) => {
        patches.push({ id: String(params.id), body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    search = `dept=${SALES_HN.id}`;
    renderApp(<OrgTreeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa Trần Thị Hoa' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Lịch sử thao tác của người này vẫn giữ/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa nhân sự' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ id: SALES_HN.members[0]!.id, body: { isActive: false } });
  });

  it('xóa phòng ban còn người → 409 DEPARTMENT_NOT_EMPTY hiện câu hướng dẫn', async () => {
    server.use(
      http.delete('/api/departments/:id', () =>
        HttpResponse.json(
          { code: 'DEPARTMENT_NOT_EMPTY', message: 'raw', details: {}, traceId: 't' },
          { status: 409 },
        ),
      ),
    );
    search = `dept=${SALES_HN.id}`;
    renderApp(<OrgTreeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa phòng ban' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/còn 0 phòng ban con và 2 nhân sự/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa phòng ban' }));
    // Bộ dịch lỗi (luật 6) — không hiện message thô của server
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Chuyển họ sang phòng ban khác rồi xóa lại/),
      ),
    );
  });

  it('chưa có phòng ban nào: màn trống mời tạo phòng ban (admin)', async () => {
    server.use(
      http.get('/api/org/tree', () =>
        HttpResponse.json({
          departments: [],
          teams: [],
          unassigned: [],
          totals: { employees: 0, departments: 0, teams: 0 },
        }),
      ),
    );
    renderApp(<OrgTreeScreen />);
    expect(await screen.findByText('Chưa có phòng ban nào')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm phòng ban' })).toBeInTheDocument();
  });
});
