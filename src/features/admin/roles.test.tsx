import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE, PERMISSIONS_FIXTURE, ROLES_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { RolesScreen } from './components/roles-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/roles',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

describe('RolesScreen — ma trận vai trò × quyền (I-03)', () => {
  it('cột theo role thật (kèm số người), ô tick theo permissions của role', async () => {
    renderApp(<RolesScreen />);
    expect(await screen.findByText('Nhân viên kinh doanh')).toBeInTheDocument();
    expect(screen.getByText('4 người')).toBeInTheDocument();

    // SALES_MEMBER có customer.read, không có role.update
    const cell = screen.getByRole('checkbox', { name: 'Nhân viên kinh doanh · Xem Khách hàng' });
    expect(cell).toHaveAttribute('data-state', 'checked');
    const off = screen.getByRole('checkbox', {
      name: 'Nhân viên kinh doanh · Sửa Vai trò & quyền',
    });
    expect(off).toHaveAttribute('data-state', 'unchecked');
  });

  it('tick ô → badge chưa lưu; Lưu gửi PUT /roles/:code với danh sách đầy đủ', async () => {
    const sent: Record<string, string[]> = {};
    server.use(
      http.put('/api/roles/:code', async ({ params, request }) => {
        const body = (await request.json()) as { permissions: string[] };
        sent[String(params.code)] = body.permissions;
        const role = ROLES_FIXTURE.find((r) => r.code === params.code)!;
        return HttpResponse.json({ ...role, permissions: body.permissions });
      }),
    );
    renderApp(<RolesScreen />);
    const cell = await screen.findByRole('checkbox', {
      name: 'Nhân viên kinh doanh · Sửa Vai trò & quyền',
    });
    fireEvent.click(cell);
    expect(screen.getByText('1 thay đổi chưa lưu')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(sent.SALES_MEMBER).toBeDefined());
    // danh sách đầy đủ = quyền cũ + quyền vừa tick (thứ tự theo catalog)
    expect([...sent.SALES_MEMBER!].sort()).toEqual(
      [...ROLES_FIXTURE[1]!.permissions, 'role.update'].sort(),
    );
    // ADMIN không đổi → không gọi PUT cho ADMIN
    expect(sent.ADMIN).toBeUndefined();
  });

  it('không có role.update → checkbox khóa, không có nút lưu', async () => {
    renderApp(<RolesScreen />, { me: { ...ME_SALE, permissions: ['role.read'] } });
    const cell = await screen.findByRole('checkbox', {
      name: 'Nhân viên kinh doanh · Xem Khách hàng',
    });
    expect(cell).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
  });

  it('catalog đủ nhóm module thật', async () => {
    renderApp(<RolesScreen />);
    await screen.findByText('Nhân viên kinh doanh');
    expect(screen.getByText('Khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Tồn kho')).toBeInTheDocument();
    expect(PERMISSIONS_FIXTURE.length).toBeGreaterThan(0);
  });
});
