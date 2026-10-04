import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE, scenario } from '@/test/msw/handlers';
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

describe('Cấu hình hệ thống › Đơn vị vận chuyển — /carriers/settings', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    toastInfo.mockClear();
  });

  it('bảng: hãng, trường + nguồn (từ env), token chỉ 4 ký tự cuối, lỗi kiểm tra gần nhất', async () => {
    renderApp(<SettingsScreen />);
    expect(await screen.findByText('Giao Hàng Tiết Kiệm')).toBeInTheDocument();
    expect(screen.getByText('…9f2c')).toBeInTheDocument();
    expect(screen.getByText('https://services.giaohangtietkiem.vn')).toBeInTheDocument();
    expect(screen.getAllByText('từ env').length).toBe(2);
    expect(screen.getByText(/Token không hợp lệ/)).toBeInTheDocument();
    // J&T: thiếu cấu hình, không có nút kiểm tra (hãng chưa hỗ trợ).
    expect(screen.getByText('Thiếu cấu hình')).toBeInTheDocument();
    expect(screen.getByText('Hãng chưa hỗ trợ kiểm tra')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Kiểm tra kết nối J&T Express' }),
    ).not.toBeInTheDocument();
  });

  it('lưu token mới → PUT chỉ gửi trường đã nhập, rồi TỰ kiểm tra kết nối', async () => {
    let putBody: unknown = null;
    let verified = 0;
    server.use(
      http.put('/api/carriers/:code/settings', async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ code: 'GHTK', name: 'Giao Hàng Tiết Kiệm' });
      }),
      http.post('/api/carriers/:code/settings/verify', () => {
        verified += 1;
        return HttpResponse.json({
          status: 'ok',
          message: 'Token hợp lệ — 1 địa chỉ lấy hàng',
          verifiedAt: '2026-10-04T08:00:00.000Z',
        });
      }),
    );
    renderApp(<SettingsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa kết nối Giao Hàng Tiết Kiệm' }));
    fireEvent.change(await screen.findByLabelText('Token API'), {
      target: { value: 'ghtk-new-token-1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(putBody).toEqual({ token: 'ghtk-new-token-1234' }));
    await waitFor(() => expect(verified).toBe(1));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Kết nối Giao Hàng Tiết Kiệm thành công', {
        description: 'Token hợp lệ — 1 địa chỉ lấy hàng',
      }),
    );
  });

  it('không nhập gì mà bấm lưu → báo chưa có thay đổi, không gọi PUT', async () => {
    let called = false;
    server.use(
      http.put('/api/carriers/:code/settings', () => {
        called = true;
        return HttpResponse.json({});
      }),
    );
    renderApp(<SettingsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa kết nối Giao Hàng Tiết Kiệm' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/Chưa có thay đổi/)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('địa chỉ API sai định dạng → lỗi tại ô, không gọi PUT', async () => {
    renderApp(<SettingsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa kết nối Giao Hàng Tiết Kiệm' }));
    fireEvent.change(await screen.findByLabelText('Địa chỉ API'), {
      target: { value: 'khong-phai-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/bắt đầu bằng http/)).toBeInTheDocument();
  });

  it('nút Kiểm tra kết nối: hãng từ chối → toast lỗi kèm lý do', async () => {
    server.use(scenario.carrierVerifyFailed);
    renderApp(<SettingsScreen />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kiểm tra kết nối Giao Hàng Tiết Kiệm' }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Kết nối Giao Hàng Tiết Kiệm thất bại', {
        description: 'Hãng GHTK lỗi khi kiểm tra kết nối: Token không hợp lệ',
      }),
    );
  });

  it('không có carrier.config → ẩn nút Sửa / Kiểm tra (luật 7)', async () => {
    renderApp(<SettingsScreen />, { me: { ...ME_SALE, permissions: [] } });
    await screen.findByText('Giao Hàng Tiết Kiệm');
    expect(screen.queryByRole('button', { name: /Sửa kết nối/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kiểm tra kết nối/ })).not.toBeInTheDocument();
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
