import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { AuthMe } from '@/lib/permission';
import { WarehouseProvider } from '@/lib/warehouse';
import { USER_DETAIL_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { UserDetailScreen } from './components/user-detail-screen';

/**
 * Kho của nhân viên: kho được phép + kho mặc định (PLAN-warehouse-context, 2026-10-16). Kho cấp
 * được = kho NGƯỜI SỬA được phép (/auth/me.warehouses); picker PDA chỉ giao đơn cho người đóng gói
 * cùng kho mặc định (apps/api/docs/pick-pack-flow.md §10).
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users/x',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const WAREHOUSES = [
  { id: 'wh-tt', code: 'KHO-TT-01', name: 'Kho Thạch Thất', isActive: true, isDefault: true },
  { id: 'wh-la', code: 'KHO-LA-01', name: 'Kho Long An', isActive: true, isDefault: false },
  { id: 'wh-tr', code: 'TRANSIT', name: 'Kho trung chuyển', isActive: true, isDefault: false },
];

const ME_EDITOR = {
  userId: 'u-admin',
  code: 'admin',
  roles: ['ADMIN'],
  permissions: [],
  leaderTeamIds: [],
  hasGlobalAccess: true,
  managesDepartments: false,
  warehouseIds: null,
  warehouses: [
    { id: 'wh-tt', code: 'KHO-TT-01', name: 'Kho Thạch Thất' },
    { id: 'wh-la', code: 'KHO-LA-01', name: 'Kho Long An' },
  ],
  defaultWarehouseId: 'wh-tt',
  selectedWarehouseId: null,
} satisfies AuthMe;

const renderDetail = () =>
  renderApp(
    <WarehouseProvider me={ME_EDITOR}>
      <UserDetailScreen id={USER_DETAIL_FIXTURE.id} />
    </WarehouseProvider>,
  );

describe('Chi tiết nhân viên — kho được phép + kho mặc định', () => {
  it('hiện kho mặc định + kho được phép; Sửa thông tin cấp thêm kho rồi đổi kho mặc định → PATCH warehouseIds + warehouseId', async () => {
    const patches: unknown[] = [];
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)),
      http.get('/api/users/:id', () =>
        HttpResponse.json({
          ...USER_DETAIL_FIXTURE,
          warehouseId: 'wh-la',
          warehouseIds: ['wh-la'],
          canManage: true,
        }),
      ),
      http.patch('/api/users/:id', async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({ ...USER_DETAIL_FIXTURE, canManage: true });
      }),
    );
    renderDetail();
    expect(await screen.findByText('Kho mặc định')).toBeInTheDocument();
    expect(screen.getAllByText('Kho Long An')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('checkbox', { name: 'Kho Long An' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Kho Thạch Thất' })).not.toBeChecked();
    expect(within(dialog).getByRole('combobox', { name: 'Kho mặc định' })).toHaveTextContent(
      'Kho Long An',
    );

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Chọn tất cả kho' }));
    expect(within(dialog).getByRole('checkbox', { name: 'Kho Thạch Thất' })).toBeChecked();
    // Bỏ kho mặc định → kho mặc định tự chuyển sang kho còn lại.
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Kho Long An' }));
    expect(within(dialog).getByRole('combobox', { name: 'Kho mặc định' })).toHaveTextContent(
      'Kho Thạch Thất',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ warehouseIds: ['wh-tt'], warehouseId: 'wh-tt' });
  });

  it('chưa gán kho → "Chưa gán" + "Chưa được cấp kho"; không đổi kho thì PATCH không gửi kho', async () => {
    const patches: Record<string, unknown>[] = [];
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)),
      http.get('/api/users/:id', () =>
        HttpResponse.json({ ...USER_DETAIL_FIXTURE, canManage: true }),
      ),
      http.patch('/api/users/:id', async ({ request }) => {
        patches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ...USER_DETAIL_FIXTURE, canManage: true });
      }),
    );
    renderDetail();
    expect(await screen.findByText('Chưa gán')).toBeInTheDocument();
    expect(screen.getByText('Chưa được cấp kho')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).not.toHaveProperty('warehouseIds');
    expect(patches[0]).not.toHaveProperty('warehouseId');
  });
});
