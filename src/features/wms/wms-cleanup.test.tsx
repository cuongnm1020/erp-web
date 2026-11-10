import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_ADMIN } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { CleanupReservationRow, CleanupTaskRow } from './api/use-wms-cleanup';
import { WmsCleanupScreen } from './components/wms-cleanup-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/cleanup',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const task = (over: Partial<CleanupTaskRow>): CleanupTaskRow => ({
  id: 't-1',
  docNumber: 'PICK2611-00001',
  type: 'PICK',
  status: 'PENDING',
  warehouseCode: 'WH01',
  warehouseName: 'Kho Hà Nội',
  orderId: 'o-1',
  orderDocNumber: 'SO2611-00001',
  assigneeName: null,
  inWave: false,
  lineCount: 1,
  exceptionLineCount: 0,
  qtyPlanned: '2.000000',
  qtyDone: '0.000000',
  skuCodes: 'SP-0147',
  releasedAt: null,
  createdAt: '2026-11-10T01:00:00.000Z',
  completedAt: null,
  blockedReason: null,
  ...over,
});

const reservation: CleanupReservationRow = {
  id: 'r-1',
  status: 'ACTIVE',
  qty: '7.000000',
  skuId: 's-1',
  skuCode: 'SP-0147',
  skuName: 'Phân bón lá',
  locationCode: 'A-01-01',
  warehouseCode: 'WH01',
  warehouseName: 'Kho Hà Nội',
  containerBarcode: null,
  lotNumber: null,
  refType: 'SalesOrder',
  refId: 'o-1',
  refDocNumber: 'SO2611-00001',
  expiresAt: null,
  createdAt: '2026-11-10T01:00:00.000Z',
};

const selectRow = (text: string) => {
  const row = screen.getByText(text).closest('tr')!;
  fireEvent.click(within(row).getByRole('checkbox'));
};

describe('WmsCleanupScreen — Dọn việc kho (superadmin, 2026-11-10)', () => {
  beforeEach(() => {
    search = '';
    replace.mockClear();
  });

  it('không phải superadmin (kể cả đủ quyền kho) → màn không có quyền', () => {
    renderApp(<WmsCleanupScreen />, {
      me: { ...ME_ADMIN, hasGlobalAccess: false, permissions: ['task.read_all', 'task.assign'] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền/i);
  });

  it('tab PICK: chọn nhiều, việc bị khóa bỏ qua; xóa cần lý do, gửi đúng id + lý do', async () => {
    const asked: string[] = [];
    let body: { ids: string[]; reason: string } | null = null;
    server.use(
      http.get('/api/wms-cleanup/tasks', ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('type') ?? '');
        return HttpResponse.json({
          items: [
            task({}),
            task({
              id: 't-2',
              docNumber: 'PICK2611-00002',
              orderDocNumber: 'SO2611-00002',
              blockedReason: 'STOCK_ISSUED',
            }),
          ],
          total: 2,
        });
      }),
      http.post('/api/wms-cleanup/tasks/cancel', async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ done: ['t-1'], failed: [] });
      }),
    );
    renderApp(<WmsCleanupScreen />);
    expect(await screen.findByText('PICK2611-00001')).toBeInTheDocument();
    expect(asked).toContain('PICK');
    expect(screen.getByText('Đơn đã trừ tồn')).toBeInTheDocument();

    selectRow('PICK2611-00001');
    selectRow('PICK2611-00002');
    expect(screen.getByText('1 việc không xóa được sẽ bỏ qua')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xóa 1 việc/ }));

    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: /Xóa 1 việc/ });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Lý do (bắt buộc)'), {
      target: { value: ' việc treo ' },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(body).toEqual({ ids: ['t-1'], reason: 'việc treo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('tab Giữ chỗ: lỗi từng dòng hiện theo mã (không render message thô)', async () => {
    search = 'tab=RESERVATION';
    server.use(
      http.get('/api/wms-cleanup/reservations', () =>
        HttpResponse.json({ items: [reservation], total: 1 }),
      ),
      http.post('/api/wms-cleanup/reservations/release', () =>
        HttpResponse.json({
          done: [],
          failed: [{ id: 'r-1', code: 'RESERVATION_NOT_ACTIVE', message: 'raw server text' }],
        }),
      ),
    );
    renderApp(<WmsCleanupScreen />);
    expect(await screen.findByText('A-01-01')).toBeInTheDocument();
    selectRow('A-01-01');
    fireEvent.click(screen.getByRole('button', { name: /Xóa 1 giữ chỗ/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Lý do (bắt buộc)'), {
      target: { value: 'mồ côi' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Xóa 1 giữ chỗ/ }));
    expect(await screen.findByText('1 bản ghi không xóa được')).toBeInTheDocument();
    expect(screen.getByText('Giữ chỗ đã nhả hoặc đã trừ tồn từ trước.')).toBeInTheDocument();
    expect(screen.queryByText('raw server text')).not.toBeInTheDocument();
  });
});
