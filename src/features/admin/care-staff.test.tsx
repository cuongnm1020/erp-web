import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { CareStaffScreen } from './components/care-staff-screen';

const toastSuccess = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}));
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/care/staff',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const DEPT = { id: 'd-cs1', code: 'CS1', name: 'CSKH Hà Nội' };
const staff = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  code: `cs.${id}`,
  fullName: `Nhân viên ${id}`,
  email: `${id}@erp.local`,
  phone: '0901234567',
  isActive: true,
  departmentId: DEPT.id,
  departmentName: DEPT.name,
  createdById: null,
  canManage: true,
  canEdit: true,
  canLock: true,
  canLead: true,
  createdAt: '2026-10-21T01:00:00.000Z',
  roles: [{ code: 'CSKH_MEMBER', name: 'Nhân viên CSKH' }],
  position: 'MEMBER',
  groupLeaderId: null,
  groupSize: 0,
  grantedPermissions: [],
  ...over,
});
const LIST = {
  departments: [DEPT],
  staff: [
    staff('lead', {
      canManage: false,
      canEdit: false,
      canLock: false,
      canLead: false,
      position: 'MANAGER',
      roles: [{ code: 'CSKH_LEADER', name: 'Trưởng phòng CSKH' }],
    }),
    staff('a'),
  ],
  viewer: { position: 'MANAGER', canAdd: true, canSetManager: false },
};
const revenue = (id: string, value: string, orders: number) => ({
  key: { id, name: id, shopId: null, shopName: null },
  revenue: value,
  orderCount: orders,
  aov: '0',
  grossProfit: '0',
  customerCount: 0,
  newCustomerCount: 0,
  returnedRevenue: '0',
  returnedOrderCount: 0,
  returnRate: '0',
  previousRevenue: '0',
  growthPct: null,
});
const ME_CSKH_LEAD = {
  permissions: ['customer.read', 'customer.care', 'report.sales', 'user.manage_department'],
  hasGlobalAccess: false,
  managesDepartments: false,
  managesCareTeam: true,
};

describe('CareStaffScreen — Nhân viên của team (trưởng nhóm CSKH, 2026-10-22)', () => {
  it('liệt kê nhân viên + doanh thu kỳ (by-staff groupBy=owner); chính mình không có nút; Khóa → PATCH isActive=false', async () => {
    search = 'from=2026-10-01&to=2026-10-22';
    const revenueQueries: URLSearchParams[] = [];
    const patches: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.get('/api/org/care-staff', () => HttpResponse.json(LIST)),
      http.get('/api/reports/sales/by-staff', ({ request }) => {
        revenueQueries.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          from: '2026-10-01',
          to: '2026-10-22',
          previousFrom: '2026-09-09',
          previousTo: '2026-09-30',
          groupBy: 'owner',
          items: [revenue('a', '12500000', 7)],
          totals: {},
          dataAsOf: null,
        });
      }),
      http.patch('/api/users/:id', async ({ params, request }) => {
        patches.push({ id: params.id as string, body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    renderApp(<CareStaffScreen />, { me: ME_CSKH_LEAD });
    const rowA = (await screen.findByText('Nhân viên a')).closest('tr')!;
    await waitFor(() => expect(within(rowA).getByText('12.500.000')).toBeInTheDocument());
    expect(within(rowA).getByText('7 đơn')).toBeInTheDocument();
    expect(revenueQueries[0]!.get('groupBy')).toBe('owner');
    expect(revenueQueries[0]!.get('from')).toBe('2026-10-01');

    const rowLead = screen.getByText('Nhân viên lead').closest('tr')!;
    expect(within(rowLead).queryByRole('button', { name: /Khóa/ })).toBeNull();
    expect(within(rowLead).getByText('0 đơn')).toBeInTheDocument();

    fireEvent.click(within(rowA).getByRole('button', { name: 'Khóa cs.a' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Khóa' }));
    await waitFor(() => expect(patches).toEqual([{ id: 'a', body: { isActive: false } }]));
    expect(toastSuccess).toHaveBeenCalledWith('Đã khóa', { description: 'cs.a · Nhân viên a' });
  });

  it('"Thêm nhân viên" mở hộp tạo tài khoản đã gắn sẵn phòng CSKH', async () => {
    search = '';
    server.use(
      http.get('/api/org/care-staff', () => HttpResponse.json(LIST)),
      http.get('/api/reports/sales/by-staff', () =>
        HttpResponse.json({ items: [], groupBy: 'owner', totals: {} }),
      ),
    );
    renderApp(<CareStaffScreen />, { me: ME_CSKH_LEAD });
    fireEvent.click(await screen.findByRole('button', { name: /Thêm nhân viên/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(DEPT.name);
  });

  it('không phụ trách phòng CSKH nào → trạng thái trống, không có nút thêm', async () => {
    search = '';
    server.use(
      http.get('/api/org/care-staff', () => HttpResponse.json({ departments: [], staff: [] })),
      http.get('/api/reports/sales/by-staff', () =>
        HttpResponse.json({ items: [], groupBy: 'owner', totals: {} }),
      ),
    );
    renderApp(<CareStaffScreen />, { me: ME_CSKH_LEAD });
    expect(await screen.findByText('Bạn chưa phụ trách phòng CSKH nào')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm nhân viên/ })).toBeNull();
  });

  it('trưởng nhóm (2026-10-24): cột Chức vụ / Nhóm / Quyền thêm; "Phân quyền" tick quyền → PUT grants', async () => {
    search = '';
    const puts: unknown[] = [];
    server.use(
      http.get('/api/org/care-staff', () =>
        HttpResponse.json({
          ...LIST,
          staff: [
            ...LIST.staff,
            staff('g', {
              fullName: 'Lê Thị Huế',
              position: 'GROUP_LEAD',
              groupSize: 1,
              grantedPermissions: ['user.group_edit'],
            }),
            staff('b', { fullName: 'Nhân viên b', groupLeaderId: 'g' }),
          ],
        }),
      ),
      http.get('/api/reports/sales/by-staff', () =>
        HttpResponse.json({ items: [], groupBy: 'owner', totals: {} }),
      ),
      http.get('/api/org/care-staff/:id/grants', () =>
        HttpResponse.json({
          grantable: [
            {
              code: 'user.group_edit',
              group: 'Nhân sự trong nhóm',
              label: 'Sửa thông tin nhân viên',
              hint: null,
            },
            {
              code: 'user.group_lock',
              group: 'Nhân sự trong nhóm',
              label: 'Khóa / mở khóa nhân viên',
              hint: null,
            },
            { code: 'sales_order.approve', group: 'Đơn hàng', label: 'Duyệt đơn', hint: null },
          ],
          granted: ['user.group_edit'],
        }),
      ),
      http.put('/api/org/care-staff/:id/grants', async ({ params, request }) => {
        const body = (await request.json()) as { permissions: string[] };
        puts.push({ id: params.id, ...body });
        return HttpResponse.json({ grantable: [], granted: body.permissions });
      }),
    );
    renderApp(<CareStaffScreen />, { me: ME_CSKH_LEAD });
    const rowG = (await screen.findByText('Lê Thị Huế')).closest('tr')!;
    expect(within(rowG).getByText('Trưởng nhóm')).toBeInTheDocument();
    expect(within(rowG).getByText('1 nhân viên')).toBeInTheDocument();
    expect(within(rowG).getByText('Sửa NV')).toBeInTheDocument();
    const rowB = screen.getByText('Nhân viên b').closest('tr')!;
    expect(within(rowB).getByText('Nhóm Lê Thị Huế')).toBeInTheDocument();
    const rowA = screen.getByText('Nhân viên a').closest('tr')!;
    expect(within(rowA).getByText('Chưa có nhóm')).toBeInTheDocument();

    fireEvent.click(within(rowG).getByRole('button', { name: 'Phân quyền cs.g' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Duyệt đơn')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Duyệt đơn/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu quyền' }));
    await waitFor(() =>
      expect(puts).toEqual([{ id: 'g', permissions: ['user.group_edit', 'sales_order.approve'] }]),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Đã lưu quyền', { description: 'cs.g · Lê Thị Huế' });
  });
});
