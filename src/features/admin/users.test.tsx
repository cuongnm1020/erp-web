import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ME_SALE, makeUsers, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { UsersScreen } from './components/users-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const FIRST = makeUsers(1)[0]!;

describe('UsersScreen — GET /users (I-01)', () => {
  beforeEach(() => {
    search = '';
  });

  it('loading → bảng render, tổng hiện trên tiêu đề', async () => {
    renderApp(<UsersScreen />);
    expect(await screen.findByText('Nhân viên 1')).toBeInTheDocument();
    expect(screen.getByText('57 tài khoản')).toBeInTheDocument();
  });

  it('mã NV dẫn tới chi tiết theo id, không theo mã', async () => {
    renderApp(<UsersScreen />);
    const link = await screen.findByRole('link', { name: FIRST.code });
    expect(link).toHaveAttribute('href', `/admin/users/${FIRST.id}`);
  });

  it('không có user.create → nút thêm ẩn (luật 7)', async () => {
    renderApp(<UsersScreen />, { me: { ...ME_SALE, permissions: ['user.read'] } });
    await screen.findByText('Nhân viên 1');
    expect(screen.queryByRole('button', { name: /Thêm nhân viên/ })).not.toBeInTheDocument();
  });

  it('empty: EmptyState kèm hành động', async () => {
    server.use(scenario.usersEmpty);
    renderApp(<UsersScreen />);
    expect(await screen.findByText('Chưa có nhân viên')).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId, thử lại thì refetch', async () => {
    server.use(scenario.usersError);
    renderApp(<UsersScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    server.resetHandlers();
    screen.getByRole('button', { name: 'Thử lại' }).click();
    await waitFor(() => expect(screen.getByText('Nhân viên 1')).toBeInTheDocument());
  });

  it('sắp xếp phía server: sort=code:desc đọc từ URL (luật 8)', async () => {
    search = 'sort=code:desc';
    renderApp(<UsersScreen />);
    expect(await screen.findByRole('link', { name: 'nv.057' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nv.001' })).not.toBeInTheDocument();
  });
});
