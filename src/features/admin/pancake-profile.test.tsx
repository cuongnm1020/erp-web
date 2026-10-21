import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarehouseProvider } from '@/lib/warehouse';
import { PANCAKE_PROFILE_FIXTURE, USER_DETAIL_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { MeScreen } from './components/me-screen';
import { UserDetailScreen } from './components/user-detail-screen';

/**
 * Hồ sơ Pancake (2026-10-18): Facebook ID + tên trên Pancake + POS làm việc — admin khai hộ ở
 * chi tiết nhân viên, nhân viên tự khai ở Tài khoản của tôi.
 */

const toastSuccess = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users/x',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ME_ADMIN = {
  userId: 'u-admin',
  code: 'admin',
  roles: ['ADMIN'],
  permissions: [],
  leaderTeamIds: [],
  careTeamIds: [],
  hasGlobalAccess: true,
  managesDepartments: false,
  warehouseIds: null,
  warehouses: [],
  defaultWarehouseId: null,
  selectedWarehouseId: null,
  mustChangePassword: false,
};

const renderDetail = (canManage: boolean) => {
  server.use(
    http.get('/api/warehouses', () => HttpResponse.json([])),
    http.get('/api/users/:id', () => HttpResponse.json({ ...USER_DETAIL_FIXTURE, canManage })),
  );
  return renderApp(
    <WarehouseProvider me={ME_ADMIN}>
      <UserDetailScreen id={USER_DETAIL_FIXTURE.id} />
    </WarehouseProvider>,
  );
};

const section = async () =>
  within(
    (await screen.findByRole('heading', { name: 'Hồ sơ Pancake' })).closest(
      'section',
    ) as HTMLElement,
  );

describe('Hồ sơ Pancake — chi tiết nhân viên', () => {
  beforeEach(() => toastSuccess.mockClear());

  it('chưa có Facebook ID → không chọn được POS; nhập ID, chọn POS, lưu → PUT đủ hồ sơ', async () => {
    const puts: unknown[] = [];
    server.use(
      http.put('/api/users/:id/pancake-profile', async ({ request }) => {
        puts.push(await request.json());
        return HttpResponse.json({
          ...PANCAKE_PROFILE_FIXTURE,
          fbId: '154057992263134',
          pancakeName: 'Thanh Vân Sale - NLPN',
          shops: PANCAKE_PROFILE_FIXTURE.shops.map((s, i) => ({ ...s, selected: i === 0 })),
          transferredFrom: [{ id: 'u-pc', code: 'pc.thanh.van.sale', fullName: 'Thanh Vân' }],
        });
      }),
    );
    renderDetail(true);
    const s = await section();
    const posA = await s.findByRole('checkbox', { name: 'POS Hưng Thịnh' });
    expect(posA).toBeDisabled();
    expect(s.getByText('Nhập Facebook ID trước rồi chọn POS.')).toBeInTheDocument();
    expect(s.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();

    fireEvent.change(s.getByLabelText('Facebook ID trên Pancake'), {
      target: { value: ' 154057992263134 ' },
    });
    fireEvent.change(s.getByLabelText('Tên trên Pancake'), {
      target: { value: 'Thanh Vân Sale - NLPN' },
    });
    expect(posA).toBeEnabled();
    fireEvent.click(posA);
    fireEvent.click(s.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      fbId: '154057992263134',
      pancakeName: 'Thanh Vân Sale - NLPN',
      shopIds: ['407957969'],
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã lưu thay đổi'));
    expect(toastSuccess).toHaveBeenCalledWith(
      'Đã chuyển đơn và POS từ tài khoản pc.thanh.van.sale — tài khoản đó đã khóa',
    );
  });

  it('Facebook ID sai định dạng → báo ngay, không cho lưu', async () => {
    renderDetail(true);
    const s = await section();
    fireEvent.change(await s.findByLabelText('Facebook ID trên Pancake'), {
      target: { value: 'có dấu' },
    });
    expect(s.getByText(/Facebook ID chỉ gồm chữ số/)).toBeInTheDocument();
    expect(s.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
  });

  it('409 PANCAKE_FB_ID_TAKEN → chỉ đúng tài khoản đang giữ, không hiện message thô', async () => {
    server.use(
      http.put('/api/users/:id/pancake-profile', () =>
        HttpResponse.json(
          {
            code: 'PANCAKE_FB_ID_TAKEN',
            message: 'raw server message',
            details: {
              fbId: '1',
              users: [{ id: 'u-x', code: 'vanhtt', fullName: 'Hoàng Thị Thanh Vân' }],
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderDetail(true);
    const s = await section();
    fireEvent.change(await s.findByLabelText('Facebook ID trên Pancake'), {
      target: { value: '1' },
    });
    fireEvent.click(s.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await s.findByRole('alert')).toHaveTextContent(
      'Facebook ID này đang gắn với tài khoản vanhtt (Hoàng Thị Thanh Vân).',
    );
    expect(s.queryByText('raw server message')).not.toBeInTheDocument();
  });

  it('không quản lý tài khoản này → chỉ xem: ô khoá, không có nút lưu', async () => {
    server.use(
      http.get('/api/users/:id/pancake-profile', () =>
        HttpResponse.json({
          ...PANCAKE_PROFILE_FIXTURE,
          fbId: '154057992263134',
          shops: PANCAKE_PROFILE_FIXTURE.shops.map((x) => ({ ...x, selected: true })),
          otherFbIds: ['999'],
        }),
      ),
    );
    renderDetail(false);
    const s = await section();
    expect(await s.findByDisplayValue('154057992263134')).toBeDisabled();
    expect(s.getByRole('checkbox', { name: 'POS Real Agri' })).toBeChecked();
    expect(s.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
    expect(s.getByText('999')).toBeInTheDocument();
  });
});

describe('Hồ sơ Pancake — Tài khoản của tôi', () => {
  it('tự khai: đọc GET /me/pancake-profile, lưu qua PUT /me/pancake-profile', async () => {
    const puts: unknown[] = [];
    server.use(
      http.put('/api/me/pancake-profile', async ({ request }) => {
        puts.push(await request.json());
        return HttpResponse.json({ ...PANCAKE_PROFILE_FIXTURE, fbId: '42', transferredFrom: [] });
      }),
    );
    renderApp(<MeScreen />);
    const s = await section();
    expect(s.getByText(/sẽ gán cho bạn/)).toBeInTheDocument();
    fireEvent.change(await s.findByLabelText('Facebook ID trên Pancake'), {
      target: { value: '42' },
    });
    fireEvent.click(s.getByRole('checkbox', { name: 'POS Real Agri' }));
    fireEvent.click(s.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ fbId: '42', pancakeName: null, shopIds: ['715130909'] });
  });
});
