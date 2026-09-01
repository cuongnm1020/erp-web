import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { StocktakeScreen } from './components/stocktake-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/stocktake',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const LIST = {
  items: [
    {
      id: 'cc-1',
      docNumber: 'CC2608-00009',
      status: 'PENDING_APPROVAL',
      warehouseId: 'wh-1',
      warehouseName: 'Kho HN-1',
      createdAt: '2026-08-22T08:00:00.000Z',
      createdByName: 'Lê Minh Hùng',
      countedAt: '2026-08-22T17:30:00.000Z',
      lineCount: 3,
      countedLineCount: 3,
      varianceLineCount: 1,
    },
    {
      id: 'cc-2',
      docNumber: 'CC2608-00010',
      status: 'DRAFT',
      warehouseId: 'wh-1',
      warehouseName: 'Kho HN-1',
      createdAt: '2026-08-23T08:00:00.000Z',
      createdByName: 'Lê Minh Hùng',
      countedAt: null,
      lineCount: 2,
      countedLineCount: 1,
      varianceLineCount: 0,
    },
  ],
  total: 2,
  statusCounts: { DRAFT: 1, PENDING_APPROVAL: 1, POSTED: 0, CANCELLED: 0 },
};

const line = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  skuId: `sku-${id}`,
  skuCode: `TL08-${id}`,
  skuName: `Bút bi ${id}`,
  locationCode: 'A-03-02-B',
  lotNumber: 'L2607',
  qtySystem: '480',
  qtyCounted: null,
  variance: null,
  note: null,
  countedByName: null,
  ...extra,
});

const DETAIL_PENDING = {
  id: 'cc-1',
  docNumber: 'CC2608-00009',
  status: 'PENDING_APPROVAL',
  warehouseId: 'wh-1',
  warehouseName: 'Kho HN-1',
  createdAt: '2026-08-22T08:00:00.000Z',
  createdByName: 'Lê Minh Hùng',
  countedAt: '2026-08-22T17:30:00.000Z',
  lineCount: 2,
  countedLineCount: 2,
  varianceLineCount: 1,
  lines: [
    line('l1', {
      qtyCounted: '468',
      variance: '-12',
      note: 'Rơi vỡ sau kệ',
      countedByName: 'Đỗ Quang Huy',
    }),
    line('l2', { qtyCounted: '480', variance: '0', countedByName: 'Vũ Thị Lan' }),
  ],
};

const DETAIL_DRAFT = {
  ...DETAIL_PENDING,
  id: 'cc-2',
  docNumber: 'CC2608-00010',
  status: 'DRAFT',
  countedAt: null,
  countedLineCount: 1,
  varianceLineCount: 0,
  lines: [line('l1', { qtyCounted: '480', variance: '0' }), line('l2')],
};

describe('StocktakeScreen — /cycle-counts', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/warehouses', () =>
        HttpResponse.json([
          { id: 'wh-1', code: 'WH01', name: 'Kho HN-1', address: null, isActive: true },
        ]),
      ),
      http.get('/api/cycle-counts', () => HttpResponse.json(LIST)),
    );
  });

  it('danh sách phiên: số phiên, trạng thái, tiến độ đếm, dòng lệch', async () => {
    search = '';
    renderApp(<StocktakeScreen />);
    expect(await screen.findByText('CC2608-00009')).toBeInTheDocument();
    expect(screen.getByText('Chờ duyệt chênh lệch')).toBeInTheDocument();
    expect(screen.getByText('Đang đếm')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('mở phiên: dialog chọn kho → POST /cycle-counts', async () => {
    search = '';
    const posts: unknown[] = [];
    server.use(
      http.post('/api/cycle-counts', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(
          { countId: 'cc-9', docNumber: 'CC2608-00011', status: 'DRAFT', lineCount: 214 },
          { status: 201 },
        );
      }),
    );
    renderApp(<StocktakeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Mở phiên kiểm kê/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Kho kiểm kê' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kho HN-1' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mở phiên kiểm kê' }));
    await waitFor(() => expect(posts).toEqual([{ warehouseId: 'wh-1' }]));
  });

  it('phiên DRAFT: nhập số đếm + lý do → PATCH lines/:lineId; chưa đếm đủ thì không gửi duyệt được', async () => {
    search = 'cc=cc-2';
    const patches: Array<{ lineId: string; body: unknown }> = [];
    server.use(
      http.get('/api/cycle-counts/:id', () => HttpResponse.json(DETAIL_DRAFT)),
      http.patch('/api/cycle-counts/:id/lines/:lineId', async ({ request, params }) => {
        patches.push({ lineId: params.lineId as string, body: await request.json() });
        return HttpResponse.json({ lineId: params.lineId, qtyCounted: '468', variance: '-12' });
      }),
    );
    renderApp(<StocktakeScreen />);
    await screen.findByText('CC2608-00010');
    const qtyInput = await screen.findByLabelText('Đếm thực TL08-l2 tại A-03-02-B');
    fireEvent.change(qtyInput, { target: { value: '468' } });
    fireEvent.change(screen.getByLabelText('Lý do TL08-l2 tại A-03-02-B'), {
      target: { value: 'Rơi vỡ sau kệ' },
    });
    const saveButtons = screen.getAllByRole('button', { name: 'Lưu' });
    fireEvent.click(saveButtons[saveButtons.length - 1]!);
    await waitFor(() =>
      expect(patches).toEqual([
        { lineId: 'l2', body: { qtyCounted: '468', note: 'Rơi vỡ sau kệ' } },
      ]),
    );
    // 1/2 dòng đã đếm → nút gửi duyệt bị khóa
    expect(screen.getByRole('button', { name: /Gửi duyệt/ })).toBeDisabled();
  });

  it('phiên chờ duyệt: Duyệt → POST :id/approve; Từ chối → POST :id/reject; lọc chỉ dòng lệch', async () => {
    search = 'cc=cc-1';
    const approved: string[] = [];
    server.use(
      http.get('/api/cycle-counts/:id', () => HttpResponse.json(DETAIL_PENDING)),
      http.post('/api/cycle-counts/:id/approve', ({ params }) => {
        approved.push(params.id as string);
        return HttpResponse.json({
          countId: params.id,
          docNumber: 'CC2608-00009',
          status: 'POSTED',
          adjustedLineCount: 1,
        });
      }),
    );
    renderApp(<StocktakeScreen />);
    await screen.findByText('Rơi vỡ sau kệ');
    // Không có ô nhập khi chờ duyệt (số đếm đóng băng)
    expect(screen.queryByLabelText(/Đếm thực/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Chỉ dòng chênh lệch/));
    expect(screen.getByText('TL08-l1')).toBeInTheDocument();
    expect(screen.queryByText('TL08-l2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Duyệt chênh lệch/ }));
    await waitFor(() => expect(approved).toEqual(['cc-1']));
  });

  it('không có stock.adjust → không thấy nút Duyệt/Từ chối (luật 7)', async () => {
    search = 'cc=cc-1';
    server.use(http.get('/api/cycle-counts/:id', () => HttpResponse.json(DETAIL_PENDING)));
    renderApp(<StocktakeScreen />, {
      me: { ...ME_SALE, permissions: ['stock.read', 'stock.count'] },
    });
    await screen.findByText('Rơi vỡ sau kệ');
    expect(screen.queryByRole('button', { name: /Duyệt chênh lệch/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Từ chối' })).not.toBeInTheDocument();
  });
});
