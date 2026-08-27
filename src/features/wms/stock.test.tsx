import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
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
