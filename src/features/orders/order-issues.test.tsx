import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderIssuesScreen } from './components/order-issues-screen';
import { requiredAbilityFor } from '@/lib/navigation';
import { buildAbility } from '@/lib/permission/ability';

/** Quản trị › Xử lý đơn lỗi (2026-11-02, chỉ superadmin). */

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/order-issues',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const COUNTS = {
  waybillError: 78,
  waybillErrorCodes: [
    { code: 'PICKUP_WAREHOUSE_NOT_READY', count: 55 },
    { code: 'CARRIER_REJECTED', count: 21 },
  ],
  carrierCancelled: 2,
  packError: 174,
  packErrorStockReady: 51,
  awaitingPickup: 2281,
  awaitingPickupOld: 752,
  unsent: 7479,
  unsentOld: 3282,
  unsentShort: 3110,
  olderThanDays: 2,
  pancakeOverwrite: 34,
  pancakeOverwriteRestorable: 16,
  pancakeOverwriteCheckedAt: '2026-11-02T15:30:00.000Z',
  warehouseSplit: 228,
  warehouseSplitRepairable: 43,
};

const SPLIT_ORDER = {
  orderId: '00000002-0000-4000-8000-000000000002',
  docNumber: 'SOP2611-189319',
  status: 'APPROVED',
  customerName: 'Khách B',
  warehouseId: null,
  total: '150000',
  fulfilmentStatus: 'NOT_STARTED',
  carrierStatusText: null,
  movedAt: '2026-11-05T01:42:00.000Z',
  movedByName: 'Đặng Vinh Quang',
  fromWarehouseId: null,
  toWarehouseId: null,
  fix: 'REPAIR',
  reason: null,
  extraLines: [{ skuCode: 'SP-0204', skuName: 'Rooting', qty: '2' }],
};
const SPLIT_PACKED = {
  ...SPLIT_ORDER,
  orderId: '00000003-0000-4000-8000-000000000003',
  docNumber: 'SOP2611-189320',
  fulfilmentStatus: 'PACKED',
  fix: 'PACKED',
};

const OVERWRITE_ORDER = {
  orderId: '00000001-0000-4000-8000-000000000001',
  docNumber: 'SOP2610-58794',
  status: 'APPROVED',
  customerName: 'Khách A',
  warehouseId: null,
  total: '1534000',
  fulfilmentStatus: 'NOT_STARTED',
  fix: 'RESTORE_LINES',
  lastOverwrittenAt: '2026-11-02T04:46:30.000Z',
  changes: [
    {
      kind: 'LINE',
      key: 'SP-0147',
      action: 'Sửa',
      editorName: 'Nguyễn Thu Trang',
      editedAt: '2026-11-02T04:46:28.000Z',
      overwrittenAt: '2026-11-02T04:46:29.000Z',
      setValue: null,
      pancakeValue: null,
      qtySet: '5',
      amountSet: '730000',
      pcQty: '5',
      pcAmount: '750000',
      pcVia: 'webhook',
    },
  ],
};

function setup() {
  const listQueries: URLSearchParams[] = [];
  const rows = makeOrders(2).map((o) => ({
    ...o,
    status: 'APPROVED',
    waybillErrorCode: 'PICKUP_WAREHOUSE_NOT_READY',
    waybillError: 'Kho KHO-LA-01 chưa khai điểm lấy hàng',
    waybillErrorAt: '2026-11-02T08:31:00.000Z',
    shipment: { ...(o.shipment ?? {}), id: `shp-${o.id}`, carrierCode: 'VTP', trackingNo: null },
  }));
  server.use(
    http.get('/api/sales-orders/issue-counts', () => HttpResponse.json(COUNTS)),
    http.get('/api/sales-orders', ({ request }) => {
      listQueries.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items: rows, total: rows.length });
    }),
  );
  return { listQueries, rows };
}

describe('OrderIssuesScreen', () => {
  it('5 ô Cần xử lý hiện số từ issue-counts; mặc định nhóm Lỗi vận đơn', async () => {
    search = '';
    const { listQueries, rows } = setup();
    renderApp(<OrderIssuesScreen />);
    const tile = await screen.findByTestId('issue-tile-WAYBILL_ERROR');
    await waitFor(() => expect(within(tile).getByText('78')).toBeInTheDocument());
    expect(
      within(tile).getByText('55 kho chưa khai điểm lấy · 21 hãng từ chối'),
    ).toBeInTheDocument();
    expect(tile).toHaveAttribute('aria-selected', 'true');
    expect(
      within(screen.getByTestId('issue-tile-PACK_ERROR')).getByText(
        '51 đơn nay đã đủ hàng — đóng gói lại được',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('issue-tile-AWAITING_PICKUP')).getByText('2.281'),
    ).toBeInTheDocument();
    expect(await screen.findByText(rows[0]!.docNumber)).toBeInTheDocument();
    expect(listQueries.at(-1)!.get('issue')).toBe('WAYBILL_ERROR');
  });

  it('nhân viên kho có quyền sales_order.issues: thấy 5 nhóm, không có ô "Bị Pancake ghi đè"; URL tab đó → về Lỗi vận đơn', async () => {
    search = 'issue=PANCAKE_OVERWRITE';
    const { listQueries } = setup();
    renderApp(<OrderIssuesScreen />, {
      me: { permissions: ['sales_order.read', 'sales_order.issues'], hasGlobalAccess: false },
    });
    const tile = await screen.findByTestId('issue-tile-WAYBILL_ERROR');
    expect(tile).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('issue-tile-PANCAKE_OVERWRITE')).toBeNull();
    await waitFor(() => expect(listQueries.at(-1)!.get('issue')).toBe('WAYBILL_ERROR'));
  });

  it('nhóm + lọc từ URL đi lên API (issue, olderThanDays, stockReady)', async () => {
    search = 'issue=PACK_ERROR&old=1&ready=true';
    const { listQueries } = setup();
    renderApp(<OrderIssuesScreen />);
    await waitFor(() => expect(listQueries.length).toBeGreaterThan(0));
    const q = listQueries.at(-1)!;
    expect(q.get('issue')).toBe('PACK_ERROR');
    expect(q.get('olderThanDays')).toBe('2');
    expect(q.get('stockReady')).toBe('true');
  });

  it('Chưa gửi ĐVVC lọc được "Hiện tại: Đã đủ hàng" (stockReady)', async () => {
    search = 'issue=UNSENT&ready=true';
    const { listQueries } = setup();
    renderApp(<OrderIssuesScreen />);
    await waitFor(() => expect(listQueries.length).toBeGreaterThan(0));
    const q = listQueries.at(-1)!;
    expect(q.get('issue')).toBe('UNSENT');
    expect(q.get('stockReady')).toBe('true');
  });

  it('bấm ô khác → đổi nhóm trên URL', async () => {
    search = '';
    setup();
    replace.mockClear();
    renderApp(<OrderIssuesScreen />);
    fireEvent.click(await screen.findByTestId('issue-tile-UNSENT'));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(String(replace.mock.calls.at(-1)![0])).toContain('issue=UNSENT');
  });

  it('tick đơn ở Lỗi vận đơn → thanh hàng loạt có "Xin lại vận đơn (n)" làm việc chính', async () => {
    search = '';
    const { rows } = setup();
    renderApp(<OrderIssuesScreen />);
    await screen.findByText(rows[0]!.docNumber);
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[1]!);
    expect(
      await screen.findByRole('button', { name: /Xin lại vận đơn \(1\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gán hãng / cân nặng' })).toBeInTheDocument();
  });

  it('route gate: quyền sales_order.issues (kho, 2026-11-03) hoặc superadmin; thiếu quyền thì không thấy', () => {
    const req = requiredAbilityFor('/admin/order-issues');
    expect(req).toEqual({ action: 'issues', subject: 'SalesOrder' });
    const superadmin = buildAbility({ permissions: [], hasGlobalAccess: true });
    const warehouse = buildAbility({
      permissions: ['sales_order.read', 'sales_order.issues'],
      hasGlobalAccess: false,
    });
    const sale = buildAbility({
      permissions: ['sales_order.read', 'sales_order.send_carrier'],
      hasGlobalAccess: false,
    });
    expect(superadmin.can(req!.action, req!.subject)).toBe(true);
    expect(warehouse.can(req!.action, req!.subject)).toBe(true);
    expect(sale.can(req!.action, req!.subject)).toBe(false);
    // Tab "Bị Pancake ghi đè" vẫn chỉ superadmin.
    expect(warehouse.can('manage', 'OrderIssue')).toBe(false);
  });

  it('tab Bị Pancake ghi đè: ô đếm, danh sách NV đặt → Pancake đè, khôi phục gửi đúng đơn', async () => {
    search = 'issue=PANCAKE_OVERWRITE';
    setup();
    const restoreBodies: unknown[] = [];
    server.use(
      http.get('/api/sales-orders/pancake-overwrites', () =>
        HttpResponse.json({
          items: [OVERWRITE_ORDER],
          total: 1,
          checkedAt: '2026-11-02T15:30:00.000Z',
        }),
      ),
      http.get('/api/warehouses', () => HttpResponse.json([])),
      http.post('/api/sales-orders/pancake-overwrites/restore', async ({ request }) => {
        restoreBodies.push(await request.json());
        return HttpResponse.json({
          restored: [{ orderId: OVERWRITE_ORDER.orderId, docNumber: OVERWRITE_ORDER.docNumber }],
          skipped: [],
          failed: [],
        });
      }),
    );
    renderApp(<OrderIssuesScreen />);
    const tile = await screen.findByTestId('issue-tile-PANCAKE_OVERWRITE');
    await waitFor(() => expect(within(tile).getByText('34')).toBeInTheDocument());
    expect(within(tile).getByText('16 đơn khôi phục được')).toBeInTheDocument();
    expect(await screen.findByText('SOP2610-58794')).toBeInTheDocument();
    expect(screen.getByText(/SP-0147 ×5: 730\.000/)).toBeInTheDocument();
    expect(screen.getByText(/×5 · 750\.000/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    fireEvent.click(await screen.findByRole('button', { name: /Khôi phục bản ERP \(1\)/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Khôi phục 1 đơn/ }));
    await waitFor(() => expect(restoreBodies).toEqual([{ orderIds: [OVERWRITE_ORDER.orderId] }]));
    expect((await within(dialog).findAllByText('Đã khôi phục')).length).toBeGreaterThan(0);
  });

  it('tab Đổi kho nhân đôi combo: quyền fix_warehouse_split; dọn chỉ gửi đơn dọn được', async () => {
    expect(
      buildAbility({
        permissions: ['sales_order.issues', 'sales_order.fix_warehouse_split'],
        hasGlobalAccess: false,
      }).can('fix_warehouse_split', 'SalesOrder'),
    ).toBe(true);
    expect(
      buildAbility({ permissions: ['sales_order.issues'], hasGlobalAccess: false }).can(
        'fix_warehouse_split',
        'SalesOrder',
      ),
    ).toBe(false);

    search = 'issue=WAREHOUSE_SPLIT';
    setup();
    const repairBodies: unknown[] = [];
    server.use(
      http.get('/api/sales-orders/warehouse-splits', () =>
        HttpResponse.json({
          items: [SPLIT_ORDER, SPLIT_PACKED],
          total: 2,
          checkedAt: '2026-11-05T14:00:00.000Z',
        }),
      ),
      http.get('/api/warehouses', () => HttpResponse.json([])),
      http.post('/api/sales-orders/warehouse-splits/repair', async ({ request }) => {
        repairBodies.push(await request.json());
        return HttpResponse.json({
          items: [
            {
              orderId: SPLIT_ORDER.orderId,
              docNumber: SPLIT_ORDER.docNumber,
              result: 'REPAIRED',
              fix: null,
            },
          ],
        });
      }),
    );
    renderApp(<OrderIssuesScreen />);
    const tile = await screen.findByTestId('issue-tile-WAREHOUSE_SPLIT');
    await waitFor(() => expect(within(tile).getByText('228')).toBeInTheDocument());
    expect(within(tile).getByText('43 đơn dọn được')).toBeInTheDocument();
    expect(await screen.findByText('SOP2611-189319')).toBeInTheDocument();
    expect(screen.getAllByText(/Rooting ×2/).length).toBe(2);
    expect(screen.getByText(/Kho mở hộp lấy hàng thừa ra/)).toBeInTheDocument();
    // Chọn cả hai: chỉ đơn dọn được vào hộp dọn.
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    fireEvent.click(screen.getAllByRole('checkbox')[2]!);
    fireEvent.click(await screen.findByRole('button', { name: /Dọn dòng thừa \(1\)/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Dọn 1 đơn/ }));
    await waitFor(() => expect(repairBodies).toEqual([{ orderIds: [SPLIT_ORDER.orderId] }]));
    expect((await within(dialog).findAllByText('Đã dọn dòng thừa')).length).toBeGreaterThan(0);
  });
});
