import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { USER_DETAIL_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { UserDetailScreen } from './components/user-detail-screen';

/**
 * "Kho làm việc" của nhân viên (2026-10-12): picker PDA chỉ giao đơn cho người đóng gói cùng kho
 * (apps/api/docs/pick-pack-flow.md §10). Spec docs/screens/FE-PDA-2-new-orders-handover.md §4.
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

describe('Chi tiết nhân viên — Kho làm việc', () => {
  it('hiện tên kho làm việc; hộp thoại Sửa thông tin có ô Kho làm việc', async () => {
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)),
      http.get('/api/users/:id', () =>
        HttpResponse.json({ ...USER_DETAIL_FIXTURE, warehouseId: 'wh-la', canManage: true }),
      ),
    );
    renderApp(<UserDetailScreen id={USER_DETAIL_FIXTURE.id} />);
    expect(await screen.findByText('Kho Long An')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: 'Kho làm việc' })).toHaveTextContent(
      'Kho Long An',
    );
  });

  it('chưa gán kho → "Chưa gán"', async () => {
    server.use(http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)));
    renderApp(<UserDetailScreen id={USER_DETAIL_FIXTURE.id} />);
    expect(await screen.findByText('Chưa gán')).toBeInTheDocument();
  });
});
