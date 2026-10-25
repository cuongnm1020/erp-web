import { http, HttpResponse, delay } from 'msw';

/**
 * Handler MSW dùng chung cho Storybook + Vitest. Đường dẫn là /api/* (proxy Next) — giống
 * browser thật. Dữ liệu mẫu tối thiểu; story/test override bằng `parameters.msw` / server.use().
 */
export const ME_ADMIN = {
  userId: 'u-admin',
  code: 'admin',
  roles: ['ADMIN'],
  permissions: [],
  leaderTeamIds: [],
  careTeamIds: [],
  hasGlobalAccess: true,
  mustChangePassword: false,
};

export const ME_SALE = {
  userId: 'u-sale',
  code: 'sale.hn.1',
  roles: ['SALES_MEMBER'],
  permissions: ['customer.read', 'customer.create', 'sales_order.read', 'sales_order.create'],
  leaderTeamIds: [],
  careTeamIds: [],
  hasGlobalAccess: false,
  mustChangePassword: false,
};

const CUSTOMER_TYPES = ['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'KEY_ACCOUNT'] as const;

/** Đúng shape `CustomerOrderItemDto` (CRM-05) — 25 đơn mới nhất trước; đơn chưa duyệt / hủy netRevenue null. */
const CUSTOMER_ORDER_STATUSES = [
  'POSTED',
  'APPROVED',
  'PENDING_APPROVAL',
  'DRAFT',
  'CANCELLED',
] as const;
export function makeCustomerOrders(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const status = CUSTOMER_ORDER_STATUSES[i % CUSTOMER_ORDER_STATUSES.length]!;
    const booked = status === 'POSTED' || status === 'APPROVED';
    return {
      id: `so-${String(i + 1).padStart(4, '0')}`,
      code: `SO-${String(2600 - i)}`,
      orderDate: new Date(Date.UTC(2026, 8, 30 - i, 3)).toISOString(),
      status,
      channel: i % 3 === 0 ? ('MARKETPLACE' as const) : ('DIRECT' as const),
      total: `${1_250_000 + i * 10_000}.0000`,
      netRevenue: booked ? `${1_100_000 + i * 10_000}.0000` : null,
      returnedRevenue: booked ? (i === 0 ? '150000.0000' : '0.0000') : null,
      itemCount: (i % 4) + 1,
      owner: i % 2 === 0 ? { id: 'u-sale', name: 'Trần Thị Sale' } : null,
    };
  });
}

/** Đúng shape `CustomerSalesStatsDto` (CRM-05). */
export const CUSTOMER_STATS = {
  orderCount: 10,
  revenue: '12345000.0000',
  aov: '1234500.0000',
  firstOrderAt: '2026-01-15T03:00:00.000Z',
  lastOrderAt: '2026-09-30T03:00:00.000Z',
  returnedRevenue: '150000.0000',
  returnedOrderCount: 1,
  returnRate: '10.00',
  topSkus: [
    {
      skuId: 'sku-1',
      skuCode: 'PB-NPK-25',
      name: 'Phân bón NPK 16-16-8 bao 25kg',
      qty: '40.000000',
      revenue: '8000000.0000',
    },
    {
      skuId: 'sku-2',
      skuCode: 'TT-ABA-100',
      name: 'Thuốc trừ sâu Abamectin 100ml',
      qty: '12.500000',
      revenue: '4500000.0000',
    },
  ],
};

/** Đúng shape `CustomerGroupDto` (CRM-01) — nhóm cuối đã ngừng dùng. */
export const CUSTOMER_GROUPS = [
  {
    id: '000000c1-0000-4000-8000-000000000001',
    code: 'DAILY',
    name: 'Đại lý',
    description: 'Đại lý cấp 1, cấp 2',
    isActive: true,
  },
  {
    id: '000000c1-0000-4000-8000-000000000002',
    code: 'TRANGTRAI',
    name: 'Trang trại',
    description: null,
    isActive: true,
  },
  {
    id: '000000c1-0000-4000-8000-000000000003',
    code: 'CU',
    name: 'Nhóm cũ',
    description: null,
    isActive: false,
  },
];

/** Đúng shape `CustomerTierDto`. */
export const CUSTOMER_TIERS = [
  {
    id: '000000c2-0000-4000-8000-000000000001',
    code: 'SILVER',
    name: 'Bạc',
    minRevenue: '100000000.0000',
    discountRate: '0.0100',
    sortOrder: 10,
  },
  {
    id: '000000c2-0000-4000-8000-000000000002',
    code: 'GOLD',
    name: 'Vàng',
    minRevenue: '300000000.0000',
    discountRate: null,
    sortOrder: 20,
  },
];

/** Đúng shape `TagDto`. */
export const CUSTOMER_TAGS = [
  { id: '000000c3-0000-4000-8000-000000000001', code: 'vip', name: 'Khách VIP', color: '#dc2626' },
  {
    id: '000000c3-0000-4000-8000-000000000002',
    code: 'vu-dong-xuan',
    name: 'Vụ Đông Xuân',
    color: null,
  },
];

/** Đúng shape `TierPromotionResultDto`. */
export function makeTierPromotionResult(dryRun: boolean, allowDemotion = false) {
  return {
    from: '2025-10-05T17:00:00.000Z',
    to: '2026-10-05T17:00:00.000Z',
    dryRun,
    allowDemotion,
    actorId: 'u-admin',
    tiersConfigured: CUSTOMER_TIERS.length,
    customersEvaluated: 237,
    promoted: 2,
    demoted: 0,
    unchanged: 235,
    changes: [
      {
        customerId: '00000000-0000-4000-8000-000000000000',
        customerCode: 'KH00001',
        revenue: '350000000.0000',
        fromTierId: CUSTOMER_TIERS[0]!.id,
        fromTierCode: 'SILVER',
        toTierId: CUSTOMER_TIERS[1]!.id,
        toTierCode: 'GOLD',
        direction: 'PROMOTE',
      },
      {
        customerId: '00000000-0000-4000-8000-000000000001',
        customerCode: 'KH00002',
        revenue: '120000000.0000',
        fromTierId: null,
        fromTierCode: null,
        toTierId: CUSTOMER_TIERS[0]!.id,
        toTierCode: 'SILVER',
        direction: 'PROMOTE',
      },
    ],
  };
}

/**
 * Đúng shape `CustomerListItemDto` trong openapi.json (CustomerDto + group/tier/tags, CRM-03) —
 * đổi DTO ở backend thì sửa cả đây. Khách chẵn thuộc nhóm Đại lý; khách đầu cấp Bạc + tag VIP.
 */
export function makeCustomers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    group: i % 2 === 0 ? { id: CUSTOMER_GROUPS[0]!.id, code: 'DAILY', name: 'Đại lý' } : null,
    tier: i === 0 ? { id: CUSTOMER_TIERS[0]!.id, code: 'SILVER', name: 'Bạc' } : null,
    tags: i === 0 ? [CUSTOMER_TAGS[0]!] : [],
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    code: `KH${String(i + 1).padStart(5, '0')}`,
    name: `Khách hàng ${i + 1}`,
    taxCode: i % 4 === 0 ? `010${String(1000000 + i)}` : null,
    phone: `09${String(10000000 + i).slice(0, 8)}`,
    email: i % 3 === 0 ? `kh${i + 1}@example.com` : null,
    type: CUSTOMER_TYPES[i % CUSTOMER_TYPES.length]!,
    groupId: i % 2 === 0 ? CUSTOMER_GROUPS[0]!.id : null,
    tierId: i === 0 ? CUSTOMER_TIERS[0]!.id : null,
    isActive: i % 10 !== 9,
    mergedIntoId: null,
    teamIds: ['t-hn'],
    ownerIds: i % 2 === 0 ? ['u-sale'] : ['u-sale-2'],
    priceListId: null,
    creditLimit: String((i * 1_000_000) % 50_000_000),
    paymentTerm: i % 5 === 0 ? null : 30,
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 5, 1) + i * 3_600_000).toISOString(),
  }));
}

/**
 * CRM-07..09 gộp khách trùng — đúng shape DuplicateGroupDto / CustomerCompareItemDto /
 * MergeResultDto / MergeLogDto trong openapi.json. Nhóm 1 có 2 hồ sơ (A giữ gợi ý, B gộp vào),
 * nhóm 2 có 3 hồ sơ.
 */
export const DUP_A = '0000dd00-0000-4000-8000-00000000000a';
export const DUP_B = '0000dd00-0000-4000-8000-00000000000b';
export const DUP_C = '0000dd00-0000-4000-8000-00000000000c';
export const DUP_D = '0000dd00-0000-4000-8000-00000000000d';
export const DUP_E = '0000dd00-0000-4000-8000-00000000000e';
export const MERGE_LOG_ID = '0000dd00-0000-4000-8000-0000000000f1';

function dupCustomer(
  id: string,
  code: string,
  name: string,
  phone: string,
  extra: Partial<{ orderCount: number; revenue: string; source: 'PANCAKE' | 'MANUAL' }> = {},
) {
  return {
    id,
    code,
    name,
    phone,
    email: null,
    createdAt: '2026-08-23T03:00:00.000Z',
    orderCount: extra.orderCount ?? 0,
    lastOrderAt: extra.orderCount ? '2026-09-30T03:00:00.000Z' : null,
    revenue: extra.revenue ?? '0',
    owners: [{ id: 'u-sale', name: 'Nguyễn Văn An' }],
    teams: [{ id: 't-hn', name: 'Team Hà Nội' }],
    source: extra.source ?? 'MANUAL',
  };
}

export const DUPLICATE_GROUPS = {
  items: [
    {
      phone: '0912345678',
      suggestedSurvivorId: DUP_A,
      customers: [
        dupCustomer(DUP_A, 'KH-004512', 'Cửa hàng VTNN Minh Tâm', '0912345678', {
          orderCount: 47,
          revenue: '184250000.0000',
        }),
        dupCustomer(DUP_B, 'KH-013207', 'Minh Tâm HN', '0912 345 678', {
          orderCount: 1,
          revenue: '2140000.0000',
          source: 'PANCAKE',
        }),
      ],
    },
    {
      phone: '0987445020',
      suggestedSurvivorId: DUP_D,
      customers: [
        dupCustomer(DUP_C, 'KH-000101', 'CH Tuấn Kiệt', '0987445020'),
        dupCustomer(DUP_D, 'KH-000102', 'Cửa hàng VTNN Tuấn Kiệt', '0987445020', {
          orderCount: 9,
          revenue: '12000000.0000',
        }),
        dupCustomer(DUP_E, 'KH-000103', 'Tuấn Kiệt 2', '0987445020'),
      ],
    },
  ],
  total: 2,
};

function compareItem(id: string) {
  const isA = id === DUP_A;
  const base = {
    id,
    code: isA ? 'KH-004512' : id === DUP_B ? 'KH-013207' : `KH-${id.slice(-3)}`,
    name: isA ? 'Cửa hàng VTNN Minh Tâm' : id === DUP_B ? 'Minh Tâm HN' : `Khách ${id.slice(-1)}`,
    taxCode: null,
    phone: '0912345678',
    email: isA ? null : 'minhtam.hn@gmail.com',
    type: isA ? ('DISTRIBUTOR' as const) : ('RETAIL' as const),
    groupId: isA ? CUSTOMER_GROUPS[0]!.id : null,
    tierId: isA ? CUSTOMER_TIERS[0]!.id : null,
    isActive: true,
    mergedIntoId: null,
    teamIds: ['t-hn'],
    ownerIds: ['u-sale'],
    priceListId: null,
    creditLimit: isA ? '50000000.0000' : null,
    paymentTerm: 30,
    createdAt: '2026-01-02T03:00:00.000Z',
    updatedAt: '2026-09-02T03:00:00.000Z',
  };
  return {
    ...base,
    normalizedPhone: '0912345678',
    group: isA ? { id: CUSTOMER_GROUPS[0]!.id, code: 'DAILY', name: 'Đại lý' } : null,
    tier: isA ? { id: CUSTOMER_TIERS[0]!.id, code: 'SILVER', name: 'Bạc' } : null,
    tags: isA ? [CUSTOMER_TAGS[0]!] : [],
    addresses: makeCustomerAddresses(id).slice(0, isA ? 2 : 1),
    owners: [{ id: 'u-sale', name: 'Nguyễn Văn An' }],
    teams: [{ id: 't-hn', name: 'Team Hà Nội' }],
    source: isA ? ('MANUAL' as const) : ('PANCAKE' as const),
    pancake: isA
      ? null
      : {
          source: 'PANCAKE',
          shopId: '715130909',
          externalId: 'c-778',
          fbId: '1234',
          conversationLink: 'https://pancake.vn/conv/778',
        },
    consents: isA
      ? [
          {
            channel: 'EMAIL' as const,
            granted: true,
            source: 'form',
            recordedAt: '2026-05-01T03:00:00.000Z',
          },
        ]
      : [],
    orders: isA
      ? {
          total: 47,
          posted: 45,
          open: 2,
          lastOrderAt: '2026-09-30T03:00:00.000Z',
          revenue: '184250000.0000',
        }
      : {
          total: 3,
          posted: 2,
          open: 1,
          lastOrderAt: '2026-09-01T03:00:00.000Z',
          revenue: '2140000',
        },
    openInvoices: isA ? 1 : 0,
    references: [
      { key: 'core.SalesOrder.customerId', label: 'Đơn bán', count: isA ? 47 : 3 },
      { key: 'crm.Ticket.customerId', label: 'Ticket', count: 0 },
    ],
  };
}

export function makeDuplicateCompare(ids: string[]) {
  return { customers: ids.map(compareItem), samePhone: true };
}

export const MERGE_RESULT = {
  logId: MERGE_LOG_ID,
  survivorId: DUP_A,
  mergedId: DUP_B,
  matchedOn: 'phone' as const,
  fieldsChanged: ['email'],
  moved: [
    { key: 'core.SalesOrder.customerId', label: 'Đơn bán', count: 1 },
    { key: 'core.CustomerAddress.customerId', label: 'Địa chỉ giao', count: 1 },
    { key: 'crm.Ticket.customerId', label: 'Ticket', count: 0 },
  ],
  kept: [{ key: 'core.SalesOrder.customerId', label: 'Đơn bán', count: 2 }],
};

export const MERGE_UNDO_RESULT = {
  logId: MERGE_LOG_ID,
  survivorId: DUP_A,
  mergedId: DUP_B,
  restored: [{ key: 'core.SalesOrder.customerId', label: 'Đơn bán', count: 1 }],
  stuck: [],
  fieldsRestored: ['email'],
  fieldsNotRestored: [],
  undoneAt: '2026-10-06T04:00:00.000Z',
};

export const MERGE_LOGS = {
  items: [
    {
      id: MERGE_LOG_ID,
      survivor: { id: DUP_A, code: 'KH-004512', name: 'Cửa hàng VTNN Minh Tâm' },
      merged: { id: DUP_B, code: 'KH-013207', name: 'Minh Tâm HN' },
      matchedOn: 'phone',
      fieldChoices: { email: 'merged' as const },
      fieldsChanged: ['email'],
      moved: MERGE_RESULT.moved,
      kept: MERGE_RESULT.kept,
      mergedBy: { id: 'u-admin', name: 'Quản trị' },
      mergedAt: '2026-10-06T03:00:00.000Z',
      undoneAt: null,
      undoneBy: null,
      canUndo: true,
    },
    {
      id: '0000dd00-0000-4000-8000-0000000000f2',
      survivor: { id: DUP_D, code: 'KH-000102', name: 'Cửa hàng VTNN Tuấn Kiệt' },
      merged: { id: DUP_C, code: null, name: null },
      matchedOn: 'manual',
      fieldChoices: {},
      fieldsChanged: [],
      moved: [],
      kept: [],
      mergedBy: null,
      mergedAt: '2026-10-01T03:00:00.000Z',
      undoneAt: '2026-10-02T03:00:00.000Z',
      undoneBy: { id: 'u-admin', name: 'Quản trị' },
      canUndo: false,
    },
  ],
  total: 2,
};

/** Đúng shape `CustomerAddressDto` — hai địa chỉ, địa chỉ đầu là mặc định. */
export function makeCustomerAddresses(customerId: string) {
  return [
    {
      id: '00000077-0000-4000-8000-000000000001',
      customerId,
      label: 'Cửa hàng',
      recipient: 'Nguyễn Thị Thu Hà',
      phone: '0903112233',
      line1: '12 Lê Thanh Nghị',
      hamlet: null,
      ward: 'Phường Hai Bà Trưng',
      province: 'Hà Nội',
      isDefault: true,
    },
    {
      id: '00000077-0000-4000-8000-000000000002',
      customerId,
      label: null,
      recipient: 'Trần Văn Bình',
      phone: '0912345678',
      line1: 'Thôn 3',
      hamlet: 'Xóm Đông',
      ward: 'Xã Kim Quan',
      province: 'Hà Nội',
      isDefault: false,
    },
  ];
}

const ORDER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'CANCELLED'] as const;
const ORDER_CHANNELS = ['DIRECT', 'MARKETPLACE', 'WEBSITE', 'POS'] as const;

const uuid = (prefix: string, i: number) =>
  `${prefix}-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** Σ dòng × cân nặng SKU của fixture đơn, xoay vòng 5 mức (kg, Decimal(12,4) chuỗi). */
export const LINE_WEIGHTS = ['0.3000', '0.6000', '0.9000', '1.2000', '1.5000'] as const;

/** Đúng shape `SalesOrderHeaderDto` trong openapi.json. */
export function makeOrders(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: uuid('00000001', i),
    docNumber: `SO-2608-${String(i + 1).padStart(5, '0')}`,
    customer: {
      id: uuid('00000000', i % 20),
      code: `KH${String((i % 20) + 1).padStart(5, '0')}`,
      name: `Khách hàng ${(i % 20) + 1}`,
    },
    channel: ORDER_CHANNELS[i % ORDER_CHANNELS.length]!,
    orderDate: new Date(Date.UTC(2026, 7, 23) - i * 3_600_000).toISOString(),
    status: ORDER_STATUSES[i % ORDER_STATUSES.length]!,
    lineCount: (i % 9) + 1,
    subtotal: String(1_000_000 + i * 1000),
    discount: String((i % 5) * 10_000),
    taxAmount: String(80_000 + i * 100),
    shippingFee: '250000',
    total: String(1_330_000 + i * 1100),
    currencyCode: 'VND',
    ownerId: i % 3 === 0 ? null : 'u-sale',
    teamId: 't-hn',
    // Mỗi đơn thứ 5 (lệch 1) đã gán GHTK — để test lọc theo hãng; đơn đầu (FIRST) vẫn chưa gán.
    carrierId: i % 5 === 1 ? 'c-ghtk' : null,
    carrierAccountId: null,
    senderPhone: null,
    warehouseId: null,
    addressId: null,
    // Cân nặng: đặt tay 1 kg ở mỗi đơn thứ 4; còn lại tính từ dòng 0,3 → 1,5 kg.
    shippingWeightKg: i % 4 === 0 ? '1.0000' : null,
    lineWeightKg: LINE_WEIGHTS[i % 5]!,
    weightKg: i % 4 === 0 ? '1.0000' : LINE_WEIGHTS[i % 5]!,
    shippingOptions: null,
    // Mỗi đơn thứ 7 đồng bộ từ Pancake (id theo shop = 100 + i).
    pancakeOrderId: i % 7 === 3 ? String(100 + i) : null,
    pancakeOrderLink:
      i % 7 === 3 ? `https://pos.pages.fm/shop/715130909/order?order_id=9${100 + i}` : null,
    postedAt:
      ORDER_STATUSES[i % ORDER_STATUSES.length] === 'POSTED' ? '2026-08-24T02:00:00.000Z' : null,
    createdAt: new Date(Date.UTC(2026, 7, 23) - i * 3_600_000).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 7, 23) - i * 1_800_000).toISOString(),
    // Màn Quản lý đơn hàng (2026-10-12) — tab theo trạng thái chứng từ + kho / giao hàng.
    ...orderListExtras(i, ORDER_STATUSES[i % ORDER_STATUSES.length]!),
  }));
}

/** Tab của fixture: chứng từ hủy / chưa duyệt thắng; đơn đã duyệt xoay vòng trạng thái kho. */
const FIXTURE_FLOWS = ['WAREHOUSE', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'] as const;
const FIXTURE_PHONES = ['0912345678', '0386000104', '0908000110', null] as const;

function orderListExtras(i: number, status: (typeof ORDER_STATUSES)[number]) {
  const flow =
    status === 'CANCELLED'
      ? ('CANCELLED' as const)
      : status === 'DRAFT' || status === 'PENDING_APPROVAL'
        ? ('PENDING_APPROVAL' as const)
        : FIXTURE_FLOWS[i % FIXTURE_FLOWS.length]!;
  const shipped = flow === 'OUT_FOR_DELIVERY' || flow === 'DELIVERED' || flow === 'RETURNED';
  return {
    flow,
    fulfilmentStatus:
      flow === 'PENDING_APPROVAL' || flow === 'CANCELLED'
        ? null
        : flow === 'WAREHOUSE'
          ? ('NOT_STARTED' as const)
          : flow,
    statusChangedAt: shipped ? new Date(Date.UTC(2026, 7, 24) - i * 600_000).toISOString() : null,
    sameDayCount: 0,
    phone: FIXTURE_PHONES[i % FIXTURE_PHONES.length]!,
    recipientName: null,
    addressLine: `Thôn ${(i % 9) + 1}, X. Ea Kar`,
    province: 'Đắk Lắk',
    product: {
      name: `Sản phẩm 1`,
      qty: '10',
      uomCode: 'cái',
      moreCount: (i % 9) + 1 - 1,
    },
    shipment: shipped
      ? {
          status: flow === 'OUT_FOR_DELIVERY' ? ('OUT_FOR_DELIVERY' as const) : flow,
          carrierCode: 'GHTK',
          carrierName: 'Giao Hàng Tiết Kiệm',
          trackingNo: `S2311.HN.${1000 + i}`,
          shipFee: '30000.0000',
          codAmount: '200000.0000',
          collectedAmount:
            flow === 'DELIVERED' ? '170000.0000' : flow === 'RETURNED' ? '-30000.0000' : null,
        }
      : null,
    ownerName: i % 3 === 0 ? null : 'Nguyễn Văn Sale',
    note: i % 6 === 0 ? 'Gọi trước khi giao' : null,
  };
}

/** Đúng shape `SalesOrderDetailDto` — header + `SalesOrderLineDto[]`. */
export function makeOrderDetail(id: string) {
  const header = makeOrders(60).find((o) => o.id === id);
  if (!header) return null;
  const lines = Array.from({ length: header.lineCount }, (_, i) => ({
    id: uuid('00000002', i),
    lineNo: i + 1,
    skuId: uuid('00000003', i),
    skuCode: `SKU-${String(i + 1).padStart(4, '0')}`,
    skuName: `Sản phẩm ${i + 1}`,
    pancakeName: null as string | null,
    pancakeSkuCode: null as string | null,
    nonStock: false,
    uomId: uuid('00000004', i),
    uomCode: i % 2 === 0 ? 'cái' : 'thùng',
    qty: String((i + 1) * 10),
    qtyBase: String((i + 1) * 10),
    listPrice: '72000',
    unitPrice: '68400',
    discount: String(i * 1000),
    lineTotal: String((i + 1) * 684_000),
    priceListId: null,
    promotionId: null,
    isGift: i === 2,
    combo: null,
    reservedQty: String((i + 1) * 10),
    pickedQty: i === 0 ? String((i + 1) * 10) : '0',
  }));
  return {
    ...header,
    // Tên NV + mốc giờ (API 2026-10-22). Danh sách đã có ownerName; chi tiết trả thêm 4 tên.
    careStaffName: null as string | null,
    packerName: null as string | null,
    marketerName: null as string | null,
    createdByName: 'Quản trị hệ thống' as string | null,
    timeline: {
      approvedAt:
        header.status === 'APPROVED' || header.status === 'POSTED' ? header.createdAt : null,
      pickedAt: null as string | null,
      packedAt: null as string | null,
      packedByName: null as string | null,
      sentToCarrierAt: null as string | null,
      shippedAt: null as string | null,
      deliveredAt: null as string | null,
    },
    shippingAddress: null,
    approval: null as { requestId: string; ruleName: string | null; canAct: boolean } | null,
    customItems: [] as { name: string; qty: string; unitPrice: string | null; discount: string }[],
    fulfilment: {
      status: 'NOT_STARTED',
      pickTaskId: null,
      pickTaskDocNumber: null,
      packTaskId: null,
      packTaskDocNumber: null,
    },
    carrier: null,
    carrierAccount: null,
    warehouse: null,
    shipment: null,
    lines,
    source: null,
    surcharge: '0.0000',
    prepaidAmount: '0.0000',
    freeShipping: false,
    shipFeeOnReturnOnly: false,
    packerId: null,
    careStaffId: null,
    marketerId: null,
    internalNote: null,
    printNote: null,
    expectedDeliveryDate: null,
    tags: [] as { id: string; code: string; name: string; color: string | null }[],
    attachments: [] as {
      id: string;
      fileName: string;
      contentType: string;
      sizeBytes: number;
      url: string;
      uploadedBy: string;
      createdAt: string;
    }[],
  };
}

/**
 * Chi tiết đơn có MỘT combo (2 dòng thành phần, `combo.groupNo` = 1) + một dòng thường —
 * đúng shape `SalesOrderLineDto.combo` (server bung combo, tiền đã phân bổ xuống thành phần).
 */
export function makeOrderDetailWithCombo(id: string) {
  const base = makeOrderDetail(id);
  if (!base) return null;
  const combo = {
    skuId: uuid('00000005', 1),
    skuCode: 'CB-0001',
    skuName: 'Combo A + B',
    groupNo: 1,
    qty: '3',
    componentQty: '2',
    listPrice: '150000',
    unitPrice: '150000',
  };
  const lines = [
    {
      ...base.lines[0]!,
      lineNo: 1,
      skuCode: 'SKU-A',
      skuName: 'Sản phẩm A',
      qty: '6',
      qtyBase: '6',
      listPrice: '56250',
      unitPrice: '56250',
      discount: '0',
      lineTotal: '337500',
      isGift: false,
      combo,
    },
    {
      ...base.lines[0]!,
      id: uuid('00000002', 11),
      lineNo: 2,
      skuId: uuid('00000003', 11),
      skuCode: 'SKU-B',
      skuName: 'Sản phẩm B',
      qty: '3',
      qtyBase: '3',
      listPrice: '37500',
      unitPrice: '37500',
      discount: '0',
      lineTotal: '112500',
      isGift: false,
      combo: { ...combo, componentQty: '1' },
    },
    {
      ...base.lines[0]!,
      id: uuid('00000002', 12),
      lineNo: 3,
      skuId: uuid('00000003', 12),
      skuCode: 'SKU-C',
      skuName: 'Sản phẩm C',
      qty: '1',
      qtyBase: '1',
      listPrice: '60000',
      unitPrice: '60000',
      discount: '0',
      lineTotal: '60000',
      isGift: false,
      combo: null,
    },
  ];
  return { ...base, lineCount: 3, subtotal: '510000', total: '510000', lines };
}

/** Đúng shape `SalesOrderShipmentDto` — phiếu giao đã có vận đơn GHTK, chưa in nhãn. */
export const ORDER_SHIPMENT_FIXTURE = {
  id: uuid('0000000e', 7),
  docNumber: 'DN2609-00007',
  status: 'PENDING' as const,
  carrierCode: 'GHTK',
  carrierAccountName: 'Mặc định' as string | null,
  trackingNo: 'S12345678.SG.A1.B2',
  labelPrintedAt: null,
  labelPrintCount: 0,
};

/** Đúng shape `TaskDetailDto` (GET /tasks/:id) — task PICK 2 dòng đã sắp theo pickSequence. */
export function makeTaskDetail(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    docNumber: 'PICK2609-00004',
    type: 'PICK',
    status: 'COMPLETED',
    priority: 0,
    assigneeId: 'staff-1',
    warehouseId: 'wh-1',
    warehouseCode: 'WH01',
    warehouseName: 'Kho HN-1',
    waveId: null,
    lineCount: 2,
    qtyPlanned: '120',
    qtyDone: '120',
    refType: 'SalesOrder',
    refId: 'so-4',
    createdAt: '2026-09-02T08:00:00.000Z',
    assignedAt: '2026-09-02T08:05:00.000Z',
    startedAt: '2026-09-02T08:10:00.000Z',
    completedAt: '2026-09-02T09:00:00.000Z',
    ageMinutes: 60,
    idleMinutes: 0,
    assigneeName: 'Phạm Thị Hoa',
    refDocNumber: 'SO2609-00004',
    lines: [
      {
        id: 'tl-1',
        lineNo: 1,
        status: 'COMPLETED',
        skuId: 'sku-1',
        skuCode: 'TL08-BLUE',
        skuName: 'Bút bi Thiên Long TL-08 xanh',
        barcodes: ['8935001800012', 'TL08-BLUE'],
        lotId: 'lot-1',
        lotNumber: 'L2605',
        expiryDate: null,
        fromLocationId: 'loc-1',
        fromLocationCode: 'A-03-02-B',
        toLocationId: null,
        toLocationCode: null,
        pickSequence: 120,
        qtyPlanned: '48',
        qtyDone: '48',
        scannedBarcode: '8935001800012',
        exceptionNote: null,
      },
      {
        id: 'tl-2',
        lineNo: 2,
        status: 'COMPLETED',
        skuId: 'sku-2',
        skuCode: 'TL08-RED',
        skuName: 'Bút bi Thiên Long TL-08 đỏ',
        barcodes: [],
        lotId: null,
        lotNumber: null,
        expiryDate: null,
        fromLocationId: 'loc-2',
        fromLocationCode: 'A-03-04-A',
        toLocationId: null,
        toLocationCode: null,
        pickSequence: 140,
        qtyPlanned: '72',
        qtyDone: '72',
        scannedBarcode: null,
        exceptionNote: null,
      },
    ],
    ...over,
  };
}

/** Đúng shape `PickupWarehouseDto` (GET /pickup-warehouses). */
export const PICKUP_WAREHOUSES = [
  {
    id: 'wh-hcm',
    code: 'WH01',
    name: 'Kho trung tâm',
    address: 'Lô A1 KCN Tân Tạo',
    hamlet: null,
    ward: 'Phường Tân Tạo A',
    province: 'Hồ Chí Minh',
    contactName: 'Kho trung tâm',
    phone: '0900000000',
    pickupReady: true,
  },
  {
    id: 'wh-bare',
    code: 'WH02',
    name: 'Kho chưa khai',
    address: null,
    hamlet: null,
    ward: null,
    province: null,
    contactName: null,
    phone: null,
    pickupReady: false,
  },
];

const CARRIERS_BASE = [
  {
    id: 'c-manual',
    code: 'MANUAL',
    name: 'Giao thủ công (xe nhà / khách tự lấy)',
    isActive: true,
    hasAdapter: false,
    operations: ['createWaybill'],
    configured: true,
    webhook: false,
  },
  {
    id: 'c-ghn',
    code: 'GHN',
    name: 'Giao Hàng Nhanh',
    isActive: true,
    hasAdapter: true,
    operations: ['createWaybill', 'track', 'cancel'],
    configured: false,
    webhook: true,
  },
  {
    id: 'c-old',
    code: 'OLD',
    name: 'Hãng đã tắt',
    isActive: false,
    hasAdapter: false,
    operations: ['createWaybill'],
    configured: true,
    webhook: false,
  },
  {
    id: 'c-ghtk',
    code: 'GHTK',
    name: 'Giao Hàng Tiết Kiệm',
    isActive: true,
    hasAdapter: true,
    operations: ['createWaybill', 'quote', 'getStatus', 'cancelWaybill'],
    configured: true,
    webhook: true,
  },
  {
    id: 'c-vtp',
    code: 'VTP',
    name: 'Viettel Post',
    isActive: true,
    hasAdapter: true,
    operations: ['createWaybill', 'quote', 'getStatus', 'cancelWaybill'],
    configured: true,
    webhook: true,
  },
];

/**
 * Đúng shape `CarrierDto` (GET /carriers). Hãng có adapter có đúng MỘT tài khoản "Mặc định"
 * (đủ cấu hình như hãng) — test nhiều tài khoản tự ghi đè handler (FE-CARRIER-ACC-1).
 */
export const CARRIERS = CARRIERS_BASE.map((c) => ({
  ...c,
  accounts: c.hasAdapter
    ? [
        {
          id: `acc-${c.code.toLowerCase()}-default`,
          name: 'Mặc định',
          isDefault: true,
          code: null,
          configured: c.configured,
        },
      ]
    : [],
}));

/** Đúng shape `ShippingQuoteResultDto` (GET /sales-orders/:id/shipping-quote). */
export function makeShippingQuote(orderId: string, carrierId: string) {
  const carrier = CARRIERS.find((c) => c.id === carrierId) ?? CARRIERS[3]!;
  return {
    orderId,
    docNumber: `SO-2026-${orderId.slice(-4)}`,
    carrierId: carrier.id,
    carrierCode: carrier.code,
    carrierName: carrier.name,
    fee: '28000.0000',
    currency: 'VND',
    serviceCode: null,
    estimatedDeliveryAt: null,
    weightKg: '0.7500',
    codAmount: '1250000.0000',
    pickupWarehouseId: 'wh-hcm',
    pickupSummary: 'Hồ Chí Minh · Phường Tân Tạo A',
  };
}

/** Đúng shape `StockRowDto`. */
export function makeStockRows(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const onHand = 100 + i * 7;
    const reserved = i % 11 === 10 ? onHand + 5 : i * 3;
    return {
      skuId: uuid('00000003', i),
      skuCode: `SKU-${String(i + 1).padStart(4, '0')}`,
      skuName: `Sản phẩm ${i + 1}`,
      baseUomId: uuid('00000004', i % 3),
      baseUomCode: ['cái', 'ream', 'hộp'][i % 3]!,
      isActive: i % 13 !== 12,
      onHand: String(onHand),
      reserved: String(reserved),
      available: String(onHand - reserved),
      hasCost: i % 2 === 0,
      unitCost: i % 2 === 0 ? '12000' : null,
      // SKU lẻ chưa cân; SKU chẵn 250 g, 500 g… (kg Decimal chuỗi).
      weightKg: i % 2 === 0 ? String(0.25 * (i / 2 + 1)) : null,
    };
  });
}

/** Đúng shape `StockByLocationRowDto`. */
export function makeStockByLocation(n: number) {
  const types = ['BIN', 'RACK', 'STAGING', 'QUARANTINE'] as const;
  return Array.from({ length: n }, (_, i) => ({
    skuId: uuid('00000003', i),
    skuCode: `SKU-${String(i + 1).padStart(4, '0')}`,
    skuName: `Sản phẩm ${i + 1}`,
    warehouseId: uuid('00000005', 0),
    warehouseCode: 'HN-1',
    locationId: uuid('00000006', i),
    locationCode: `A-01-${String(i + 1).padStart(2, '0')}-A`,
    locationType: types[i % types.length]!,
    isPickable: i % 4 !== 3,
    pickSequence: i % 5 === 4 ? null : i + 1,
    onHand: String(40 + i),
    reserved: String(i % 7),
    available: String(40 + i - (i % 7)),
  }));
}

/** Đúng shape `StockByLotRowDto`. */
export function makeStockByLot(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    skuId: uuid('00000003', i),
    skuCode: `SKU-${String(i + 1).padStart(4, '0')}`,
    skuName: `Sản phẩm ${i + 1}`,
    lotId: i % 6 === 5 ? null : uuid('00000007', i),
    lotNumber: i % 6 === 5 ? null : `L26${String(i + 1).padStart(2, '0')}`,
    expiryDate: i % 6 === 5 ? null : `2026-${String((i % 12) + 1).padStart(2, '0')}-28`,
    mfgDate: i % 6 === 5 ? null : '2026-01-15',
    onHand: String(200 + i),
    reserved: String(i * 2),
    available: String(200 + i - i * 2),
  }));
}

const TASK_TYPES = [
  'PICK',
  'PUT_AWAY',
  'PACK',
  'RECEIVE',
  'SHIP',
  'TRANSFER',
  'COUNT',
  'REPLENISH',
] as const;
const TASK_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'EXCEPTION', 'COMPLETED'] as const;

/** Đúng shape `TaskRowDto` — có ageMinutes/idleMinutes, KHÔNG có hạn chót/SLA. */
export function makeTasks(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const status = TASK_STATUSES[i % TASK_STATUSES.length]!;
    const done = status === 'COMPLETED';
    return {
      id: uuid('00000008', i),
      docNumber: `TK-0823-${String(i + 1).padStart(3, '0')}`,
      type: TASK_TYPES[i % TASK_TYPES.length]!,
      status,
      priority: (i % 3) * 5,
      assigneeId: status === 'PENDING' ? null : 'u-picker',
      warehouseId: uuid('00000005', 0),
      warehouseCode: 'HN-1',
      warehouseName: 'Kho Hà Nội 1',
      waveId: null,
      lineCount: (i % 12) + 1,
      exceptionLineCount: 0,
      qtyPlanned: String(((i % 12) + 1) * 10),
      qtyDone: done ? String(((i % 12) + 1) * 10) : String((i % 12) * 3),
      refType: i % 2 === 0 ? 'SalesOrder' : 'GoodsReceipt',
      refId: uuid('00000001', i),
      refDocNumber: i % 2 === 0 ? `SO2608-${String(i + 1).padStart(5, '0')}` : null,
      createdAt: new Date(Date.UTC(2026, 7, 23, 2) + i * 60_000).toISOString(),
      assignedAt: status === 'PENDING' ? null : new Date(Date.UTC(2026, 7, 23, 3)).toISOString(),
      startedAt:
        status === 'IN_PROGRESS' || done ? new Date(Date.UTC(2026, 7, 23, 4)).toISOString() : null,
      completedAt: done ? new Date(Date.UTC(2026, 7, 23, 5)).toISOString() : null,
      ageMinutes: 12 + i * 3,
      idleMinutes: done ? 0 : 4 + i,
    };
  });
}

export const errorEnvelope = (status: number, code: string, message = 'x', details?: unknown) =>
  HttpResponse.json(
    { statusCode: status, code, message, ...(details !== undefined ? { details } : {}) },
    { status, headers: { 'x-request-id': `trace-${code.toLowerCase()}` } },
  );

/** Đúng shape `RoleDto` (permissions phẳng string[] + memberCount). */
export const ROLES_FIXTURE = [
  {
    id: uuid('00000009', 0),
    code: 'ADMIN',
    name: 'Quản trị',
    description: null,
    permissions: ['customer.read', 'customer.update', 'role.read', 'role.update', 'user.read'],
    memberCount: 1,
  },
  {
    id: uuid('00000009', 1),
    code: 'SALES_MEMBER',
    name: 'Nhân viên kinh doanh',
    description: null,
    permissions: ['customer.read', 'customer.update', 'sales_order.read'],
    memberCount: 4,
  },
];

/** Đúng shape `PermissionDto`. */
export const PERMISSIONS_FIXTURE = [
  { id: uuid('0000000a', 0), code: 'customer.read', module: 'customer', action: 'read' },
  { id: uuid('0000000a', 1), code: 'customer.update', module: 'customer', action: 'update' },
  { id: uuid('0000000a', 2), code: 'role.read', module: 'role', action: 'read' },
  { id: uuid('0000000a', 3), code: 'role.update', module: 'role', action: 'update' },
  { id: uuid('0000000a', 4), code: 'sales_order.read', module: 'sales_order', action: 'read' },
  { id: uuid('0000000a', 5), code: 'stock.adjust', module: 'stock', action: 'adjust' },
  { id: uuid('0000000a', 6), code: 'user.read', module: 'user', action: 'read' },
];

/** Đúng shape `UserListItemDto`. */
export function makeUsers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: uuid('0000000b', i),
    code: `nv.${String(i + 1).padStart(3, '0')}`,
    email: `nv${i + 1}@erp.local`,
    fullName: `Nhân viên ${i + 1}`,
    departmentId: null,
    departmentName: i % 2 === 0 ? 'Kinh doanh' : null,
    roleCodes: i % 3 === 0 ? [] : ['SALES_MEMBER'],
    isActive: i % 7 !== 6,
    isSuperAdmin: i === 0,
    createdAt: new Date(Date.UTC(2026, 7, 20) + i * 3_600_000).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 7, 23) + i * 3_600_000).toISOString(),
  }));
}

/** Đúng shape `UserDetailDto`. */
export const USER_DETAIL_FIXTURE = {
  id: uuid('0000000b', 1),
  code: 'nv.002',
  email: 'nv2@erp.local',
  fullName: 'Nhân viên 2',
  department: { id: uuid('0000000c', 0), code: 'SALES', name: 'Kinh doanh' },
  warehouseId: null as string | null,
  warehouseIds: [] as string[],
  roles: [{ code: 'SALES_MEMBER', name: 'Nhân viên kinh doanh' }],
  teams: [
    {
      teamId: uuid('0000000d', 0),
      teamCode: 'SALES-HN',
      teamName: 'Kinh doanh Hà Nội',
      role: 'MEMBER',
      joinedAt: new Date(Date.UTC(2026, 7, 1)).toISOString(),
    },
  ],
  allow: [],
  deny: [],
  isActive: true,
  isSuperAdmin: false,
  createdAt: new Date(Date.UTC(2026, 7, 20)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 7, 23)).toISOString(),
};

/** Đúng shape `PancakeProfileDto` — chưa khai fb_id, hai POS đang kết nối, chưa chọn POS nào. */
export const PANCAKE_PROFILE_FIXTURE = {
  userId: USER_DETAIL_FIXTURE.id,
  fbId: null as string | null,
  pancakeName: null as string | null,
  shops: [
    { shopId: '407957969', shopName: 'POS Hưng Thịnh', isActive: true, selected: false },
    { shopId: '715130909', shopName: 'POS Real Agri', isActive: true, selected: false },
  ],
  otherFbIds: [] as string[],
};

/** Đúng shape `UserPermissionsDto` — nv.002 mang SALES_MEMBER, chưa override. */
export const USER_PERMISSIONS_FIXTURE = {
  userId: USER_DETAIL_FIXTURE.id,
  isSuperAdmin: false,
  entries: PERMISSIONS_FIXTURE.map((p) => {
    const fromRoles = ROLES_FIXTURE[1]!.permissions.includes(p.code) ? ['SALES_MEMBER'] : [];
    return {
      code: p.code,
      module: p.module,
      action: p.action,
      fromRoles,
      override: null,
      effective: fromRoles.length > 0,
    };
  }),
};

export const DEPARTMENTS_FIXTURE = [
  {
    id: uuid('0000000c', 0),
    code: 'SALES',
    name: 'Kinh doanh',
    parentId: null,
    managerId: null,
    isActive: true,
    _count: { members: 5 },
  },
];

/** Đúng shape `OrgTreeDto` (GET /org/tree): 2 phòng ban lồng nhau, 2 team lồng nhau, 1 người chưa có phòng ban. */
const ORG_EMP = (i: number, departmentId: string | null, isActive = true) => ({
  id: uuid('0000000e', i),
  code: `NV${String(i).padStart(3, '0')}`,
  fullName:
    ['Nguyễn Văn Lãnh', 'Trần Thị Hoa', 'Lê Minh Tuấn', 'Đỗ Văn Kho'][i - 1] ?? `Nhân viên ${i}`,
  email: `nv${i}@erp.local`,
  isActive,
  departmentId,
  createdById: null,
  canManage: true,
});
/** Field sơ đồ nhân sự của node phòng ban (GET /org/tree). */
const ORG_DEPT_EXTRA = (managerName: string | null, sortOrder = 0) => ({
  managerName,
  sortOrder,
  canAddMembers: true,
});
export const ORG_TREE_FIXTURE = {
  departments: [
    {
      id: uuid('0000000c', 0),
      code: 'SALES',
      name: 'Kinh doanh',
      isActive: true,
      managerId: uuid('0000000e', 1),
      ...ORG_DEPT_EXTRA('Nguyễn Văn Lãnh'),
      members: [ORG_EMP(1, uuid('0000000c', 0))],
      memberCount: 3,
      children: [
        {
          id: uuid('0000000c', 1),
          code: 'SALES-HN',
          name: 'Kinh doanh Hà Nội',
          isActive: true,
          managerId: null,
          ...ORG_DEPT_EXTRA(null),
          members: [ORG_EMP(2, uuid('0000000c', 1)), ORG_EMP(3, uuid('0000000c', 1))],
          memberCount: 2,
          children: [],
        },
      ],
    },
  ],
  teams: [
    {
      id: uuid('0000000d', 0),
      code: 'SALES',
      name: 'Phòng kinh doanh',
      type: 'SALES' as const,
      isActive: true,
      members: [],
      memberCount: 3,
      children: [
        {
          id: uuid('0000000d', 1),
          code: 'SALES-HN',
          name: 'Sale Hà Nội',
          type: 'SALES' as const,
          isActive: true,
          members: [
            {
              ...ORG_EMP(1, uuid('0000000c', 0)),
              role: 'LEADER' as const,
              joinedAt: '2026-01-01T00:00:00.000Z',
            },
            {
              ...ORG_EMP(2, uuid('0000000c', 1)),
              role: 'MEMBER' as const,
              joinedAt: '2026-01-01T00:00:00.000Z',
            },
            {
              ...ORG_EMP(3, uuid('0000000c', 1)),
              role: 'MEMBER' as const,
              joinedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          memberCount: 3,
          children: [],
        },
      ],
    },
    {
      id: uuid('0000000d', 2),
      code: 'WH',
      name: 'Kho',
      type: 'WAREHOUSE' as const,
      isActive: true,
      members: [
        { ...ORG_EMP(4, null), role: 'MEMBER' as const, joinedAt: '2026-01-01T00:00:00.000Z' },
      ],
      memberCount: 1,
      children: [],
    },
  ],
  unassigned: [ORG_EMP(4, null)],
  totals: { employees: 4, departments: 2, teams: 3 },
};

/**
 * Đúng shape `ShipmentMonitorRowDto` — phiếu hãng đang giữ, giữ 3, 4, 5… ngày (dòng 0 = 3 ngày).
 * `overdue` tính theo ngưỡng `holdDays` như API.
 */
export function makeMonitorRows(n: number, holdDays = 5) {
  return Array.from({ length: n }, (_, i) => ({
    id: uuid('0000000e', i),
    docNumber: `DN-2608-${String(i + 1).padStart(5, '0')}`,
    orderId: uuid('00000001', i),
    orderDocNumber: `SO-2608-${String(i + 1).padStart(5, '0')}`,
    status: (['PICKED_UP', 'IN_TRANSIT', 'FAILED'] as const)[i % 3]!,
    carrierId: uuid('0000000c', 0),
    carrierCode: 'GHTK',
    carrierName: 'Giao Hàng Tiết Kiệm',
    trackingNo: `S${String(i + 1).padStart(8, '0')}.HN`,
    packedAt: new Date(Date.UTC(2026, 7, 20, 2) - (3 + i) * 86_400_000).toISOString(),
    shippedAt: new Date(Date.UTC(2026, 7, 20, 3) - (3 + i) * 86_400_000).toISOString(),
    deliveredAt: null,
    lastCarrierSyncAt: i % 2 === 0 ? new Date(Date.UTC(2026, 7, 27)).toISOString() : null,
    carrierStatusCode: String(4 + (i % 3)),
    holdDays: 3 + i,
    overdue: 3 + i >= holdDays,
  }));
}

/** Đúng shape `ShipmentMonitorSummaryDto` cho 12 phiếu của {@link makeMonitorRows}. */
export function makeMonitorSummary(holdDays = 5, date = '2026-08-20') {
  const rows = makeMonitorRows(12, holdDays);
  const counts = {
    packed: 42,
    handedOver: 37,
    holding: rows.length,
    holdingOverdue: rows.filter((r) => r.overdue).length,
  };
  return {
    date,
    from: `${date}T00:00:00+07:00`,
    to: `${date}T24:00:00+07:00`,
    holdDays,
    asOf: new Date(Date.UTC(2026, 7, 20, 5)).toISOString(),
    totals: counts,
    byCarrier: [
      {
        carrierId: uuid('0000000c', 0),
        carrierCode: 'GHTK',
        carrierName: 'Giao Hàng Tiết Kiệm',
        ...counts,
      },
    ],
  };
}

/** Đúng shape `CarrierStatusLogListDto`. */
export const STATUS_LOG_FIXTURE = {
  shipmentId: uuid('0000000e', 0),
  shipmentDocNumber: 'DN-2608-00001',
  items: [
    {
      id: uuid('0000000f', 0),
      source: 'WEBHOOK',
      carrierCode: 'GHTK',
      carrierName: 'Giao Hàng Tiết Kiệm',
      trackingNo: 'S00000001.HN',
      carrierStatusCode: '4',
      mappedStatus: 'IN_TRANSIT',
      outcome: 'APPLIED',
      note: null,
      occurredAt: new Date(Date.UTC(2026, 7, 21, 3)).toISOString(),
      createdAt: new Date(Date.UTC(2026, 7, 21, 3, 1)).toISOString(),
    },
    {
      id: uuid('0000000f', 1),
      source: 'POLL',
      carrierCode: 'GHTK',
      carrierName: 'Giao Hàng Tiết Kiệm',
      trackingNo: 'S00000001.HN',
      carrierStatusCode: '45',
      mappedStatus: null,
      outcome: 'REJECTED_UNMAPPED',
      note: 'mã trạng thái 45 chưa được ánh xạ',
      occurredAt: null,
      createdAt: new Date(Date.UTC(2026, 7, 22, 3)).toISOString(),
    },
  ],
};

/** CRM-13 — đúng shape `ConsentRecordDto`. */
export const CONSENT_RECORDS = [
  {
    id: '0000cc00-0000-4000-8000-000000000001',
    customerId: '00000000-0000-4000-8000-000000000001',
    channel: 'ZALO',
    granted: false,
    source: 'UNSUBSCRIBE_LINK',
    purpose: 'MARKETING',
    evidence: { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (iPhone)' },
    recordedAt: new Date(Date.UTC(2026, 9, 5, 2, 30)).toISOString(),
    recordedBy: null,
  },
  {
    id: '0000cc00-0000-4000-8000-000000000002',
    customerId: '00000000-0000-4000-8000-000000000001',
    channel: 'SMS',
    granted: true,
    source: 'PHONE',
    purpose: 'MARKETING',
    evidence: { note: 'Ghi âm cuộc gọi CG-0412' },
    recordedAt: new Date(Date.UTC(2026, 9, 1, 3)).toISOString(),
    recordedBy: { id: 'u-sale-1', name: 'Trần Thị Mai' },
  },
];

/** Đúng shape `CustomerConsentsDto` — đủ 4 kênh, EMAIL / PHONE_CALL chưa ghi nhận. */
export const CUSTOMER_CONSENTS = {
  customerId: '00000000-0000-4000-8000-000000000001',
  current: [
    { channel: 'EMAIL', granted: null, recordedAt: null, source: null },
    { channel: 'SMS', granted: true, recordedAt: CONSENT_RECORDS[1]!.recordedAt, source: 'PHONE' },
    {
      channel: 'ZALO',
      granted: false,
      recordedAt: CONSENT_RECORDS[0]!.recordedAt,
      source: 'UNSUBSCRIBE_LINK',
    },
    { channel: 'PHONE_CALL', granted: null, recordedAt: null, source: null },
  ],
  history: { items: CONSENT_RECORDS, total: 2 },
};

/** Đúng shape `ConsentStateListDto`. */
export function makeConsentStates(n: number) {
  const channels = ['EMAIL', 'SMS', 'ZALO', 'PHONE_CALL'] as const;
  return Array.from({ length: n }, (_, i) => ({
    id: `0000cc10-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    customer: {
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      code: `KH-${String(i + 1).padStart(6, '0')}`,
      name: `Khách hàng ${i + 1}`,
      phone: `09120000${String(i).padStart(2, '0')}`,
    },
    channel: channels[i % 4]!,
    granted: i % 3 !== 0,
    source: i % 2 === 0 ? 'FORM' : 'PHONE',
    purpose: 'MARKETING',
    recordedAt: new Date(Date.UTC(2026, 9, 1 + (i % 5), 3)).toISOString(),
    recordedBy: i % 3 === 0 ? null : { id: 'u-sale-1', name: 'Trần Thị Mai' },
  }));
}

/** Đúng shape `PublicUnsubscribeDto`. */
export const PUBLIC_UNSUBSCRIBE = {
  customerName: 'Ng*** V** A',
  channel: 'SMS',
  currentlyGranted: true,
};

export const handlers = [
  // Module Công việc (2026-10-22): thẻ "Yêu cầu hỗ trợ" ở hồ sơ khách + dải nhắc ở chi tiết đơn —
  // mặc định không có việc nào; test của module work tự khai handler riêng.
  http.get('/api/work-items', () => HttpResponse.json({ items: [], total: 0 })),
  http.get('/api/customers/:id/consents', () => HttpResponse.json(CUSTOMER_CONSENTS)),
  http.post('/api/customers/:id/consents', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: '0000cc00-0000-4000-8000-0000000000ff',
        customerId: params.id,
        channel: body.channel,
        granted: body.granted,
        source: body.source,
        purpose: body.purpose ?? 'MARKETING',
        evidence: body.evidence ? { note: body.evidence } : null,
        recordedAt: new Date(Date.UTC(2026, 9, 6, 3)).toISOString(),
        recordedBy: { id: 'u-admin', name: 'Quản trị' },
      },
      { status: 201 },
    );
  }),
  http.get('/api/consents', ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const all = makeConsentStates(60);
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.get('/api/public/unsubscribe/:token', () => HttpResponse.json(PUBLIC_UNSUBSCRIBE)),
  http.post('/api/public/unsubscribe/:token', () =>
    HttpResponse.json({ ...PUBLIC_UNSUBSCRIBE, currentlyGranted: false }),
  ),
  http.get('/api/container-types', () => HttpResponse.json([])),
  http.get('/api/carriers', () => HttpResponse.json(CARRIERS)),
  // CSKH (2026-10-21): mặc định không có đơn trùng / không tra được khách — test riêng ghi đè.
  http.get('/api/sales-orders/same-day', () =>
    HttpResponse.json({ day: '2026-10-21', total: 0, hiddenCount: 0, orders: [] }),
  ),
  http.get('/api/customer-care/lookup', () =>
    HttpResponse.json({ customer: null, careTeam: null }),
  ),
  http.get('/api/sales-orders/staff-options', () =>
    HttpResponse.json([
      {
        id: '00000000-0000-4000-8000-0000000000a1',
        code: 'sale.hn.1',
        fullName: 'Nguyễn Văn Sale',
      },
      { id: '00000000-0000-4000-8000-0000000000a2', code: 'packer.01', fullName: 'Trần Thị Đóng' },
    ]),
  ),
  // NV xử lý: chỉ nhân viên cùng team người tạo — packer.01 ngoài team nên không có ở đây.
  http.get('/api/sales-orders/owner-options', () =>
    HttpResponse.json([
      {
        id: '00000000-0000-4000-8000-0000000000a1',
        code: 'sale.hn.1',
        fullName: 'Nguyễn Văn Sale',
      },
    ]),
  ),
  http.get('/api/pickup-warehouses', () => HttpResponse.json(PICKUP_WAREHOUSES)),
  http.get('/api/sales-orders/:id/shipping-quote', ({ params, request }) => {
    const carrierId = new URL(request.url).searchParams.get('carrierId') ?? '';
    return HttpResponse.json(makeShippingQuote(params.id as string, carrierId));
  }),
  http.get('/api/auth/me', () => HttpResponse.json(ME_ADMIN)),
  http.get('/api/health', () =>
    HttpResponse.json({ status: 'ok', db: 'ok', redis: 'ok', timestamp: new Date().toISOString() }),
  ),
  http.get('/api/customers', async ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const sortBy = url.searchParams.get('sortBy') ?? 'name';
    const dir = url.searchParams.get('sortDir') === 'desc' ? -1 : 1;
    await delay(150);
    let all = makeCustomers(237);
    if (q)
      // Như API: q khớp tên, mã hoặc SĐT.
      all = all.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.phone ?? '').includes(q),
      );
    const groupId = url.searchParams.get('groupId');
    const tierId = url.searchParams.get('tierId');
    const type = url.searchParams.get('type');
    const tagIds = url.searchParams.getAll('tagIds').flatMap((t) => t.split(','));
    if (groupId) all = all.filter((c) => c.groupId === groupId);
    if (tierId) all = all.filter((c) => c.tierId === tierId);
    if (type) all = all.filter((c) => c.type === type);
    if (tagIds.length > 0)
      all = all.filter((c) =>
        url.searchParams.get('tagMatch') === 'all'
          ? tagIds.every((t) => c.tags.some((x) => x.id === t))
          : c.tags.some((x) => tagIds.includes(x.id)),
      );
    all = [...all].sort((a, b) => {
      const x = String(a[sortBy as keyof typeof a] ?? '');
      const y = String(b[sortBy as keyof typeof b] ?? '');
      return x < y ? -dir : x > y ? dir : 0;
    });
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.get('/api/customer-groups', ({ request }) => {
    const all = new URL(request.url).searchParams.get('includeInactive') === 'true';
    return HttpResponse.json(all ? CUSTOMER_GROUPS : CUSTOMER_GROUPS.filter((g) => g.isActive));
  }),
  http.get('/api/customer-tiers', () => HttpResponse.json(CUSTOMER_TIERS)),
  http.get('/api/customer-tags', () => HttpResponse.json(CUSTOMER_TAGS)),
  // Gộp khách trùng — khai TRƯỚC /customers/:id (giống thứ tự đăng ký module ở API).
  http.get('/api/customers/duplicates', () => HttpResponse.json(DUPLICATE_GROUPS)),
  http.get('/api/customers/duplicates/compare', ({ request }) => {
    const ids = new URL(request.url).searchParams.getAll('ids').flatMap((x) => x.split(','));
    return HttpResponse.json(makeDuplicateCompare(ids));
  }),
  http.get('/api/customers/merge-logs', () => HttpResponse.json(MERGE_LOGS)),
  http.post('/api/customers/merge', () => HttpResponse.json(MERGE_RESULT, { status: 201 })),
  http.post('/api/customers/merge/:logId/undo', () => HttpResponse.json(MERGE_UNDO_RESULT)),
  http.get('/api/customers/:id', async ({ params }) => {
    await delay(50);
    const found = makeCustomers(237).find((c) => c.id === params.id);
    // CustomerDetailDto = CustomerDto + addresses (danh sách không kèm).
    return found
      ? HttpResponse.json({
          ...found,
          addresses: makeCustomerAddresses(found.id),
          mergedInto: null,
        })
      : errorEnvelope(404, 'NOT_FOUND');
  }),
  http.get('/api/customers/:id/stats', () => HttpResponse.json(CUSTOMER_STATS)),
  http.get('/api/customers/:id/orders', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const take = Number(url.searchParams.get('take') ?? 20);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const all = makeCustomerOrders(25).filter((o) => !status || o.status === status);
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  // Đếm tab (khai TRƯỚC /sales-orders/:id). Fixture không lọc thêm — đếm trên cả 60 đơn.
  http.get('/api/sales-orders/flow-counts', () => {
    const all = makeOrders(60);
    const count = (f: string) => all.filter((o) => o.flow === f).length;
    return HttpResponse.json({
      total: all.length,
      PENDING_APPROVAL: count('PENDING_APPROVAL'),
      WAREHOUSE: count('WAREHOUSE'),
      PICKING: count('PICKING'),
      PACKED: count('PACKED'),
      PICKED_UP: count('PICKED_UP'),
      IN_TRANSIT: count('IN_TRANSIT'),
      OUT_FOR_DELIVERY: count('OUT_FOR_DELIVERY'),
      DELIVERED: count('DELIVERED'),
      RETURNED: count('RETURNED'),
      CARRIER_CANCELLED: count('CARRIER_CANCELLED'),
      CANCELLED: count('CANCELLED'),
    });
  }),
  // POS Pancake cho bộ lọc đơn — đúng shape PancakeShopOptionDto.
  http.get('/api/pancake-sync/shops', () =>
    HttpResponse.json([
      { shopId: '715130909', shopName: 'Thiên Nông chính', isActive: true },
      { shopId: '407957969', shopName: null, isActive: false },
    ]),
  ),
  // Đồng bộ lại đơn Pancake theo POS — mặc định chưa chạy lần nào (PancakeOrderResyncStatusDto).
  http.get('/api/pancake-sync/transform/orders/resync', ({ request }) =>
    HttpResponse.json({
      shopId: new URL(request.url).searchParams.get('shopId') ?? '',
      state: 'idle',
      done: 0,
      total: 0,
      counts: {
        updated: 0,
        created: 0,
        skipped: 0,
        pickReplanned: 0,
        shippedExternal: 0,
        failed: 0,
      },
      failures: [],
      skippedOrders: [],
      error: null,
      startedAt: null,
      finishedAt: null,
    }),
  ),
  http.get('/api/sales-orders', async ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const status = url.searchParams.get('status');
    const customerId = url.searchParams.get('customerId');
    const weightMin = url.searchParams.get('weightMin');
    const weightMax = url.searchParams.get('weightMax');
    const noCarrier = url.searchParams.get('noCarrier') === 'true';
    const carrierId = url.searchParams.get('carrierId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    await delay(50);
    let all = makeOrders(60);
    if (q)
      all = all.filter(
        (o) =>
          o.docNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.pancakeOrderId === q.replace(/^#/, ''),
      );
    if (status) all = all.filter((o) => o.status === status);
    const flow = url.searchParams.get('flow');
    if (flow) all = all.filter((o) => o.flow === flow);
    if (customerId) all = all.filter((o) => o.customer.id === customerId);
    // Fixture thôi — so sánh bằng Number là đủ, không phải tiền.
    if (weightMin) all = all.filter((o) => Number(o.weightKg) >= Number(weightMin));
    if (weightMax) all = all.filter((o) => Number(o.weightKg) <= Number(weightMax));
    if (noCarrier) all = all.filter((o) => o.carrierId === null);
    if (carrierId) all = all.filter((o) => o.carrierId === carrierId);
    // Fixture: ngày → so sánh theo UTC là đủ (server thật lấy trọn ngày VN).
    if (from) all = all.filter((o) => o.orderDate >= new Date(from).toISOString());
    if (to) {
      const end = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999Z`) : new Date(to);
      all = all.filter((o) => o.orderDate <= end.toISOString());
    }
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.post('/api/sales-orders/bulk-update', async ({ request }) => {
    const body = (await request.json()) as {
      orderIds: string[];
      carrierId?: string | null;
      shippingWeightKg?: string | null;
    };
    await delay(30);
    const byId = new Map(makeOrders(60).map((o) => [o.id, o]));
    return HttpResponse.json(
      {
        updated: body.orderIds
          .filter((id) => byId.has(id))
          .map((id) => ({
            orderId: id,
            docNumber: byId.get(id)!.docNumber,
            status: byId.get(id)!.status,
            carrierId: body.carrierId === undefined ? null : body.carrierId,
            warehouseId: null,
            shippingWeightKg: body.shippingWeightKg ?? null,
            changed: [
              ...(body.carrierId !== undefined ? ['carrierId'] : []),
              ...(body.shippingWeightKg !== undefined ? ['shippingWeightKg'] : []),
            ],
          })),
        failed: body.orderIds
          .filter((id) => !byId.has(id))
          .map((id) => ({ orderId: id, docNumber: null, code: 'NOT_FOUND', message: 'not found' })),
      },
      { status: 201 },
    );
  }),
  http.post('/api/sales-orders/send-to-carrier', async ({ request }) => {
    const body = (await request.json()) as {
      orderIds: string[];
      carrierId: string;
      carrierAccountId?: string;
    };
    await delay(30);
    const byId = new Map(makeOrders(60).map((o) => [o.id, o]));
    const carrier = CARRIERS.find((c) => c.id === body.carrierId);
    if (!carrier) return errorEnvelope(404, 'NOT_FOUND');
    return HttpResponse.json(
      {
        sent: body.orderIds
          .filter((id) => byId.has(id))
          .map((id, i) => ({
            orderId: id,
            docNumber: byId.get(id)!.docNumber,
            carrierId: carrier.id,
            carrierCode: carrier.code,
            carrierAccountId: body.carrierAccountId ?? null,
            // Đơn đầu giả lập đã pick → cấp vận đơn ngay; còn lại lưu chờ đóng gói.
            outcome: i === 0 ? 'ISSUED' : 'SAVED',
            shipmentId: i === 0 ? uuid('00000009', i) : null,
            shipmentDocNumber: i === 0 ? 'DN2609-00001' : null,
            trackingNo: i === 0 ? `${carrier.code}0000001` : null,
            reason: null,
          })),
        failed: body.orderIds
          .filter((id) => !byId.has(id))
          .map((id) => ({ orderId: id, docNumber: null, code: 'NOT_FOUND', message: 'not found' })),
      },
      { status: 201 },
    );
  }),
  http.get('/api/sales-orders/:id', async ({ params }) => {
    await delay(50);
    const found = makeOrderDetail(String(params.id));
    return found ? HttpResponse.json(found) : errorEnvelope(404, 'NOT_FOUND');
  }),
  http.get('/api/stock', async ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    await delay(50);
    let all = makeStockRows(120);
    if (q)
      all = all.filter(
        (r) => r.skuCode.toLowerCase().includes(q) || r.skuName.toLowerCase().includes(q),
      );
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.get('/api/stock/by-location', async ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    await delay(50);
    const all = makeStockByLocation(80);
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.get('/api/stock/by-lot', async ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    await delay(50);
    const all = makeStockByLot(70);
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.get('/api/tasks', async ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const refType = url.searchParams.get('refType');
    const refId = url.searchParams.get('refId');
    const docNumber = url.searchParams.get('docNumber');
    const lineCount = url.searchParams.get('lineCount');
    const lineCountMin = url.searchParams.get('lineCountMin');
    await delay(50);
    let all = makeTasks(40);
    if (status) all = all.filter((t) => t.status === status);
    if (type) all = all.filter((t) => t.type === type);
    if (refType) all = all.filter((t) => t.refType === refType);
    if (refId) all = all.filter((t) => t.refId === refId);
    if (docNumber) all = all.filter((t) => t.docNumber === docNumber);
    if (lineCount) all = all.filter((t) => t.lineCount === Number(lineCount));
    if (lineCountMin) all = all.filter((t) => t.lineCount >= Number(lineCountMin));
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),

  // Lượt pick gộp (PLAN-barcode-pick-pack E3) — mặc định trống; test override khi cần.
  http.get('/api/waves', () => HttpResponse.json({ items: [], total: 0 })),
  // Gợi ý gộp theo cấp đóng gói (PLAN-packaging-hierarchy §12) — mặc định không có nhóm.
  http.get('/api/waves/suggestions', () =>
    HttpResponse.json({ items: [], cartonCount: 0, palletCount: 0 }),
  ),

  // Danh bạ người nhận việc của bảng điều phối (GET /tasks/assignees) — khai TRƯỚC /tasks/:id
  http.get('/api/tasks/assignees', () =>
    HttpResponse.json([
      { id: 'staff-1', code: 'wh.1', fullName: 'Phạm Thị Hoa', roles: ['WAREHOUSE'] },
      { id: 'staff-2', code: 'wh.2', fullName: 'Trần Văn Bảo', roles: ['WAREHOUSE'] },
      { id: 'staff-3', code: 'picker.1', fullName: 'Lê Văn Lấy', roles: ['PICKER'] },
      { id: 'staff-4', code: 'packer.1', fullName: 'Ngô Thị Đóng', roles: ['PACKER'] },
    ]),
  ),
  http.get('/api/tasks/:id', ({ params }) => HttpResponse.json(makeTaskDetail(String(params.id)))),

  // ── Quản trị: users / roles / permissions / departments ──
  http.get('/api/users', async ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase() ?? '';
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const take = Number(url.searchParams.get('take') ?? 50);
    const sortDir = url.searchParams.get('sortDir') ?? 'asc';
    let all = makeUsers(57);
    if (q) all = all.filter((u) => `${u.code} ${u.fullName} ${u.email}`.toLowerCase().includes(q));
    if (url.searchParams.get('sortBy') === 'code' && sortDir === 'desc') all = all.reverse();
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.post('/api/users', async ({ request }) => {
    const body = (await request.json()) as { code: string; fullName: string; email: string };
    return HttpResponse.json(
      { ...USER_DETAIL_FIXTURE, code: body.code, fullName: body.fullName, email: body.email },
      { status: 201 },
    );
  }),
  http.get('/api/users/:id', () => HttpResponse.json(USER_DETAIL_FIXTURE)),
  http.patch('/api/users/:id', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...USER_DETAIL_FIXTURE, ...body });
  }),
  http.get('/api/users/:id/pancake-profile', () => HttpResponse.json(PANCAKE_PROFILE_FIXTURE)),
  http.get('/api/me/pancake-profile', () => HttpResponse.json(PANCAKE_PROFILE_FIXTURE)),
  http.get('/api/me/profile', () =>
    HttpResponse.json({
      userId: 'u-admin',
      code: 'admin',
      email: 'admin@example.com',
      fullName: 'Quản trị',
      phone: null,
    }),
  ),
  // Tuỳ chọn giao diện theo người dùng (2026-10-22) — mặc định chưa lưu.
  http.get('/api/me/preferences/:key', ({ params }) =>
    HttpResponse.json({ key: params.key, value: null }),
  ),
  http.put('/api/me/preferences/:key', async ({ params, request }) => {
    const body = (await request.json()) as { value: Record<string, unknown> };
    return HttpResponse.json({ key: params.key, value: body.value });
  }),
  http.get('/api/users/:id/permissions', () => HttpResponse.json(USER_PERMISSIONS_FIXTURE)),
  http.put('/api/users/:id/permissions', async ({ request }) => {
    const body = (await request.json()) as { allow: string[]; deny: string[] };
    return HttpResponse.json({
      ...USER_PERMISSIONS_FIXTURE,
      entries: USER_PERMISSIONS_FIXTURE.entries.map((e) => ({
        ...e,
        override: body.allow.includes(e.code)
          ? 'ALLOW'
          : body.deny.includes(e.code)
            ? 'DENY'
            : null,
      })),
    });
  }),
  http.put('/api/users/:id/roles', async ({ request }) => {
    const body = (await request.json()) as { roles: string[] };
    return HttpResponse.json({
      userId: USER_DETAIL_FIXTURE.id,
      roles: body.roles,
      permissions: [],
    });
  }),
  http.get('/api/roles', () => HttpResponse.json(ROLES_FIXTURE)),
  http.get('/api/roles/assignable', () => HttpResponse.json(ROLES_FIXTURE)),
  http.put('/api/roles/:code', async ({ params, request }) => {
    const body = (await request.json()) as { permissions?: string[] };
    const role = ROLES_FIXTURE.find((r) => r.code === params.code);
    return role
      ? HttpResponse.json({ ...role, permissions: body.permissions ?? role.permissions })
      : errorEnvelope(404, 'NOT_FOUND');
  }),
  http.post('/api/roles', async ({ request }) => {
    const body = (await request.json()) as { code: string; name: string };
    return HttpResponse.json(
      { id: uuid('00000009', 9), description: null, permissions: [], memberCount: 0, ...body },
      { status: 201 },
    );
  }),
  http.get('/api/permissions', () => HttpResponse.json(PERMISSIONS_FIXTURE)),
  http.get('/api/shipment-monitor/summary', ({ request }) => {
    const url = new URL(request.url);
    const holdDays = Number(url.searchParams.get('holdDays') ?? 5);
    return HttpResponse.json(
      makeMonitorSummary(holdDays, url.searchParams.get('date') ?? '2026-08-20'),
    );
  }),
  http.get('/api/shipment-monitor', ({ request }) => {
    const url = new URL(request.url);
    const holdDays = Number(url.searchParams.get('holdDays') ?? 5);
    const view = url.searchParams.get('view') ?? 'HOLDING';
    const q = url.searchParams.get('q')?.toLowerCase();
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const take = Number(url.searchParams.get('take') ?? 50);
    const all = makeMonitorRows(12, holdDays)
      .filter((r) => view !== 'OVERDUE' || r.overdue)
      .filter(
        (r) =>
          !q ||
          r.docNumber.toLowerCase().includes(q) ||
          r.trackingNo.toLowerCase().includes(q) ||
          r.orderDocNumber.toLowerCase() === q,
      );
    return HttpResponse.json({ view, items: all.slice(skip, skip + take), total: all.length });
  }),
  // Việc đã giao cho tôi (GET /pda/tasks, màn pick cột "Việc được giao") — mặc định rỗng.
  http.get('/api/pda/tasks', () => HttpResponse.json([])),
  // Lượt gộp đã giao cho tôi (GET /pda/waves) — mặc định rỗng.
  http.get('/api/pda/waves', () => HttpResponse.json({ items: [], total: 0 })),
  // Cột "Đơn mới" + giao người đóng gói (2026-10-12) — mặc định rỗng; test luồng mới tự ghi đè.
  http.get('/api/pda/new-orders', () =>
    HttpResponse.json({
      warehouseId: null,
      items: [],
      total: 0,
      holding: 0,
      limit: 30,
      pendingHandover: 0,
    }),
  ),
  http.get('/api/pda/handover', () =>
    HttpResponse.json({ pending: [], pendingWarehouseId: null, openPicks: 0, latest: null }),
  ),
  // Hàng đợi + thống kê bàn đóng gói (role PACKER, 2026-09-15) — mặc định rỗng / 0.
  http.get('/api/pda/queue', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') ?? 'PACK';
    return HttpResponse.json({ type, warehouseId: null, items: [], waiting: 0, mine: 0 });
  }),
  http.get('/api/pda/stats', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') ?? 'PACK';
    return HttpResponse.json({
      userId: 'u-admin',
      type,
      date: '2026-09-15',
      from: '2026-09-14T17:00:00.000Z',
      to: '2026-09-15T17:00:00.000Z',
      completed: 0,
      items: [],
    });
  }),
  http.get('/api/shipments/:id/status-log', ({ params }) =>
    HttpResponse.json({ ...STATUS_LOG_FIXTURE, shipmentId: params.id }),
  ),
  http.get('/api/departments', () => HttpResponse.json(DEPARTMENTS_FIXTURE)),
  http.get('/api/org/tree', () => HttpResponse.json(ORG_TREE_FIXTURE)),

  // ── Quản trị: kết nối Pancake ──
  http.get('/api/pancake-sync/config', () => HttpResponse.json(PANCAKE_CONFIG_FIXTURE)),
  // Nhân viên Pancake ↔ tài khoản ERP — đúng shape PancakeStaffDto; ?pending=true chỉ dòng chờ.
  http.get('/api/pancake-sync/staff', ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get('pending') === 'true'
        ? PANCAKE_STAFF_FIXTURE.filter((s) => s.pending)
        : PANCAKE_STAFF_FIXTURE,
    ),
  ),
  // Tài khoản thật được gắn vào — đúng shape StaffCandidateDto (3 người, không pc.*).
  http.get('/api/pancake-sync/staff/candidates', ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    return HttpResponse.json(
      PANCAKE_STAFF_CANDIDATES_FIXTURE.filter(
        (u) => !q || u.fullName.toLowerCase().includes(q) || u.code.includes(q),
      ),
    );
  }),
  http.post('/api/pancake-sync/staff/relink', async ({ request }) => {
    const body = (await request.json()) as { fbId: string; userId: string };
    const target = PANCAKE_STAFF_CANDIDATES_FIXTURE.find((u) => u.id === body.userId);
    return HttpResponse.json(
      {
        fbId: body.fbId,
        userId: body.userId,
        userCode: target?.code ?? 'nv.002',
        shops: 1,
        absorbed: [],
      },
      { status: 201 },
    );
  }),
  http.post('/api/pancake-sync/staff/cleanup', () =>
    HttpResponse.json({ items: [] }, { status: 201 }),
  ),
  http.put('/api/pancake-sync/config/:shopId', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : null;
    return HttpResponse.json({
      ...PANCAKE_SHOP_FIXTURE,
      shopId: String(params.shopId),
      shopName: (body.shopName as string | null) ?? null,
      apiKeyHint: apiKey ? `…${apiKey.slice(-4)}` : PANCAKE_SHOP_FIXTURE.apiKeyHint,
    });
  }),
  http.delete('/api/pancake-sync/config/:shopId', () => new HttpResponse(null, { status: 204 })),
  // Sản phẩm bán trên shop: mặc định bán tất cả; PUT trả lại đúng danh sách gửi lên.
  http.get('/api/pancake-sync/config/:shopId/products', ({ params }) =>
    HttpResponse.json({
      shopId: String(params.shopId),
      restricted: false,
      products: [],
      updatedAt: null,
      updatedBy: null,
    }),
  ),
  http.put('/api/pancake-sync/config/:shopId/products', async ({ params, request }) => {
    const body = (await request.json()) as { restricted: boolean; productIds: string[] };
    return HttpResponse.json({
      shopId: String(params.shopId),
      restricted: body.restricted,
      products: body.productIds.map((id) => ({
        id,
        code: id,
        name: id,
        isCombo: false,
        isActive: true,
      })),
      updatedAt: '2026-10-08T08:00:00.000Z',
      updatedBy: null,
      queued: body.productIds.length,
    });
  }),
  http.post('/api/pancake-sync/config/:shopId/webhook-secret', ({ params }) =>
    HttpResponse.json({
      ...PANCAKE_SHOP_FIXTURE,
      shopId: String(params.shopId),
      webhookSecret: 'ffffffffffffffffffffffffffffffffffffffffffffffff',
    }),
  ),
  http.post('/api/pancake-sync/config/:shopId/verify', ({ params }) =>
    HttpResponse.json({
      shopId: String(params.shopId),
      warehouses: 3,
      verifiedAt: '2026-09-07T08:00:00.000Z',
    }),
  ),
  // Kho ERP trên các shop Pancake — đúng shape PancakeWarehouseLinksDto.
  http.get('/api/pancake-sync/warehouses/links', () =>
    HttpResponse.json(PANCAKE_WAREHOUSE_LINKS_FIXTURE),
  ),
  http.post('/api/pancake-sync/push/warehouses', () =>
    HttpResponse.json({
      results: [
        {
          shopId: '407957969',
          entity: 'warehouse',
          internalId: '00000077-0000-4000-8000-000000000001',
          action: 'updated',
          externalId: 'wh-pos-tt',
          reason: null,
        },
      ],
      total: 2,
      failed: 0,
    }),
  ),
  http.put('/api/pancake-sync/warehouses/:id/link', async ({ params, request }) => {
    const body = (await request.json()) as { shopId: string; externalId: string };
    return HttpResponse.json({
      shopId: body.shopId,
      entity: 'warehouse',
      internalId: String(params.id),
      action: 'updated',
      externalId: body.externalId,
      reason: null,
    });
  }),
  http.delete(
    '/api/pancake-sync/warehouses/:id/link',
    () => new HttpResponse(null, { status: 204 }),
  ),
  // ── Quản trị: Cấu hình hệ thống › Đơn vị vận chuyển ──
  http.get('/api/carriers/settings', () => HttpResponse.json(CARRIER_SETTINGS_FIXTURE)),
  http.put('/api/carriers/:code/settings', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const base = CARRIER_SETTINGS_FIXTURE.find((c) => c.code === params.code)!;
    return HttpResponse.json({
      ...base,
      fields: base.fields.map((f) =>
        typeof body[f.key] === 'string'
          ? {
              ...f,
              source: 'db',
              value: f.secret ? null : body[f.key],
              hint: f.secret ? `…${String(body[f.key]).slice(-4)}` : null,
            }
          : f,
      ),
    });
  }),
  http.post('/api/carriers/:code/settings/verify', () =>
    HttpResponse.json({
      status: 'ok',
      message: 'Token hợp lệ — 1 địa chỉ lấy hàng',
      verifiedAt: '2026-10-04T08:00:00.000Z',
    }),
  ),
  // Tài khoản của hãng (FE-CARRIER-ACC-1) — trả lại cả hãng như API thật.
  http.post('/api/carriers/:code/accounts', async ({ params, request }) => {
    const body = (await request.json()) as { name: string };
    const base = CARRIER_SETTINGS_FIXTURE.find((c) => c.code === params.code)!;
    return HttpResponse.json(
      {
        ...base,
        accounts: [
          ...base.accounts,
          {
            ...base.accounts[0]!,
            id: 'acc-new',
            name: body.name,
            isDefault: false,
            lastVerifiedAt: null,
            lastVerifyError: null,
          },
        ],
      },
      { status: 201 },
    );
  }),
  http.patch('/api/carriers/:code/accounts/:accountId', ({ params }) =>
    HttpResponse.json(CARRIER_SETTINGS_FIXTURE.find((c) => c.code === params.code)!),
  ),
  http.post('/api/carriers/:code/accounts/:accountId/default', ({ params }) =>
    HttpResponse.json(CARRIER_SETTINGS_FIXTURE.find((c) => c.code === params.code)!),
  ),
  http.post('/api/carriers/:code/accounts/:accountId/verify', () =>
    HttpResponse.json({
      status: 'ok',
      message: 'Token hợp lệ — 1 địa chỉ lấy hàng',
      verifiedAt: '2026-10-04T08:00:00.000Z',
    }),
  ),
  http.delete(
    '/api/carriers/:code/accounts/:accountId',
    () => new HttpResponse(null, { status: 204 }),
  ),
];

type FieldSource = 'db' | 'env' | 'apiConfig' | null;

const GHTK_DEFAULT_FIELDS = [
  {
    key: 'baseUrl' as const,
    label: 'Địa chỉ API',
    secret: false,
    value: 'https://services.giaohangtietkiem.vn',
    hint: null,
    source: 'env' as FieldSource,
    envName: 'CARRIER_GHTK_BASE_URL' as string | null,
    help: null,
  },
  {
    key: 'token' as const,
    label: 'Token API',
    secret: true,
    value: null,
    hint: '…9f2c' as string | null,
    source: 'env' as FieldSource,
    envName: 'CARRIER_GHTK_TOKEN' as string | null,
    help: 'Token API ở khachhang.giaohangtietkiem.vn',
  },
];

const JT_FIELDS = [
  {
    key: 'token' as const,
    label: 'Token API',
    secret: true,
    value: null,
    hint: null as string | null,
    source: null as FieldSource,
    envName: 'CARRIER_JT_TOKEN' as string | null,
    help: null,
  },
];

/**
 * Đúng shape `CarrierSettingDto` trong openapi.json — bí mật chỉ có hint, không có giá trị.
 * Trường cấp hãng = tài khoản mặc định; GHTK có thêm một tài khoản phụ (FE-CARRIER-ACC-1).
 */
export const CARRIER_SETTINGS_FIXTURE = [
  {
    code: 'GHTK',
    name: 'Giao Hàng Tiết Kiệm',
    isActive: true,
    configured: true,
    canVerify: true,
    secretsUnreadable: false,
    lastVerifiedAt: null,
    lastVerifyError: 'Hãng GHTK lỗi khi kiểm tra kết nối: Token không hợp lệ',
    updatedAt: null,
    fields: GHTK_DEFAULT_FIELDS,
    accounts: [
      {
        id: 'acc-ghtk-default',
        name: 'Mặc định',
        isDefault: true,
        isActive: true,
        configured: true,
        fields: GHTK_DEFAULT_FIELDS,
        secretsUnreadable: false,
        lastVerifiedAt: null as string | null,
        lastVerifyError: 'Hãng GHTK lỗi khi kiểm tra kết nối: Token không hợp lệ' as string | null,
        updatedAt: null as string | null,
      },
      {
        id: 'acc-ghtk-shop2',
        name: 'GHTK cửa hàng 2',
        isDefault: false,
        isActive: true,
        configured: true,
        fields: [
          { ...GHTK_DEFAULT_FIELDS[0]! },
          {
            ...GHTK_DEFAULT_FIELDS[1]!,
            hint: '…ab12',
            source: 'db' as FieldSource,
            envName: null,
          },
        ],
        secretsUnreadable: false,
        lastVerifiedAt: '2026-10-14T01:00:00.000Z' as string | null,
        lastVerifyError: null as string | null,
        updatedAt: '2026-10-14T01:00:00.000Z' as string | null,
      },
    ],
  },
  {
    code: 'JT',
    name: 'J&T Express',
    isActive: true,
    configured: false,
    canVerify: false,
    secretsUnreadable: false,
    lastVerifiedAt: null,
    lastVerifyError: null,
    updatedAt: null,
    fields: JT_FIELDS,
    accounts: [
      {
        id: 'acc-jt-default',
        name: 'Mặc định',
        isDefault: true,
        isActive: true,
        configured: false,
        fields: JT_FIELDS,
        secretsUnreadable: false,
        lastVerifiedAt: null as string | null,
        lastVerifyError: null as string | null,
        updatedAt: null as string | null,
      },
    ],
  },
];

/** Đúng shape `PancakeShopConfigDto` trong openapi.json — không có trường nào chứa khoá. */
export const PANCAKE_SHOP_FIXTURE = {
  shopId: '407957969',
  shopName: 'Shop chính',
  apiKeyHint: '…a9f2',
  source: 'db' as const,
  keyReadable: true,
  baseUrl: null,
  requestsPerSecond: null,
  burst: null,
  isActive: true,
  lastVerifiedAt: '2026-09-06T10:15:00.000Z',
  lastVerifyError: null,
  updatedAt: '2026-09-06T10:00:00.000Z',
  updatedBy: 'u-admin',
  webhookPath: '/pancake-sync/webhook/407957969',
  webhookSecret: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718',
  senderPhones: ['0911000001', '0911000002'] as string[],
};

/** Đúng shape `StaffCandidateDto` — 3 tài khoản thật (như makeUsers(3), không pc.*). */
export const PANCAKE_STAFF_CANDIDATES_FIXTURE = makeUsers(3).map((u) => ({
  id: u.id,
  code: u.code,
  fullName: u.fullName,
  email: u.email,
  departmentName: u.departmentName,
}));

/** Đúng shape `PancakeStaffDto` (2026-10-20: kèm email, đơn / khách treo, gợi ý, pending). */
export const PANCAKE_STAFF_FIXTURE = [
  {
    fbId: '888000111222',
    externalUserId: null,
    observedName: 'Marketer Chờ',
    observedPhone: '0900000000',
    observedEmail: 'mk@gmail.com',
    seenRoles: ['marketer'],
    shopIds: ['407957969'],
    user: null,
    autoCreated: false,
    orderCount: 0,
    customerCount: 0,
    suggestedUser: null,
    pending: true,
  },
  {
    fbId: '1660224970965826',
    externalUserId: '4fc6cdb6-5b09-4d1b-8a78-34bf0adbc751',
    observedName: 'Nguyen Manh Cuong',
    observedPhone: '84977191246',
    observedEmail: 'nv2@erp.local',
    seenRoles: ['creator', 'seller'],
    shopIds: ['407957969'],
    user: {
      id: '00000099-0000-4000-8000-000000000001',
      code: 'pc.nguyen.manh.cuong',
      fullName: 'Nguyen Manh Cuong',
      isActive: true,
    },
    autoCreated: true,
    orderCount: 1441,
    customerCount: 1427,
    suggestedUser: {
      id: PANCAKE_STAFF_CANDIDATES_FIXTURE[1]!.id,
      code: 'nv.002',
      fullName: 'Nhân viên 2',
      email: 'nv2@erp.local',
    },
    pending: true,
  },
  {
    fbId: '154057992263134',
    externalUserId: null,
    observedName: 'Thanh Vân Sale',
    observedPhone: null,
    observedEmail: null,
    seenRoles: ['seller'],
    shopIds: ['407957969'],
    user: {
      id: PANCAKE_STAFF_CANDIDATES_FIXTURE[2]!.id,
      code: 'nv.003',
      fullName: 'Nhân viên 3',
      isActive: true,
    },
    autoCreated: false,
    orderCount: 0,
    customerCount: 0,
    suggestedUser: null,
    pending: false,
  },
];

export const PANCAKE_CONFIG_FIXTURE = {
  items: [
    PANCAKE_SHOP_FIXTURE,
    {
      ...PANCAKE_SHOP_FIXTURE,
      shopId: '123456',
      shopName: 'Shop test',
      apiKeyHint: '…zz01',
      isActive: false,
      lastVerifiedAt: null,
      lastVerifyError: 'Pancake từ chối khoá API (401/403) — kiểm tra lại khoá.',
    },
  ],
  env: { hasApiKey: false, shopId: null },
};

export const PANCAKE_WAREHOUSE_LINKS_FIXTURE = {
  shops: [
    {
      shopId: '407957969',
      shopName: 'Shop chính',
      error: null,
      warehouses: [
        {
          warehouseId: '00000077-0000-4000-8000-000000000001',
          code: 'KHO-TT-01',
          name: 'Kho Thạch Thất',
          isActive: true,
          externalId: 'wh-pos-tt',
          externalName: 'Kho Thạch Thất',
          externalMissing: false,
        },
        {
          warehouseId: '00000077-0000-4000-8000-000000000002',
          code: 'KHO-LA-01',
          name: 'Kho Long An',
          isActive: true,
          externalId: null,
          externalName: null,
          externalMissing: false,
        },
        {
          warehouseId: '00000077-0000-4000-8000-000000000003',
          code: 'KHO-CU',
          name: 'Kho cũ',
          isActive: true,
          externalId: 'wh-pos-gone',
          externalName: null,
          externalMissing: true,
        },
      ],
      unlinked: [
        {
          externalId: 'wh-pos-vtnn',
          name: 'Vật Tư Nông Nghiệp',
          customId: null,
          fullAddress: 'Xã Thạch Thất, Hà Nội',
          allowCreateOrder: true,
        },
      ],
    },
  ],
};

/** Bộ handler trạng thái — story "error" / "empty" / "forbidden" dùng. */
export const scenario = {
  customersEmpty: http.get('/api/customers', () => HttpResponse.json({ items: [], total: 0 })),
  customersError: http.get('/api/customers', () => errorEnvelope(500, 'DB_ERROR')),
  customersForbidden: http.get('/api/customers', () => errorEnvelope(403, 'FORBIDDEN')),
  customersSlow: http.get('/api/customers', async () => {
    await delay('infinite');
    return HttpResponse.json({ items: [], total: 0 });
  }),
  customerNotFound: http.get('/api/customers/:id', () => errorEnvelope(404, 'NOT_FOUND')),
  customerError: http.get('/api/customers/:id', () => errorEnvelope(500, 'DB_ERROR')),
  customerForbidden: http.get('/api/customers/:id', () => errorEnvelope(403, 'FORBIDDEN')),
  customerOrdersEmpty: http.get('/api/customers/:id/orders', () =>
    HttpResponse.json({ items: [], total: 0 }),
  ),
  customerOrdersError: http.get('/api/customers/:id/orders', () => errorEnvelope(500, 'DB_ERROR')),
  customerStatsEmpty: http.get('/api/customers/:id/stats', () =>
    HttpResponse.json({
      orderCount: 0,
      revenue: '0.0000',
      aov: '0.0000',
      firstOrderAt: null,
      lastOrderAt: null,
      returnedRevenue: '0.0000',
      returnedOrderCount: 0,
      returnRate: null,
      topSkus: [],
    }),
  ),
  customerStatsError: http.get('/api/customers/:id/stats', () => errorEnvelope(500, 'DB_ERROR')),
  meSale: http.get('/api/auth/me', () => HttpResponse.json(ME_SALE)),

  usersEmpty: http.get('/api/users', () => HttpResponse.json({ items: [], total: 0 })),
  usersError: http.get('/api/users', () => errorEnvelope(500, 'DB_ERROR')),

  pancakeEmpty: http.get('/api/pancake-sync/config', () =>
    HttpResponse.json({ items: [], env: { hasApiKey: false, shopId: null } }),
  ),
  pancakeEnvOnly: http.get('/api/pancake-sync/config', () =>
    HttpResponse.json({
      items: [
        {
          ...PANCAKE_SHOP_FIXTURE,
          source: 'env',
          apiKeyHint: '…env1',
          shopName: null,
          updatedAt: null,
          updatedBy: null,
          lastVerifiedAt: null,
        },
      ],
      env: { hasApiKey: true, shopId: PANCAKE_SHOP_FIXTURE.shopId },
    }),
  ),
  pancakeError: http.get('/api/pancake-sync/config', () => errorEnvelope(500, 'DB_ERROR')),
  carrierSettingsEmpty: http.get('/api/carriers/settings', () => HttpResponse.json([])),
  carrierSettingsError: http.get('/api/carriers/settings', () => errorEnvelope(500, 'DB_ERROR')),
  carrierVerifyFailed: http.post('/api/carriers/:code/accounts/:accountId/verify', () =>
    HttpResponse.json({
      status: 'failed',
      message: 'Hãng GHTK lỗi khi kiểm tra kết nối: Token không hợp lệ',
      verifiedAt: null,
    }),
  ),
  pancakeVerifyFailed: http.post('/api/pancake-sync/config/:shopId/verify', () =>
    errorEnvelope(502, 'PANCAKE_VERIFY_FAILED', 'x', { upstreamStatus: 401 }),
  ),
  userCreate422: http.post('/api/users', () =>
    errorEnvelope(422, 'VALIDATION', 'x', { missing: ['NOPE'] }),
  ),
  userCreateDupCode: http.post('/api/users', () =>
    errorEnvelope(400, 'VALIDATION', 'x', ['code đã tồn tại']),
  ),

  ordersEmpty: http.get('/api/sales-orders', () => HttpResponse.json({ items: [], total: 0 })),
  ordersError: http.get('/api/sales-orders', () => errorEnvelope(500, 'DB_ERROR')),
  ordersForbidden: http.get('/api/sales-orders', () => errorEnvelope(403, 'FORBIDDEN')),
  orderNotFound: http.get('/api/sales-orders/:id', () => errorEnvelope(404, 'NOT_FOUND')),
  /** Đơn đã pick xong, phiếu giao có vận đơn GHTK → thẻ Vận đơn + nút In nhãn. */
  orderWithShipment: http.get('/api/sales-orders/:id', ({ params }) => {
    const found = makeOrderDetail(String(params.id));
    return found
      ? HttpResponse.json({ ...found, shipment: ORDER_SHIPMENT_FIXTURE })
      : errorEnvelope(404, 'NOT_FOUND');
  }),
  orderError: http.get('/api/sales-orders/:id', () => errorEnvelope(500, 'DB_ERROR')),
  orderForbidden: http.get('/api/sales-orders/:id', () => errorEnvelope(403, 'FORBIDDEN')),

  stockEmpty: http.get('/api/stock', () => HttpResponse.json({ items: [], total: 0 })),
  stockError: http.get('/api/stock', () => errorEnvelope(500, 'DB_ERROR')),
  stockForbidden: http.get('/api/stock', () => errorEnvelope(403, 'FORBIDDEN')),
  stockByLotEmpty: http.get('/api/stock/by-lot', () => HttpResponse.json({ items: [], total: 0 })),

  tasksEmpty: http.get('/api/tasks', () => HttpResponse.json({ items: [], total: 0 })),
  tasksError: http.get('/api/tasks', () => errorEnvelope(500, 'DB_ERROR')),
  tasksForbidden: http.get('/api/tasks', () => errorEnvelope(403, 'FORBIDDEN')),
};
