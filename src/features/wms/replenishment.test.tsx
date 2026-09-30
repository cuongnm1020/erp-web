import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ReplenishmentAlertScreen } from './components/reorder-points-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();
const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/reorder-points',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const row = (over: Record<string, unknown>) => ({
  skuId: 's-1',
  skuCode: 'TL08',
  skuName: 'Bút bi TL-08',
  productId: 'p-1',
  productName: 'Bút bi TL-08',
  baseUomCode: 'PCS',
  reorderLevel: '500',
  onHand: '120',
  reserved: '20',
  available: '100',
  soldToday: '30',
  sold1d: '60',
  sold2d: '40',
  avgDaily: '50',
  daysLeft: '2',
  projectedOutDate: '2026-09-24',
  status: 'BELOW',
  ...over,
});

describe('Cảnh báo nhập hàng — GET /stock/replenishment (2026-09-22)', () => {
  it('bảng: trạng thái do API xếp, tồn / bán 3 ngày / TB / còn bán được / dự kiến hết; header đếm SKU cần chú ý', async () => {
    const urls: string[] = [];
    server.use(
      http.get('/api/warehouses', () =>
        HttpResponse.json([{ id: 'wh-1', code: 'WH01', name: 'Kho HN-1' }]),
      ),
      http.get('/api/stock/replenishment', ({ request }) => {
        urls.push(new URL(request.url).search);
        return HttpResponse.json({
          items: [
            row({}),
            row({
              skuId: 's-2',
              skuCode: 'TL08-RED',
              skuName: 'Bút bi TL-08 đỏ',
              productName: 'Bút bi TL-08',
              onHand: '0',
              reserved: '0',
              available: '0',
              sold1d: '0',
              sold2d: '0',
              avgDaily: '0',
              daysLeft: null,
              projectedOutDate: null,
              status: 'OUT',
            }),
            row({
              skuId: 's-3',
              skuCode: 'GA4',
              skuName: 'Giấy A4',
              productName: 'Giấy A4 Double A',
              onHand: '560',
              available: '540',
              status: 'SOON',
            }),
          ],
          total: 3,
          alertCount: 3,
          asOf: '2026-09-22',
        });
      }),
    );
    renderApp(<ReplenishmentAlertScreen />);
    // "Dưới mức" / "Sắp chạm mức" còn xuất hiện ở đoạn giải thích → chờ theo "Hết hàng" (chỉ có ở bảng)
    expect(await screen.findByText('Hết hàng')).toBeInTheDocument();
    expect(screen.getAllByText('Dưới mức').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Sắp chạm mức').length).toBeGreaterThan(1);
    expect(
      screen.getByText('3 SKU cần chú ý · số bán tính đến hôm nay 22/09/2026'),
    ).toBeInTheDocument();
    // Mặc định chỉ dòng cần chú ý (onlyAlert=true), trang đầu
    expect(urls[0]).toContain('onlyAlert=true');
    expect(urls[0]).toContain('take=50');
    // Tên biến thể hiện dưới tên thương mại khi khác nhau
    expect(screen.getByText('Bút bi TL-08 đỏ')).toBeInTheDocument();
    // Dự kiến hết theo dd/mm/yyyy; không dự báo được → "chưa có số bán"
    expect(screen.getAllByText('24/09/2026').length).toBe(2);
    expect(screen.getByText('chưa có số bán')).toBeInTheDocument();
    expect(screen.getAllByText('2 ngày').length).toBeGreaterThan(0);
    // Sửa mức → form sản phẩm
    expect(screen.getAllByRole('link', { name: 'Sửa mức' })[0]).toHaveAttribute(
      'href',
      '/catalog/products/p-1/edit',
    );
  });

  it('phạm vi "Mọi SKU có mức tồn kho" → onlyAlert=false trên URL; trống → mời đặt mức trên sản phẩm', async () => {
    search = 'scope=all';
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json([])),
      http.get('/api/stock/replenishment', ({ request }) =>
        new URL(request.url).searchParams.get('onlyAlert') === 'false'
          ? HttpResponse.json({ items: [], total: 0, alertCount: 0, asOf: '2026-09-22' })
          : HttpResponse.json({ items: [row({})], total: 1, alertCount: 1, asOf: '2026-09-22' }),
      ),
    );
    renderApp(<ReplenishmentAlertScreen />);
    expect(await screen.findByText('Chưa sản phẩm nào đặt mức tồn kho')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở danh sách sản phẩm' })).toHaveAttribute(
      'href',
      '/catalog/products',
    );
    search = '';
  });

  it('trống ở chế độ mặc định → nút xem mọi SKU đổi scope=all trên URL (luật 8)', async () => {
    server.use(
      http.get('/api/warehouses', () => HttpResponse.json([])),
      http.get('/api/stock/replenishment', () =>
        HttpResponse.json({ items: [], total: 0, alertCount: 0, asOf: '2026-09-22' }),
      ),
    );
    renderApp(<ReplenishmentAlertScreen />);
    expect(await screen.findByText('Chưa có sản phẩm nào cần nhập')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem mọi SKU có mức tồn kho' }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/wms/reorder-points?scope=all', { scroll: false }),
    );
  });
});
