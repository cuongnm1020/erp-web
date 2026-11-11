import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    // Cột NV lên đơn + Sản phẩm (2026-11-02); đơn chưa khớp người / không có đơn → "—".
    expect(screen.getByRole('columnheader', { name: 'NV lên đơn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sản phẩm' })).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Sale')).toBeInTheDocument();
    expect(screen.getByTitle('Amino Ga3 ×2 CHAI, Phân bón lá ×1 GOI')).toBeInTheDocument();
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
    expect((await within(dialog).findAllByText('Webhook')).length).toBeGreaterThan(0);
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

  it('ô Phòng ban dùng chung với danh sách đơn (2026-11-04): chọn nhiều → URL team, API teamIds; danh sách rỗng → ẩn', async () => {
    const seen: string[] = [];
    server.use(
      http.get('/api/sales-orders/team-filter-options', () =>
        HttpResponse.json([
          { teamId: 't-cskh-a', name: 'CSKH A', group: 'CSKH', isActive: true },
          { teamId: 't-sale-1', name: 'Kinh doanh · Sale 1', group: 'SALES', isActive: true },
        ]),
      ),
      http.get('/api/shipment-monitor/summary', ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('teamIds') ?? '');
        return HttpResponse.json(makeMonitorSummary());
      }),
    );
    search = 'team=t-cskh-a,t-sale-1';
    const { unmount } = renderApp(<ShippingMonitorScreen />);
    const box = await screen.findByRole('combobox', { name: 'Phòng ban' });
    expect(box).toHaveTextContent('Phòng ban: 2 phòng');
    expect(seen).toContain('t-cskh-a,t-sale-1');
    unmount();

    server.use(http.get('/api/sales-orders/team-filter-options', () => HttpResponse.json([])));
    search = '';
    renderApp(<ShippingMonitorScreen />);
    await screen.findByRole('button', { name: /Hãng đang giữ/ });
    expect(screen.queryByRole('combobox', { name: 'Phòng ban' })).not.toBeInTheDocument();
  });

  it('ô Trạng thái (2026-11-04): URL status → API statuses; chọn thêm ghi URL', async () => {
    const seen: string[] = [];
    server.use(
      http.get('/api/shipment-monitor', ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('statuses') ?? '');
        return HttpResponse.json({ view: 'OVERDUE', items: makeMonitorRows(1), total: 1 });
      }),
    );
    search = 'status=IN_TRANSIT';
    renderApp(<ShippingMonitorScreen />);
    const box = await screen.findByRole('combobox', { name: 'Trạng thái' });
    expect(box).toHaveTextContent('Đang vận chuyển');
    expect(seen).toContain('IN_TRANSIT');
    fireEvent.click(box);
    fireEvent.click(await screen.findByRole('option', { name: /Đang giao hàng/ }));
    await waitFor(() => expect(lastUrl()).toContain('status=IN_TRANSIT%2COUT_FOR_DELIVERY'));
  });

  it('ô Tài khoản vận chuyển + ô In tem (2026-11-09): URL → API carrierAccountId / printStatus; đổi hãng bỏ tài khoản', async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/shipment-monitor', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ view: 'OVERDUE', items: makeMonitorRows(1), total: 1 });
      }),
    );
    search = 'carrierId=c-ghtk&carrierAccountId=acc-ghtk-default&print=ERROR';
    renderApp(<ShippingMonitorScreen />);
    const account = await screen.findByRole('combobox', { name: 'Tài khoản vận chuyển' });
    await waitFor(() => expect(account).toHaveTextContent('Giao Hàng Tiết Kiệm'));
    expect(screen.getByRole('combobox', { name: 'In tem' })).toHaveTextContent('Lỗi không in được');
    await waitFor(() =>
      expect(
        seen.some(
          (p) =>
            p.get('carrierAccountId') === 'acc-ghtk-default' && p.get('printStatus') === 'ERROR',
        ),
      ).toBe(true),
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'In tem' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Đã in tem' }));
    await waitFor(() => expect(lastUrl()).toContain('print=PRINTED'));

    fireEvent.click(screen.getByRole('combobox', { name: 'Hãng vận chuyển' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Giao Hàng Nhanh' }));
    await waitFor(() => expect(lastUrl()).toContain('carrierId=c-ghn'));
    expect(lastUrl()).not.toContain('carrierAccountId');
  });

  it('sắp theo cột Bàn giao hãng (2026-11-04): bấm tiêu đề → URL sort, API sortBy/sortDir', async () => {
    const seen: string[] = [];
    server.use(
      http.get('/api/shipment-monitor', ({ request }) => {
        const p = new URL(request.url).searchParams;
        seen.push(`${p.get('sortBy') ?? ''}:${p.get('sortDir') ?? ''}`);
        return HttpResponse.json({ view: 'OVERDUE', items: makeMonitorRows(1), total: 1 });
      }),
    );
    search = 'sort=shippedAt:desc';
    renderApp(<ShippingMonitorScreen />);
    await screen.findByText(makeMonitorRows(1)[0]!.docNumber);
    expect(seen).toContain('shippedAt:desc');
    expect(seen).not.toContain(':');
    // desc → bấm nữa = bỏ sắp (none → asc → desc → none): URL không còn `sort`.
    replace.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Bàn giao hãng \(đang giảm dần\)/ }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(lastUrl()).not.toContain('sort=');
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
