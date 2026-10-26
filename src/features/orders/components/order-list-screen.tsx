'use client';

import type { RowSelectionState } from '@tanstack/react-table';
import Decimal from 'decimal.js';
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  ExternalLink,
  MessageSquareText,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { CopyButton } from '@/components/data/copy-button';
import { CopyText } from '@/components/data/copy-text';
import { pancakeShopLabel } from '@/components/data/pancake-shop-select';
import { ColumnPicker, DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import {
  formatDateTime,
  formatMoney,
  formatPhone,
  groupVi,
  normalizePhone,
  formatQuantity,
  formatWaited,
  formatRelative,
  phoneCarrier,
  toDecimal,
} from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useHotkey } from '@/lib/use-hotkey';
import { useListState, type SortState } from '@/lib/url-state';
import { useCarriers } from '@/features/wms/api/use-shipping';
import { CarrierSelect } from '@/features/wms/components/carrier-select';
import {
  orderKeys,
  useOrderFlowCounts,
  useOrderListPrefs,
  useOrders,
  useCareTeamOptions,
  usePancakeShops,
  useSaveOrderListPrefs,
  type OrderFlow,
  type OrderCarrierSource,
  type OrderItemOrigin,
  type OrderSortField,
  type SalesOrderListItem,
} from '../api/use-orders';
import {
  FLOW_FAMILY_DOT,
  fulfilmentLabel,
  ORDER_FLOW_TABS,
  parseOrderFlow,
  parseOrderStatus,
} from '../labels';
import { BulkCancelDialog } from './bulk-cancel-dialog';
import { BulkMoveWarehouseDialog } from './bulk-move-warehouse-dialog';
import { BulkFulfilPrintDialog } from './bulk-fulfil-print-dialog';
import { BulkReprintWaybillDialog } from './bulk-reprint-waybill-dialog';
import { BulkShippingDialog } from './bulk-shipping-dialog';
import { FlowBadge, OrderQuickView, TelcoBadge } from './order-quick-view';
import { OrderSavedViews } from './order-saved-views';
import { OrderScanButton } from './order-scan-button';
import { PancakeOrderResyncButton } from './pancake-order-resync-button';
import { SendToCarrierMenu } from './send-to-carrier-menu';
import { PancakeOrderLink } from './pancake-order-link';

/**
 * D-03 Quản lý đơn hàng — GET /sales-orders + GET /sales-orders/flow-counts (thiết kế lại
 * 2026-10-12, canvas "Quản lý đơn hàng — thiết kế lại").
 *
 * Dữ liệu đã được API scope theo khách hàng (bất biến 8): sale chỉ thấy đơn của khách mình
 * phụ trách; số đếm tab cũng do API tính theo scope. Frontend KHÔNG lọc lại theo quyền (luật 7).
 *
 * Tab = luồng chung của đơn (Chờ duyệt → … → Thành công | Sự cố hoàn | Hãng hủy | Đã hủy, bảng
 * trạng thái ở apps/api/docs/carrier-status-mapping.md) — `?flow=` trên URL cùng mọi bộ lọc,
 * trang (luật 8). Bấm một dòng → xem nhanh bên phải; bấm số đơn → màn chi tiết. Chọn nhiều dòng →
 * "Gửi sang ĐVVC" / "Gán hãng / cân nặng" / "In lại vận đơn" (tem ERP 100×75, đơn đã có mã).
 *
 * Trạng thái không sửa tay trên dòng (khác Pancake): trạng thái do quy trình kho + hãng cập nhật.
 * Chưa làm so với canvas (cần API riêng): Nhập / Xuất Excel, lọc theo người phụ trách (chưa có
 * danh bạ người dùng cho sale).
 *
 * Redesign Bán hàng 2026-10-22 (canvas "Redesign Bán hàng", đã duyệt): tab chia họ màu, thanh lọc
 * gọn (lọc ít dùng vào "Thêm lọc"), "Bộ lọc đã lưu", cột cuối RowActions (Xem nhanh + ⋯ có
 * Nhân bản đơn), chọn nhiều → BulkActionBar thay chỗ thanh lọc, F2 tạo đơn.
 */
const DEFAULTS = {
  size: 50,
  filterKeys: [
    'flow',
    'status',
    'customerId',
    'weightMin',
    'weightMax',
    'noCarrier',
    'carrierId',
    // Tài khoản hãng (ô chọn hãng dùng chung) + ai gán hãng (ERP / Pancake), 2026-10-25.
    'carrierAccountId',
    'carrierSource',
    // Kho: ô chọn kho làm việc ở sidebar (header X-Warehouse-Id) — không còn bộ lọc kho riêng.
    'source',
    'from',
    'to',
    // CSKH-5: chỉ đơn trùng trong ngày (cùng SĐT, cùng ngày VN, chưa hủy).
    'duplicate',
    // Đơn có sản phẩm không phải hàng ERP (món gõ tay / SKU Pancake tự sinh), 2026-10-22.
    'itemOrigin',
    // Team CSKH lên đơn (phòng ban loại CSKH), 2026-10-24.
    'careTeamId',
    // Đơn thiếu tồn một SKU (Chờ hàng, 2026-10-25) — "Xem đơn" từ màn Hàng chờ.
    'shortSkuId',
  ] as const,
};

const ITEM_ORIGIN_OPTIONS: { value: OrderItemOrigin; label: string }[] = [
  { value: 'NON_ERP', label: 'Có SP không phải hàng ERP' },
  { value: 'CUSTOM', label: 'Có món gõ tay trên Pancake' },
  { value: 'POS_SKU', label: 'Có SP Pancake tự tạo' },
];
const parseItemOrigin = (v: string | undefined): OrderItemOrigin | undefined =>
  ITEM_ORIGIN_OPTIONS.find((o) => o.value === v)?.value;

/** Ai gán hãng cho đơn (2026-10-25): chọn trong ERP hay Pancake gán + cấp vận đơn. */
const CARRIER_SOURCE_OPTIONS: { value: OrderCarrierSource; label: string }[] = [
  { value: 'ERP', label: 'Hệ thống ERP gán hãng' },
  { value: 'PANCAKE', label: 'Pancake gán hãng' },
];
const parseCarrierSource = (v: string | undefined): OrderCarrierSource | undefined =>
  CARRIER_SOURCE_OPTIONS.find((o) => o.value === v)?.value;

/**
 * Cột sắp được → trường `sortBy` của API. Cột không có ở đây không sắp được (sản phẩm, vận
 * chuyển… là dữ liệu ghép từ nhiều nguồn, server không sắp theo chúng).
 */
const SORT_FIELD: Record<string, OrderSortField> = {
  docNumber: 'docNumber',
  orderDate: 'orderDate',
  customer: 'customer',
  total: 'total',
  time: 'time',
};

/**
 * Cột ẩn khi người dùng chưa chọn lần nào. "Thực thu ĐVVC" gần như toàn "—" tới khi hãng đối
 * soát → ẩn mặc định, bật lại ở "Cột".
 */
const DEFAULT_HIDDEN = ['orderDate', 'collected'];
/** Cột chỉ hiện ở tab Chờ hàng. */
const WAITING_ONLY_COLUMNS = ['shortage', 'waitingSince'];

type OrderFilter = (typeof DEFAULTS.filterKeys)[number];

/** Lọc ít dùng — nằm sau nút "Thêm lọc", tự hiện trên thanh khi đang có giá trị. */
const EXTRA_FILTERS = [
  { key: 'duplicate', label: 'Trùng trong ngày' },
  { key: 'itemOrigin', label: 'Sản phẩm ngoài ERP' },
  { key: 'weightMin', label: 'Cân nặng' },
] as const satisfies ReadonlyArray<{ key: OrderFilter; label: string }>;
type ExtraFilter = (typeof EXTRA_FILTERS)[number]['key'];

/** Quyền + handler mà cột thao tác cần — tính một lần ở màn, không gọi hook trong cell. */
interface RowActionContext {
  canUpdate: boolean;
  canCreate: boolean;
  onPeek: (row: SalesOrderListItem) => void;
}

/** Menu "⋯" của một dòng đơn: mở / sửa / nhân bản (redesign 2026-10-22). */
function orderRowItems(o: SalesOrderListItem, ctx: RowActionContext): RowActionItem[] {
  return [
    {
      label: 'Mở chi tiết',
      icon: <ExternalLink aria-hidden />,
      href: `/crm/orders/${o.id}`,
    },
    ...(ctx.canUpdate
      ? [
          {
            label: 'Sửa đơn',
            icon: <Pencil aria-hidden />,
            href: `/crm/orders/${o.id}/edit`,
            disabledReason: o.status === 'CANCELLED' ? 'Đơn đã hủy' : undefined,
          },
        ]
      : []),
    ...(ctx.canCreate
      ? [
          {
            // ?from= mở tab tạo đơn điền sẵn từ đơn này; đơn gốc giữ nguyên.
            label: 'Nhân bản đơn',
            icon: <Copy aria-hidden />,
            href: `/crm/orders/new?from=${o.id}`,
          },
        ]
      : []),
  ];
}

/**
 * Cột của bảng — `carrierOf` tra mã + tên hãng chọn trên đơn khi kho chưa tạo phiếu giao.
 * Cột Kho đã bỏ (2026-10-22): danh sách luôn lọc theo kho làm việc ở ô chọn kho.
 */
const buildColumns = (
  carrierOf: (id: string) => CarrierRef | null,
  actions: RowActionContext,
): ColumnDef<SalesOrderListItem, unknown>[] => [
  {
    id: 'docNumber',
    header: 'Mã đơn',
    meta: { width: 170, sortable: true },
    cell: ({ row }) => {
      const o = row.original;
      // Nguồn (Pancake # / ERP) + sale trên MỘT dòng phụ, cắt gọn — tên đầy đủ ở title.
      const meta = [o.pancakeOrderId ? null : 'Tạo trong ERP', o.ownerName].filter(Boolean);
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/crm/orders/${o.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-xs font-semibold text-primary hover:underline"
            >
              {o.docNumber}
            </Link>
            <CopyButton value={o.docNumber} label="mã đơn" />
            {o.note ? (
              <span title={o.note} className="inline-flex text-warning">
                <MessageSquareText className="h-3.5 w-3.5" aria-label="Có ghi chú" />
              </span>
            ) : null}
          </div>
          <div
            className="max-w-40 truncate text-xs text-muted-foreground"
            title={[o.pancakeOrderId ? `Pancake #${o.pancakeOrderId}` : null, ...meta]
              .filter(Boolean)
              .join(' · ')}
          >
            {o.pancakeOrderId ? (
              <PancakeOrderLink orderId={o.pancakeOrderId} link={o.pancakeOrderLink} />
            ) : null}
            {o.pancakeOrderId && meta.length > 0 ? ' · ' : null}
            {meta.join(' · ')}
          </div>
        </div>
      );
    },
  },
  {
    id: 'orderDate',
    header: 'Ngày đặt',
    meta: { width: 130, sortable: true },
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs">{formatDateTime(row.original.orderDate)}</span>
    ),
  },
  {
    id: 'customer',
    header: 'Khách hàng',
    meta: { width: 200, sortable: true },
    cell: ({ row }) => {
      const o = row.original;
      const telco = phoneCarrier(o.phone);
      return (
        <div className="space-y-1">
          <span className="block max-w-48 truncate font-medium" title={o.customer.name}>
            {o.recipientName ?? o.customer.name}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {/* Viết liền (0356523006) như trước — dán thẳng vào Zalo / tổng đài (2026-10-13). */}
            <span className="font-mono text-xs">
              {o.phone ? (normalizePhone(o.phone) ?? o.phone) : formatPhone(o.phone)}
            </span>
            {telco ? <TelcoBadge name={telco} /> : null}
            {o.phone ? (
              // Chép dạng viết liền (0356523006) để dán thẳng vào Zalo / tổng đài.
              <CopyButton value={normalizePhone(o.phone) ?? o.phone} label="số điện thoại" />
            ) : null}
          </span>
        </div>
      );
    },
  },
  {
    id: 'address',
    header: 'Địa chỉ nhận',
    meta: { width: 240 },
    cell: ({ row }) => (
      <div className="space-y-1">
        <span className="block max-w-60 truncate" title={row.original.addressLine ?? undefined}>
          {row.original.addressLine ?? '—'}
        </span>
        <span className="block text-xs text-muted-foreground">{row.original.province}</span>
      </div>
    ),
  },
  {
    id: 'product',
    header: 'Sản phẩm',
    meta: { width: 230 },
    cell: ({ row }) => {
      const p = row.original.product;
      if (!p) return <span className="text-muted-foreground">—</span>;
      const name = `${p.name} × ${formatQuantity(p.qty)}`;
      return (
        <div className="space-y-1">
          <span className="block max-w-56 truncate" title={name}>
            {name}
          </span>
          {p.moreCount > 0 ? (
            <span className="block text-xs text-primary">+{p.moreCount} sản phẩm khác</span>
          ) : null}
        </div>
      );
    },
  },
  // Hai cột của tab Chờ hàng (màn lọc bỏ ở tab khác).
  {
    id: 'shortage',
    header: 'Hàng thiếu',
    meta: { width: 230 },
    cell: ({ row }) => {
      const items = row.original.shortage?.items ?? [];
      const first = items[0];
      if (!first) return <span className="text-muted-foreground">—</span>;
      const name = `${first.skuName} × ${formatQuantity(first.qty)}`;
      return (
        <div className="space-y-1">
          <span className="block max-w-56 truncate font-semibold text-warning" title={name}>
            {name}
          </span>
          {items.length > 1 ? (
            <span
              className="block text-xs text-muted-foreground"
              title={items
                .slice(1)
                .map((i) => `${i.skuName} × ${formatQuantity(i.qty)}`)
                .join(', ')}
            >
              + {items.length - 1} SP thiếu khác
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'waitingSince',
    header: 'Chờ từ',
    meta: { width: 120, align: 'right' },
    cell: ({ row }) => {
      const since = row.original.shortage?.since;
      return since ? (
        <span className="whitespace-nowrap" title={formatDateTime(since)}>
          {formatWaited(since)}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    id: 'shipping',
    header: 'Vận chuyển',
    meta: { width: 200 },
    cell: ({ row }) => <ShippingCell order={row.original} carrierOf={carrierOf} />,
  },
  {
    id: 'total',
    header: 'Tổng tiền',
    meta: { align: 'right', width: 120, sortable: true },
    cell: ({ row }) => {
      const o = row.original;
      return (
        <div className="space-y-1">
          <span className="block font-semibold">{formatMoney(o.total, { unit: '' })}</span>
          <span className="block text-xs text-muted-foreground">
            COD {formatMoney(o.shipment?.codAmount ?? o.total, { unit: '' })}
          </span>
        </div>
      );
    },
  },
  {
    id: 'collected',
    // Header dạng hàm để giữ tooltip giải thích (meta.title của DataTable là CHỮ tiêu đề; ô
    // chọn cột đọc meta.title).
    header: () => (
      <span
        className="block text-right"
        title="Ước tính: COD − phí VC khi giao thành công; − phí VC khi hoàn"
      >
        Thực thu ĐVVC
      </span>
    ),
    meta: { align: 'right', width: 120, title: 'Thực thu ĐVVC' },
    cell: ({ row }) => {
      const v = row.original.shipment?.collectedAmount;
      if (!v) return <span className="text-muted-foreground">—</span>;
      const negative = toDecimal(v)?.isNegative() ?? false;
      return (
        <span className={cn('font-semibold', negative && 'text-destructive')}>
          {formatMoney(v, { unit: '' })}
        </span>
      );
    },
  },
  {
    // Trạng thái + thời gian gộp một cột (2026-10-22); id giữ 'time' để sắp xếp theo thời gian
    // (và tuỳ chọn sắp đã lưu của người dùng) vẫn chạy.
    id: 'time',
    header: 'Trạng thái',
    meta: { width: 160, sortable: true, title: 'Trạng thái' },
    cell: ({ row }) => {
      const o = row.original;
      return (
        <div className="space-y-0.5">
          <span className="flex flex-wrap items-center gap-1">
            <span title={o.fulfilmentStatus ? fulfilmentLabel(o.fulfilmentStatus) : undefined}>
              <FlowBadge flow={o.flow} />
            </span>
            {o.sameDayCount > 0 ? (
              <span title={`Cùng SĐT khách còn ${o.sameDayCount} đơn khác hôm đặt đơn này`}>
                <StatusBadge tone="warn">Trùng · {o.sameDayCount + 1} đơn</StatusBadge>
              </span>
            ) : null}
          </span>
          <span
            className="block text-xs text-muted-foreground"
            title={`Tạo ${formatDateTime(o.createdAt)} · đổi trạng thái ${formatDateTime(
              o.statusChangedAt ?? o.updatedAt,
            )}`}
          >
            {formatRelative(o.statusChangedAt ?? o.updatedAt)}
          </span>
        </div>
      );
    },
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Thao tác</span>,
    meta: { width: 72, title: 'Thao tác' },
    cell: ({ row }) => (
      <RowActions
        itemName={`đơn ${row.original.docNumber}`}
        primary={{
          label: 'Xem nhanh',
          icon: <Eye aria-hidden />,
          onClick: () => actions.onPeek(row.original),
        }}
        items={orderRowItems(row.original, actions)}
      />
    ),
  },
];

interface CarrierRef {
  code: string;
  name: string;
}

/**
 * Hãng (viết tắt = mã hãng: GHTK, VTP…) + phí VC + mã vận đơn; chưa có phiếu giao thì hãng chọn
 * trên đơn / "Chưa gán hãng". Có mã vận đơn → bấm mã hãng (hoặc mã vận đơn) là sao chép mã vận đơn.
 */
function ShippingCell({
  order,
  carrierOf,
}: {
  order: SalesOrderListItem;
  carrierOf: (id: string) => CarrierRef | null;
}) {
  const s = order.shipment;
  // Phiếu giao thắng; chưa có phiếu thì hãng sale chọn trên đơn (tra từ danh mục hãng).
  const picked = order.carrierId ? carrierOf(order.carrierId) : null;
  const code = s?.carrierCode ?? picked?.code ?? null;
  const fullName = s?.carrierName ?? picked?.name ?? code;
  const short = code ?? (order.carrierId ? 'Đã chọn hãng' : null);
  return (
    <div className="space-y-1 text-xs">
      {short ? (
        <span className="block whitespace-nowrap">
          {s?.trackingNo ? (
            <CopyText value={s.trackingNo} what="mã vận đơn" className="font-semibold">
              <span title={fullName ?? undefined}>{short}</span>
            </CopyText>
          ) : (
            <span className="font-semibold" title={fullName ?? undefined}>
              {short}
            </span>
          )}
          {s?.shipFee ? (
            <span className="text-muted-foreground">
              {' '}
              · phí {formatMoney(s.shipFee, { unit: '' })}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="block text-warning">Chưa gán hãng</span>
      )}
      {s?.trackingNo ? (
        <CopyText
          value={s.trackingNo}
          what="mã vận đơn"
          className="block max-w-48 truncate font-mono text-muted-foreground"
        />
      ) : (
        <WeightNote order={order} />
      )}
    </div>
  );
}

/**
 * Cân nặng gửi hãng hiệu lực (`weightKg` = đặt tay ?? Σ dòng × cân nặng SKU) khi chưa có mã vận
 * đơn — gom đơn theo cân để gán hãng. Đặt tay có dấu ✎ + tooltip Σ dòng; 0 = SKU chưa khai.
 */
function WeightNote({ order }: { order: SalesOrderListItem }) {
  const manual = order.shippingWeightKg !== null;
  if ((toDecimal(order.weightKg)?.isZero() ?? true) && !manual) return null;
  return (
    <span
      className="block tabular-nums text-muted-foreground"
      title={
        manual
          ? `Đặt tay · tính từ dòng: ${formatQuantity(order.lineWeightKg, { unit: 'kg' })}`
          : 'Tính từ cân nặng SKU'
      }
    >
      {formatQuantity(order.weightKg, { unit: 'kg' })}
      {manual ? (
        <span className="ml-1" aria-label="đặt tay">
          ✎
        </span>
      ) : null}
    </span>
  );
}

/**
 * Tab luồng đơn + số đếm (API). Tab cùng họ màu (design system `flow-*`) đứng cạnh nhau, vạch
 * dọc tách họ, chấm màu ở tab đầu họ; tab đang 0 đơn chữ mờ (vẫn bấm được).
 */
function FlowTabs({
  value,
  counts,
  onChange,
}: {
  value: OrderFlow | undefined;
  counts: Record<string, number> | undefined;
  onChange: (v: OrderFlow | undefined) => void;
}) {
  const tabs = [
    { key: undefined as OrderFlow | undefined, label: 'Tất cả', divider: false, dot: null },
    ...ORDER_FLOW_TABS.map((t, i) => {
      const first = i === 0 || ORDER_FLOW_TABS[i - 1]!.family !== t.family;
      return {
        key: t.flow as OrderFlow | undefined,
        label: t.label,
        divider: first,
        dot: first ? FLOW_FAMILY_DOT[t.family] : null,
      };
    }),
  ];
  return (
    <div
      className="mb-3 flex overflow-x-auto border-b"
      role="tablist"
      aria-label="Trạng thái đơn hàng"
    >
      {tabs.map((t) => {
        const active = value === t.key;
        const n = counts?.[t.key ?? 'total'];
        const zero = n === 0;
        return (
          <div key={t.key ?? '__all__'} className="flex flex-none items-stretch">
            {t.divider ? <span aria-hidden className="mx-1 my-3 w-px bg-input-soft" /> : null}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              className={cn(
                '-mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-sm',
                active
                  ? 'border-primary font-semibold text-foreground'
                  : zero
                    ? 'border-transparent text-subtle-foreground hover:text-foreground'
                    : 'border-transparent font-semibold text-muted-foreground hover:text-foreground',
              )}
            >
              {t.dot ? (
                <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
              ) : null}
              {t.label}
              <span className="font-normal tabular-nums text-subtle-foreground">
                {n === undefined ? '…' : groupVi(String(n))}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * "Thêm lọc": bật / tắt các lọc ít dùng trên thanh lọc. Lọc đang có giá trị luôn hiện (không tắt
 * được ở đây — bỏ giá trị bằng chính ô lọc hoặc "Xóa lọc").
 */
function MoreFilters({
  shown,
  active,
  onToggle,
}: {
  shown: ReadonlySet<ExtraFilter>;
  active: ReadonlySet<ExtraFilter>;
  onToggle: (key: ExtraFilter) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary-hover">
          <Plus aria-hidden />
          Thêm lọc
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Lọc thêm theo</DropdownMenuLabel>
        {EXTRA_FILTERS.map((f) => (
          <DropdownMenuItem
            key={f.key}
            disabled={active.has(f.key)}
            hint={active.has(f.key) ? 'đang lọc' : undefined}
            onSelect={(e) => {
              e.preventDefault();
              onToggle(f.key);
            }}
          >
            <Check
              aria-hidden
              className={cn(shown.has(f.key) || active.has(f.key) ? 'opacity-100' : 'opacity-0')}
            />
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Khoảng cân nặng (kg): gõ xong rồi Enter / rời ô mới áp lên URL — không bắn request theo
 * từng phím. Cùng giá trị hai ô = lọc đúng một mức cân (vd tất cả đơn 1,2 kg).
 */
function WeightRangeFilter({
  min,
  max,
  onChange,
}: {
  min: string | undefined;
  max: string | undefined;
  onChange: (next: { weightMin: string | undefined; weightMax: string | undefined }) => void;
}) {
  const [draftMin, setDraftMin] = useState(min ?? '');
  const [draftMax, setDraftMax] = useState(max ?? '');
  useEffect(() => setDraftMin(min ?? ''), [min]);
  useEffect(() => setDraftMax(max ?? ''), [max]);
  const commit = () => {
    const norm = (s: string) => {
      const t = s.trim().replace(',', '.');
      return t === '' || !/^\d{1,8}(\.\d{1,4})?$/.test(t) ? undefined : t;
    };
    const nextMin = norm(draftMin);
    const nextMax = norm(draftMax);
    if (nextMin === min && nextMax === max) return;
    onChange({ weightMin: nextMin, weightMax: nextMax });
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
  };
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <span>Cân nặng</span>
      <Input
        value={draftMin}
        onChange={(e) => setDraftMin(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        placeholder="từ"
        aria-label="Cân nặng từ (kg)"
        className="h-9 w-20 text-right tabular-nums"
      />
      <span>–</span>
      <Input
        value={draftMax}
        onChange={(e) => setDraftMax(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        placeholder="đến"
        aria-label="Cân nặng đến (kg)"
        className="h-9 w-20 text-right tabular-nums"
      />
      <span>kg</span>
    </div>
  );
}

/**
 * Dải giải thích của tab Chờ hàng + chip "Đang lọc đơn thiếu <SP>" (từ màn Hàng chờ). Điều kiện
 * ghi đúng như API tính (apps/api docs/pick-pack-flow.md §3.6).
 */
function WaitingStockNote({
  shortSkuName,
  onClearSku,
}: {
  shortSkuName: string | null;
  onClearSku: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
      <p role="note" className="flex-1 rounded-lg bg-info-weak px-3 py-2 text-sm text-info">
        Đơn đã duyệt từ 24 giờ, chưa <strong>Gửi sang ĐVVC</strong> và còn sản phẩm thiếu tồn tự vào
        tab này. Gửi sang ĐVVC hoặc hàng về đủ thì đơn tự rời tab. Không đổi trạng thái trên
        Pancake.{' '}
        <Link href="/wms/waiting-stock" className="font-semibold text-primary hover:underline">
          Xem tổng hàng thiếu
        </Link>
      </p>
      {shortSkuName ? (
        <Button size="sm" variant="secondary" onClick={onClearSku}>
          Đơn thiếu: {shortSkuName}
          <X aria-hidden />
          <span className="sr-only">Bỏ lọc sản phẩm thiếu</span>
        </Button>
      ) : null}
    </div>
  );
}

const NO_CARRIER = '__none__';
const ANY = '__all__';

/**
 * Ô "Hãng vận chuyển" của bộ lọc: Tất cả / Chưa gán hãng / từng tài khoản hãng (ô chọn dùng chung).
 * Ba key URL loại trừ nhau: `noCarrier`, `carrierAccountId` (hãng có tài khoản), `carrierId` (hãng
 * không tài khoản như giao thủ công — và link cũ lọc theo hãng).
 */
function CarrierFilter({
  noCarrier,
  carrierId,
  carrierAccountId,
  onChange,
}: {
  noCarrier: boolean;
  carrierId: string;
  carrierAccountId: string;
  onChange: (
    patch: Partial<Record<'noCarrier' | 'carrierId' | 'carrierAccountId', string | undefined>>,
  ) => void;
}) {
  const carriers = useCarriers();
  const ofAccount = carrierAccountId
    ? (carriers.data ?? []).find((c) => c.accounts.some((a) => a.id === carrierAccountId))
    : undefined;
  const value = noCarrier
    ? NO_CARRIER
    : ofAccount
      ? { carrierId: ofAccount.id, accountId: carrierAccountId }
      : carrierId
        ? { carrierId, accountId: null }
        : ANY;
  const clear = { noCarrier: undefined, carrierId: undefined, carrierAccountId: undefined };
  return (
    <CarrierSelect
      className="h-9 w-64"
      value={value}
      specials={[
        { value: ANY, label: 'Hãng VC: tất cả' },
        { value: NO_CARRIER, label: 'Chưa gán hãng' },
      ]}
      onChange={(v, option) => {
        if (v === NO_CARRIER) onChange({ ...clear, noCarrier: 'true' });
        else if (typeof v === 'string' || !option) onChange(clear);
        // Lọc theo đúng tài khoản đã chọn (id thật — server tự gộp đơn chưa chọn tài khoản vào
        // tài khoản mặc định).
        else if (option.accountId) onChange({ ...clear, carrierAccountId: option.accountId });
        else onChange({ ...clear, carrierId: option.carrier.id });
      }}
    />
  );
}

export function OrderListScreen() {
  const { state, set, skipTake } = useListState<OrderFilter>(DEFAULTS);
  const flow = parseOrderFlow(state.filters.flow);
  const status = parseOrderStatus(state.filters.status);
  const customerId = state.filters.customerId ?? '';
  const weightMin = state.filters.weightMin ?? '';
  const weightMax = state.filters.weightMax ?? '';
  const noCarrier = state.filters.noCarrier === 'true';
  const carrierId = state.filters.carrierId ?? '';
  const carrierAccountId = state.filters.carrierAccountId ?? '';
  const carrierSource = parseCarrierSource(state.filters.carrierSource);
  const shortSkuId = state.filters.shortSkuId ?? '';
  // Ô "Nguồn" gộp cả POS: `POS:<mã shop>` = đơn Pancake của đúng POS đó (URL giữ một khoá).
  const posShopId = /^POS:(\d+)$/.exec(state.filters.source ?? '')?.[1] ?? '';
  const source: 'PANCAKE' | 'ERP' | undefined =
    state.filters.source === 'PANCAKE' || posShopId
      ? 'PANCAKE'
      : state.filters.source === 'ERP'
        ? 'ERP'
        : undefined;
  const pancakeShops = usePancakeShops();
  const from = state.filters.from ?? '';
  const to = state.filters.to ?? '';
  const duplicate = state.filters.duplicate === 'true';
  const itemOrigin = parseItemOrigin(state.filters.itemOrigin);
  const careTeamId = state.filters.careTeamId ?? '';
  const careTeams = useCareTeamOptions();
  // Cột ẩn + sắp xếp lưu theo người dùng ở server (đăng xuất / đổi máy vẫn giữ). Sắp xếp trên URL
  // (link dán cho đồng nghiệp) thắng; URL không có thì lấy lần sắp gần nhất của người dùng.
  const prefs = useOrderListPrefs();
  const savePrefs = useSaveOrderListPrefs();
  const hidden = prefs.data?.hidden ?? DEFAULT_HIDDEN;
  const sort: SortState | null = state.sort ?? prefs.data?.sort ?? null;
  const sortBy = sort && !hidden.includes(sort.id) ? SORT_FIELD[sort.id] : undefined;
  const changeSort = (next: SortState | null) => {
    set({ sort: next });
    savePrefs.mutate({ hidden, sort: next });
  };
  const changeHidden = (next: string[]) => {
    // Ẩn cột đang sắp → bỏ sắp xếp theo cột đó (chỉ sắp theo cột đang hiện).
    const dropSort = sort !== null && next.includes(sort.id);
    if (dropSort) set({ sort: null });
    savePrefs.mutate({ hidden: next, sort: dropSort ? null : sort });
  };
  const filterParams = useMemo(
    () => ({
      q: state.q,
      duplicate,
      status,
      customerId,
      weightMin,
      weightMax,
      noCarrier,
      carrierId,
      carrierAccountId,
      carrierSource,
      shortSkuId,
      source,
      pancakeShopId: posShopId || undefined,
      from,
      to,
      itemOrigin,
      careTeamId,
    }),
    [
      state.q,
      duplicate,
      status,
      customerId,
      weightMin,
      weightMax,
      noCarrier,
      carrierId,
      carrierAccountId,
      carrierSource,
      shortSkuId,
      source,
      posShopId,
      from,
      to,
      itemOrigin,
      careTeamId,
    ],
  );
  const params = useMemo(
    () => ({
      ...filterParams,
      flow,
      sortBy,
      sortDir: sortBy ? (sort?.desc ? ('desc' as const) : ('asc' as const)) : undefined,
      ...skipTake,
    }),
    [filterParams, flow, sortBy, sort?.desc, skipTake],
  );
  const carriers = useCarriers();
  const router = useRouter();
  const ability = useAbility();
  const canUpdate = ability.can('update', 'SalesOrder');
  const canCreate = ability.can('create', 'SalesOrder');
  const [peek, setPeek] = useState<SalesOrderListItem | null>(null);
  const columns = useMemo(() => {
    const carrierById = new Map((carriers.data ?? []).map((c) => [c.id, c]));
    const all = buildColumns((id) => carrierById.get(id) ?? null, {
      canUpdate,
      canCreate,
      onPeek: setPeek,
    });
    // Cột Hàng thiếu / Chờ từ chỉ có nghĩa ở tab Chờ hàng.
    return flow === 'WAITING_STOCK'
      ? all
      : all.filter((c) => !WAITING_ONLY_COLUMNS.includes(c.id ?? ''));
  }, [carriers.data, canUpdate, canCreate, flow]);
  const pickerColumns = useMemo(
    () =>
      columns
        .filter((c) => c.id !== 'actions')
        .map((c) => ({
          id: c.id!,
          title: c.meta?.title ?? (typeof c.header === 'string' ? c.header : c.id!),
          required: c.id === 'docNumber',
        })),
    [columns],
  );
  const query = useOrders(params);
  const counts = useOrderFlowCounts(filterParams);
  // Quét bằng camera: bỏ mọi lọc (đơn có thể ở tab khác) rồi tìm theo mã; ra đúng một đơn thì mở
  // xem nhanh luôn — mã vận đơn / số đơn gần như luôn khớp một đơn.
  const [scanned, setScanned] = useState<string | null>(null);
  const onScan = (code: string) => {
    setScanned(code);
    set({ q: code, filters: {} });
  };
  useEffect(() => {
    if (scanned === null || state.q !== scanned || !query.data || query.isPlaceholderData) return;
    setScanned(null);
    const only = query.data.items.length === 1 ? query.data.items[0] : undefined;
    if (only) setPeek(only);
  }, [scanned, state.q, query.data, query.isPlaceholderData]);
  useInvalidateOn(['order.created', 'order.updated'], [orderKeys.lists()]);
  const [selected, setSelected] = useState<RowSelectionState>({});
  // Lọc ít dùng người dùng vừa bật qua "Thêm lọc" (chưa có giá trị) — chỉ sống trong phiên.
  const [shownExtras, setShownExtras] = useState<ReadonlySet<ExtraFilter>>(new Set());
  const activeExtras = useMemo(
    () =>
      new Set<ExtraFilter>(
        EXTRA_FILTERS.filter((f) =>
          f.key === 'weightMin' ? !!(weightMin || weightMax) : !!state.filters[f.key],
        ).map((f) => f.key),
      ),
    [weightMin, weightMax, state.filters],
  );
  const toggleExtra = (key: ExtraFilter) =>
    setShownExtras((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const showExtra = (key: ExtraFilter) => activeExtras.has(key) || shownExtras.has(key);

  useHotkey('F2', () => router.push('/crm/orders/new'), { enabled: canCreate });

  const setFilter = (patch: Partial<Record<OrderFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });

  const hasFilter =
    state.q !== '' ||
    flow !== undefined ||
    status !== undefined ||
    customerId !== '' ||
    weightMin !== '' ||
    weightMax !== '' ||
    noCarrier ||
    carrierId !== '' ||
    carrierAccountId !== '' ||
    carrierSource !== undefined ||
    shortSkuId !== '' ||
    source !== undefined ||
    from !== '' ||
    to !== '' ||
    duplicate ||
    itemOrigin !== undefined ||
    careTeamId !== '';
  const customerName = query.data?.items[0]?.customer.name;
  const selectedRows = (query.data?.items ?? []).filter((r) => selected[r.id]);
  const clearSelection = () => setSelected({});

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        description={
          query.data
            ? `${groupVi(String(query.data.total))} đơn khớp bộ lọc`
            : 'Đang đếm số đơn khớp bộ lọc…'
        }
        breadcrumb={[{ label: 'Bán hàng' }, { label: 'Đơn hàng' }]}
        actions={
          <>
            <OrderScanButton onScan={onScan} />
            <Can I="map" a="Sync">
              <PancakeOrderResyncButton defaultShopId={posShopId} />
            </Can>
            <Can I="create" a="SalesOrder">
              <Button asChild shortcut="F2">
                <Link href="/crm/orders/new">
                  <Plus aria-hidden />
                  Tạo đơn
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      <FlowTabs
        value={flow}
        counts={counts.data as Record<string, number> | undefined}
        onChange={(v) => setFilter({ flow: v })}
      />

      {flow === 'WAITING_STOCK' || shortSkuId ? (
        <WaitingStockNote
          shortSkuName={
            shortSkuId
              ? (query.data?.items
                  .flatMap((o) => o.shortage?.items ?? [])
                  .find((i) => i.skuId === shortSkuId)?.skuName ?? 'sản phẩm đã chọn')
              : null
          }
          onClearSku={() => setFilter({ shortSkuId: undefined })}
        />
      ) : null}

      {selectedRows.length > 0 ? (
        <OrderBulkBar rows={selectedRows} onClear={clearSelection} />
      ) : (
        <FilterBar<OrderFilter>
          q={state.q}
          onQChange={(q) => set({ q })}
          filters={[
            {
              key: 'from',
              toKey: 'to',
              label: 'Ngày đặt',
              type: 'dateRange',
              rememberKey: 'date.orders',
            },
            {
              // Một ô cho cả "chưa gán hãng" lẫn "đã gán hãng X" — hai key URL (noCarrier / carrierId)
              // loại trừ nhau.
              key: 'carrierId',
              label: 'Hãng vận chuyển',
              type: 'custom',
              render: () => (
                <CarrierFilter
                  noCarrier={noCarrier}
                  carrierId={carrierId}
                  carrierAccountId={carrierAccountId}
                  onChange={setFilter}
                />
              ),
            },
            {
              key: 'carrierSource',
              label: 'Gán hãng',
              type: 'select',
              options: CARRIER_SOURCE_OPTIONS,
            },
            {
              key: 'source',
              label: 'Nguồn',
              type: 'select',
              // Hàng chục POS Pancake — gõ tìm theo tên shop.
              searchable: true,
              options: [
                { value: 'ERP', label: 'Tạo trong ERP' },
                { value: 'PANCAKE', label: 'Pancake (mọi POS)' },
                ...(pancakeShops.data ?? []).map((s) => ({
                  value: `POS:${s.shopId}`,
                  label: `Pancake · ${pancakeShopLabel(s)}`,
                })),
              ],
            },
            {
              key: 'careTeamId',
              label: 'Team CSKH',
              type: 'select',
              searchable: true,
              options: (careTeams.data ?? []).map((t) => ({
                value: t.teamId,
                label: t.isActive ? t.name : `${t.name} (ngừng hoạt động)`,
              })),
            },
            ...(showExtra('duplicate')
              ? [
                  {
                    key: 'duplicate' as const,
                    label: 'Trùng trong ngày',
                    type: 'select' as const,
                    options: [{ value: 'true', label: 'Chỉ đơn trùng trong ngày' }],
                  },
                ]
              : []),
            ...(showExtra('itemOrigin')
              ? [
                  {
                    key: 'itemOrigin' as const,
                    label: 'Sản phẩm ngoài ERP',
                    type: 'select' as const,
                    options: ITEM_ORIGIN_OPTIONS,
                  },
                ]
              : []),
            ...(showExtra('weightMin')
              ? [
                  {
                    key: 'weightMin' as const,
                    label: 'Cân nặng',
                    type: 'custom' as const,
                    render: () => (
                      <WeightRangeFilter
                        min={state.filters.weightMin}
                        max={state.filters.weightMax}
                        onChange={setFilter}
                      />
                    ),
                  },
                ]
              : []),
          ]}
          after={<MoreFilters shown={shownExtras} active={activeExtras} onToggle={toggleExtra} />}
          values={{
            flow: state.filters.flow,
            status: state.filters.status,
            customerId: state.filters.customerId,
            weightMin: state.filters.weightMin,
            weightMax: state.filters.weightMax,
            noCarrier: state.filters.noCarrier,
            carrierId: state.filters.carrierId,
            carrierAccountId: state.filters.carrierAccountId,
            carrierSource: state.filters.carrierSource,
            source: state.filters.source,
            from: state.filters.from,
            to: state.filters.to,
            duplicate: state.filters.duplicate,
            itemOrigin: state.filters.itemOrigin,
            careTeamId: state.filters.careTeamId,
          }}
          onFilterChange={setFilter}
          searchPlaceholder="Mã đơn, mã Pancake, SĐT, tên khách, mã vận đơn"
          right={
            <>
              {customerId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilter({ customerId: undefined })}
                >
                  <X aria-hidden />
                  Đang lọc theo khách {customerName ? `“${customerName}”` : 'đã chọn'}
                </Button>
              ) : null}
              <OrderSavedViews />
              <ColumnPicker columns={pickerColumns} hidden={hidden} onChange={changeHidden} />
            </>
          }
        />
      )}

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={9} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={hasFilter ? 'Không có đơn nào khớp' : 'Chưa có đơn hàng nào'}
            description={
              hasFilter
                ? 'Thử bỏ bớt bộ lọc — hoặc đơn này thuộc khách do người khác phụ trách.'
                : 'Tạo đơn đầu tiên để bắt đầu bán.'
            }
            action={
              hasFilter ? (
                <Button variant="outline" onClick={() => set({ q: '', filters: {} })}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="SalesOrder">
                  <Button asChild>
                    <Link href="/crm/orders/new">
                      <Plus aria-hidden />
                      Tạo đơn
                    </Link>
                  </Button>
                </Can>
              )
            }
          />
        }
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data.items}
            getRowId={(r) => r.id}
            total={data.total}
            page={state.page}
            size={state.size}
            sort={sortBy ? sort : null}
            hiddenColumns={hidden}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={changeSort}
            onRowClick={setPeek}
            selection={{ selected, onChange: setSelected }}
          />
        )}
      </QueryState>

      <OrderQuickView row={peek} onClose={() => setPeek(null)} />
    </>
  );
}

type BulkDialog = 'shipping' | 'reprint' | 'cancel' | null;

/**
 * Thanh chọn nhiều (design system BulkActionBar, thay chỗ thanh lọc): tổng tiền / COD của các đơn
 * đã chọn; nút phụ Chuyển kho · Đóng gói + in vận đơn; "Khác" gom Gán hãng / cân nặng · In lại vận
 * đơn · Hủy đơn (cuối); nút chính "Gửi sang ĐVVC" ở mép phải. Hộp thoại mở từ "Khác" sống ngoài
 * menu (menu đóng là gỡ nội dung).
 */
function OrderBulkBar({ rows, onClear }: { rows: SalesOrderListItem[]; onClear: () => void }) {
  const ability = useAbility();
  const [dialog, setDialog] = useState<BulkDialog>(null);
  const openChange = (d: Exclude<BulkDialog, null>) => (o: boolean) => setDialog(o ? d : null);
  const total = rows.reduce((s, r) => s.plus(r.total), new Decimal(0));
  const cod = rows.reduce((s, r) => s.plus(r.shipment?.codAmount ?? r.total), new Decimal(0));
  const canUpdate = ability.can('update', 'SalesOrder');
  const canReprint = ability.can('pack', 'Shipment');
  const canCancel = ability.can('cancel', 'SalesOrder');

  return (
    <div className="mb-3">
      <BulkActionBar
        count={rows.length}
        noun="đơn"
        onClear={onClear}
        // Cao đúng bằng thanh lọc (32px) — bảng không nhảy khi tick / bỏ tick.
        className="min-h-8 rounded-md border-b-0 py-0"
        selectAll={
          <span className="text-xs text-muted-foreground">
            tổng {formatMoney(total.toFixed(), { unit: '' })} · COD{' '}
            {formatMoney(cod.toFixed(), { unit: '' })}
          </span>
        }
      >
        <span className="ml-auto" />
        <Can I="update" a="SalesOrder">
          <BulkMoveWarehouseDialog rows={rows} onDone={onClear} />
        </Can>
        <Can I="fulfil_manual" a="SalesOrder">
          <BulkFulfilPrintDialog rows={rows} onDone={onClear} />
        </Can>
        {canUpdate || canReprint || canCancel ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Khác
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate ? (
                <DropdownMenuItem onSelect={() => setDialog('shipping')}>
                  Gán hãng / cân nặng
                </DropdownMenuItem>
              ) : null}
              {canReprint ? (
                <DropdownMenuItem onSelect={() => setDialog('reprint')}>
                  In lại vận đơn
                </DropdownMenuItem>
              ) : null}
              {canCancel ? (
                <>
                  {canUpdate || canReprint ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem danger onSelect={() => setDialog('cancel')}>
                    <X aria-hidden />
                    Hủy đơn…
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Can I="update" a="SalesOrder">
          <SendToCarrierMenu rows={rows} onDone={onClear} />
        </Can>
      </BulkActionBar>
      {canUpdate ? (
        <BulkShippingDialog
          rows={rows}
          onDone={onClear}
          open={dialog === 'shipping'}
          onOpenChange={openChange('shipping')}
        />
      ) : null}
      {canReprint ? (
        <BulkReprintWaybillDialog
          rows={rows}
          open={dialog === 'reprint'}
          onOpenChange={openChange('reprint')}
        />
      ) : null}
      {canCancel ? (
        <BulkCancelDialog
          rows={rows}
          onDone={onClear}
          open={dialog === 'cancel'}
          onOpenChange={openChange('cancel')}
        />
      ) : null}
    </div>
  );
}
