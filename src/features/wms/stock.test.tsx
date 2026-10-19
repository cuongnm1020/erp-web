import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { forgetWarehouseSelection } from '@/lib/warehouse';
import { renderApp } from '@/test/render';
import { StockScreen } from './components/stock-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/stock',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

describe('StockScreen — GET /stock, /stock/by-location, /stock/by-lot (P1-12)', () => {
  it('tab SKU: loading → bảng thật, tổng hiện trên tiêu đề', async () => {
    search = '';
    renderApp(<StockScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText('SKU-0001')).toBeInTheDocument();
    expect(screen.getByText('120 SKU khớp bộ lọc')).toBeInTheDocument();
    expect(screen.getByText('1–50 / 120 dòng')).toBeInTheDocument();
  });

  it('khả dụng âm được đánh dấu, không bị làm tròn về 0', async () => {
    search = '';
    renderApp(<StockScreen />);
    expect((await screen.findAllByText('Khả dụng âm')).length).toBe(4);
    expect(screen.getAllByText('−5').length).toBe(4);
  });

  it('tab đọc từ URL: theo lô dùng đúng endpoint by-lot (luật 8)', async () => {
    search = 'tab=lot';
    // /stock hỏng cũng không ảnh hưởng: tab đang mở chỉ gọi /stock/by-lot.
    server.use(scenario.stockError);
    renderApp(<StockScreen />);
    expect(await screen.findByText('70 dòng lô khớp bộ lọc')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Hạn dùng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Còn lại' })).toBeInTheDocument();
    // Không có cột "Thứ tự FEFO": API chỉ sắp xếp, không trả thứ hạng.
    expect(screen.queryByRole('columnheader', { name: 'Thứ tự FEFO' })).not.toBeInTheDocument();
  });

  it('tab theo vị trí dùng endpoint by-location và bỏ cột lô/HSD', async () => {
    search = 'tab=location';
    renderApp(<StockScreen />);
    expect(await screen.findByText('80 dòng vị trí khớp bộ lọc')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thứ tự đi kho' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Lô' })).not.toBeInTheDocument();
  });

  it('empty: EmptyState kèm đúng một hành động', async () => {
    search = '';
    server.use(scenario.stockEmpty);
    renderApp(<StockScreen />);
    expect(await screen.findByText('Chưa có dữ liệu tồn kho')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tạo phiếu nhập' })).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId, thử lại thì refetch', async () => {
    search = '';
    server.use(scenario.stockError);
    renderApp(<StockScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    server.resetHandlers();
    screen.getByRole('button', { name: 'Thử lại' }).click();
    await waitFor(() => expect(screen.getByText('SKU-0001')).toBeInTheDocument());
  });

  it('403: màn không có quyền, không đá về đăng nhập (luật 6)', async () => {
    search = '';
    server.use(scenario.stockForbidden);
    renderApp(<StockScreen />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});

describe('StockScreen — nhập tồn thực tế (POST /cycle-counts/actual-stock)', () => {
  const WH = [{ id: 'wh-1', code: 'WH01', name: 'Kho HN-1' }];

  it('chỉ xin hàng tạo trong ERP (erpOnly=true)', async () => {
    search = '';
    const urls: string[] = [];
    server.use(
      http.get('/api/stock', ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderApp(<StockScreen />);
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(new URL(urls[0]!).searchParams.get('erpOnly')).toBe('true');
  });

  it('gõ số đếm → chênh lệch; SKU chưa giá vốn đếm thừa phải nhập giá; lưu gửi đúng body + Idempotency-Key', async () => {
    search = '';
    const posts: Array<{ key: string | null; body: unknown }> = [];
    server.use(
      http.post('/api/cycle-counts/actual-stock', async ({ request }) => {
        posts.push({ key: request.headers.get('idempotency-key'), body: await request.json() });
        return HttpResponse.json(
          { countId: 'cc-1', docNumber: 'CC2610-00001', adjustedSkuCount: 2, unchangedSkuCount: 0 },
          { status: 201 },
        );
      }),
    );
    renderApp(<StockScreen />, { warehouses: WH });
    fireEvent.click(await screen.findByRole('button', { name: /Nhập tồn thực tế/ }));
    expect(await screen.findByText('Kho HN-1')).toBeInTheDocument();

    // SKU-0001: tồn 100, đã có giá vốn → đếm 90 = −10, không hỏi giá
    fireEvent.change(await screen.findByLabelText('Tồn thực tế SKU-0001'), {
      target: { value: '90' },
    });
    expect(screen.getByText('−10')).toBeInTheDocument();
    expect(screen.queryByLabelText('Giá vốn SKU-0001')).not.toBeInTheDocument();

    // SKU-0002: tồn 107, chưa có giá vốn → đếm 120 phải nhập giá
    fireEvent.change(screen.getByLabelText('Tồn thực tế SKU-0002'), { target: { value: '120' } });
    const save = screen.getByRole('button', { name: 'Lưu tồn thực tế' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Giá vốn SKU-0002'), { target: { value: '45.000' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.key).toBeTruthy();
    expect(posts[0]!.body).toEqual({
      warehouseId: 'wh-1',
      lines: [
        { skuId: expect.any(String), qtyCounted: '90' },
        { skuId: expect.any(String), qtyCounted: '120', unitCost: '45000' },
      ],
    });
    // Lưu xong bản nháp trống
    await waitFor(() => expect(screen.getByLabelText('Tồn thực tế SKU-0001')).toHaveValue(''));
  });

  it('đang xem tất cả kho → nhắc chọn kho, không có ô nhập', async () => {
    search = '';
    forgetWarehouseSelection(); // test trước đã chọn wh-1 — kho đang chọn là trạng thái cấp module
    renderApp(<StockScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Nhập tồn thực tế/ }));
    expect(await screen.findByText(/Chọn một kho ở ô kho làm việc/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Tồn thực tế SKU-0001')).not.toBeInTheDocument();
  });

  it('không có quyền điều chỉnh tồn → không có nút nhập tồn thực tế', async () => {
    search = '';
    renderApp(<StockScreen />, { me: ME_SALE });
    await screen.findByText(/khớp bộ lọc|Bạn không có quyền/);
    expect(screen.queryByRole('button', { name: /Nhập tồn thực tế/ })).not.toBeInTheDocument();
  });
});
