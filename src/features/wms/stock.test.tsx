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

  it('thống kê nhập tồn thực: số SKU đã nhập / tổng SKU từ GET /stock/actual-count-summary', async () => {
    search = '';
    server.use(
      http.get('/api/stock/actual-count-summary', () =>
        HttpResponse.json({ totalSkuCount: 308, countedSkuCount: 120 }),
      ),
    );
    renderApp(<StockScreen />);
    expect(await screen.findByText('120')).toBeInTheDocument();
    expect(screen.getByText(/\/ 308 SKU · 38%/)).toBeInTheDocument();
    expect(screen.getByText('Còn 188 SKU chưa nhập')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Tiến độ nhập tồn thực tế' })).toHaveAttribute(
      'aria-valuenow',
      '120',
    );
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

  it('sort đọc từ URL → sortBy/sortDir gửi lên GET /stock; bấm tiêu đề Cân nặng đổi sort trên URL', async () => {
    search = 'sort=available:desc';
    replace.mockClear();
    const urls: string[] = [];
    server.use(
      http.get('/api/stock', ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderApp(<StockScreen />);
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    const sp = new URL(urls[0]!).searchParams;
    expect(sp.get('sortBy')).toBe('available');
    expect(sp.get('sortDir')).toBe('desc');
  });

  it('cột sort được ở tab SKU: Cân nặng / Tồn thực / Đang giữ / Khả dụng; sort lạ trên URL không gửi lên', async () => {
    search = 'sort=skuName';
    replace.mockClear();
    const urls: string[] = [];
    server.use(
      http.get('/api/stock', ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({
          items: [
            {
              skuId: 's1',
              skuCode: 'SKU-A',
              skuName: 'A',
              baseUomId: 'u',
              baseUomCode: 'PCS',
              isActive: true,
              onHand: '1',
              reserved: '0',
              available: '1',
              hasCost: false,
              unitCost: null,
              weightKg: null,
            },
          ],
          total: 1,
        });
      }),
    );
    renderApp(<StockScreen />);
    expect(await screen.findByText('SKU-A')).toBeInTheDocument();
    expect(new URL(urls[0]!).searchParams.get('sortBy')).toBeNull();
    for (const name of ['Cân nặng', 'Tồn thực', 'Đang giữ', 'Khả dụng']) {
      expect(screen.getByRole('columnheader', { name })).toHaveAttribute('aria-sort');
    }
    expect(screen.getByRole('columnheader', { name: 'SKU' })).not.toHaveAttribute('aria-sort');
    fireEvent.click(screen.getByRole('button', { name: /Cân nặng/ }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('sort=weight'), expect.anything());
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

  it('admin (cả hai quyền): số lượng → actual-stock (Idempotency-Key), giá vốn → /stock/costs, số trước giá sau', async () => {
    search = '';
    const calls: Array<{ url: string; key: string | null; body: unknown }> = [];
    server.use(
      http.post('/api/cycle-counts/actual-stock', async ({ request }) => {
        calls.push({
          url: 'actual',
          key: request.headers.get('idempotency-key'),
          body: await request.json(),
        });
        return HttpResponse.json(
          { countId: 'cc-1', docNumber: 'CC2610-00001', adjustedSkuCount: 2, unchangedSkuCount: 0 },
          { status: 201 },
        );
      }),
      http.post('/api/stock/costs', async ({ request }) => {
        calls.push({ url: 'costs', key: null, body: await request.json() });
        return HttpResponse.json({ updatedSkuCount: 1, layerCount: 1, skippedSkuIds: [] });
      }),
    );
    renderApp(<StockScreen />, { warehouses: WH });
    fireEvent.click(await screen.findByRole('button', { name: /Nhập tồn & giá vốn/ }));
    expect(await screen.findByText('Kho HN-1')).toBeInTheDocument();

    // SKU-0001: tồn 100 → đếm 90 = −10; ô giá vốn gợi ý giá hiện tại
    fireEvent.change(await screen.findByLabelText('Tồn thực tế SKU-0001'), {
      target: { value: '90' },
    });
    expect(screen.getByText('−10')).toBeInTheDocument();
    expect(screen.getByLabelText('Giá vốn SKU-0001')).toHaveAttribute(
      'placeholder',
      expect.stringContaining('12.000'),
    );
    // SKU-0002: chỉ đếm; SKU-0003: chỉ nhập giá (dấu chấm nghìn bị bỏ)
    fireEvent.change(screen.getByLabelText('Tồn thực tế SKU-0002'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Giá vốn SKU-0003'), { target: { value: '45.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]!.url).toBe('actual');
    expect(calls[0]!.key).toBeTruthy();
    expect(calls[0]!.body).toEqual({
      warehouseId: 'wh-1',
      lines: [
        { skuId: expect.any(String), qtyCounted: '90' },
        { skuId: expect.any(String), qtyCounted: '120' },
      ],
    });
    expect(calls[1]).toEqual({
      url: 'costs',
      key: null,
      body: { lines: [{ skuId: expect.any(String), unitCost: '45000' }] },
    });
    // Lưu xong bản nháp trống
    await waitFor(() => expect(screen.getByLabelText('Tồn thực tế SKU-0001')).toHaveValue(''));
    expect(screen.getByLabelText('Giá vốn SKU-0003')).toHaveValue('');
  });

  it('cân nặng: cột gram chỉ đọc; kho gõ gram → POST /stock/weights nhận kg, không cần chọn kho', async () => {
    search = '';
    forgetWarehouseSelection();
    const weights: unknown[] = [];
    server.use(
      http.post('/api/stock/weights', async ({ request }) => {
        weights.push(await request.json());
        return HttpResponse.json({ updatedSkuCount: 2, skippedSkuIds: [] });
      }),
    );
    renderApp(<StockScreen />, {
      me: { permissions: ['stock.read', 'stock.adjust'], hasGlobalAccess: false },
    });
    // Chế độ xem: SKU-0001 250 g, SKU-0002 chưa cân.
    expect(await screen.findByText('250 g')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nhập tồn thực tế' }));
    // Chưa chọn kho: không có ô tồn thực tế nhưng vẫn nhập cân nặng được.
    expect(await screen.findByText(/Cân nặng vẫn nhập được/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Tồn thực tế SKU-0001')).not.toBeInTheDocument();
    const w1 = screen.getByLabelText('Cân nặng SKU-0001');
    expect(w1).toHaveAttribute('placeholder', '250');
    expect(screen.getByLabelText('Cân nặng SKU-0002')).toHaveAttribute('placeholder', 'chưa cân');
    fireEvent.change(w1, { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText('Cân nặng SKU-0002'), { target: { value: '0,5' } });
    // Sai định dạng → chưa lưu được.
    fireEvent.change(screen.getByLabelText('Cân nặng SKU-0003'), { target: { value: 'abc' } });
    expect(screen.getByText(/1 dòng chưa hợp lệ/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Cân nặng SKU-0003'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(weights).toEqual([
        {
          lines: [
            { skuId: expect.any(String), weightKg: '1.5' },
            { skuId: expect.any(String), weightKg: '0.0005' },
          ],
        },
      ]),
    );
    await waitFor(() => expect(w1).toHaveValue(''));
  });

  it('kho (stock.adjust, không stock.cost): không có cột giá vốn', async () => {
    search = '';
    renderApp(<StockScreen />, {
      warehouses: WH,
      me: { permissions: ['stock.read', 'stock.adjust'], hasGlobalAccess: false },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Nhập tồn thực tế' }));
    expect(await screen.findByLabelText('Tồn thực tế SKU-0001')).toBeInTheDocument();
    expect(screen.queryByLabelText('Giá vốn SKU-0001')).not.toBeInTheDocument();
  });

  it('kế toán (stock.cost, không stock.adjust): chỉ cột giá vốn, không cần chọn kho', async () => {
    search = '';
    forgetWarehouseSelection();
    const costs: unknown[] = [];
    server.use(
      http.post('/api/stock/costs', async ({ request }) => {
        costs.push(await request.json());
        return HttpResponse.json({ updatedSkuCount: 1, layerCount: 2, skippedSkuIds: [] });
      }),
    );
    renderApp(<StockScreen />, {
      me: { permissions: ['stock.read', 'stock.cost'], hasGlobalAccess: false },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Nhập giá vốn' }));
    const cost = await screen.findByLabelText('Giá vốn SKU-0002');
    expect(cost).toHaveAttribute('placeholder', 'chưa có');
    expect(screen.queryByLabelText('Tồn thực tế SKU-0002')).not.toBeInTheDocument();
    fireEvent.change(cost, { target: { value: '30000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(costs).toEqual([{ lines: [{ skuId: expect.any(String), unitCost: '30000' }] }]),
    );
  });

  it('đang xem tất cả kho → nhắc chọn kho, không có ô nhập', async () => {
    search = '';
    forgetWarehouseSelection(); // test trước đã chọn wh-1 — kho đang chọn là trạng thái cấp module
    renderApp(<StockScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Nhập tồn & giá vốn/ }));
    expect(await screen.findByText(/Chọn một kho ở ô kho làm việc/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Tồn thực tế SKU-0001')).not.toBeInTheDocument();
  });

  it('không có quyền điều chỉnh tồn / giá vốn → không có nút nhập', async () => {
    search = '';
    renderApp(<StockScreen />, { me: ME_SALE });
    await screen.findByText(/khớp bộ lọc|Bạn không có quyền/);
    expect(screen.queryByRole('button', { name: /Nhập tồn|Nhập giá vốn/ })).not.toBeInTheDocument();
  });
});
