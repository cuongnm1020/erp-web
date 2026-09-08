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
  hasGlobalAccess: true,
};

export const ME_SALE = {
  userId: 'u-sale',
  code: 'sale.hn.1',
  roles: ['SALES_MEMBER'],
  permissions: ['customer.read', 'customer.create', 'sales_order.read', 'sales_order.create'],
  leaderTeamIds: [],
  hasGlobalAccess: false,
};

const CUSTOMER_TYPES = ['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'KEY_ACCOUNT'] as const;

/** Đúng shape `CustomerDto` trong openapi.json — đổi DTO ở backend thì sửa cả đây. */
export function makeCustomers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    code: `KH${String(i + 1).padStart(5, '0')}`,
    name: `Khách hàng ${i + 1}`,
    taxCode: i % 4 === 0 ? `010${String(1000000 + i)}` : null,
    phone: `09${String(10000000 + i).slice(0, 8)}`,
    email: i % 3 === 0 ? `kh${i + 1}@example.com` : null,
    type: CUSTOMER_TYPES[i % CUSTOMER_TYPES.length]!,
    groupId: null,
    tierId: null,
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

const ORDER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'CANCELLED'] as const;
const ORDER_CHANNELS = ['DIRECT', 'MARKETPLACE', 'WEBSITE', 'POS'] as const;

const uuid = (prefix: string, i: number) =>
  `${prefix}-0000-4000-8000-${String(i).padStart(12, '0')}`;

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
    carrierId: null,
    postedAt:
      ORDER_STATUSES[i % ORDER_STATUSES.length] === 'POSTED' ? '2026-08-24T02:00:00.000Z' : null,
    createdAt: new Date(Date.UTC(2026, 7, 23) - i * 3_600_000).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 7, 23) - i * 1_800_000).toISOString(),
  }));
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
    reservedQty: String((i + 1) * 10),
    pickedQty: i === 0 ? String((i + 1) * 10) : '0',
  }));
  return { ...header, carrier: null, lines };
}

/** Đúng shape `CarrierDto` (GET /carriers). */
export const CARRIERS = [
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
];

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
      qtyPlanned: String(((i % 12) + 1) * 10),
      qtyDone: done ? String(((i % 12) + 1) * 10) : String((i % 12) * 3),
      refType: i % 2 === 0 ? 'SalesOrder' : 'GoodsReceipt',
      refId: uuid('00000001', i),
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

/** Đúng shape `StuckShipmentDto`. */
export function makeStuckShipments(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: uuid('0000000e', i),
    docNumber: `DN-2608-${String(i + 1).padStart(5, '0')}`,
    orderId: uuid('00000001', i),
    status: (['PICKED_UP', 'IN_TRANSIT', 'FAILED'] as const)[i % 3]!,
    carrierCode: 'GHTK',
    carrierName: 'Giao Hàng Tiết Kiệm',
    trackingNo: `S${String(i + 1).padStart(8, '0')}.HN`,
    shippedAt: new Date(Date.UTC(2026, 7, 20) - i * 86_400_000).toISOString(),
    lastCarrierSyncAt: i % 2 === 0 ? new Date(Date.UTC(2026, 7, 27)).toISOString() : null,
    carrierStatusCode: String(4 + (i % 3)),
    daysSinceShipped: 6 + i,
  }));
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

export const handlers = [
  http.get('/api/carriers', () => HttpResponse.json(CARRIERS)),
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
      all = all.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    all = [...all].sort((a, b) => {
      const x = String(a[sortBy as keyof typeof a] ?? '');
      const y = String(b[sortBy as keyof typeof b] ?? '');
      return x < y ? -dir : x > y ? dir : 0;
    });
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.get('/api/customers/:id', async ({ params }) => {
    await delay(50);
    const found = makeCustomers(237).find((c) => c.id === params.id);
    return found ? HttpResponse.json(found) : errorEnvelope(404, 'NOT_FOUND');
  }),
  http.get('/api/sales-orders', async ({ request }) => {
    const url = new URL(request.url);
    const take = Number(url.searchParams.get('take') ?? 50);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const status = url.searchParams.get('status');
    const customerId = url.searchParams.get('customerId');
    await delay(50);
    let all = makeOrders(60);
    if (q)
      all = all.filter(
        (o) => o.docNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q),
      );
    if (status) all = all.filter((o) => o.status === status);
    if (customerId) all = all.filter((o) => o.customer.id === customerId);
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
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
    await delay(50);
    let all = makeTasks(40);
    if (status) all = all.filter((t) => t.status === status);
    if (type) all = all.filter((t) => t.type === type);
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),

  // Danh bạ người nhận việc của bảng điều phối (GET /tasks/assignees)
  http.get('/api/tasks/assignees', () =>
    HttpResponse.json([
      { id: 'staff-1', code: 'wh.1', fullName: 'Phạm Thị Hoa' },
      { id: 'staff-2', code: 'wh.2', fullName: 'Trần Văn Bảo' },
    ]),
  ),

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
  http.get('/api/carriers/stuck-shipments', async ({ request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days') ?? 5);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const take = Number(url.searchParams.get('take') ?? 50);
    const all = makeStuckShipments(12).filter((s) => s.daysSinceShipped >= days);
    return HttpResponse.json({ items: all.slice(skip, skip + take), total: all.length });
  }),
  http.get('/api/shipments/:id/status-log', ({ params }) =>
    HttpResponse.json({ ...STATUS_LOG_FIXTURE, shipmentId: params.id }),
  ),
  http.get('/api/departments', () => HttpResponse.json(DEPARTMENTS_FIXTURE)),

  // ── Quản trị: kết nối Pancake ──
  http.get('/api/pancake-sync/config', () => HttpResponse.json(PANCAKE_CONFIG_FIXTURE)),
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
};

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
