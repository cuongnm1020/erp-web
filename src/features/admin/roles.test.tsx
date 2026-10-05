import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE, PERMISSIONS_FIXTURE, ROLES_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { RolesScreen } from './components/roles-screen';

const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

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

  it('menu đầu cột: sửa tên / mô tả (PUT không kèm permissions) và xóa vai trò (409 ROLE_IN_USE → câu hướng dẫn)', async () => {
    const puts: unknown[] = [];
    let deleted = '';
    server.use(
      http.put('/api/roles/:code', async ({ params, request }) => {
        puts.push(await request.json());
        return HttpResponse.json(ROLES_FIXTURE.find((r) => r.code === params.code)!);
      }),
      http.delete('/api/roles/:code', ({ params }) => {
        deleted = String(params.code);
        return HttpResponse.json(
          { code: 'ROLE_IN_USE', message: 'raw', details: {}, traceId: 't' },
          { status: 409 },
        );
      }),
    );
    renderApp(<RolesScreen />);
    const trigger = await screen.findByRole('button', {
      name: 'Thao tác vai trò Nhân viên kinh doanh',
    });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sửa vai trò' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tên hiển thị'), {
      target: { value: 'Sale' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ name: 'Sale' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Xóa vai trò' }));
    const confirm = await screen.findByRole('dialog');
    expect(within(confirm).getByText(/đang gán cho 4 người/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Xóa vai trò' }));
    await waitFor(() => expect(deleted).toBe('SALES_MEMBER'));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Gỡ vai trò khỏi họ/)),
    );
  });

  it('catalog đủ nhóm module thật', async () => {
    renderApp(<RolesScreen />);
    await screen.findByText('Nhân viên kinh doanh');
    expect(screen.getByText('Khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Tồn kho')).toBeInTheDocument();
    expect(PERMISSIONS_FIXTURE.length).toBeGreaterThan(0);
  });
});
