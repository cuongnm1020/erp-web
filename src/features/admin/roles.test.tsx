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

/** Ghi lại PUT /roles/:code (body) — trả role với quyền mới. */
function capturePuts() {
  const sent: Record<string, { permissions?: string[]; name?: string }> = {};
  server.use(
    http.put('/api/roles/:code', async ({ params, request }) => {
      const body = (await request.json()) as { permissions?: string[]; name?: string };
      sent[String(params.code)] = body;
      const role = ROLES_FIXTURE.find((r) => r.code === params.code)!;
      return HttpResponse.json({ ...role, ...body });
    }),
  );
  return sent;
}

/** Mặc định mọi nhóm đóng — mở hết để thấy từng dòng quyền. */
async function expandAll() {
  fireEvent.click(await screen.findByRole('button', { name: /Mở rộng tất cả/ }));
}

/** Bấm "Lưu thay đổi" trên đầu trang → hộp xác nhận; thay đổi lớn thì gõ chữ xác nhận trước. */
async function saveAndConfirm() {
  fireEvent.click(screen.getByRole('button', { name: /^Lưu thay đổi/ }));
  const dialog = await screen.findByRole('dialog');
  const word = within(dialog).queryByLabelText(/gõ XAC NHAN/);
  if (word) fireEvent.change(word, { target: { value: 'xac nhan' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
}

async function openRoleMenu(roleName: string) {
  const trigger = await screen.findByRole('button', { name: `Thao tác vai trò ${roleName}` });
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

describe('RolesScreen — ma trận vai trò × quyền (I-03, mockup Cấu hình phân quyền)', () => {
  it('cột theo role thật (tên + mã), ô tick theo permissions, không hiện số thống kê', async () => {
    renderApp(<RolesScreen />);
    expect(await screen.findByText('Nhân viên kinh doanh')).toBeInTheDocument();
    expect(screen.getByText('SALES_MEMBER')).toBeInTheDocument();
    await expandAll();

    const cell = screen.getByRole('checkbox', { name: 'Nhân viên kinh doanh · Khách hàng: Xem' });
    expect(cell).toHaveAttribute('data-state', 'checked');
    const off = screen.getByRole('checkbox', {
      name: 'Nhân viên kinh doanh · Vai trò & quyền: Sửa',
    });
    expect(off).toHaveAttribute('data-state', 'unchecked');
    // ô "tất cả quyền" của cột: có một phần → gạch
    expect(
      screen.getByRole('checkbox', { name: 'Nhân viên kinh doanh · tất cả quyền' }),
    ).toHaveAttribute('data-state', 'indeterminate');

    // ẩn số người, n/tổng, "n quyền", "n vai trò"
    expect(screen.queryByText(/\d+ người/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ quyền/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ vai trò/)).not.toBeInTheDocument();
  });

  it('tick ô → chip chưa lưu; Lưu gửi PUT /roles/:code với danh sách đầy đủ, chỉ cho role đổi', async () => {
    const sent = capturePuts();
    renderApp(<RolesScreen />);
    await expandAll();
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Nhân viên kinh doanh · Vai trò & quyền: Sửa' }),
    );
    expect(screen.getByText('Có thay đổi chưa lưu')).toBeInTheDocument();

    await saveAndConfirm();
    await waitFor(() => expect(sent.SALES_MEMBER).toBeDefined());
    expect([...sent.SALES_MEMBER!.permissions!].sort()).toEqual(
      [...ROLES_FIXTURE[1]!.permissions, 'role.update'].sort(),
    );
    expect(sent.ADMIN).toBeUndefined();
    await waitFor(() => expect(screen.queryByText('Có thay đổi chưa lưu')).not.toBeInTheDocument());
  });

  it('ô "cả nhóm" bật mọi quyền của nhóm cho một vai trò; ô cuối dòng bật cho mọi vai trò', async () => {
    const sent = capturePuts();
    renderApp(<RolesScreen />);
    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Nhân viên kinh doanh · cả nhóm Vai trò & quyền',
      }),
    );
    await expandAll();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tồn kho: Điều chỉnh · mọi vai trò' }));
    await saveAndConfirm();
    await waitFor(() => expect(sent.ADMIN).toBeDefined());
    await waitFor(() => expect(sent.SALES_MEMBER).toBeDefined());
    expect(sent.SALES_MEMBER!.permissions).toEqual(
      expect.arrayContaining(['role.read', 'role.update', 'stock.adjust']),
    );
    expect(sent.ADMIN!.permissions).toContain('stock.adjust');
  });

  it('lưu lỗi một vai trò → vai trò đó giữ trong nháp, báo tên vai trò lỗi', async () => {
    server.use(
      http.put('/api/roles/:code', () =>
        HttpResponse.json(
          { code: 'FORBIDDEN', message: 'raw', details: {}, traceId: 't' },
          { status: 403 },
        ),
      ),
    );
    renderApp(<RolesScreen />);
    await expandAll();
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Nhân viên kinh doanh · Vai trò & quyền: Sửa' }),
    );
    await saveAndConfirm();
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Chưa lưu được: Nhân viên kinh doanh',
        expect.anything(),
      ),
    );
    expect(screen.getByText('Có thay đổi chưa lưu')).toBeInTheDocument();
  });

  it('mặc định mọi nhóm đóng; bấm tên nhóm mở / gọn; Mở rộng / Thu gọn tất cả; lọc theo tên quyền', async () => {
    renderApp(<RolesScreen />);
    const group = await screen.findByRole('button', { name: 'Khách hàng' });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Tồn kho' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(
      screen.queryByRole('checkbox', { name: 'Nhân viên kinh doanh · Khách hàng: Xem' }),
    ).not.toBeInTheDocument();
    // ô "cả nhóm" vẫn có khi nhóm đóng
    expect(
      screen.getByRole('checkbox', { name: 'Nhân viên kinh doanh · cả nhóm Khách hàng' }),
    ).toBeInTheDocument();

    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('checkbox', { name: 'Nhân viên kinh doanh · Khách hàng: Xem' }),
    ).toBeInTheDocument();
    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');

    await expandAll();
    expect(screen.getByRole('button', { name: 'Tồn kho' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /Thu gọn tất cả/ }));
    expect(screen.getByRole('button', { name: 'Tồn kho' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Lọc quyền' }), {
      target: { value: 'điều chỉnh' },
    });
    expect(screen.queryByRole('button', { name: 'Khách hàng' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tồn kho' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Lọc quyền' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('Không có quyền khớp')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(screen.getByRole('button', { name: 'Khách hàng' })).toBeInTheDocument();
  });

  it('"Chỉ chỗ đã đổi" chỉ hiện dòng có thay đổi', async () => {
    renderApp(<RolesScreen />);
    await expandAll();
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Nhân viên kinh doanh · Vai trò & quyền: Sửa' }),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Chỉ chỗ đã đổi' }));
    expect(screen.queryByRole('button', { name: 'Khách hàng' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Nhân viên kinh doanh · Vai trò & quyền: Sửa' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Nhân viên kinh doanh · Vai trò & quyền: Xem' }),
    ).not.toBeInTheDocument();
  });

  it('không có role.update → checkbox khóa, không có nút lưu / thêm', async () => {
    renderApp(<RolesScreen />, { me: { ...ME_SALE, permissions: ['role.read'] } });
    await expandAll();
    const cell = await screen.findByRole('checkbox', {
      name: 'Nhân viên kinh doanh · Khách hàng: Xem',
    });
    expect(cell).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Lưu thay đổi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm vai trò/ })).not.toBeInTheDocument();
  });

  it('menu đầu cột: sửa tên (PUT không kèm permissions); xóa vai trò còn người giữ → hộp chặn, không gọi DELETE', async () => {
    const sent = capturePuts();
    let deleted = '';
    server.use(
      http.delete('/api/roles/:code', ({ params }) => {
        deleted = String(params.code);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<RolesScreen />);
    await openRoleMenu('Nhân viên kinh doanh');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sửa tên & mô tả' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tên hiển thị'), { target: { value: 'Sale' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(sent.SALES_MEMBER).toEqual({ name: 'Sale' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await openRoleMenu('Nhân viên kinh doanh');
    expect(await screen.findByRole('menuitem', { name: 'Xem nhân viên đang giữ' })).toHaveAttribute(
      'href',
      '/admin/users?role=SALES_MEMBER',
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Xóa vai trò…' }));
    const blocked = await screen.findByRole('alertdialog');
    expect(within(blocked).getByText(/Chưa xóa được vai trò/)).toBeInTheDocument();
    expect(deleted).toBe('');
  });

  it('Thêm vai trò: bắt đầu với quyền của vai trò có sẵn → POST kèm permissions', async () => {
    let body: { code?: string; permissions?: string[] } = {};
    server.use(
      http.post('/api/roles', async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ ...ROLES_FIXTURE[1]!, ...body, memberCount: 0 });
      }),
    );
    renderApp(<RolesScreen />);
    await openRoleMenu('Nhân viên kinh doanh');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Nhân bản thành vai trò mới' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mã vai trò'), { target: { value: 'cskh' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo vai trò' }));
    await waitFor(() => expect(body.code).toBe('CSKH'));
    expect(body.permissions).toEqual(ROLES_FIXTURE[1]!.permissions);
  });

  it('hộp xác nhận lưu: liệt kê thêm / bớt; vai trò về 0 quyền phải gõ XAC NHAN mới lưu được', async () => {
    const sent = capturePuts();
    renderApp(<RolesScreen />);
    // Bỏ tick "tất cả quyền" của Nhân viên kinh doanh → còn 0 quyền (sự cố 2026-10-31).
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Nhân viên kinh doanh · tất cả quyền' }),
    );
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Nhân viên kinh doanh · tất cả quyền' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Lưu thay đổi/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Lưu quyền của 1 vai trò?')).toBeInTheDocument();
    expect(within(dialog).getByText('Mất hết quyền')).toBeInTheDocument();
    expect(within(dialog).getByText(/^còn 0\//)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Lưu thay đổi' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/gõ XAC NHAN/), { target: { value: 'XAC' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/gõ XAC NHAN/), {
      target: { value: 'XAC NHAN' },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(sent.SALES_MEMBER).toEqual({ permissions: [] }));
  });

  it('thay đổi nhỏ: hộp xác nhận không bắt gõ chữ; Hủy thì không gửi gì, nháp còn nguyên', async () => {
    const sent = capturePuts();
    renderApp(<RolesScreen />);
    await expandAll();
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Nhân viên kinh doanh · Vai trò & quyền: Sửa' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Lưu thay đổi/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/gõ XAC NHAN/)).not.toBeInTheDocument();
    expect(within(dialog).getByText('+1')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sent.SALES_MEMBER).toBeUndefined();
    expect(screen.getByText('Có thay đổi chưa lưu')).toBeInTheDocument();
  });

  it('có role.update nhưng không phải superadmin → chỉ xem quyền, không nhân bản / sao chép quyền', async () => {
    renderApp(<RolesScreen />, {
      me: { ...ME_SALE, permissions: ['role.read', 'role.update'] },
    });
    await expandAll();
    expect(
      await screen.findByRole('checkbox', { name: 'Nhân viên kinh doanh · Khách hàng: Xem' }),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Lưu thay đổi/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Chỉ quản trị hệ thống được đổi quyền/)).toBeInTheDocument();

    await openRoleMenu('Nhân viên kinh doanh');
    expect(await screen.findByRole('menuitem', { name: 'Sửa tên & mô tả' })).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Nhân bản thành vai trò mới' }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: /Thêm vai trò/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Bắt đầu với quyền của')).not.toBeInTheDocument();
  });

  it('catalog đủ nhóm module thật', async () => {
    renderApp(<RolesScreen />);
    await screen.findByText('Nhân viên kinh doanh');
    expect(screen.getByRole('button', { name: 'Khách hàng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tồn kho' })).toBeInTheDocument();
    expect(PERMISSIONS_FIXTURE.length).toBeGreaterThan(0);
  });
});
