import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE, PANCAKE_SHOP_FIXTURE, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PancakeConfigScreen } from './components/pancake-config-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Toast không render trong harness → mock để khẳng định câu lỗi đi qua bộ dịch (luật 6).
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/pancake',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

describe('PancakeConfigScreen — /pancake-sync/config', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('loading → bảng: mã shop, 4 ký tự cuối khoá, trạng thái và lỗi kiểm tra gần nhất', async () => {
    renderApp(<PancakeConfigScreen />);
    expect(await screen.findByText('Shop chính')).toBeInTheDocument();
    expect(screen.getByText('407957969')).toBeInTheDocument();
    expect(screen.getByText('…a9f2')).toBeInTheDocument();
    expect(screen.getByText('Đang bật')).toBeInTheDocument();
    expect(screen.getByText('Tắt')).toBeInTheDocument();
    expect(screen.getByText(/Pancake từ chối khoá API/)).toBeInTheDocument();
    // Không có banner env khi server không đặt PANCAKE_API_KEY.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('không có sync.config → ẩn nút Thêm shop và cụm thao tác (luật 7)', async () => {
    renderApp(<PancakeConfigScreen />, { me: { ...ME_SALE, permissions: ['sync.read'] } });
    await screen.findByText('Shop chính');
    expect(screen.queryByRole('button', { name: /Thêm shop/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kiểm tra kết nối shop/ })).not.toBeInTheDocument();
  });

  it('empty: EmptyState kèm đúng một hành động Thêm shop', async () => {
    server.use(scenario.pancakeEmpty);
    renderApp(<PancakeConfigScreen />);
    expect(await screen.findByText('Chưa kết nối shop Pancake nào')).toBeInTheDocument();
    // Header + empty state đều có nút Thêm shop cùng tên hành động.
    expect(screen.getAllByRole('button', { name: /Thêm shop/ }).length).toBeGreaterThan(0);
  });

  it('error 500: ErrorState có traceId, thử lại thì refetch', async () => {
    server.use(scenario.pancakeError);
    renderApp(<PancakeConfigScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    server.resetHandlers();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Shop chính')).toBeInTheDocument());
  });

  it('khoá từ env: banner cảnh báo, badge "từ env", không có nút sửa/xóa', async () => {
    server.use(scenario.pancakeEnvOnly);
    renderApp(<PancakeConfigScreen />);
    // Chờ dữ liệu về trước: skeleton cũng mang role="status".
    expect(await screen.findByText('từ env')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('PANCAKE_API_KEY');
    expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
    // Vẫn kiểm tra được kết nối bằng khoá env.
    expect(screen.getByRole('button', { name: /Kiểm tra kết nối shop/ })).toBeEnabled();
  });

  it('thêm shop: PUT /pancake-sync/config/{shopId} mang apiKey; thiếu khoá thì chặn ở form', async () => {
    const seen: { url: string; body: Record<string, unknown> }[] = [];
    server.use(
      http.put('/api/pancake-sync/config/:shopId', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        seen.push({ url: request.url, body });
        return HttpResponse.json({
          ...PANCAKE_SHOP_FIXTURE,
          shopId: '999',
          shopName: 'Shop mới',
          apiKeyHint: '…7890',
        });
      }),
    );
    renderApp(<PancakeConfigScreen />);
    await screen.findByText('Shop chính');
    fireEvent.click(screen.getByRole('button', { name: /Thêm shop/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Thêm shop Pancake');

    fireEvent.change(screen.getByLabelText(/Mã shop/), { target: { value: '999' } });
    fireEvent.change(screen.getByLabelText(/Tên gợi nhớ/), { target: { value: 'Shop mới' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Thêm shop' }).closest('form')!);
    expect(await screen.findByText('Nhập khoá API (tối thiểu 8 ký tự)')).toBeInTheDocument();
    expect(seen).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(/Khoá API/), {
      target: { value: 'pancake-key-1234567890' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Thêm shop' }).closest('form')!);
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]!.url).toMatch(/\/pancake-sync\/config\/999$/);
    expect(seen[0]!.body).toEqual({
      shopName: 'Shop mới',
      apiKey: 'pancake-key-1234567890',
      baseUrl: null,
      requestsPerSecond: null,
      burst: null,
      isActive: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sửa shop: không nhập khoá → body không có apiKey (giữ khoá cũ)', async () => {
    const seen: Record<string, unknown>[] = [];
    server.use(
      http.put('/api/pancake-sync/config/:shopId', async ({ request }) => {
        seen.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ...PANCAKE_SHOP_FIXTURE, shopName: 'Đổi tên' });
      }),
    );
    renderApp(<PancakeConfigScreen />);
    await screen.findByText('Shop chính');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sửa' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Sửa kết nối shop 407957969');
    expect(screen.getByLabelText(/Khoá API/)).toHaveAttribute(
      'placeholder',
      'Đang dùng khoá …a9f2',
    );
    fireEvent.change(screen.getByLabelText(/Tên gợi nhớ/), { target: { value: 'Đổi tên' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu thay đổi' }).closest('form')!);
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).not.toHaveProperty('apiKey');
    expect(seen[0]).toMatchObject({ shopName: 'Đổi tên', isActive: true });
  });

  it('kiểm tra kết nối thất bại → toast theo bộ dịch, không render message thô', async () => {
    server.use(scenario.pancakeVerifyFailed);
    renderApp(<PancakeConfigScreen />);
    await screen.findByText('Shop chính');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối shop 407957969' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith(
      expect.stringMatching(/Pancake không chấp nhận cấu hình này/),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('webhook: URL = NEXT_PUBLIC_API_URL + webhookPath, secret hiện để dán; tạo lại qua hộp xác nhận', async () => {
    let rotated = 0;
    server.use(
      http.post('/api/pancake-sync/config/:shopId/webhook-secret', () => {
        rotated++;
        return HttpResponse.json({ ...PANCAKE_SHOP_FIXTURE, webhookSecret: 'f'.repeat(48) });
      }),
    );
    renderApp(<PancakeConfigScreen />);
    await screen.findByText('Shop chính');
    const urls = screen.getAllByText(/\/pancake-sync\/webhook\/407957969$/);
    expect(urls[0]).toHaveTextContent(/^https?:\/\/.+\/pancake-sync\/webhook\/407957969$/);
    expect(screen.getAllByText(PANCAKE_SHOP_FIXTURE.webhookSecret).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Tạo lại secret webhook shop 407957969' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('mất hiệu lực ngay');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo lại secret' }));
    await waitFor(() => expect(rotated).toBe(1));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã tạo lại secret webhook', expect.anything()),
    );
  });

  it('kiểm tra kết nối thành công → toast nêu số kho Pancake trả về', async () => {
    renderApp(<PancakeConfigScreen />);
    await screen.findByText('Shop chính');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối shop 407957969' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalledWith(
      'Kết nối Pancake thành công',
      expect.objectContaining({ description: expect.stringMatching(/3 kho/) }),
    );
  });
});
