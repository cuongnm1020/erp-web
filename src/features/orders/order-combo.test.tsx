import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeOrderDetailWithCombo, makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { collapseComboLines, groupOrderLines } from './combo-lines';
import { OrderCreateScreen } from './components/order-create-screen';
import { OrderDetailScreen } from './components/order-detail-screen';

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
  usePathname: () => '/crm/orders/x',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const ORDER = makeOrders(1)[0]!;
const DETAIL = makeOrderDetailWithCombo(ORDER.id)!;

describe('groupOrderLines / collapseComboLines', () => {
  it('gộp dòng thành phần cùng groupNo thành một nhóm combo, Σ thành tiền = giá combo × số combo', () => {
    const groups = groupOrderLines(DETAIL.lines);
    expect(groups).toHaveLength(2);
    const combo = groups[0]!;
    expect(combo.kind).toBe('combo');
    if (combo.kind !== 'combo') throw new Error('expected combo');
    expect(combo.skuCode).toBe('CB-0001');
    expect(combo.qty).toBe('3');
    expect(combo.lines.map((l) => l.skuCode)).toEqual(['SKU-A', 'SKU-B']);
    expect(combo.lineTotal).toBe('450000.0000');
    expect(groups[1]!.kind).toBe('line');
  });

  it('tạo lại đơn: một nhóm combo → một dòng nhập với skuId của combo, qty = số combo', () => {
    expect(collapseComboLines(DETAIL.lines)).toEqual([
      { skuId: DETAIL.lines[0]!.combo!.skuId, uomId: '', qty: '3' },
      { skuId: DETAIL.lines[2]!.skuId, uomId: DETAIL.lines[2]!.uomId, qty: '1' },
    ]);
  });
});

describe('OrderDetailScreen — đơn có combo', () => {
  it('hiện một dòng tổng combo (giá combo × số combo) + dòng thành phần thụt vào', async () => {
    search = '';
    server.use(
      http.get('/api/sales-orders/:id', () => HttpResponse.json(DETAIL)),
      http.get('/api/sales-orders', () => HttpResponse.json({ items: [], total: 0 })),
    );
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    const comboRow = await screen.findByTestId('combo-row');
    expect(within(comboRow).getByText('Combo A + B')).toBeInTheDocument();
    expect(within(comboRow).getByText('Combo')).toBeInTheDocument();
    expect(within(comboRow).getByText('450.000')).toBeInTheDocument();
    const components = screen.getAllByTestId('combo-component-row');
    expect(components).toHaveLength(2);
    expect(within(components[0]!).getByText(/2 \/ combo/)).toBeInTheDocument();
    // Dòng thường không có nhãn combo
    expect(screen.getByText('Sản phẩm C')).toBeInTheDocument();
  });
});

describe('OrderCreateScreen — ?from= đơn có combo', () => {
  it('gộp hai dòng thành phần về một dòng combo; ô SKU hiện nhãn Combo + còn bán được', async () => {
    search = `from=${ORDER.id}`;
    const comboSkuId = DETAIL.lines[0]!.combo!.skuId;
    server.use(
      http.get('/api/sales-orders/:id', () => HttpResponse.json(DETAIL)),
      http.get('/api/products', () => HttpResponse.json({ items: [], total: 0 })),
      http.get('/api/stock', () => HttpResponse.json({ items: [], total: 0 })),
      http.get('/api/skus/:id', ({ params }) => {
        if (params.id === comboSkuId) {
          return HttpResponse.json({
            id: comboSkuId,
            productId: 'p-cb',
            code: 'CB-0001',
            name: 'Combo A + B',
            baseUomId: 'u-pcs',
            isActive: true,
            product: null,
            baseUom: { id: 'u-pcs', code: 'PCS', name: 'Cái', decimals: 0 },
            barcodes: [],
            uomConversions: [],
            isCombo: true,
            combo: {
              available: '12',
              components: [
                {
                  skuId: 'a',
                  code: 'SKU-A',
                  name: 'A',
                  baseUomCode: 'chai',
                  qty: '2',
                  available: '30',
                  isActive: true,
                },
                {
                  skuId: 'b',
                  code: 'SKU-B',
                  name: 'B',
                  baseUomCode: 'cái',
                  qty: '1',
                  available: '12',
                  isActive: true,
                },
              ],
            },
          });
        }
        const line = DETAIL.lines.find((l) => l.skuId === params.id);
        if (!line) return new HttpResponse(null, { status: 404 });
        return HttpResponse.json({
          id: line.skuId,
          productId: 'p-1',
          code: line.skuCode,
          name: line.skuName,
          baseUomId: line.uomId,
          isActive: true,
          product: null,
          baseUom: { id: line.uomId, code: line.uomCode, name: line.uomCode, decimals: 0 },
          barcodes: [],
          uomConversions: [],
          isCombo: false,
          combo: null,
        });
      }),
    );
    renderApp(<OrderCreateScreen />);
    await waitFor(() => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(2));
    expect(screen.getAllByLabelText('Số lượng')[0]).toHaveValue('3');
    expect(await screen.findByText('Combo')).toBeInTheDocument();
    expect(screen.getByText(/gồm 2 × SKU-A, 1 × SKU-B/)).toBeInTheDocument();
    expect(screen.getByText('Còn bán được 12 combo')).toBeInTheDocument();
  });
});
