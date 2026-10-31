import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetWarehouseSelection, WarehouseProvider } from '@/lib/warehouse';
import {
  FACEBOOK_PAGE_OPTIONS,
  ME_ADMIN,
  ME_SALE,
  makeCustomerAddresses,
  makeCustomers,
  makeOrderDetail,
  makeOrders,
} from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderCreateScreen } from './components/order-create-screen';
import {
  createOrderSchema,
  emptyOrderValues,
  normalizePhoneInput,
  previewManualDiscount,
  toCreateOrderBody,
  type CreateOrderValues,
} from './schema';

// Radix Select cần ResizeObserver + scrollIntoView — jsdom không có.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const push = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders/new',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  // Tab nháp lưu localStorage — không để rò từ test trước.
  window.localStorage.clear();
  push.mockReset();
  search = '';
});

const ORDER = makeOrders(1)[0]!;
const DETAIL = makeOrderDetail(ORDER.id)!;
const REAL_LINES = DETAIL.lines.filter((l) => !l.isGift);
const SKU = {
  id: '00000003-0000-4000-8000-0000000000aa',
  code: 'AMINO-GA3',
  name: 'Amino GA3 500ml',
};
const C1 = 'c1000000-0000-4000-8000-000000000001';
const S1 = '51000000-0000-4000-8000-000000000001';
const U1 = '41000000-0000-4000-8000-000000000001';

const CREATED = {
  orderId: 'new-order-1',
  docNumber: 'SO2610-00099',
  status: 'APPROVED',
  subtotal: '1',
  discount: '0',
  manualDiscount: '0',
  taxAmount: '0',
  shippingFee: '0',
  surcharge: '0',
  total: '1',
  prepaidAmount: '0',
  codAmount: '1',
  customerId: C1,
  lines: [],
  reservations: [],
  appliedPromotionIds: [],
  approvalRuleId: null,
};

function skuDetail(id: string, code: string, name: string, uomId = U1) {
  return {
    id,
    productId: 'p-1',
    code,
    name,
    baseUomId: uomId,
    isActive: true,
    product: null,
    baseUom: { id: uomId, code: 'PCS', name: 'Cái', decimals: 0 },
    barcodes: [],
    uomConversions: [],
    weightKg: '0.5',
    isCombo: false,
    combo: null,
  };
}

/** GET /skus/:id cho dòng đơn nguồn + SKU tìm được; /skus (ô tìm) trả đúng SKU mẫu. */
function skuHandlers() {
  return [
    http.get('/api/skus', () =>
      HttpResponse.json({
        items: [
          {
            skuId: SKU.id,
            code: SKU.code,
            name: SKU.name,
            productId: 'p-1',
            productCode: 'P1',
            productName: SKU.name,
            categoryName: null,
            brandName: null,
            baseUomId: U1,
            baseUomCode: 'PCS',
            trackingMode: 'NONE',
            barcodeCount: 0,
            isActive: true,
            isCombo: false,
            version: 1,
            thumbnailUrl: null,
            onHand: '10',
            reserved: '0',
            available: '10',
            byWarehouse: [],
          },
        ],
        total: 1,
      }),
    ),
    http.get('/api/skus/:id', ({ params }) => {
      if (params.id === SKU.id) return HttpResponse.json(skuDetail(SKU.id, SKU.code, SKU.name));
      const line = DETAIL.lines.find((l) => l.skuId === params.id);
      if (!line) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json(skuDetail(line.skuId, line.skuCode, line.skuName, line.uomId));
    }),
    http.get('/api/stock', () => HttpResponse.json({ items: [], total: 0 })),
    http.get('/api/prices/resolve', () =>
      HttpResponse.json({ priceListId: 'pl-1', listPrice: '100000', maxDiscount: '0.15' }),
    ),
  ];
}

function values(over: Partial<CreateOrderValues> = {}): CreateOrderValues {
  return {
    ...emptyOrderValues(),
    lines: [{ skuId: S1, uomId: U1, qty: '2', discountPercent: '5' }],
    ...over,
  };
}

describe('toCreateOrderBody — form → body POST /sales-orders', () => {
  it('khách mới gõ tay: gửi customer {tên, SĐT chuẩn hoá} + địa chỉ gõ tay, không gửi customerId', () => {
    const body = toCreateOrderBody(
      values({
        customerName: 'Trần Văn Hùng',
        customerPhone: '+84 912 345 678',
        customerGender: 'MALE',
        recipient: 'Trần Văn Hùng',
        recipientPhone: '0912.345.678',
        line1: 'Thôn Đông',
        ward: 'Xã Tân Lập',
        province: 'Hà Nội',
      }),
    );
    expect(body).not.toHaveProperty('customerId');
    expect(body.customer).toEqual({ name: 'Trần Văn Hùng', phone: '0912345678', gender: 'MALE' });
    expect(body.address).toEqual({
      recipient: 'Trần Văn Hùng',
      phone: '0912345678',
      line1: 'Thôn Đông',
      ward: 'Xã Tân Lập',
      province: 'Hà Nội',
    });
    expect(body.lines).toEqual([{ skuId: S1, uomId: U1, qty: '2', discountPercent: '0.05' }]);
  });

  it('khách chọn sẵn + địa chỉ đã lưu: gửi customerId + addressId, không gửi khối address', () => {
    const body = toCreateOrderBody(
      values({
        customerId: C1,
        customerName: 'A',
        addressId: 'a1',
        recipient: 'A',
        line1: 'x',
        province: 'HN',
      }),
    );
    expect(body).toMatchObject({ customerId: C1, addressId: 'a1' });
    expect(body).not.toHaveProperty('customer');
    expect(body).not.toHaveProperty('address');
  });

  it('các trường mới: nguồn, phụ thu, chuyển khoản, NV, thẻ, ghi chú, hãng, kích thước', () => {
    const body = toCreateOrderBody(
      values({
        customerId: C1,
        source: 'ZALO',
        surcharge: '10000',
        prepaidAmount: '50000',
        packerId: 'p1',
        tagIds: ['t1'],
        internalNote: '  gọi trước  ',
        printNote: 'Cho xem hàng',
        expectedDeliveryDate: '2026-10-20',
        carrierId: 'car1',
        shippingWeightKg: '1.5',
        lengthCm: '30',
        widthCm: '',
        heightCm: '10',
      }),
    );
    expect(body).toMatchObject({
      source: 'ZALO',
      surcharge: '10000',
      prepaidAmount: '50000',
      packerId: 'p1',
      tagIds: ['t1'],
      internalNote: 'gọi trước',
      printNote: 'Cho xem hàng',
      expectedDeliveryDate: '2026-10-20',
      carrierId: 'car1',
      shippingWeightKg: '1.5',
      shippingOptions: { lengthCm: 30, heightCm: 10 },
    });
    expect(body.shippingOptions).not.toHaveProperty('widthCm');
  });

  it('mục đích sử dụng + ghi chú chăm sóc (CSKH 2026-10-26): gửi khi có, bỏ khi rỗng', () => {
    expect(
      toCreateOrderBody(
        values({ customerId: C1, purposeTagIds: ['p1'], careNote: '  hẹn 05/11 ' }),
      ),
    ).toMatchObject({ purposeTagIds: ['p1'], careNote: 'hẹn 05/11' });
    const none = toCreateOrderBody(values({ customerId: C1, careNote: '   ' }));
    expect(none).not.toHaveProperty('purposeTagIds');
    expect(none).not.toHaveProperty('careNote');
  });

  it('miễn phí giao hàng → không gửi shippingFee; phụ thu / chuyển khoản 0 → bỏ field', () => {
    const body = toCreateOrderBody(
      values({
        customerId: C1,
        shippingFee: '30000',
        freeShipping: true,
        surcharge: '0',
        prepaidAmount: '',
      }),
    );
    expect(body).toMatchObject({ freeShipping: true });
    expect(body).not.toHaveProperty('shippingFee');
    expect(body).not.toHaveProperty('surcharge');
    expect(body).not.toHaveProperty('prepaidAmount');
  });

  it('giảm giá cấp đơn: số tiền gửi nguyên; "%" → tỉ lệ; 0 / rỗng → bỏ field', () => {
    const base = values({ customerId: C1 });
    expect(
      toCreateOrderBody({ ...base, manualDiscountType: 'AMOUNT', manualDiscountValue: '15000' }),
    ).toMatchObject({ manualDiscountType: 'AMOUNT', manualDiscountValue: '15000' });
    expect(
      toCreateOrderBody({ ...base, manualDiscountType: 'PERCENT', manualDiscountValue: '12.5' }),
    ).toMatchObject({ manualDiscountType: 'PERCENT', manualDiscountValue: '0.125' });
    for (const v of ['', '0']) {
      expect(
        toCreateOrderBody({ ...base, manualDiscountType: 'PERCENT', manualDiscountValue: v }),
      ).not.toHaveProperty('manualDiscountType');
    }
  });

  it('previewManualDiscount + normalizePhoneInput', () => {
    expect(previewManualDiscount('PERCENT', '10', '270000.0000')).toBe('27000.0000');
    expect(previewManualDiscount('PERCENT', '100', '270000.0000')).toBeNull();
    expect(previewManualDiscount('AMOUNT', '5000', null)).toBeNull();
    expect(normalizePhoneInput('(+84) 912-345-678')).toBe('0912345678');
    expect(normalizePhoneInput('912345678')).toBe('0912345678');
  });
});

describe('createOrderSchema — kiểm tra trước khi gọi API', () => {
  it('không chọn khách: bắt buộc tên + SĐT hợp lệ', () => {
    const r = createOrderSchema.safeParse(values({ customerName: '', customerPhone: '123' }));
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['customerName', 'customerPhone']));
  });

  it('địa chỉ gõ dở dang: thiếu người nhận / địa chỉ / tỉnh → báo đúng ô', () => {
    const r = createOrderSchema.safeParse(values({ customerId: C1, ward: 'Xã A' }));
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['recipient', 'recipientPhone', 'line1', 'province']),
    );
  });

  it('khách chọn sẵn, không gõ địa chỉ → hợp lệ', () => {
    expect(createOrderSchema.safeParse(values({ customerId: C1 })).success).toBe(true);
  });
});

describe('OrderCreateScreen — màn tạo đơn mới', () => {
  it('giỏ trống, chưa có khách → báo lỗi tại ô, KHÔNG gọi API', async () => {
    const posts: unknown[] = [];
    server.use(
      http.post('/api/sales-orders', () => {
        posts.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<OrderCreateScreen />);
    expect(await screen.findByText('Chưa có sản phẩm trong giỏ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    expect(await screen.findByText('Nhập tên khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Đơn phải có ít nhất một dòng hàng')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('tìm sản phẩm → thêm vào giỏ; quét lại đúng mã + Enter → cùng dòng +1', async () => {
    server.use(...skuHandlers());
    renderApp(<OrderCreateScreen />);
    const box = await screen.findByRole('combobox', { name: 'Tìm sản phẩm' });
    fireEvent.change(box, { target: { value: 'amino' } });
    fireEvent.click(await screen.findByRole('option', { name: /Amino GA3 500ml/ }));
    await waitFor(() => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(1));
    expect(screen.getByLabelText('Số lượng')).toHaveValue('1');

    // Máy quét: gõ mã rồi Enter ngay (chưa chờ kết quả) → khớp đúng mã → +1 vào dòng cũ.
    fireEvent.change(box, { target: { value: SKU.code } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(screen.getByLabelText('Số lượng')).toHaveValue('2'));
    expect(screen.getAllByLabelText('Số lượng')).toHaveLength(1);
  });

  it('?from= (nhân bản): banner "Nhân bản từ <mã đơn>" + tab đánh dấu bản sao; khối chốt ở cột phải', async () => {
    search = `from=${ORDER.id}`;
    server.use(...skuHandlers());
    renderApp(<OrderCreateScreen />);
    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent(`Nhân bản từ ${ORDER.docNumber}`);
    expect(note).toHaveTextContent('Không chép phí ship, phụ thu, tiền chuyển khoản');
    expect(screen.getByRole('link', { name: ORDER.docNumber })).toHaveAttribute(
      'href',
      `/crm/orders/${ORDER.id}`,
    );
    expect(
      within(screen.getByRole('tablist', { name: 'Đơn đang soạn' })).getByRole('tab', {
        selected: true,
      }),
    ).toHaveTextContent('bản sao');
    expect(screen.getByRole('region', { name: 'Chốt đơn' })).toHaveTextContent('Thu hộ (COD)');
  });

  it('?from=<đơn cũ> đổ sẵn dòng hàng (bỏ hàng tặng) → chốt gửi đúng body + Idempotency-Key, điều hướng về chi tiết', async () => {
    search = `from=${ORDER.id}`;
    const captured: Array<{ key: string | null; body: Record<string, unknown> }> = [];
    server.use(
      ...skuHandlers(),
      http.post('/api/sales-orders', async ({ request }) => {
        captured.push({
          key: request.headers.get('idempotency-key'),
          body: (await request.json()) as Record<string, unknown>,
        });
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    );
    renderApp(<OrderCreateScreen />);
    await waitFor(
      () => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
      { timeout: 3000 },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0]!.key).toMatch(/[0-9a-f-]{36}/);
    expect(captured[0]!.body).toMatchObject({
      customerId: ORDER.customer.id,
      channel: ORDER.channel,
      lines: REAL_LINES.map((l) => ({ skuId: l.skuId, uomId: l.uomId, qty: l.qty })),
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/orders/new-order-1'));
  });

  it('leader kiêm nhiệm (2 phòng CSKH của mình) → ô Phòng ghi doanh thu, chọn phòng → body careTeamId; một phòng → ẩn (2026-10-29)', async () => {
    search = `from=${ORDER.id}`;
    const bodies: Record<string, unknown>[] = [];
    server.use(
      ...skuHandlers(),
      http.get('/api/sales-orders/care-team-options', () =>
        HttpResponse.json([
          { teamId: 't-la', name: 'CSKH LA', isActive: true, mine: true },
          { teamId: 't-hero', name: 'CSKH HERO', isActive: true, mine: true },
          { teamId: 't-khac', name: 'CSKH khác', isActive: true, mine: false },
        ]),
      ),
      http.post('/api/sales-orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    );
    const { unmount } = renderApp(<OrderCreateScreen />);
    await waitFor(
      () => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
      { timeout: 3000 },
    );
    const box = await screen.findByRole('combobox', { name: 'Phòng ghi doanh thu' });
    expect(box).toHaveTextContent('Phòng gốc của bạn');
    fireEvent.click(box);
    expect(screen.queryByRole('option', { name: 'CSKH khác' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('option', { name: 'CSKH HERO' }));
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ careTeamId: 't-hero' });
    unmount();

    server.use(
      http.get('/api/sales-orders/care-team-options', () =>
        HttpResponse.json([{ teamId: 't-la', name: 'CSKH LA', isActive: true, mine: true }]),
      ),
    );
    renderApp(<OrderCreateScreen />);
    await waitFor(
      () => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
      { timeout: 3000 },
    );
    expect(screen.queryByRole('combobox', { name: 'Phòng ghi doanh thu' })).not.toBeInTheDocument();
  });

  it('?from=: địa chỉ mặc định của khách tự điền vào phần Nhận hàng và gửi addressId', async () => {
    search = `from=${ORDER.id}`;
    const addrs = makeCustomerAddresses(ORDER.customer.id);
    const bodies: Record<string, unknown>[] = [];
    server.use(
      ...skuHandlers(),
      http.post('/api/sales-orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    );
    renderApp(<OrderCreateScreen />);
    const recipient = await screen.findByLabelText('Tên người nhận');
    await waitFor(() => expect(recipient).toHaveValue(addrs.find((a) => a.isDefault)!.recipient));
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ addressId: addrs.find((a) => a.isDefault)!.id });
    expect(bodies[0]).not.toHaveProperty('address');
  });

  it('xem trước tiền: tạo lại đơn KHÔNG mang phí ship / phụ thu đơn cũ; Tiền cần thu trừ chuyển khoản', async () => {
    search = `from=${ORDER.id}`;
    server.use(
      ...skuHandlers(),
      http.get('/api/prices/resolve', () =>
        HttpResponse.json({ priceListId: 'pl-1', listPrice: '100000', maxDiscount: '0.15' }),
      ),
    );
    renderApp(<OrderCreateScreen />);
    await waitFor(() =>
      expect(screen.getAllByLabelText('Số lượng')[0]).toHaveValue(REAL_LINES[0]!.qty),
    );
    const vnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
    // Dòng đã giảm / sửa giá trên đơn cũ mang nguyên đơn giá sang; còn lại theo giá tra (100.000).
    const subtotal = REAL_LINES.reduce(
      (acc, l) =>
        acc + Number(l.qty) * (l.unitPrice !== l.listPrice ? Number(l.unitPrice) : 100_000),
      0,
    );
    // Tạo lại đơn không mang phí vận chuyển / phụ thu của đơn cũ (2026-10-21).
    expect(Number(DETAIL.shippingFee)).toBeGreaterThan(0);
    const ship = 0;
    await waitFor(() =>
      expect(screen.getAllByText(new RegExp(vnd(subtotal + ship))).length).toBeGreaterThan(0),
    );
    fireEvent.change(screen.getByLabelText('Tiền chuyển khoản'), { target: { value: '100000' } });
    fireEvent.blur(screen.getByLabelText('Tiền chuyển khoản'));
    await waitFor(() =>
      expect(
        screen.getAllByText(new RegExp(vnd(subtotal + ship - 100_000))).length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getAllByText('Đã chuyển khoản').length).toBeGreaterThan(0);
  });

  it('ô SĐT đứng trước tên khách; khối Chốt đơn có phí ship + chuyển khoản, không Giảm giá / Phụ thu / Mã KM / Kích thước', async () => {
    server.use(...skuHandlers());
    renderApp(<OrderCreateScreen />);
    const phone = await screen.findByLabelText('Số điện thoại khách');
    const name = screen.getByLabelText('Tên khách hàng');
    expect(phone.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Thiết kế redesign 2026-10-22: phí ship + chuyển khoản nằm trong khối Chốt đơn.
    expect(screen.getByLabelText('Phí ship thu khách')).toBeInTheDocument();
    expect(screen.getByLabelText('Tiền chuyển khoản')).toBeInTheDocument();
    expect(screen.queryByText('Kích thước')).not.toBeInTheDocument();
    for (const label of ['Phụ thu', 'Mã khuyến mãi', 'Dài (cm)']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Giảm giá')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tùy chọn giá trị đơn' })).not.toBeInTheDocument();
  });

  it('đơn giá hiện khi chưa chọn khách (giá sản phẩm), không còn ô CK %; sửa đơn giá / gõ thành tiền → gửi unitPrice; dưới trần CK báo cần duyệt', async () => {
    const bodies: Record<string, unknown>[] = [];
    const priceQueries: string[] = [];
    server.use(
      http.get('/api/prices/resolve', ({ request }) => {
        priceQueries.push(new URL(request.url).search);
        return HttpResponse.json({ priceListId: 'pl-1', listPrice: '100000', maxDiscount: '0.1' });
      }),
      ...skuHandlers(),
      http.post('/api/sales-orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    );
    renderApp(<OrderCreateScreen />);
    const box = await screen.findByRole('combobox', { name: 'Tìm sản phẩm' });
    fireEvent.change(box, { target: { value: 'amino' } });
    fireEvent.click(await screen.findByRole('option', { name: /Amino GA3 500ml/ }));
    const price = await screen.findByLabelText('Đơn giá');
    await waitFor(() => expect(price).toHaveValue('100.000'));
    expect(priceQueries.length).toBeGreaterThan(0);
    expect(priceQueries.every((q) => !q.includes('customerId'))).toBe(true);
    expect(screen.queryByLabelText('Chiết khấu %')).not.toBeInTheDocument();
    expect(screen.queryByText('chọn khách')).not.toBeInTheDocument();

    // SL 2, gõ thành tiền 170.000 → đơn giá 85.000 (dưới trần 90.000 — 2026-10-29 không còn duyệt).
    fireEvent.change(screen.getByLabelText('Số lượng'), { target: { value: '2' } });
    const total = screen.getByLabelText('Thành tiền');
    fireEvent.focus(total);
    fireEvent.change(total, { target: { value: '170000' } });
    fireEvent.blur(total);
    await waitFor(() => expect(screen.getByLabelText('Đơn giá')).toHaveValue('85.000'));
    expect(await screen.findByText(/Niêm yết 100\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/đơn cần duyệt/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Số điện thoại khách'), {
      target: { value: '0912000111' },
    });
    fireEvent.change(screen.getByLabelText('Tên khách hàng'), { target: { value: 'Khách lẻ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.lines).toEqual([
      expect.objectContaining({ skuId: SKU.id, qty: '2', unitPrice: '85000' }),
    ]);
  }, 15_000);

  it('Nguồn · POS · Page là ba ô độc lập, không bắt buộc (2026-10-26); NV đóng hàng / NV chăm sóc / Marketer ẩn', async () => {
    server.use(...skuHandlers());
    renderApp(<OrderCreateScreen />);
    await screen.findByLabelText('Số điện thoại khách');
    expect(screen.queryByText('NV đóng hàng')).not.toBeInTheDocument();
    expect(screen.queryByText('NV chăm sóc')).not.toBeInTheDocument();
    expect(screen.queryByText('Marketer')).not.toBeInTheDocument();
    // Chưa chọn nguồn vẫn có ô POS + Page.
    expect(screen.getByRole('combobox', { name: 'POS' })).toHaveTextContent('Không chọn POS');
    expect(screen.getByRole('combobox', { name: 'Page Facebook' })).toHaveTextContent(
      'Không chọn page',
    );
    const base = {
      ...emptyOrderValues(),
      customerId: '61000000-0000-4000-8000-000000000001',
      lines: [{ skuId: S1, uomId: U1, qty: '1' }],
    };
    // Nguồn khác Facebook vẫn gửi POS / page; không chọn thì không gửi.
    expect(
      toCreateOrderBody({
        ...base,
        source: 'ZALO',
        posShopId: '715130909',
        facebookPageId: FACEBOOK_PAGE_OPTIONS[0]!.id,
      }),
    ).toMatchObject({
      source: 'ZALO',
      posShopId: '715130909',
      facebookPageId: FACEBOOK_PAGE_OPTIONS[0]!.id,
    });
    const bare = toCreateOrderBody(base);
    expect(bare).not.toHaveProperty('source');
    expect(bare).not.toHaveProperty('posShopId');
    expect(bare).not.toHaveProperty('facebookPageId');
  });

  it('gõ đủ địa chỉ → gợi ý "Đắk Nông, Huyện Tuy Đức, Xã Quảng Tân"; bấm điền Xã / Huyện / Tỉnh, dòng địa chỉ còn phần còn lại (2026-10-26)', async () => {
    const asked: string[] = [];
    server.use(
      ...skuHandlers(),
      http.get('/api/geo/suggest', ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('q') ?? '');
        const q = new URL(request.url).searchParams.get('q') ?? '';
        return HttpResponse.json({
          ready: true,
          items: q.includes('Quảng Tân')
            ? [
                {
                  generation: 'OLD',
                  province: 'Đắk Nông',
                  district: 'Huyện Tuy Đức',
                  ward: 'Xã Quảng Tân',
                  label: 'Đắk Nông, Huyện Tuy Đức, Xã Quảng Tân',
                  line1: '0332119579',
                },
              ]
            : [],
        });
      }),
    );
    renderApp(<OrderCreateScreen />);
    const line1 = await screen.findByLabelText('Địa chỉ chi tiết (số nhà, đường, thôn/xóm)');
    fireEvent.change(line1, {
      target: { value: '0332119579, Xã Quảng Tân, Huyện Tuy Đức, Đắk Nông' },
    });
    const pick = await screen.findByRole('button', {
      name: /Đắk Nông, Huyện Tuy Đức, Xã Quảng Tân/,
    });
    expect(pick).toHaveTextContent('Địa giới cũ');
    fireEvent.click(pick);
    expect(screen.getByLabelText('Phường / Xã')).toHaveValue('Xã Quảng Tân');
    expect(screen.getByLabelText('Quận / Huyện (cũ)')).toHaveValue('Huyện Tuy Đức');
    expect(screen.getByLabelText('Tỉnh / Thành phố')).toHaveValue('Đắk Nông');
    expect(line1).toHaveValue('0332119579');
    // Đã điền khớp → gợi ý ẩn.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /Đắk Nông, Huyện Tuy Đức, Xã Quảng Tân/ }),
      ).not.toBeInTheDocument(),
    );
    expect(asked.every((q) => q.length >= 6)).toBe(true);
  });

  it('ô Page: page ngưng ẩn; chọn page một POS khi ô POS trống → tự điền POS; có POS thì "Page của POS này" lên trước', async () => {
    server.use(...skuHandlers());
    renderApp(<OrderCreateScreen />);
    await screen.findByLabelText('Số điện thoại khách');
    const pageBox = screen.getByRole('combobox', { name: 'Page Facebook' });
    fireEvent.click(pageBox);
    await screen.findByRole('option', { name: /Đất Phương Nam - CS4/ });
    expect(
      screen.queryByRole('option', { name: /Vật Tư Nông Nghiệp CS3/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Page của POS này')).not.toBeInTheDocument();
    // Page 2 POS → không tự điền POS.
    fireEvent.click(screen.getByRole('option', { name: /Shop Chính Hãng Cô Hai/ }));
    expect(pageBox).toHaveTextContent('Shop Chính Hãng Cô Hai');
    expect(screen.getByRole('combobox', { name: 'POS' })).toHaveTextContent('Không chọn POS');
    // Page 1 POS → POS tự điền, hiện tên POS.
    fireEvent.click(pageBox);
    fireEvent.click(await screen.findByRole('option', { name: /Đất Phương Nam - CS4/ }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'POS' })).toHaveTextContent('Thiên Nông chính'),
    );
    // Đã có POS → nhóm page của POS lên trước.
    fireEvent.click(pageBox);
    expect(await screen.findByText('Page của POS này')).toBeInTheDocument();
    expect(screen.getByText('Page khác')).toBeInTheDocument();
    const names = screen.getAllByRole('option').map((o) => o.textContent ?? '');
    expect(names.findIndex((n) => n.includes('Đất Phương Nam'))).toBeLessThan(
      names.findIndex((n) => n.includes('Nông Lâm Phương Nam')),
    );
  });

  it('gõ SĐT trùng khách cũ → chưa tự gắn; bấm "Chọn khách này" → gắn khách + điền địa chỉ mặc định xuống Nhận hàng, chốt gửi customerId', async () => {
    const CUST = makeCustomers(1)[0]!;
    const bodies: Record<string, unknown>[] = [];
    server.use(
      ...skuHandlers(),
      http.post('/api/sales-orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    );
    renderApp(<OrderCreateScreen />);
    fireEvent.change(await screen.findByLabelText('Số điện thoại khách'), {
      target: { value: CUST.phone },
    });
    // Người nhận đã gõ dở — chọn khách thì ghi đè bằng địa chỉ của khách.
    fireEvent.change(screen.getByLabelText('Tên người nhận'), { target: { value: 'Gõ tay' } });
    const pick = await screen.findByRole('button', { name: 'Chọn khách này' });
    expect(screen.queryByText('Khách cũ')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tên khách hàng')).toHaveValue('');
    fireEvent.click(pick);
    expect(await screen.findByText('Khách cũ')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Tên khách hàng')).toHaveValue(CUST.name));
    await waitFor(() =>
      expect(screen.getByLabelText('Tên người nhận')).toHaveValue('Nguyễn Thị Thu Hà'),
    );
    expect(screen.getByRole('textbox', { name: 'Số điện thoại' })).toHaveValue('0903112233');
    expect(screen.getByLabelText('Địa chỉ chi tiết (số nhà, đường, thôn/xóm)')).toHaveValue(
      '12 Lê Thanh Nghị',
    );

    const box = screen.getByRole('combobox', { name: 'Tìm sản phẩm' });
    fireEvent.change(box, { target: { value: 'amino' } });
    fireEvent.click(await screen.findByRole('option', { name: /Amino GA3 500ml/ }));
    await waitFor(() => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ customerId: CUST.id });
  });

  it('gõ dở SĐT → gợi ý khách mình thấy (2026-10-29); chọn → gắn khách + Nhận hàng = địa chỉ đơn mua gần nhất (không phải mặc định)', async () => {
    const CUST = makeCustomers(1)[0]!;
    const queries: string[] = [];
    server.use(
      http.get('/api/customers', ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json({ items: [CUST], total: 1 });
      }),
      http.get(`/api/customers/${CUST.id}`, () =>
        HttpResponse.json({
          ...CUST,
          addresses: makeCustomerAddresses(CUST.id),
          mergedInto: null,
          // Đơn gần nhất giao về địa chỉ thứ hai (không mặc định).
          lastOrderAddressId: '00000077-0000-4000-8000-000000000002',
        }),
      ),
    );
    renderApp(<OrderCreateScreen />);
    const phoneBox = await screen.findByLabelText('Số điện thoại khách');
    // 3 số: chưa gợi ý.
    fireEvent.change(phoneBox, { target: { value: CUST.phone!.slice(0, 3) } });
    await new Promise((r) => setTimeout(r, 350));
    expect(screen.queryByRole('listbox', { name: 'Khách có SĐT khớp' })).not.toBeInTheDocument();

    const typed = CUST.phone!.slice(0, 6);
    fireEvent.change(phoneBox, { target: { value: typed } });
    const list = await screen.findByRole('listbox', { name: 'Khách có SĐT khớp' });
    expect(queries).toContain(typed);
    const option = within(list).getByRole('option', { name: new RegExp(CUST.name) });
    // Bàn phím: ↓ chọn dòng đầu, Enter gắn.
    fireEvent.keyDown(phoneBox, { key: 'ArrowDown' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(phoneBox, { key: 'Enter' });

    expect(await screen.findByText('Khách cũ')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên khách hàng')).toHaveValue(CUST.name);
    expect(phoneBox).toHaveValue(CUST.phone);
    expect(screen.queryByRole('listbox', { name: 'Khách có SĐT khớp' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('Tên người nhận')).toHaveValue('Trần Văn Bình'),
    );
    expect(screen.getByLabelText('Địa chỉ chi tiết (số nhà, đường, thôn/xóm)')).toHaveValue(
      'Thôn 3, Xóm Đông',
    );
  });

  it('thẻ Chăm sóc khách: mục đích khách đã có bật sẵn (khóa), bấm thêm mục đích + ghi chú → chốt gửi purposeTagIds + careNote', async () => {
    const CUST = makeCustomers(1)[0]!;
    const DURIAN = '00000000-0000-4000-8000-0000000000d1';
    const COFFEE = '00000000-0000-4000-8000-0000000000d2';
    const bodies: Record<string, unknown>[] = [];
    server.use(
      ...skuHandlers(),
      http.get('/api/customer-purposes', () =>
        HttpResponse.json([
          { id: DURIAN, name: 'Sầu riêng', color: null, customerCount: 3 },
          { id: COFFEE, name: 'Cà phê', color: null, customerCount: 1 },
        ]),
      ),
      http.get(`/api/customer-care/customers/${CUST.id}/purposes`, () =>
        HttpResponse.json([
          {
            id: DURIAN,
            name: 'Sầu riêng',
            taggedAt: '2026-10-25T09:20:00.000Z',
            taggedById: 'u1',
            taggedByName: 'Ngọc',
          },
        ]),
      ),
      http.get(`/api/customer-care/customers/${CUST.id}/notes`, () =>
        HttpResponse.json({
          total: 1,
          items: [
            {
              id: 'n1',
              customerId: CUST.id,
              orderId: null,
              orderCode: null,
              body: 'Vườn 3ha sầu riêng Ri6',
              authorId: 'u1',
              authorName: 'Ngọc',
              authorDepartment: 'CSKH LA',
              mine: false,
              createdAt: '2026-10-25T09:20:00.000Z',
              editedAt: null,
            },
          ],
        }),
      ),
      http.post('/api/sales-orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    );
    renderApp(<OrderCreateScreen />);
    fireEvent.change(await screen.findByLabelText('Số điện thoại khách'), {
      target: { value: CUST.phone },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Chọn khách này' }));
    expect(await screen.findByText('Vườn 3ha sầu riêng Ri6')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Sầu riêng', pressed: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cà phê' }));
    fireEvent.change(screen.getByLabelText('Ghi chú chăm sóc lần này'), {
      target: { value: 'Hẹn gọi lại 05/11' },
    });

    const box = screen.getByRole('combobox', { name: 'Tìm sản phẩm' });
    fireEvent.change(box, { target: { value: 'amino' } });
    fireEvent.click(await screen.findByRole('option', { name: /Amino GA3 500ml/ }));
    await waitFor(() => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      customerId: CUST.id,
      purposeTagIds: [COFFEE],
      careNote: 'Hẹn gọi lại 05/11',
    });
  });

  it('đơn trùng trong ngày: thẻ khách nhắc; Chốt đơn mở hộp cảnh báo — Quay lại sửa không gửi, Vẫn tạo đơn mới gửi', async () => {
    search = `from=${ORDER.id}`;
    const posts: Array<string | null> = [];
    const sameDayPhones: string[] = [];
    server.use(
      ...skuHandlers(),
      http.get('/api/sales-orders/same-day', ({ request }) => {
        sameDayPhones.push(new URL(request.url).searchParams.get('phone') ?? '');
        return HttpResponse.json({
          day: '2026-10-21',
          total: 3,
          hiddenCount: 1,
          orders: [
            {
              id: 'so-dup-1',
              docNumber: 'DH2610-01234',
              orderDate: '2026-10-21T01:12:00.000Z',
              status: 'APPROVED',
              total: '380000',
              ownerName: 'Lê Thị Mai',
              source: 'PANCAKE',
            },
            {
              id: 'so-dup-2',
              docNumber: 'DH2610-01251',
              orderDate: '2026-10-21T03:47:00.000Z',
              status: 'PENDING_APPROVAL',
              total: '520000',
              ownerName: null,
              source: 'ERP',
            },
          ],
        });
      }),
      http.post('/api/sales-orders', ({ request }) => {
        posts.push(request.headers.get('idempotency-key'));
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    );
    renderApp(<OrderCreateScreen />);
    expect(await screen.findByText('Khách đã có 3 đơn hôm nay')).toBeInTheDocument();
    expect(sameDayPhones.at(-1)).toMatch(/^0\d{9,10}$/);
    await waitFor(() =>
      expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Khách này đã có 3 đơn hôm nay' });
    expect(within(dialog).getByText('DH2610-01234')).toBeInTheDocument();
    expect(within(dialog).getByText('Pancake')).toBeInTheDocument();
    expect(within(dialog).getByText(/Và 1 đơn của team khác/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại sửa' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    const again = await screen.findByRole('dialog', { name: 'Khách này đã có 3 đơn hôm nay' });
    fireEvent.click(within(again).getByRole('button', { name: 'Vẫn tạo đơn' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatch(/[0-9a-f-]{36}/);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/orders/new-order-1'));
  });

  it('CSKH gõ SĐT khách của team khác: hiện "Khách team khác", điền tên + địa chỉ, chốt gửi theo SĐT (không customerId)', async () => {
    const bodies: Record<string, unknown>[] = [];
    const lookups: string[] = [];
    server.use(
      ...skuHandlers(),
      http.get('/api/customer-care/lookup', ({ request }) => {
        lookups.push(new URL(request.url).searchParams.get('phone') ?? '');
        return HttpResponse.json({
          customer: {
            id: 'cust-other',
            code: 'KH024811',
            name: 'Trần Văn Hùng',
            phone: '0909888777',
            address: {
              recipient: 'Trần Văn Hùng',
              phone: '0909888777',
              line1: 'Thôn Đông',
              hamlet: null,
              ward: 'Xã Tân Lập',
              district: null,
              province: 'Hà Nội',
            },
          },
          careTeam: 'OTHER',
        });
      }),
      http.post('/api/sales-orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    );
    renderApp(<OrderCreateScreen />, {
      me: { ...ME_SALE, permissions: [...ME_SALE.permissions, 'customer.care'] },
    });
    fireEvent.change(await screen.findByLabelText('Số điện thoại khách'), {
      target: { value: '0909 888 777' },
    });
    expect(await screen.findByText('Khách team khác')).toBeInTheDocument();
    expect(screen.getByText(/Đơn này tính doanh thu cho bạn và team bạn/)).toBeInTheDocument();
    expect(lookups).toContain('0909888777');
    expect(screen.getByLabelText('Tên khách hàng')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Chọn khách này' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Tên khách hàng')).toHaveValue('Trần Văn Hùng'),
    );
    expect(screen.getByLabelText('Tên người nhận')).toHaveValue('Trần Văn Hùng');

    const box = screen.getByRole('combobox', { name: 'Tìm sản phẩm' });
    fireEvent.change(box, { target: { value: 'amino' } });
    fireEvent.click(await screen.findByRole('option', { name: /Amino GA3 500ml/ }));
    await waitFor(() => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('customerId');
    expect(bodies[0]).toMatchObject({
      customer: { name: 'Trần Văn Hùng', phone: '0909888777' },
    });
  });

  it('sale (không customer.care) cũng tra SĐT toàn hệ thống: khách người khác → "Khách đã có", không tạo trùng', async () => {
    const lookups: string[] = [];
    server.use(
      http.get('/api/customer-care/lookup', () => {
        lookups.push('x');
        return HttpResponse.json({
          customer: {
            id: 'cust-other',
            code: 'KH024811',
            name: 'Trần Văn Hùng',
            phone: '0909888777',
            address: null,
          },
          careTeam: 'NONE',
        });
      }),
    );
    renderApp(<OrderCreateScreen />, { me: ME_SALE });
    fireEvent.change(await screen.findByLabelText('Số điện thoại khách'), {
      target: { value: '0909888777' },
    });
    expect(await screen.findByText('Khách đã có')).toBeInTheDocument();
    expect(screen.getByText(/Đơn này tính doanh thu cho bạn và team bạn/)).toBeInTheDocument();
    expect(screen.queryByText(/Khách mới — sẽ tạo hồ sơ khách/)).not.toBeInTheDocument();
    expect(lookups.length).toBeGreaterThan(0);
  });

  it('SĐT chưa có trên hệ thống → "Khách mới"', async () => {
    server.use(
      http.get('/api/customer-care/lookup', () =>
        HttpResponse.json({ customer: null, careTeam: null }),
      ),
    );
    renderApp(<OrderCreateScreen />, { me: ME_SALE });
    fireEvent.change(await screen.findByLabelText('Số điện thoại khách'), {
      target: { value: '0909888777' },
    });
    expect(await screen.findByText(/Khách mới — sẽ tạo hồ sơ khách/)).toBeInTheDocument();
    // SĐT khách mới chép xuống SĐT người nhận; sửa SĐT khách thì người nhận đi theo.
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Số điện thoại' })).toHaveValue('0909888777'),
    );
    fireEvent.change(screen.getByLabelText('Số điện thoại khách'), {
      target: { value: '0909888666' },
    });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Số điện thoại' })).toHaveValue('0909888666'),
    );
  });

  it('khách mới: người nhận đã gõ SĐT khác thì không bị ghi đè', async () => {
    renderApp(<OrderCreateScreen />, { me: ME_SALE });
    fireEvent.change(await screen.findByRole('textbox', { name: 'Số điện thoại' }), {
      target: { value: '0911222333' },
    });
    fireEvent.change(screen.getByLabelText('Số điện thoại khách'), {
      target: { value: '0909888777' },
    });
    expect(await screen.findByText(/Khách mới — sẽ tạo hồ sơ khách/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Số điện thoại' })).toHaveValue('0911222333');
  });

  it('thẻ Nhận hàng nằm trên thẻ Chăm sóc khách', async () => {
    renderApp(<OrderCreateScreen />, { me: ME_SALE });
    const receiver = await screen.findByText('Nhận hàng');
    const care = screen.getByText('Chăm sóc khách');
    expect(receiver.compareDocumentPosition(care) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('server báo chuyển khoản vượt tổng (422 path prepaidAmount) → lỗi gắn đúng ô', async () => {
    search = `from=${ORDER.id}`;
    server.use(
      ...skuHandlers(),
      http.post('/api/sales-orders', () =>
        HttpResponse.json(
          {
            statusCode: 422,
            code: 'VALIDATION',
            message: 'x',
            details: { path: 'prepaidAmount' },
            traceId: 't',
          },
          { status: 422 },
        ),
      ),
    );
    renderApp(<OrderCreateScreen />);
    await waitFor(
      () => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
      { timeout: 3000 },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    expect((await screen.findAllByText('Tiền chuyển khoản vượt tổng đơn')).length).toBeGreaterThan(
      0,
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('tab nháp: F6 mở tab mới; tab đặt tên theo khách; nháp còn sau khi mở lại màn', async () => {
    const view = renderApp(<OrderCreateScreen />);
    fireEvent.change(await screen.findByLabelText('Tên khách hàng'), {
      target: { value: 'Chị Lan' },
    });
    await waitFor(() => expect(screen.getByRole('tab', { name: /Chị Lan/ })).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'F6' });
    expect(
      await screen.findByRole('tab', { name: 'Đơn mới 2', selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Tên khách hàng')).toHaveValue('');

    view.unmount();
    renderApp(<OrderCreateScreen />);
    const tabs = await screen.findByRole('tablist', { name: 'Đơn đang soạn' });
    await waitFor(() =>
      expect(within(tabs).getByRole('tab', { name: /Chị Lan/ })).toBeInTheDocument(),
    );
    fireEvent.click(within(tabs).getByRole('tab', { name: /Chị Lan/ }));
    await waitFor(() => expect(screen.getByLabelText('Tên khách hàng')).toHaveValue('Chị Lan'));
  });

  it('tệp đính kèm: chốt xong tải từng tệp lên POST /sales-orders/:id/attachments', async () => {
    search = `from=${ORDER.id}`;
    const uploads: string[] = [];
    server.use(
      ...skuHandlers(),
      http.post('/api/sales-orders', () => HttpResponse.json(CREATED, { status: 201 })),
      http.post('/api/sales-orders/:id/attachments', ({ params }) => {
        uploads.push(String(params.id));
        return HttpResponse.json(
          {
            id: 'att-1',
            fileName: 'a.png',
            contentType: 'image/png',
            sizeBytes: 3,
            url: 'https://s3/a.png',
            uploadedBy: 'u',
            createdAt: '2026-10-17T00:00:00Z',
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<OrderCreateScreen />);
    await waitFor(
      () => expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
      { timeout: 3000 },
    );
    const file = new File(['abc'], 'a.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Chọn tệp đính kèm'), { target: { files: [file] } });
    expect(await screen.findByRole('button', { name: 'Bỏ tệp a.png' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Chốt đơn F10/ }));
    await waitFor(() => expect(uploads).toEqual(['new-order-1']));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/orders/new-order-1'));
  });

  it('ô Kho xuất: đang "Tất cả kho" (mặc định sau đăng nhập) → kho mặc định của tài khoản', async () => {
    renderApp(
      <WarehouseProvider
        me={{
          ...ME_ADMIN,
          managesDepartments: false,
          managesCareTeam: false,
          warehouseIds: ['wh-tt', 'wh-la'],
          warehouses: [
            { id: 'wh-tt', code: 'KHO-TT-01', name: 'Kho Thạch Thất' },
            { id: 'wh-la', code: 'KHO-LA-01', name: 'Kho Long An' },
          ],
          defaultWarehouseId: 'wh-la',
          defaultPosShopId: null,
          selectedWarehouseId: null,
        }}
      >
        <OrderCreateScreen />
      </WarehouseProvider>,
    );
    expect(await screen.findByRole('combobox', { name: 'Kho xuất' })).toHaveTextContent(
      'Kho Long An',
    );
    forgetWarehouseSelection(); // store kho là module-level — không để rò sang test sau
  });

  it('ô tìm sản phẩm / combo chỉ xin hàng tạo trong ERP (erpOnly=true, 2026-10-29) — bỏ SKU đồng bộ Pancake tự sinh', async () => {
    const urls: URL[] = [];
    server.use(
      http.get('/api/skus', ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderApp(<OrderCreateScreen />);
    const box = await screen.findByRole('combobox', { name: 'Tìm sản phẩm' });
    fireEvent.change(box, { target: { value: 'amino' } });
    await waitFor(() => expect(urls).toHaveLength(1));
    fireEvent.click(screen.getByRole('tab', { name: 'Combo' }));
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls.map((u) => u.searchParams.get('erpOnly'))).toEqual(['true', 'true']);
    expect(urls.map((u) => u.searchParams.get('isCombo'))).toEqual(['false', 'true']);
  });

  it('khả dụng trên dòng giỏ tính theo Kho xuất (2026-10-29): GET /stock kèm warehouseId; kho không có hàng → báo đỏ', async () => {
    const stockCalls: (string | null)[] = [];
    server.use(
      // Đứng trước skuHandlers() — MSW lấy handler khớp đầu tiên.
      http.get('/api/stock', ({ request }) => {
        const wh = new URL(request.url).searchParams.get('warehouseId');
        stockCalls.push(wh);
        const row = {
          skuId: SKU.id,
          skuCode: SKU.code,
          skuName: SKU.name,
          baseUomId: U1,
          baseUomCode: 'PCS',
          isActive: true,
          onHand: '7',
          reserved: '0',
          available: '7',
          hasCost: true,
          unitCost: null,
          weightKg: '0.5',
        };
        // Kho Long An có 7; Kho Thạch Thất không có dòng tồn nào.
        return HttpResponse.json(
          wh === 'wh-la' ? { items: [row], total: 1 } : { items: [], total: 0 },
        );
      }),
      ...skuHandlers(),
    );
    renderApp(
      <WarehouseProvider
        me={{
          ...ME_ADMIN,
          managesDepartments: false,
          managesCareTeam: false,
          warehouseIds: ['wh-tt', 'wh-la'],
          warehouses: [
            { id: 'wh-tt', code: 'KHO-TT-01', name: 'Kho Thạch Thất' },
            { id: 'wh-la', code: 'KHO-LA-01', name: 'Kho Long An' },
          ],
          defaultWarehouseId: 'wh-la',
          defaultPosShopId: null,
          selectedWarehouseId: null,
        }}
      >
        <OrderCreateScreen />
      </WarehouseProvider>,
    );
    const box = await screen.findByRole('combobox', { name: 'Tìm sản phẩm' });
    fireEvent.change(box, { target: { value: 'amino' } });
    fireEvent.click(await screen.findByRole('option', { name: /Amino GA3 500ml/ }));
    expect(await screen.findByText('Khả dụng 7 PCS')).toBeInTheDocument();
    expect(stockCalls).toContain('wh-la');

    fireEvent.click(screen.getByRole('combobox', { name: 'Kho xuất' }));
    fireEvent.click(await screen.findByRole('option', { name: /Kho Thạch Thất/ }));
    expect(await screen.findByText('Kho xuất chưa có hàng')).toBeInTheDocument();
    expect(stockCalls).toContain('wh-tt');
    forgetWarehouseSelection();
  });

  it('ô NV xử lý chỉ liệt kê nhân viên cùng team (GET /sales-orders/owner-options), không lấy danh sách mọi nhân viên', async () => {
    renderApp(<OrderCreateScreen />);
    fireEvent.click(await screen.findByRole('combobox', { name: 'NV xử lý' }));
    expect(await screen.findByRole('option', { name: /Nguyễn Văn Sale/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Trần Thị Đóng/ })).not.toBeInTheDocument();
  });

  it('ô ĐVVC chỉ liệt kê hãng đang bật và đã cấu hình (ẩn GHN chưa cấu hình, hãng đã tắt)', async () => {
    renderApp(<OrderCreateScreen />);
    const picker = await screen.findByRole('combobox', { name: 'Đơn vị vận chuyển' });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.click(picker);
    const names = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(names).toEqual([
      'Chưa chọn ĐVVC',
      'Giao thủ công (xe nhà / khách tự lấy)',
      'GHTK Giao Hàng Tiết Kiệm',
      'VTP Viettel Post',
    ]);
  });

  it('sale / CSKH không có send_carrier → không có ô ĐVVC, chỉ "Kho chọn khi gửi hàng" (2026-10-31)', async () => {
    renderApp(<OrderCreateScreen />, { me: ME_SALE });
    expect(await screen.findByText('Kho chọn khi gửi hàng')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Đơn vị vận chuyển' })).not.toBeInTheDocument();
  });
});
