import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE, WAITING_MATCH_EMPTY, WAITING_SUMMARY } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { GrnWaitingMatch } from './components/grn-waiting-match';
import { WaitingStockScreen } from './components/waiting-stock-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/waiting-stock',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

describe('WaitingStockScreen — Hàng chờ (2026-10-25)', () => {
  beforeEach(() => {
    search = '';
    replace.mockClear();
  });

  it('4 ô số tổng + bảng SKU thiếu trên tổng đơn chờ; "Xem đơn" sang tab Chờ hàng lọc SKU', async () => {
    renderApp(<WaitingStockScreen />);
    expect(await screen.findByText('312')).toBeInTheDocument();
    expect(screen.getByText('trên 1027 đơn đã duyệt chưa gửi hãng')).toBeInTheDocument();
    expect(screen.getByText('27 đơn')).toBeInTheDocument();
    const row = screen.getByText('AMINO-GA3-500').closest('tr')!;
    expect(within(row).getByText('146')).toBeInTheDocument();
    expect(within(row).getByText('47%')).toBeInTheDocument(); // 146 / 312
    expect(within(row).getByText('376')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Xem đơn' })).toHaveAttribute(
      'href',
      `/crm/orders?flow=WAITING_STOCK&shortSkuId=${WAITING_SUMMARY.items[0]!.skuId}`,
    );
  });

  it('ô tìm gửi q lên server (luật 8), lọc ra 0 dòng → "Xóa lọc"', async () => {
    search = 'q=khong-co';
    const asked: string[] = [];
    server.use(
      http.get('/api/waiting-stock/summary', ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json({ ...WAITING_SUMMARY, items: [] });
      }),
    );
    renderApp(<WaitingStockScreen />);
    expect(await screen.findByText('Không có sản phẩm thiếu khớp')).toBeInTheDocument();
    expect(asked).toContain('khong-co');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(String(replace.mock.calls.at(-1)![0])).not.toContain('q=');
  });

  it('không có quyền xem đơn → màn không có quyền', () => {
    renderApp(<WaitingStockScreen />, { me: { ...ME_SALE, permissions: ['stock.read'] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền/i);
  });
});

describe('GrnWaitingMatch — khớp đơn chờ hàng trên phiếu nhập', () => {
  it('3 ô (đủ cả đơn / còn thiếu SP khác / chưa tới lượt), bảng theo SKU, danh sách cảnh báo', async () => {
    server.use(
      http.get('/api/goods-receipts/:id/waiting-match', () =>
        HttpResponse.json({
          ...WAITING_MATCH_EMPTY,
          waitingOrders: 150,
          fullOrders: 118,
          partialOrders: 23,
          laterOrders: 9,
          lines: [
            {
              skuId: 's-1',
              skuCode: 'AMINO-GA3-500',
              skuName: 'Amino GA3 500ml',
              qty: '300',
              needOrders: 146,
              needQty: '388',
              given: '300',
              full: 94,
              partial: 18,
              later: 9,
              left: '0',
            },
          ],
          warnings: [
            {
              orderId: 'o-1',
              docNumber: 'SO2610-04118',
              customerName: 'Đại lý Phước Thành',
              waitingSince: new Date(Date.now() - 54 * 3_600_000).toISOString(),
              got: [
                { skuId: 's-1', skuCode: 'AMINO-GA3-500', skuName: 'Amino GA3 500ml', qty: '20' },
              ],
              missing: [
                { skuId: 's-2', skuCode: 'KALI-TRANG-1KG', skuName: 'Kali trắng 1kg', qty: '10' },
              ],
            },
          ],
        }),
      ),
    );
    renderApp(<GrnWaitingMatch receiptId="r-1" />);
    expect(await screen.findByText('118 đơn')).toBeInTheDocument();
    expect(screen.getByText('23 đơn')).toBeInTheDocument();
    expect(screen.getByText('9 đơn')).toBeInTheDocument();
    expect(screen.getByText('146 đơn · 388')).toBeInTheDocument();
    expect(screen.getByText('23 đơn khớp nhưng còn thiếu sản phẩm khác')).toBeInTheDocument();
    const warn = screen.getByRole('link', { name: 'SO2610-04118' }).closest('tr')!;
    expect(within(warn).getByText('Kali trắng 1kg × 10')).toBeInTheDocument();
    expect(within(warn).getByText('2 ngày 6 giờ')).toBeInTheDocument();
  });

  it('không đơn chờ nào cần SP của phiếu → câu trống, không bảng', async () => {
    renderApp(<GrnWaitingMatch receiptId="r-1" />);
    expect(
      await screen.findByText('Không có đơn chờ hàng nào ở kho này cần sản phẩm của phiếu.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
