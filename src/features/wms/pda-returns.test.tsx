import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { ReturnableOrder } from './api/use-returns';
import { PdaReturnsScreen } from './components/pda-returns-screen';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/pda/returns',
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** Đúng shape `ReturnableOrderDto` — đơn Pancake gửi ngoài ERP, kiện VTP hoàn về. */
const ORDER: ReturnableOrder = {
  orderId: 'o-1',
  docNumber: 'SO2610-04512',
  status: 'APPROVED',
  stockNotDeducted: true,
  shipment: {
    id: 'sh-1',
    docNumber: 'SHP2610-03381',
    trackingNo: 'PKE450373047160385',
    carrierCode: 'VTP',
    carrierName: 'Viettel Post',
    status: 'RETURNED',
    shippedOutsideErp: true,
  },
  lines: [
    {
      orderLineId: 'ol-1',
      lineNo: 1,
      skuId: 's-1',
      skuCode: 'AMINO-GA3-500',
      skuName: 'Amino Ga3 500 ml',
      qtyOrdered: '2.000000',
      qtyShipped: '2.000000',
      qtyReturned: '0.000000',
      qtyReturnable: '2.000000',
      unitCost: '50000.0000',
      defaultLocationId: 'loc-def',
      defaultLocationCode: 'DEFAULT',
      defaultLotId: null,
      defaultLotNumber: null,
    },
  ],
};

const scan = (label: string, code: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: code } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('/pda/returns — quét kiện hoàn', () => {
  it('chưa quét: quét mã trên kiện → đưa mã lên URL', async () => {
    nav.search = '';
    nav.replace.mockClear();
    renderApp(<PdaReturnsScreen />);
    expect(await screen.findByText('Quét mã vạch vận đơn trên kiện')).toBeInTheDocument();
    scan('Mã trên kiện', ' PKE450373047160385 ');
    expect(nav.replace).toHaveBeenCalledWith('/pda/returns?code=PKE450373047160385');
  });

  it('ra đơn theo vận đơn: hãng + mã, đơn ngoài ERP, lý do ĐVVC hoàn; +2 → NHẬP KHO tạo phiếu kèm Idempotency-Key rồi post', async () => {
    nav.search = 'code=PKE450373047160385';
    nav.replace.mockClear();
    const creates: { body: unknown; key: string | null }[] = [];
    const posts: string[] = [];
    server.use(
      http.get('/api/return-receipts/returnable', ({ request }) => {
        expect(new URL(request.url).searchParams.get('code')).toBe('PKE450373047160385');
        return HttpResponse.json(ORDER);
      }),
      http.post('/api/return-receipts', async ({ request }) => {
        creates.push({ body: await request.json(), key: request.headers.get('idempotency-key') });
        return HttpResponse.json(
          { receiptId: 'r-9', docNumber: 'RTN2610-00032', status: 'DRAFT' },
          { status: 201 },
        );
      }),
      http.post('/api/return-receipts/:id/post', ({ params }) => {
        posts.push(String(params.id));
        return HttpResponse.json({});
      }),
    );
    renderApp(<PdaReturnsScreen />);
    expect(await screen.findByText('Viettel Post')).toBeInTheDocument();
    expect(screen.getByText('PKE450373047160385')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/kho chưa trừ tồn/);
    expect(screen.getByRole('button', { name: 'ĐVVC hoàn (giao không thành)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const plus = screen.getByRole('button', { name: 'Thêm 1 — Nhập lại kho dòng 1' });
    fireEvent.click(plus);
    fireEvent.click(plus);
    // Đủ số còn hoàn được → không cộng thêm được
    expect(plus).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'NHẬP KHO 2 SẢN PHẨM' }));

    expect(await screen.findByText('Đã nhập kho hàng hoàn')).toBeInTheDocument();
    expect(posts).toEqual(['r-9']);
    expect(creates).toHaveLength(1);
    expect(creates[0]!.key).toMatch(/[0-9a-f-]{36}/);
    expect(creates[0]!.body).toEqual({
      orderId: 'o-1',
      reason: 'ĐVVC hoàn (giao không thành)',
      note: 'Kiện PKE450373047160385',
      lines: [{ orderLineId: 'ol-1', qty: '2' }],
    });
    expect(nav.replace).toHaveBeenCalledWith('/pda/returns');
    expect(screen.getByRole('link', { name: 'Xem phiếu RTN2610-00032' })).toHaveAttribute(
      'href',
      '/wms/returns/r-9',
    );
  });

  it('mã không ra đơn → báo rõ mã, nút QUÉT LẠI về màn quét', async () => {
    nav.search = 'code=1769559795';
    nav.replace.mockClear();
    server.use(
      http.get('/api/return-receipts/returnable', () =>
        HttpResponse.json(
          { code: 'RETURN_ORDER_NOT_FOUND', message: 'x', traceId: 't-1' },
          { status: 404 },
        ),
      ),
    );
    renderApp(<PdaReturnsScreen />);
    expect(await screen.findByText('Không ra đơn nào cho mã 1769559795')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'QUÉT LẠI' }));
    expect(nav.replace).toHaveBeenCalledWith('/pda/returns');
  });

  it('đơn đã hoàn đủ → cảnh báo, không có nút NHẬP KHO', async () => {
    nav.search = 'code=PKE450373047160385';
    server.use(
      http.get('/api/return-receipts/returnable', () =>
        HttpResponse.json({
          ...ORDER,
          lines: [{ ...ORDER.lines[0]!, qtyReturned: '2.000000', qtyReturnable: '0.000000' }],
        }),
      ),
    );
    renderApp(<PdaReturnsScreen />);
    expect(await screen.findByText('Đơn SO2610-04512 không còn hàng để hoàn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /NHẬP KHO/ })).toBeNull();
  });

  it('không có quyền nhập kho → màn không có quyền', async () => {
    nav.search = '';
    renderApp(<PdaReturnsScreen />, { me: { ...ME_SALE, permissions: ['stock.read'] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền/i));
  });
});
