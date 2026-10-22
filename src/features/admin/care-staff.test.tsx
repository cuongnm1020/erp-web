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
  createdAt: '2026-10-21T01:00:00.000Z',
  roles: [{ code: 'CSKH_MEMBER', name: 'Nhân viên CSKH' }],
  ...over,
});
const LIST = {
  departments: [DEPT],
  staff: [
    staff('lead', { canManage: false, roles: [{ code: 'CSKH_LEADER', name: 'Trưởng nhóm CSKH' }] }),
    staff('a'),
  ],
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
});
