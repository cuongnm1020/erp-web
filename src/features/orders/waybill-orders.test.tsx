import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { requiredAbilityFor } from '@/lib/navigation';
import { WaybillOrdersScreen } from './components/waybill-orders-screen';

/** Kho › Đơn đã gán vận chuyển (2026-11-03). */

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/waybills',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function setup() {
  const listQueries: URLSearchParams[] = [];
  const rows = makeOrders(2).map((o, i) => ({
    ...o,
    status: 'APPROVED',
    sentToCarrierAt: `2026-11-03T0${i + 2}:15:00.000Z`,
    posShopId: '715130909',
    teamName: 'CSKH LA',
    labelPrintedAt: i === 0 ? '2026-11-03T03:00:00.000Z' : null,
    labelPrintedById: i === 0 ? '00000000-0000-4000-8000-0000000000cc' : null,
    labelPrintedByName: i === 0 ? 'Nguyễn Văn Kho' : null,
    fulfilmentStatus: i === 0 ? 'PACKED' : 'SHIPPED',
    carrierStatusText: i === 0 ? null : 'Đã lấy hàng/Đã nhập kho',
    shipment: {
      ...(o.shipment ?? {}),
      id: `shp-${o.id}`,
      status: 'PENDING',
      carrierCode: 'GHTK',
      carrierName: 'Giao Hàng Tiết Kiệm',
      trackingNo: `S23-${i}`,
    },
  }));
  server.use(
    http.get('/api/sales-orders', ({ request }) => {
      listQueries.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items: rows, total: rows.length });
    }),
  );
  return { listQueries, rows };
}

describe('WaybillOrdersScreen', () => {
  it('chỉ đơn đã gán ĐVVC, mặc định mới gán trước; hiện POS, phòng ban, mã vận đơn, giờ gán', async () => {
    search = '';
    const { listQueries, rows } = setup();
    renderApp(<WaybillOrdersScreen />);
    expect(await screen.findByText(rows[0]!.docNumber)).toBeInTheDocument();
    const q = listQueries.at(-1)!;
    expect(q.get('sentToCarrier')).toBe('true');
    expect(q.get('sortBy')).toBe('sentToCarrierAt');
    expect(q.get('sortDir')).toBe('desc');
    expect(screen.getAllByText('Thiên Nông chính').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CSKH LA').length).toBe(2);
    expect(screen.getByText('S23-0')).toBeInTheDocument();
    expect(screen.getByText('Chưa in')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Theo dõi đơn' })).toBeInTheDocument();
    // Hãng lấy hàng: đơn 1 chưa lấy, đơn 2 đã lấy + chữ trạng thái hãng.
    expect(screen.getByText('Chưa lấy hàng')).toBeInTheDocument();
    expect(screen.getByText('Đã lấy hàng')).toBeInTheDocument();
    expect(screen.getByText('Đã lấy hàng/Đã nhập kho')).toBeInTheDocument();
  });

  it('lọc hãng chưa lấy hàng + chưa in tem từ URL đi lên API', async () => {
    search = 'pickup=AWAITING&printStatus=NOT_PRINTED';
    const { listQueries } = setup();
    renderApp(<WaybillOrdersScreen />);
    await waitFor(() => expect(listQueries.length).toBeGreaterThan(0));
    const q = listQueries.at(-1)!;
    expect(q.get('pickupStatus')).toBe('AWAITING');
    expect(q.get('printStatus')).toBe('NOT_PRINTED');
  });

  it('NV in đơn (2026-11-03): cột tên người in; chọn ở ô lọc → URL printedBy → API labelPrintedBy', async () => {
    search = '';
    const { listQueries } = setup();
    server.use(
      http.get('/api/sales-orders/label-printer-options', () =>
        HttpResponse.json([
          {
            userId: '00000000-0000-4000-8000-0000000000cc',
            fullName: 'Nguyễn Văn Kho',
            code: 'wh.1',
          },
        ]),
      ),
    );
    renderApp(<WaybillOrdersScreen />);
    expect(await screen.findByText('NV in đơn', { selector: 'th *, th' })).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn Văn Kho').length).toBeGreaterThan(0);

    search = 'printedBy=00000000-0000-4000-8000-0000000000cc';
    renderApp(<WaybillOrdersScreen />);
    await waitFor(() =>
      expect(listQueries.at(-1)!.get('labelPrintedBy')).toBe(
        '00000000-0000-4000-8000-0000000000cc',
      ),
    );
  });

  it('lọc từ URL đi lên API: ngày gán, POS, sản phẩm, hãng', async () => {
    search =
      'from=2026-11-01&to=2026-11-03&pos=715130909&skuId=00000000-0000-4000-8000-0000000000aa&carrierId=00000000-0000-4000-8000-0000000000bb';
    const { listQueries } = setup();
    renderApp(<WaybillOrdersScreen />);
    await waitFor(() => expect(listQueries.length).toBeGreaterThan(0));
    const q = listQueries.at(-1)!;
    expect(q.get('dateField')).toBe('sentToCarrierAt');
    expect(q.get('from')).toBe('2026-11-01');
    expect(q.get('pancakeShopId')).toBe('715130909');
    expect(q.get('skuId')).toBe('00000000-0000-4000-8000-0000000000aa');
    expect(q.get('carrierId')).toBe('00000000-0000-4000-8000-0000000000bb');
  });

  it('chọn nhiều đơn → thanh hàng loạt có "In lại vận đơn"', async () => {
    search = '';
    const { rows } = setup();
    renderApp(<WaybillOrdersScreen />, {
      me: { permissions: ['sales_order.read', 'shipment.pack'], hasGlobalAccess: false },
    });
    await screen.findByText(rows[0]!.docNumber);
    const boxes = screen.getAllByRole('checkbox', { name: 'Chọn dòng' });
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[1]!);
    expect(await screen.findByRole('button', { name: /In lại vận đơn/ })).toBeInTheDocument();
  });

  it('menu Kho › Đơn đã gán vận chuyển cần quyền xem phiếu giao', () => {
    expect(requiredAbilityFor('/wms/waybills')).toEqual({ action: 'read', subject: 'Shipment' });
  });
});
