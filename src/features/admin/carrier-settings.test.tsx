import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CARRIER_SETTINGS_FIXTURE, ME_SALE, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { SettingsScreen } from './components/settings-screen';

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
const toastInfo = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: (...a: unknown[]) => toastInfo(...a),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/settings',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

describe('Cấu hình hệ thống › Đơn vị vận chuyển — tài khoản theo hãng (FE-CARRIER-ACC-1)', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    toastInfo.mockClear();
  });

  const GHTK_DEFAULT = 'Mặc định của Giao Hàng Tiết Kiệm';
  const GHTK_SHOP2 = 'GHTK cửa hàng 2 của Giao Hàng Tiết Kiệm';

  it('bảng: hãng nhóm các tài khoản; trường + nguồn, token chỉ 4 ký tự cuối, lỗi kiểm tra gần nhất', async () => {
    renderApp(<SettingsScreen />);
    expect(await screen.findByText('Giao Hàng Tiết Kiệm')).toBeInTheDocument();
    expect(screen.getByText('GHTK cửa hàng 2')).toBeInTheDocument();
    expect(screen.getByText('…9f2c')).toBeInTheDocument();
    expect(screen.getByText('…ab12')).toBeInTheDocument();
    expect(screen.getAllByText('https://services.giaohangtietkiem.vn')).toHaveLength(2);
    expect(screen.getAllByText('nhập ở đây').length).toBe(1);
    expect(screen.getByText(/Token không hợp lệ/)).toBeInTheDocument();
    // Tài khoản mặc định: có badge, không có Tắt / Xóa / Đặt mặc định.
    expect(screen.getAllByText('Mặc định', { selector: 'span' }).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: `Xóa tài khoản ${GHTK_DEFAULT}` }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Xóa tài khoản ${GHTK_SHOP2}` })).toBeInTheDocument();
    // J&T: thiếu cấu hình, hãng chưa hỗ trợ kiểm tra.
    expect(screen.getByText('Thiếu cấu hình')).toBeInTheDocument();
    expect(screen.getByText('Hãng chưa hỗ trợ kiểm tra')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Kiểm tra kết nối Mặc định của J&T Express' }),
    ).not.toBeInTheDocument();
  });

  it('sửa token tài khoản phụ → PATCH đúng tài khoản, chỉ gửi trường đã nhập, rồi TỰ kiểm tra tài khoản đó', async () => {
    let patched: { url: string; body: unknown } | null = null;
    let verifiedUrl = '';
    server.use(
      http.patch('/api/carriers/:code/accounts/:accountId', async ({ request }) => {
        patched = { url: request.url, body: await request.json() };
        return HttpResponse.json(CARRIER_SETTINGS_FIXTURE[0]);
      }),
      http.post('/api/carriers/:code/accounts/:accountId/verify', ({ request }) => {
        verifiedUrl = request.url;
        return HttpResponse.json({
          status: 'ok',
          message: 'Token hợp lệ — 1 địa chỉ lấy hàng',
          verifiedAt: '2026-10-04T08:00:00.000Z',
        });
      }),
    );
    renderApp(<SettingsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: `Sửa tài khoản ${GHTK_SHOP2}` }));
    fireEvent.change(await screen.findByLabelText('Token API'), {
      target: { value: 'ghtk-shop2-new-5678' },
    });
    // Tài khoản phụ: bỏ giá trị đã nhập là "xóa", không có env làm nền.
    expect(screen.getByLabelText('Xóa giá trị đã nhập cho Token API')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched!.url).toContain('/carriers/GHTK/accounts/acc-ghtk-shop2');
    expect(patched!.body).toEqual({ token: 'ghtk-shop2-new-5678' });
    await waitFor(() =>
      expect(verifiedUrl).toContain('/carriers/GHTK/accounts/acc-ghtk-shop2/verify'),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Kết nối Giao Hàng Tiết Kiệm (GHTK cửa hàng 2) thành công',
        { description: 'Token hợp lệ — 1 địa chỉ lấy hàng' },
      ),
    );
  });

  it('thêm tài khoản: tên bắt buộc; POST kèm tên + token', async () => {
    let posted: unknown = null;
    server.use(
      http.post('/api/carriers/:code/accounts', async ({ request }) => {
        posted = await request.json();
        const base = CARRIER_SETTINGS_FIXTURE[0]!;
        return HttpResponse.json(
          {
            ...base,
            accounts: [
              ...base.accounts,
              { ...base.accounts[1]!, id: 'acc-new', name: 'GHTK Long An' },
            ],
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<SettingsScreen />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm tài khoản Giao Hàng Tiết Kiệm' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm tài khoản' }));
    expect(await screen.findByText('Nhập tên tài khoản')).toBeInTheDocument();
    expect(posted).toBeNull();
    fireEvent.change(screen.getByLabelText('Tên tài khoản'), { target: { value: 'GHTK Long An' } });
    fireEvent.change(screen.getByLabelText('Token API'), { target: { value: 'ghtk-la-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tài khoản' }));
    await waitFor(() => expect(posted).toEqual({ name: 'GHTK Long An', token: 'ghtk-la-token' }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã thêm tài khoản', expect.anything()),
    );
  });

  it('không nhập gì mà bấm lưu → báo chưa có thay đổi, không gọi PATCH', async () => {
    let called = false;
    server.use(
      http.patch('/api/carriers/:code/accounts/:accountId', () => {
        called = true;
        return HttpResponse.json({});
      }),
    );
    renderApp(<SettingsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: `Sửa tài khoản ${GHTK_DEFAULT}` }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/Chưa có thay đổi/)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('địa chỉ API sai định dạng → lỗi tại ô, không gọi PATCH', async () => {
    renderApp(<SettingsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: `Sửa tài khoản ${GHTK_DEFAULT}` }));
    fireEvent.change(await screen.findByLabelText('Địa chỉ API'), {
      target: { value: 'khong-phai-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/bắt đầu bằng http/)).toBeInTheDocument();
  });

  it('đặt mặc định → POST …/default, toast; xóa tài khoản đã dùng → 409 dịch qua bảng mã', async () => {
    let defaultUrl = '';
    server.use(
      http.post('/api/carriers/:code/accounts/:accountId/default', async ({ request }) => {
        defaultUrl = request.url;
        return HttpResponse.json(CARRIER_SETTINGS_FIXTURE[0]);
      }),
      http.delete('/api/carriers/:code/accounts/:accountId', () =>
        HttpResponse.json(
          {
            code: 'CARRIER_ACCOUNT_IN_USE',
            message: 'x',
            details: { reason: 'shipments' },
            traceId: 't',
          },
          { status: 409 },
        ),
      ),
    );
    renderApp(<SettingsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: `Đặt ${GHTK_SHOP2} làm mặc định` }));
    await waitFor(() =>
      expect(defaultUrl).toContain('/carriers/GHTK/accounts/acc-ghtk-shop2/default'),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã đặt tài khoản mặc định', {
        description: 'Giao Hàng Tiết Kiệm · GHTK cửa hàng 2',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: `Xóa tài khoản ${GHTK_SHOP2}` }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa tài khoản' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Không xoá / tắt được tài khoản này: đang là mặc định hoặc đã cấp vận đơn. Đặt tài khoản khác làm mặc định, hoặc tắt thay vì xoá.',
      ),
    );
  });

  it('nút Kiểm tra kết nối: hãng từ chối → toast lỗi kèm lý do', async () => {
    server.use(scenario.carrierVerifyFailed);
    renderApp(<SettingsScreen />);
    fireEvent.click(
      await screen.findByRole('button', { name: `Kiểm tra kết nối ${GHTK_DEFAULT}` }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Kết nối Giao Hàng Tiết Kiệm thất bại', {
        description: 'Hãng GHTK lỗi khi kiểm tra kết nối: Token không hợp lệ',
      }),
    );
  });

  it('không có carrier.config → ẩn mọi nút thao tác (luật 7)', async () => {
    renderApp(<SettingsScreen />, { me: { ...ME_SALE, permissions: [] } });
    await screen.findByText('Giao Hàng Tiết Kiệm');
    expect(screen.queryByRole('button', { name: /Sửa tài khoản/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kiểm tra kết nối/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm tài khoản/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xóa tài khoản/ })).not.toBeInTheDocument();
  });

  it('empty + error 500 có traceId', async () => {
    server.use(scenario.carrierSettingsEmpty);
    const { unmount } = renderApp(<SettingsScreen />);
    expect(await screen.findByText('Chưa có hãng vận chuyển nào kết nối API')).toBeInTheDocument();
    unmount();
    server.use(scenario.carrierSettingsError);
    renderApp(<SettingsScreen />);
    expect(await screen.findByText('trace-db_error')).toBeInTheDocument();
  });
});
