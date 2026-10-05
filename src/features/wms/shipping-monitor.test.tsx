import { fireEvent, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { makeMonitorRows, makeMonitorSummary } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ShippingMonitorScreen } from './components/shipping-monitor-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/shipping',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

// Dòng 0 giữ 3 ngày (chưa quá hạn 5), dòng 2 giữ 5 ngày (quá hạn).
const [FRESH, , OLD] = makeMonitorRows(3);

const lastUrl = () => String(replace.mock.calls.at(-1)?.[0] ?? '');

describe('ShippingMonitorScreen — đóng gói / bàn giao / hãng giữ + cảnh báo quá hạn', () => {
  beforeEach(() => {
    search = '';
    replace.mockClear();
  });

  it('4 ô chỉ số + cảnh báo đơn hãng giữ quá 5 ngày; mặc định liệt kê đơn quá hạn', async () => {
    renderApp(<ShippingMonitorScreen />);
    const alert = await screen.findByRole('alert');
    // 12 phiếu giữ 3..14 ngày → 10 phiếu ≥ 5 ngày
    expect(alert).toHaveTextContent('10 đơn');
    expect(alert).toHaveTextContent('quá 5 ngày');

    const packed = screen.getByRole('button', { name: /Đã đóng gói/ });
    expect(packed).toHaveTextContent('42');
    expect(screen.getByRole('button', { name: /Đã bàn giao hãng/ })).toHaveTextContent('37');
    expect(screen.getByRole('button', { name: /Hãng đang giữ/ })).toHaveTextContent('12');
    const overdue = screen.getByRole('button', { name: /Giữ quá 5 ngày/ });
    expect(overdue).toHaveTextContent('10');
    expect(overdue).toHaveAttribute('aria-pressed', 'true');

    expect(await screen.findByText(OLD!.docNumber)).toBeInTheDocument();
    expect(screen.getByText(OLD!.orderDocNumber)).toBeInTheDocument();
    expect(screen.queryByText(FRESH!.docNumber)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Quá hạn').length).toBeGreaterThan(0);
  });

  it('bấm ô "Hãng đang giữ" → góc nhìn HOLDING lên URL', async () => {
    renderApp(<ShippingMonitorScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Hãng đang giữ/ }));
    expect(lastUrl()).toContain('view=HOLDING');
  });

  it('?view=HOLDING → liệt kê cả đơn chưa quá hạn', async () => {
    search = 'view=HOLDING';
    renderApp(<ShippingMonitorScreen />);
    expect(await screen.findByText(FRESH!.docNumber)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hãng đang giữ/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('đổi ngưỡng ?days=7 → cảnh báo và danh sách tính lại phía server', async () => {
    search = 'days=7';
    renderApp(<ShippingMonitorScreen />);
    // giữ 7..14 ngày → 8 phiếu
    expect(await screen.findByRole('alert')).toHaveTextContent('8 đơn');
    expect(screen.getByRole('button', { name: /Giữ quá 7 ngày/ })).toBeInTheDocument();
    await screen.findByText(makeMonitorRows(5)[4]!.docNumber);
    expect(screen.queryByText(OLD!.docNumber)).not.toBeInTheDocument();
  });

  it('tìm theo số đơn bán (?q=) → chỉ phiếu của đơn đó', async () => {
    search = `view=HOLDING&q=${OLD!.orderDocNumber}`;
    renderApp(<ShippingMonitorScreen />);
    expect(await screen.findByText(OLD!.docNumber)).toBeInTheDocument();
    expect(screen.queryByText(FRESH!.docNumber)).not.toBeInTheDocument();
  });

  it('nhấn dòng → mở timeline tín hiệu hãng', async () => {
    renderApp(<ShippingMonitorScreen />);
    fireEvent.click(await screen.findByText(OLD!.docNumber));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(`Hành trình ${OLD!.docNumber}`)).toBeInTheDocument();
    expect(await within(dialog).findByText('Webhook')).toBeInTheDocument();
  });

  it('không có đơn quá hạn → không cảnh báo, empty state rõ ràng', async () => {
    server.use(
      http.get('/api/shipment-monitor/summary', () =>
        HttpResponse.json({
          ...makeMonitorSummary(),
          totals: { packed: 3, handedOver: 2, holding: 1, holdingOverdue: 0 },
          byCarrier: [],
        }),
      ),
      http.get('/api/shipment-monitor', () =>
        HttpResponse.json({ view: 'OVERDUE', items: [], total: 0 }),
      ),
    );
    renderApp(<ShippingMonitorScreen />);
    expect(await screen.findByText(/Không có đơn nào hãng giữ quá 5 ngày/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lỗi server → màn lỗi có nút thử lại', async () => {
    server.use(
      http.get('/api/shipment-monitor/summary', () =>
        HttpResponse.json(
          { code: 'INTERNAL', message: 'x', details: null, traceId: 'trace-1' },
          { status: 500, headers: { 'x-request-id': 'trace-1' } },
        ),
      ),
    );
    renderApp(<ShippingMonitorScreen />);
    expect((await screen.findAllByRole('button', { name: /thử lại/i })).length).toBeGreaterThan(0);
  });
});
