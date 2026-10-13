import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { ReturnableOrder, ReturnReceiptDetail } from './api/use-returns';
import { ReturnCreateScreen } from './components/return-create-screen';
import { ReturnDetailScreen } from './components/return-detail-screen';
import { ReturnListScreen } from './components/return-list-screen';

let search = '';
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/returns',
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: vi.fn(),
  },
}));

/** Đúng shape `ReturnableOrderDto` (GET /return-receipts/returnable). */
const RETURNABLE: ReturnableOrder = {
  orderId: 'o-1',
  docNumber: 'SO2610-00001',
  status: 'APPROVED',
  lines: [
    {
      orderLineId: 'ol-1',
      lineNo: 1,
      skuId: 's-1',
      skuCode: 'VBC-40G',
      skuName: 'Vua Bật Chồi 40gr',
      qtyOrdered: '5.000000',
      qtyShipped: '5.000000',
      qtyReturned: '1.000000',
      qtyReturnable: '4.000000',
      unitCost: '44000.0000',
      defaultLocationId: 'loc-1',
      defaultLocationCode: 'A-01-01',
      defaultLotId: null,
      defaultLotNumber: null,
    },
    {
      orderLineId: 'ol-2',
      lineNo: 2,
      skuId: 's-2',
      skuCode: 'RTX-500',
      skuName: 'Rooting Extra 500ml',
      qtyOrdered: '2.000000',
      qtyShipped: '0.000000',
      qtyReturned: '0.000000',
      qtyReturnable: '0.000000',
      unitCost: null,
      defaultLocationId: null,
      defaultLocationCode: null,
      defaultLotId: null,
      defaultLotNumber: null,
    },
  ],
};

const DETAIL: ReturnReceiptDetail = {
  id: 'r-1',
  docNumber: 'RTN2610-00001',
  status: 'DRAFT',
  orderId: 'o-1',
  orderDocNumber: 'SO2610-00001',
  warehouseId: 'wh-1',
  warehouseName: 'Kho HN-1',
  reason: 'Khách trả hàng',
  receivedAt: '2026-10-02T03:00:00.000Z',
  lineCount: 2,
  totalQty: '3.000000',
  note: null,
  postedAt: null,
  lines: [
    {
      id: 'l-1',
      lineNo: 1,
      orderLineId: 'ol-1',
      skuId: 's-1',
      skuCode: 'VBC-40G',
      skuName: 'Vua Bật Chồi 40gr',
      qtyBase: '2.000000',
      disposition: 'RESTOCK',
      locationId: 'loc-1',
      locationCode: 'A-01-01',
      lotId: null,
      lotNumber: null,
      unitCost: null,
      costAmount: null,
    },
    {
      id: 'l-2',
      lineNo: 2,
      orderLineId: 'ol-1',
      skuId: 's-1',
      skuCode: 'VBC-40G',
      skuName: 'Vua Bật Chồi 40gr',
      qtyBase: '1.000000',
      disposition: 'SCRAP',
      locationId: null,
      locationCode: null,
      lotId: null,
      lotNumber: null,
      unitCost: null,
      costAmount: null,
    },
  ],
};

describe('Nhập hàng hoàn', () => {
  it('danh sách: số phiếu, đơn bán, trạng thái', async () => {
    search = '';
    server.use(
      http.get('/api/return-receipts', () => HttpResponse.json({ items: [DETAIL], total: 1 })),
    );
    renderApp(<ReturnListScreen />);
    expect(await screen.findByText('RTN2610-00001')).toBeInTheDocument();
    const row = screen.getByText('RTN2610-00001').closest('tr')!;
    expect(within(row).getByText('SO2610-00001')).toBeInTheDocument();
    expect(within(row).getByText('Nháp')).toBeInTheDocument();
  });

  it('lập phiếu: 2 nhập lại + 1 hủy → POST kèm Idempotency-Key, rồi post phiếu', async () => {
    search = 'orderId=o-1';
    const creates: { body: unknown; key: string | null }[] = [];
    const posts: string[] = [];
    server.use(
      http.get('/api/return-receipts/returnable', ({ request }) => {
        expect(new URL(request.url).searchParams.get('orderId')).toBe('o-1');
        return HttpResponse.json(RETURNABLE);
      }),
      http.post('/api/return-receipts', async ({ request }) => {
        creates.push({ body: await request.json(), key: request.headers.get('idempotency-key') });
        return HttpResponse.json(
          { receiptId: 'r-1', docNumber: 'RTN2610-00001', status: 'DRAFT' },
          { status: 201 },
        );
      }),
      http.post('/api/return-receipts/:id/post', ({ params }) => {
        posts.push(String(params.id));
        return HttpResponse.json({ ...DETAIL, status: 'POSTED' });
      }),
    );
    renderApp(<ReturnCreateScreen />);
    fireEvent.change(await screen.findByLabelText('Nhập lại kho dòng 1'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Hủy dòng 1'), { target: { value: '1' } });
    // Dòng chưa xuất kho → không nhập được
    expect(screen.getByLabelText('Nhập lại kho dòng 2')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu & post' }));
    await waitFor(() => expect(posts).toEqual(['r-1']));
    expect(creates).toHaveLength(1);
    expect(creates[0]!.key).toMatch(/[0-9a-f-]{36}/);
    expect(creates[0]!.body).toEqual({
      orderId: 'o-1',
      reason: 'Khách trả hàng',
      lines: [
        { orderLineId: 'ol-1', qty: '2' },
        { orderLineId: 'ol-1', qty: '1', disposition: 'SCRAP' },
      ],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/wms/returns/r-1'));
  });

  it('vượt phần còn hoàn được → báo lỗi trên dòng, khoá nút lưu', async () => {
    search = 'orderId=o-1';
    server.use(http.get('/api/return-receipts/returnable', () => HttpResponse.json(RETURNABLE)));
    renderApp(<ReturnCreateScreen />);
    fireEvent.change(await screen.findByLabelText('Nhập lại kho dòng 1'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Hủy dòng 1'), { target: { value: '2' } });
    expect(screen.getByText('Tối đa 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu & post' })).toBeDisabled();
  });

  it('quét mã từng sản phẩm hoàn về → cộng "Nhập lại kho" của dòng cùng SKU (mã thùng cộng cả thùng); vượt / không thuộc đơn / mã lạ → báo, không cộng', async () => {
    search = 'orderId=o-1';
    toastError.mockClear();
    const sku = (id: string, code: string, name: string) => ({
      id,
      code,
      name,
      productCode: code,
      trackingMode: 'NONE',
    });
    const base = { id: 'u-pcs', code: 'PCS' };
    server.use(
      http.get('/api/return-receipts/returnable', () => HttpResponse.json(RETURNABLE)),
      http.get('/api/barcodes/:code', ({ params }) => {
        const code = String(params.code);
        if (code === 'https://www.thiennongnamviet.com.vn/vbc')
          return HttpResponse.json({
            barcode: code,
            type: 'QR',
            sku: sku('s-1', 'VBC-40G', 'Vua Bật Chồi 40gr'),
            uom: { ...base, name: 'Gói' },
            baseUom: base,
            factor: '1',
          });
        if (code === 'THUNG-VBC')
          return HttpResponse.json({
            barcode: code,
            type: 'CODE128',
            sku: sku('s-1', 'VBC-40G', 'Vua Bật Chồi 40gr'),
            uom: { id: 'u-box', code: 'BOX', name: 'Thùng' },
            baseUom: base,
            factor: '3',
          });
        if (code === 'KHAC')
          return HttpResponse.json({
            barcode: code,
            type: 'CODE128',
            sku: sku('s-9', 'KHAC-1', 'Sản phẩm khác'),
            uom: { ...base, name: 'Gói' },
            baseUom: base,
            factor: '1',
          });
        return HttpResponse.json(
          { code: 'NOT_FOUND', message: 'x', details: null, traceId: 't' },
          { status: 404 },
        );
      }),
      http.get('/api/skus/:id/conversions', () =>
        HttpResponse.json([{ uomId: 'u-box', uomCode: 'BOX', factor: '3', containerTypeId: null }]),
      ),
    );
    renderApp(<ReturnCreateScreen />);
    const restock = await screen.findByLabelText('Nhập lại kho dòng 1');
    const scan = (code: string) => {
      const input = screen.getByLabelText('Quét mã sản phẩm hoàn về');
      fireEvent.change(input, { target: { value: code } });
      fireEvent.keyDown(input, { key: 'Enter' });
    };
    scan('https://www.thiennongnamviet.com.vn/vbc');
    await waitFor(() => expect(restock).toHaveValue('1'));
    scan('https://www.thiennongnamviet.com.vn/vbc');
    await waitFor(() => expect(restock).toHaveValue('2'));
    // Thùng 3 → 5 > còn hoàn được 4 → không cộng.
    scan('THUNG-VBC');
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Vua Bật Chồi 40gr: đã đủ số còn hoàn được của đơn.'),
    );
    expect(restock).toHaveValue('2');
    scan('KHAC');
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'KHAC-1 — Sản phẩm khác không có trong đơn SO2610-00001.',
      ),
    );
    scan('LA');
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Mã LA chưa gán')),
    );
    expect(restock).toHaveValue('2');
  });

  it('chi tiết nháp: xử lý từng dòng, nút Post phiếu gọi POST :id/post', async () => {
    const posts: string[] = [];
    server.use(
      http.get('/api/return-receipts/r-1', () => HttpResponse.json(DETAIL)),
      http.post('/api/return-receipts/:id/post', ({ params }) => {
        posts.push(String(params.id));
        return HttpResponse.json({ ...DETAIL, status: 'POSTED' });
      }),
    );
    renderApp(<ReturnDetailScreen id="r-1" />);
    expect(await screen.findByText('Nhập lại kho')).toBeInTheDocument();
    expect(screen.getByText('Hủy (hỏng)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Post phiếu' }));
    await waitFor(() => expect(posts).toEqual(['r-1']));
  });
});
