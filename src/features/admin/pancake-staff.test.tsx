import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE, PANCAKE_STAFF_CANDIDATES_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PancakeStaffScreen } from './components/pancake-staff-screen';

/**
 * FE-PANCAKE-STAFF-1 — màn /crm/pancake-staff cho trưởng nhóm kinh doanh (2026-10-20): người chốt
 * đơn Pancake chưa có tài khoản thật, số đơn / khách đang treo, gắn theo gợi ý trùng email, dọn
 * tài khoản tự tạo (quản trị).
 */

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/pancake-staff',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

/** Trưởng nhóm kinh doanh: xem + gắn, KHÔNG có sync.map (không dọn). */
const ME_LEADER = {
  ...ME_SALE,
  code: 'sale.hn.lead',
  roles: ['SALES_LEADER'],
  permissions: [...ME_SALE.permissions, 'sync.staff_read', 'sync.staff_map'],
};

describe('PancakeStaffScreen — /crm/pancake-staff', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    replace.mockClear();
    search = '';
  });

  it('trưởng nhóm: KPI từ danh sách chờ, chỉ dòng chờ, không có nút dọn', async () => {
    renderApp(<PancakeStaffScreen />, { me: ME_LEADER });
    // Tên Pancake + tên tài khoản tự tạo trùng nhau → có ≥ 1 chỗ hiện.
    expect((await screen.findAllByText('Nguyen Manh Cuong')).length).toBeGreaterThan(0);
    expect(screen.getByText('Marketer Chờ')).toBeInTheDocument();
    // Người đã gắn tài khoản thật không nằm trong tab Chờ xử lý.
    expect(screen.queryByText('Thanh Vân Sale')).not.toBeInTheDocument();
    // KPI: 2 người chờ (1 có gợi ý), 1.441 đơn + 1.427 khách treo ở tài khoản tự tạo.
    expect(screen.getByText('Chưa có tài khoản thật').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('1 người có gợi ý trùng email')).toBeInTheDocument();
    expect(screen.getByText('Đơn đang treo ở tài khoản tự tạo').nextSibling).toHaveTextContent(
      '1.441',
    );
    expect(screen.getByText('Khách đang treo ở tài khoản tự tạo').nextSibling).toHaveTextContent(
      '1.427',
    );
    expect(
      screen.queryByRole('button', { name: 'Dọn tài khoản tự tạo đã khóa' }),
    ).not.toBeInTheDocument();
    // Tab Tất cả → ?tab=all (luật 8).
    fireEvent.click(screen.getByRole('tab', { name: 'Tất cả' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(String(replace.mock.calls[0]![0])).toContain('tab=all');
  });

  it('gắn theo gợi ý: hộp mở với tài khoản trùng email đã chọn → POST relink đúng người', async () => {
    const seen: Record<string, unknown>[] = [];
    server.use(
      http.post('/api/pancake-sync/staff/relink', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        seen.push(body);
        return HttpResponse.json(
          {
            fbId: body.fbId,
            userId: body.userId,
            userCode: 'nv.002',
            shops: 1,
            absorbed: [
              {
                id: 'u-pc',
                code: 'pc.nguyen.manh.cuong',
                fullName: 'Nguyen Manh Cuong',
                orders: 1441,
                customers: 1427,
              },
            ],
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<PancakeStaffScreen />, { me: ME_LEADER });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Gắn Nguyen Manh Cuong vào Nhân viên 2' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(
      'Gợi ý vì email Pancake nv2@erp.local trùng email tài khoản này.',
    );
    const submit = within(dialog).getByRole('button', { name: 'Gắn tài khoản' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({
      fbId: '1660224970965826',
      userId: PANCAKE_STAFF_CANDIDATES_FIXTURE[1]!.id,
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Đã gắn tài khoản',
        expect.objectContaining({ description: expect.stringMatching(/1\.441 đơn, 1\.427 khách/) }),
      ),
    );
  });

  it('403 từ API khi gắn người ngoài phòng → câu lỗi qua bộ dịch (luật 6)', async () => {
    server.use(
      http.post('/api/pancake-sync/staff/relink', () =>
        HttpResponse.json(
          { code: 'FORBIDDEN', message: 'raw', details: null, traceId: 't-1' },
          { status: 403 },
        ),
      ),
    );
    renderApp(<PancakeStaffScreen />, { me: ME_LEADER });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Gắn Nguyen Manh Cuong vào Nhân viên 2' }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gắn tài khoản' }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]![0])).not.toBe('raw');
  });

  it('quản trị: nút dọn → xác nhận → POST cleanup → toast tóm tắt', async () => {
    let calls = 0;
    server.use(
      http.post('/api/pancake-sync/staff/cleanup', () => {
        calls += 1;
        return HttpResponse.json(
          {
            items: [
              {
                id: 'a',
                code: 'pc.cu',
                fullName: 'Cũ',
                targetUserId: 'u1',
                targetUserCode: 'nv.001',
                orders: 1864,
                customers: 2049,
                skipped: null,
              },
              {
                id: 'b',
                code: 'pc.mo.coi',
                fullName: 'Mồ Côi',
                targetUserId: null,
                targetUserCode: null,
                orders: 0,
                customers: 0,
                skipped: 'Không tìm được người thật đã nhận POS',
              },
            ],
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<PancakeStaffScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dọn tài khoản tự tạo đã khóa' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dọn ngay' }));
    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Đã dọn tài khoản tự tạo',
        expect.objectContaining({
          description: expect.stringMatching(
            /1 tài khoản gộp xong \(1\.864 đơn, 2\.049 khách\); 1 tài khoản không rõ người nhận/,
          ),
        }),
      ),
    );
  });

  it('không có sync.staff_read → màn 403, không gọi API', async () => {
    renderApp(<PancakeStaffScreen />, { me: ME_SALE });
    expect(await screen.findByText(/không có quyền/i)).toBeInTheDocument();
  });
});
