import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PickScreen } from './components/pick-screen';

/**
 * `/pda/pick` 2026-10-12 — cột Đơn mới, Lấy đơn, Gộp lượt lấy, giao người đóng gói
 * (spec docs/screens/FE-PDA-2-new-orders-handover.md; luồng apps/api/docs/pick-pack-flow.md).
 */

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/pda/pick',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ITEMS = [
  { taskId: 't-big', orderId: 'o1', docNumber: 'SO2610-00123', skuCount: 4, weightKg: '12.5000' },
  { taskId: 't-mid', orderId: 'o2', docNumber: 'SO2610-00119', skuCount: 1, weightKg: '2.0000' },
];

const newOrders = (over: Record<string, unknown> = {}) => ({
  warehouseId: 'wh-1',
  items: ITEMS,
  total: ITEMS.length,
  holding: 0,
  limit: 30,
  pendingHandover: 0,
  ...over,
});

const PACKERS = [
  { id: 'pk-a', code: 'pk.a', fullName: 'Nguyễn Văn A' },
  { id: 'pk-b', code: 'pk.b', fullName: 'Trần Thị B' },
];
const PENDING = [
  { taskId: 'p1', orderId: 'o1', docNumber: 'SO-1', packTaskId: null, packStatus: null },
  { taskId: 'p2', orderId: 'o2', docNumber: 'SO-2', packTaskId: 'k2', packStatus: 'PENDING' },
];

const column = () => screen.getByRole('region', { name: 'Đơn mới' });

// renderApp không gắn Toaster — kiểm câu thông báo qua spy (như dispatch.test).
let okToast: ReturnType<typeof vi.spyOn>;
let errToast: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.restoreAllMocks();
  okToast = vi.spyOn(toast, 'success').mockImplementation(() => '' as never);
  errToast = vi.spyOn(toast, 'error').mockImplementation(() => '' as never);
});

describe('/pda/pick — cột Đơn mới', () => {
  it('hiện mã đơn + số SKU + cân nặng; chọn → tổng cân nặng; Lấy đơn → POST đúng taskIds + key', async () => {
    let body: { taskIds: string[]; idempotencyKey: string } | null = null;
    server.use(
      http.get('/api/pda/new-orders', () => HttpResponse.json(newOrders())),
      http.post('/api/pda/new-orders/take', async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({
          taskIds: body!.taskIds,
          docNumbers: ['SO2610-00123', 'SO2610-00119'],
          replayed: false,
        });
      }),
    );
    renderApp(<PickScreen />);
    expect(await screen.findByText('SO2610-00123')).toBeInTheDocument();
    expect(within(column()).getByText('4 SKU · 12,5 kg')).toBeInTheDocument();
    expect(screen.getByTestId('new-orders-total')).toHaveTextContent('Chạm vào đơn để chọn');

    fireEvent.click(screen.getByRole('checkbox', { name: /SO2610-00123/ }));
    expect(screen.getByTestId('new-orders-total')).toHaveTextContent('Đã chọn 1 đơn · 12,5 kg');
    fireEvent.click(screen.getByRole('checkbox', { name: /SO2610-00119/ }));
    expect(screen.getByTestId('new-orders-total')).toHaveTextContent('Đã chọn 2 đơn · 14,5 kg');

    fireEvent.click(screen.getByRole('button', { name: 'Lấy 2 đơn' }));
    await waitFor(() => expect(okToast).toHaveBeenCalledWith('Đã lấy 2 đơn'));
    expect(body!.taskIds).toEqual(['t-big', 't-mid']);
    expect(body!.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('409 PDA_NEW_ORDERS_TAKEN → báo mã đơn, bỏ chọn hết, tải lại danh sách', async () => {
    let calls = 0;
    server.use(
      http.get('/api/pda/new-orders', () => {
        calls += 1;
        return HttpResponse.json(
          calls === 1 ? newOrders() : newOrders({ items: ITEMS.slice(1), total: 1 }),
        );
      }),
      http.post('/api/pda/new-orders/take', () =>
        HttpResponse.json(
          {
            code: 'PDA_NEW_ORDERS_TAKEN',
            message: 'x',
            details: { docNumbers: ['SO2610-00123'] },
          },
          { status: 409 },
        ),
      ),
    );
    renderApp(<PickScreen />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /SO2610-00123/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lấy 1 đơn' }));
    await waitFor(() =>
      expect(errToast).toHaveBeenCalledWith(
        'Đơn SO2610-00123 đã có người lấy hoặc không còn chờ lấy. Danh sách đã tải lại — chọn lại.',
      ),
    );
    await waitFor(() => expect(screen.queryByText('SO2610-00123')).not.toBeInTheDocument());
    expect(screen.getByTestId('new-orders-total')).toHaveTextContent('Chạm vào đơn để chọn');
  });

  it('còn đơn chờ giao → thanh vàng, Lấy đơn mờ; Chọn người đóng gói → hộp thoại → Giao 2 đơn cho B', async () => {
    let posted: { packerId: string } | null = null;
    let packersWh: string | null = null;
    server.use(
      http.get('/api/pda/new-orders', () => HttpResponse.json(newOrders({ pendingHandover: 2 }))),
      http.get('/api/pda/handover', () =>
        HttpResponse.json({
          pending: PENDING,
          pendingWarehouseId: 'wh-1',
          openPicks: 0,
          latest: null,
        }),
      ),
      http.get('/api/pda/packers', ({ request }) => {
        packersWh = new URL(request.url).searchParams.get('warehouseId');
        return HttpResponse.json(PACKERS);
      }),
      http.post('/api/pda/handovers', async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json({
          id: 'h1',
          warehouseId: 'wh-1',
          packer: PACKERS[1],
          createdAt: '',
          updatedAt: '',
          orders: PENDING,
          changeable: 2,
          replayed: false,
        });
      }),
    );
    renderApp(<PickScreen />);
    expect(
      await screen.findByText('2 đơn đã lấy xong chưa giao người đóng gói'),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('checkbox', { name: /SO2610-00123/ }));
    expect(screen.getByRole('button', { name: 'Lấy 1 đơn' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Chọn người đóng gói' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('radio', { name: /Trần Thị B/ }));
    expect(packersWh).toBe('wh-1');
    expect(within(dialog).getByText('SO-1 · SO-2')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Giao 2 đơn cho Trần Thị B' }));
    await waitFor(() => expect(okToast).toHaveBeenCalledWith('Đã giao 2 đơn cho Trần Thị B'));
    expect(posted!.packerId).toBe('pk-b');
  });
});

describe('/pda/pick — Gộp lượt lấy', () => {
  it('≥ 2 việc của tôi chưa bắt đầu → nút Gộp lượt lấy · 2 đơn → POST self-merge đúng taskIds', async () => {
    let body: { taskIds: string[] } | null = null;
    const task = (id: string, doc: string) => ({
      taskId: id,
      docNumber: `PICK-${doc}`,
      refDocNumber: doc,
      type: 'PICK',
      status: 'ASSIGNED',
      priority: 0,
      waveId: null,
      waveDocNumber: null,
      lines: [],
    });
    server.use(
      http.get('/api/pda/tasks', () => HttpResponse.json([task('t1', 'SO-1'), task('t2', 'SO-2')])),
      http.post('/api/pda/waves/self-merge', async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json(
          { code: 'WAVE_SELF_MERGE_STALE', message: 'x', details: null },
          { status: 409 },
        );
      }),
    );
    renderApp(<PickScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gộp lượt lấy · 2 đơn' }));
    await waitFor(() =>
      expect(errToast).toHaveBeenCalledWith(
        expect.stringContaining('Đã tải lại — bấm Gộp lượt lấy lần nữa.'),
      ),
    );
    expect(body!.taskIds).toEqual(['t1', 't2']);
  });
});
