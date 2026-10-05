import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ORG_TREE_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrgTreeScreen } from './components/org-tree-screen';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/org-tree',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const EMPTY_TREE = {
  departments: [],
  teams: [],
  unassigned: [],
  totals: { employees: 0, departments: 0, teams: 0 },
};

beforeEach(() => {
  replace.mockClear();
  // Mặc định màn mở dạng sơ đồ (org-chart.test.tsx); các test này kiểm dạng danh sách.
  search = 'view=list';
});

/** URL gọi router.replace gần nhất, tách query để so không phụ thuộc thứ tự param. */
const lastReplaceQuery = () => {
  const url = replace.mock.calls.at(-1)?.[0] as string;
  return Object.fromEntries(new URLSearchParams(url.split('?')[1] ?? ''));
};

describe('Sơ đồ nhân sự — dạng danh sách (/admin/org-tree?view=list)', () => {
  it('dựng cây phòng ban lồng nhau: trưởng phòng đứng đầu, phòng ban con dưới, người chưa có phòng ban ở nhóm riêng', async () => {
    renderApp(<OrgTreeScreen />);
    const deptTree = await screen.findByRole('tree', { name: 'Theo phòng ban' });
    // Gốc → con → nhân viên đúng chỗ.
    const sales = within(deptTree).getByRole('treeitem', { name: 'Kinh doanh' });
    const hn = within(sales).getByRole('treeitem', { name: 'Kinh doanh Hà Nội' });
    expect(within(hn).getByRole('link', { name: 'Trần Thị Hoa' })).toBeInTheDocument();
    expect(within(hn).getByRole('link', { name: 'Lê Minh Tuấn' })).toBeInTheDocument();
    // Trưởng phòng (managerId) có badge; link sang hồ sơ nhân viên.
    const lanh = within(sales).getByRole('link', { name: 'Nguyễn Văn Lãnh' });
    expect(lanh).toHaveAttribute(
      'href',
      `/admin/users/${ORG_TREE_FIXTURE.departments[0]!.members[0]!.id}`,
    );
    expect(within(lanh.closest('li')!).getByText('Trưởng phòng')).toBeInTheDocument();
    // Nhóm "Chưa có phòng ban" chứa người không có departmentId.
    const unassigned = within(deptTree).getByRole('treeitem', { name: 'Chưa có phòng ban' });
    expect(within(unassigned).getByRole('link', { name: 'Đỗ Văn Kho' })).toBeInTheDocument();
    // Số người cộng dồn từ server.
    expect(within(sales).getAllByText('3 người')[0]).toBeInTheDocument();
    // Tổng ở header.
    expect(screen.getByText('4 nhân viên · 2 phòng ban · 3 team')).toBeInTheDocument();
  });

  it('cây team: LEADER có badge, loại team hiện chữ, team con lồng dưới team cha', async () => {
    renderApp(<OrgTreeScreen />);
    const teamTree = await screen.findByRole('tree', { name: 'Theo team' });
    const sales = within(teamTree).getByRole('treeitem', { name: 'Phòng kinh doanh' });
    const hn = within(sales).getByRole('treeitem', { name: 'Sale Hà Nội' });
    const leader = within(hn).getByRole('link', { name: 'Nguyễn Văn Lãnh' });
    expect(within(leader.closest('li')!).getByText('Leader')).toBeInTheDocument();
    expect(within(hn).getAllByText('Kinh doanh').length).toBeGreaterThan(0);
    const wh = within(teamTree).getByRole('treeitem', { name: 'Kho' });
    expect(within(wh).getAllByText('Kho')).toHaveLength(2); // tên team + nhãn loại WAREHOUSE
    expect(within(wh).getByRole('link', { name: 'Đỗ Văn Kho' })).toBeInTheDocument();
  });

  it('thu gọn / mở một node và toàn bộ cây', async () => {
    renderApp(<OrgTreeScreen />);
    const deptTree = await screen.findByRole('tree', { name: 'Theo phòng ban' });
    const sales = within(deptTree).getByRole('treeitem', { name: 'Kinh doanh' });
    expect(sales).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(sales).getByRole('button', { name: 'Thu gọn Kinh doanh' }));
    expect(sales).toHaveAttribute('aria-expanded', 'false');
    expect(within(sales).queryByRole('link', { name: 'Trần Thị Hoa' })).not.toBeInTheDocument();
    fireEvent.click(within(sales).getByRole('button', { name: 'Mở Kinh doanh' }));
    expect(within(sales).getByRole('link', { name: 'Trần Thị Hoa' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn tất cả' }));
    expect(screen.queryAllByRole('link', { name: /Trần Thị Hoa|Đỗ Văn Kho/ })).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Mở tất cả' }));
    expect(screen.getAllByRole('link', { name: 'Trần Thị Hoa' })).toHaveLength(2); // phòng ban + team
  });

  it('?q= lọc nhân viên trong cả hai cây, giữ cha để thấy đường đi; ô tìm ghi lên URL', async () => {
    search = 'view=list&q=hoa';
    renderApp(<OrgTreeScreen />);
    const deptTree = await screen.findByRole('tree', { name: 'Theo phòng ban' });
    expect(within(deptTree).getByRole('link', { name: 'Trần Thị Hoa' })).toBeInTheDocument();
    expect(within(deptTree).queryByRole('link', { name: 'Lê Minh Tuấn' })).not.toBeInTheDocument();
    expect(within(deptTree).queryByRole('link', { name: 'Đỗ Văn Kho' })).not.toBeInTheDocument();
    // Cha vẫn hiện để thấy đường đi, nhưng nhân viên không khớp của cha bị ẩn.
    expect(within(deptTree).getByRole('treeitem', { name: 'Kinh doanh' })).toBeInTheDocument();
    expect(
      within(deptTree).queryByRole('link', { name: 'Nguyễn Văn Lãnh' }),
    ).not.toBeInTheDocument();
    const teamTree = screen.getByRole('tree', { name: 'Theo team' });
    expect(within(teamTree).getByRole('link', { name: 'Trần Thị Hoa' })).toBeInTheDocument();
    expect(within(teamTree).queryByRole('treeitem', { name: 'Kho' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm nhân viên' }), {
      target: { value: 'tuấn' },
    });
    await waitFor(() => expect(lastReplaceQuery()).toEqual({ view: 'list', q: 'tuấn' }));
  });

  it('khớp tên phòng ban / team thì giữ nguyên toàn bộ thành viên của node đó', async () => {
    search = 'view=list&q=kho';
    renderApp(<OrgTreeScreen />);
    const teamTree = await screen.findByRole('tree', { name: 'Theo team' });
    const wh = within(teamTree).getByRole('treeitem', { name: 'Kho' });
    expect(within(wh).getByRole('link', { name: 'Đỗ Văn Kho' })).toBeInTheDocument();
    expect(
      within(teamTree).queryByRole('treeitem', { name: 'Phòng kinh doanh' }),
    ).not.toBeInTheDocument();
  });

  it('"Hiện đã ngừng hoạt động" gọi API với includeInactive=true và ghi ?inactive=1', async () => {
    const queries: string[] = [];
    server.use(
      http.get('/api/org/tree', ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('includeInactive') ?? 'absent');
        return HttpResponse.json(ORG_TREE_FIXTURE);
      }),
    );
    search = 'view=list&inactive=1';
    renderApp(<OrgTreeScreen />);
    await screen.findByRole('tree', { name: 'Theo phòng ban' });
    expect(queries).toEqual(['true']);
    const box = screen.getByRole('checkbox', { name: 'Hiện đã ngừng hoạt động' });
    expect(box).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(box);
    // Bỏ tick → mất ?inactive, giữ nguyên kiểu xem
    await waitFor(() => expect(lastReplaceQuery()).toEqual({ view: 'list' }));
  });

  it('nhân viên / phòng ban đã ngừng được đánh dấu chứ không ẩn ở client', async () => {
    const dept = ORG_TREE_FIXTURE.departments[0]!;
    server.use(
      http.get('/api/org/tree', () =>
        HttpResponse.json({
          ...ORG_TREE_FIXTURE,
          departments: [
            {
              ...dept,
              isActive: false,
              members: [{ ...dept.members[0]!, isActive: false }],
              children: [],
            },
          ],
          unassigned: [],
        }),
      ),
    );
    renderApp(<OrgTreeScreen />);
    const deptTree = await screen.findByRole('tree', { name: 'Theo phòng ban' });
    const sales = within(deptTree).getByRole('treeitem', { name: 'Kinh doanh' });
    expect(within(sales).getByText('Ngừng')).toBeInTheDocument();
    expect(within(sales).getByText('Khóa')).toBeInTheDocument();
  });

  it('trạng thái trống và lỗi (luật 13)', async () => {
    server.use(http.get('/api/org/tree', () => HttpResponse.json(EMPTY_TREE)));
    const { unmount } = renderApp(<OrgTreeScreen />);
    expect(await screen.findByText('Chưa có dữ liệu nhân sự')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đến danh sách nhân viên' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
    unmount();

    server.use(
      http.get('/api/org/tree', () =>
        HttpResponse.json(
          { code: 'INTERNAL', message: 'boom' },
          // traceId đọc từ header x-request-id (lib/api/errors.ts).
          { status: 500, headers: { 'x-request-id': 'trace-org-1' } },
        ),
      ),
    );
    renderApp(<OrgTreeScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-org-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});
