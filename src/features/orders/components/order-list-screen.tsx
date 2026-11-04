'use client';

import type { RowSelectionState } from '@tanstack/react-table';
import Decimal from 'decimal.js';
import {
  Ban,
  ChevronDown,
  Copy,
  Eye,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { CopyButton } from '@/components/data/copy-button';
import { CopyText } from '@/components/data/copy-text';
import { ExportExcelButton, type ExportColumn } from '@/components/data/export-excel-button';
import { pancakeShopLabel } from '@/components/data/pancake-shop-select';
import { ColumnPicker, DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { TrackingLink } from '@/components/data/tracking-link';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor, messageForCode, messageForItemCode } from '@/lib/error-messages';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  groupVi,
  normalizePhone,
  formatQuantity,
  formatRelative,
  phoneCarrier,
  toDecimal,
  toLocalDateKey,
} from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useHotkey } from '@/lib/use-hotkey';
import { useListState, type SortState } from '@/lib/url-state';
import { decimalCell } from '@/lib/xlsx-writer';
import {
  carrierAccountLabel,
  useCarriers,
  type CarrierAccountOption,
} from '@/features/wms/api/use-shipping';
import { CarrierSelect } from '@/features/wms/components/carrier-select';
import {
  fetchOrdersPage,
  orderKeys,
  useOrderFlowCounts,
  useOrderGrandTotal,
  useOrderListPrefs,
  useOrders,
  useRequestWaybill,
  useSetOrdersWaitingStock,
  useTeamFilterOptions,
  useCarrierStatusOptions,
  useOrderCreatorOptions,
  useFacebookPageOptions,
  usePancakeShops,
  useSaveOrderListPrefs,
  type OrderCarrierSource,
  type OrderCarrierStatusOption,
  type OrderDateField,
  type OrderFlow,
  type OrderItemOrigin,
  type OrderPrintStatus,
  type OrderSortField,
  type SalesOrderListItem,
} from '../api/use-orders';
import {
  fulfilmentLabel,
  orderCancellable,
  orderFlowLabel,
  DEFAULT_ORDER_FLOW,
  parseOrderFlow,
  parseOrderStatus,
} from '../labels';
import { BulkCancelDialog } from './bulk-cancel-dialog';
import { CancelWaybillDialog } from './cancel-waybill-dialog';
import { BulkMoveWarehouseDialog } from './bulk-move-warehouse-dialog';
import { BulkFulfilPrintDialog } from './bulk-fulfil-print-dialog';
import { BulkReprintWaybillDialog } from './bulk-reprint-waybill-dialog';
import { BulkRetryWaybillDialog, retryableWaybill } from './bulk-retry-waybill-dialog';
import { BulkShippingDialog } from './bulk-shipping-dialog';
import { carrierTone } from './carrier-status-card';
import { OrderFlowTabs } from './order-flow-tabs';
import { FlowBadge, OrderQuickView, TelcoBadge } from './order-quick-view';
import { OrderSavedViews } from './order-saved-views';
import { OrderScanButton } from './order-scan-button';
import { PancakeOrderResyncButton } from './pancake-order-resync-button';
import { SendToCarrierMenu } from './send-to-carrier-menu';
import { PancakeErpLockedBadge, PancakeMirrorBadge, PancakeOrderLink } from './pancake-order-link';
import { SameDayOrdersHover } from './same-day-orders-hover';
import { MarketplaceBadge, MaskedPhoneBadge, waybillErrorText } from './waybill-error';
import { EntityPicker } from '@/components/data/form';
import { useSkuDetail, useSkuSearch } from '../api/use-line-entry';

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
 * gọn, "Bộ lọc đã lưu", cột cuối RowActions, chọn nhiều → BulkActionBar thay chỗ thanh lọc, F2
 * tạo đơn.
 *
 * Bảng mới 2026-10-29 (mockup TmGafrdk3wiAxJu4cFY937, đã duyệt): hiện hết bộ lọc (bỏ "Thêm lọc"),
 * cột Kho luôn hiện, cột NV lên đơn = người bấm tạo đơn, ngày đặt dưới mã đơn, bỏ dòng COD, chưa
 * gán hãng = "—", nút Hủy đơn trên dòng (hộp xác nhận dùng chung với hủy hàng loạt).
 */
const DEFAULTS = {
  size: 50,
  filterKeys: [
    'flow',
    // Tab cha (2026-11-03): wait / fulfil / issue / ship, `all` = mọi trạng thái (link từ màn khác).
    // Có `flow` thì nhóm suy từ flow.
    'group',
    'status',
    'customerId',
    'weightMin',
    'weightMax',
    // Giá trị đơn ≥ / = / ≤ / khoảng (2026-11-02).
    'totalMin',
    'totalMax',
    'noCarrier',
    'carrierId',
    // Tài khoản hãng (ô chọn hãng dùng chung) + ai gán hãng (ERP / Pancake), 2026-10-25.
    'carrierAccountId',
    'carrierSource',
    // Kho: ô chọn kho làm việc ở sidebar (header X-Warehouse-Id) — không còn bộ lọc kho riêng.
    'source',
    'from',
    'to',
    // Lọc from/to theo trường ngày nào (2026-10-28) — trống = ngày đặt.
    'dateField',
    // CSKH-5: chỉ đơn trùng trong ngày (cùng SĐT, cùng ngày VN, chưa hủy).
    'duplicate',
    // Đơn có sản phẩm không phải hàng ERP (món gõ tay / SKU Pancake tự sinh), 2026-10-22.
    'itemOrigin',
    // Phòng ban lên đơn (team phòng ban, id nối dấu phẩy, chọn nhiều — CSKH + Sale/MKT), 2026-11-02;
    // thay ô "Phòng ban CSKH" một lựa chọn (careTeamId, 2026-10-24).
    'team',
    // NV lên đơn = người bấm tạo đơn (2026-10-29).
    'creatorId',
    // Page Facebook (id nối dấu phẩy, chọn nhiều), 2026-10-26 — khoá `fbPage` vì `page` là số trang.
    'fbPage',
    // Chữ "Trạng thái VC" hãng gửi (chọn nhiều, 2026-10-28) — mỗi giá trị encodeURIComponent rồi nối
    // dấu phẩy: chữ hãng có dấu phẩy ("Tồn - Khách hàng nghỉ, không có nhà").
    'carrierStatus',
    // Đơn thiếu tồn một SKU (Chờ hàng, 2026-10-25) — "Xem đơn" từ màn Hàng chờ.
    'shortSkuId',
    // Đơn đã gửi ĐVVC: đã in / chưa in / lỗi in tem (2026-11-02).
    'printStatus',
    // Đơn có sản phẩm (SKU) này, kể cả thành phần combo (2026-11-02).
    'skuId',
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
 * In tem của đơn ĐÃ gửi sang ĐVVC (2026-11-02): xem đơn đẩy sang hãng mà chưa in được tem + lý do.
 * "Lỗi" = "Đóng gói + in" không đóng gói được, hoặc hãng không cấp vận đơn.
 */
const PRINT_STATUS_OPTIONS: { value: OrderPrintStatus; label: string }[] = [
  { value: 'NOT_PRINTED', label: 'Đã gửi ĐVVC · chưa in tem' },
  { value: 'ERROR', label: 'Đã gửi ĐVVC · lỗi, không in được' },
  { value: 'PRINTED', label: 'Đã gửi ĐVVC · đã in tem' },
];
const parsePrintStatus = (v: string | undefined): OrderPrintStatus | undefined =>
  PRINT_STATUS_OPTIONS.find((o) => o.value === v)?.value;

/** Ô "Trạng thái hãng": giá trị URL = từng chữ encodeURIComponent nối dấu phẩy (chữ hãng có dấu phẩy). */
export const decodeList = (v: string): string[] =>
  v
    .split(',')
    .filter(Boolean)
    .flatMap((x) => {
      try {
        return [decodeURIComponent(x)];
      } catch {
        return [];
      }
    });

/** Mỗi chữ một lựa chọn; cùng chữ ở nhiều hãng gộp một dòng, gợi ý ghi tên các hãng. */
export const carrierStatusOptions = (rows: OrderCarrierStatusOption[]) => {
  const byText = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byText.get(r.statusText) ?? new Set<string>();
    if (r.carrierCode) set.add(r.carrierCode);
    byText.set(r.statusText, set);
  }
  return [...byText].map(([text, codes]) => ({
    value: encodeURIComponent(text),
    label: text,
    hint: [...codes].join(', ') || undefined,
  }));
};

/**
 * Cột sắp được → trường `sortBy` của API. Cột không có ở đây không sắp được (sản phẩm, vận
 * chuyển… là dữ liệu ghép từ nhiều nguồn, server không sắp theo chúng).
 */
const SORT_FIELD: Record<string, OrderSortField> = {
  docNumber: 'docNumber',
  orderDate: 'orderDate',
  customer: 'customer',
  total: 'total',
  // Cột Trạng thái hiện "đổi trạng thái … trước" → sắp theo đúng mốc đó (2026-11-03, user: sắp
  // theo ngày tạo đơn là sai).
  time: 'statusChangedAt',
  // Cột Vận chuyển sắp theo lúc gửi sang ĐVVC (2026-11-03); đơn chưa gửi luôn cuối.
  shipping: 'sentToCarrierAt',
};

/**
 * Cột ẩn khi người dùng chưa chọn lần nào. Hàng thiếu / Chờ từ / Thực thu ĐVVC đã bỏ khỏi bảng
 * (2026-11-02); Thực thu vẫn có trong file Excel xuất. Ngày đặt hiện mặc định từ 2026-11-03 (bỏ
 * dòng ngày dưới mã đơn).
 */
const DEFAULT_HIDDEN: string[] = [];

/**
 * Cột luôn hiện, không bỏ chọn được ở nút "Cột": Mã đơn, Ngày đặt (user chốt 2026-11-04). Lựa chọn
 * ẩn đã lưu từ trước bị bỏ qua.
 */
const ALWAYS_SHOWN = new Set(['docNumber', 'orderDate']);

type OrderFilter = (typeof DEFAULTS.filterKeys)[number];

/** Ô "Theo" của bộ lọc ngày (2026-10-28) — phần tử đầu là mặc định (không ghi lên URL). */
const DATE_FIELDS: Array<{ value: OrderDateField; label: string }> = [
  { value: 'orderDate', label: 'Ngày đặt' },
  { value: 'createdAt', label: 'Ngày tạo đơn' },
  { value: 'updatedAt', label: 'Ngày cập nhật' },
  { value: 'sentToCarrierAt', label: 'Ngày gán ĐVVC' },
];

/** Quyền + handler mà cột thao tác cần — tính một lần ở màn, không gọi hook trong cell. */
interface RowActionContext {
  canUpdate: boolean;
  canCreate: boolean;
  /** `shipment.pack` — xin lại vận đơn cho đơn lỗi vận đơn. */
  canPack: boolean;
  /** Hủy đơn — cùng quyền với nút Hủy của thanh chọn nhiều. */
  canCancel: boolean;
  /**
   * Quyền rộng (`sales_order.cancel` / `edit_all`) — không bị khóa khi kho đã xử lý đơn. Người lên
   * đơn chỉ sửa / hủy ở Đơn mới / Chờ duyệt / Đã xác nhận (2026-10-31; server kiểm lại chính xác).
   */
  canCancelAny: boolean;
  /** `sales_order.cancel_after_carrier` — hủy cả đơn đã đóng gói mà hãng chưa lấy (2026-11-02). */
  canCancelAfterCarrier: boolean;
  canEditAny: boolean;
  onPeek: (row: SalesOrderListItem) => void;
  onRetryWaybill: (row: SalesOrderListItem) => void;
  onCancel: (row: SalesOrderListItem) => void;
}

/**
 * Nút thao tác của một dòng đơn, đứng cạnh Xem nhanh, không "⋯" (user yêu cầu 2026-10-29): Sửa ·
 * Nhân bản (+ Xin lại vận đơn ở tab Cần sửa khi lỗi vận đơn) · Hủy đơn (chữ đỏ, cuối cụm, qua hộp xác nhận —
 * mockup TmGafrdk3wiAxJu4cFY937). Mở chi tiết = bấm mã đơn.
 */
/** Tab còn trước khi kho thao tác — người lên đơn còn sửa / hủy được (2026-10-31). */
const OPEN_FLOWS: readonly string[] = ['NEW', 'PENDING_APPROVAL', 'WAREHOUSE'];
/** Sửa đơn còn được thêm ở Chờ hàng — kho chưa lấy hàng thật (2026-11-03; hủy vẫn khóa). */
const EDIT_OPEN_FLOWS: readonly string[] = [...OPEN_FLOWS, 'WAITING_STOCK'];
const STAGE_LOCKED = 'Kho đã xử lý đơn — không sửa / hủy được nữa';

function orderRowItems(o: SalesOrderListItem, ctx: RowActionContext): RowActionItem[] {
  const stageOpen = OPEN_FLOWS.includes(o.flow);
  const editOpen = EDIT_OPEN_FLOWS.includes(o.flow);
  // Nút "Xác nhận" trên dòng đã bỏ (user 2026-11-03) — xác nhận ở màn chi tiết / sửa đơn.
  return [
    ...(ctx.canPack && o.flow === 'NEEDS_FIX' && o.waybillErrorCode && o.shipment?.carrierCode
      ? [
          {
            // Lỗi vận đơn (2026-10-28, tab Cần sửa): sửa đơn xong thì xin lại — thành công là rời tab.
            label: 'Xin lại vận đơn',
            icon: <RefreshCw aria-hidden />,
            onSelect: () => ctx.onRetryWaybill(o),
          },
        ]
      : []),
    ...(ctx.canUpdate
      ? [
          {
            label: 'Sửa đơn',
            icon: <Pencil aria-hidden />,
            href: `/crm/orders/${o.id}/edit`,
            disabledReason:
              o.status === 'CANCELLED'
                ? 'Đơn đã hủy'
                : !editOpen && !o.editPastStage && !ctx.canEditAny
                  ? STAGE_LOCKED
                  : undefined,
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
    ...(ctx.canCancel
      ? [
          {
            label: 'Hủy đơn',
            icon: <Ban aria-hidden />,
            danger: true,
            onSelect: () => ctx.onCancel(o),
            disabledReason:
              o.status === 'CANCELLED'
                ? 'Đơn đã hủy'
                : !orderCancellable(o.status, o.fulfilmentStatus, ctx.canCancelAfterCarrier)
                  ? ctx.canCancelAfterCarrier
                    ? 'Hãng đã lấy hàng — xử lý bằng hoàn hàng'
                    : 'Kho đã đóng gói — nhờ trưởng phòng / quản trị hủy'
                  : !stageOpen && !ctx.canCancelAny && !ctx.canCancelAfterCarrier
                    ? STAGE_LOCKED
                    : undefined,
          },
        ]
      : []),
  ];
}

/**
 * Cột của bảng — `carrierOf` tra mã + tên hãng chọn trên đơn khi kho chưa tạo phiếu giao.
 * Cột Kho bỏ 2026-10-22, thêm lại 2026-10-29 (luôn hiện, user chốt) cùng cột NV lên đơn.
 */
const buildColumns = (
  carrierOf: (id: string) => CarrierRef | null,
  actions: RowActionContext,
): ColumnDef<SalesOrderListItem, unknown>[] => [
  {
    id: 'docNumber',
    header: 'Mã đơn',
    meta: { width: 150, sortable: true },
    cell: ({ row }) => {
      const o = row.original;
      // Dòng phụ 1: nguồn (Pancake # / ERP). Dòng phụ 2: tên sale đầy đủ, xuống dòng khi dài.
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
          {/* Dòng 2 (2026-11-03, user): badge "Sửa trên ERP" thay chỗ ngày đặt — ngày đặt xem ở cột
              Ngày đặt (hiện mặc định). Không có badge thì dòng trống không chiếm chỗ. */}
          <PancakeErpLockedBadge lockedAt={o.pancakeErpLockedAt} />
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="shrink-0">
              {o.pancakeOrderId ? (
                <PancakeOrderLink orderId={o.pancakeOrderId} link={o.pancakeOrderLink} />
              ) : (
                'ERP'
              )}
            </span>
            <PancakeMirrorBadge mirror={o.pancakeMirror} />
            {o.marketplace ? <MarketplaceBadge marketplace={o.marketplace} /> : null}
          </div>
        </div>
      );
    },
  },
  {
    id: 'orderDate',
    header: 'Ngày đặt',
    meta: { width: 116, sortable: true },
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs" title={formatDateTime(row.original.orderDate)}>
        {formatDate(row.original.orderDate)}
      </span>
    ),
  },
  {
    id: 'customer',
    header: 'Khách hàng',
    meta: { width: 170, sortable: true },
    cell: ({ row }) => {
      const o = row.original;
      const telco = phoneCarrier(o.phone);
      return (
        <div className="space-y-0.5">
          <span className="block max-w-48 truncate font-medium" title={o.customer.name}>
            {o.recipientName ?? o.customer.name}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {/* Viết liền (0356523006) như trước — dán thẳng vào Zalo / tổng đài (2026-10-13). */}
            <span className="font-mono text-xs">
              {o.phone ? (normalizePhone(o.phone) ?? o.phone) : formatPhone(o.phone)}
            </span>
            {o.phone ? (
              // Chép dạng viết liền (0356523006) để dán thẳng vào Zalo / tổng đài.
              <CopyButton value={normalizePhone(o.phone) ?? o.phone} label="số điện thoại" />
            ) : null}
          </span>
          {/* Nhà mạng xuống dòng riêng dưới SĐT, mỗi mạng một màu (mockup 2026-10-29). */}
          {telco ? (
            <span className="block">
              <TelcoBadge name={telco} />
            </span>
          ) : null}
          <MaskedPhoneBadge masked={o.phoneMasked} />
        </div>
      );
    },
  },
  {
    id: 'address',
    header: 'Địa chỉ nhận',
    // Không đặt width (2026-10-29): bảng trải đủ ngang, phần thừa dồn vào Địa chỉ + Sản phẩm thay
    // vì chia đều thành khoảng trống giữa mọi cột; chữ dài xuống tối đa 2 dòng.
    cell: ({ row }) => (
      <div className="min-w-44 space-y-0.5">
        <span className="line-clamp-2 break-words" title={row.original.addressLine ?? undefined}>
          {row.original.addressLine ?? '—'}
        </span>
        <span className="block text-xs text-muted-foreground">{row.original.province}</span>
      </div>
    ),
  },
  {
    id: 'product',
    header: 'Sản phẩm',
    // Không đặt width — xem cột Địa chỉ nhận.
    cell: ({ row }) => {
      const p = row.original.product;
      if (!p) return <span className="text-muted-foreground">—</span>;
      const name = `${p.name} × ${formatQuantity(p.qty)}`;
      return (
        <div className="min-w-40 space-y-0.5">
          <span className="line-clamp-2 break-words" title={name}>
            {name}
          </span>
          {p.moreCount > 0 ? (
            <span className="block text-xs text-primary">+{p.moreCount} sản phẩm khác</span>
          ) : null}
          {row.original.flow === 'NEEDS_FIX' && row.original.nonErpItems ? (
            // Cần sửa (2026-11-02): SP ngoài hệ thống — không Gửi sang ĐVVC được tới khi thay SP.
            <span
              className="block text-xs font-semibold text-destructive"
              title="Đơn có món gõ tay / SP Pancake tự tạo — thay bằng sản phẩm trong hệ thống rồi mới gửi ĐVVC"
              data-testid="order-non-erp-items"
            >
              Có SP ngoài hệ thống
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    // Cột Kho luôn hiện (user chốt 2026-10-29). 2026-11-02: bỏ mã kho + gộp cột NV lên đơn vào
    // đây — tên kho, dưới là NV lên đơn (người bấm tạo đơn, tên đầy đủ), dưới nữa page Facebook.
    id: 'warehouse',
    header: 'Kho',
    meta: { width: 150 },
    cell: ({ row }) => {
      const o = row.original;
      return (
        <div className="space-y-0.5">
          {o.warehouseName ? (
            <span className="block font-medium" data-testid="order-warehouse">
              {o.warehouseName}
            </span>
          ) : (
            <span className="block text-muted-foreground">—</span>
          )}
          <span
            className="block break-words text-xs text-muted-foreground"
            title="NV lên đơn"
            data-testid="order-creator"
          >
            {o.creatorName ?? '—'}
          </span>
          {o.facebookPageName ? (
            <span
              className="block break-words text-xs text-muted-foreground"
              data-testid="order-page"
            >
              {o.facebookPageName}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'shipping',
    header: 'Vận chuyển',
    meta: { width: 96, sortable: true },
    cell: ({ row }) => <ShippingCell order={row.original} carrierOf={carrierOf} />,
  },
  {
    id: 'total',
    header: 'Tổng tiền',
    // Chỉ tổng tiền đơn, bỏ dòng COD (mockup 2026-10-29); cột hẹp để sát cột Vận chuyển.
    meta: { align: 'right', width: 92, sortable: true },
    cell: ({ row }) => (
      <span className="block font-semibold">{formatMoney(row.original.total, { unit: '' })}</span>
    ),
  },
  {
    // Trạng thái + thời gian gộp một cột (2026-10-22); id giữ 'time' để sắp xếp theo thời gian
    // (và tuỳ chọn sắp đã lưu của người dùng) vẫn chạy.
    id: 'time',
    header: 'Trạng thái',
    meta: { width: 130, sortable: true, title: 'Trạng thái' },
    cell: ({ row }) => {
      const o = row.original;
      return (
        <div className="space-y-0.5">
          <span className="flex flex-wrap items-center gap-1">
            <span title={o.fulfilmentStatus ? fulfilmentLabel(o.fulfilmentStatus) : undefined}>
              <FlowBadge flow={o.flow} />
            </span>
            {o.sameDayCount > 0 ? (
              <span className="inline-flex items-center gap-0.5">
                <span title={`Cùng SĐT khách còn ${o.sameDayCount} đơn khác hôm đặt đơn này`}>
                  <StatusBadge tone="warn">Trùng · {o.sameDayCount + 1} đơn</StatusBadge>
                </span>
                <SameDayOrdersHover orderId={o.id} count={o.sameDayCount} />
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
    // Xem nhanh · Sửa · Nhân bản · Hủy (+ Xin lại vận đơn ở tab Cần sửa khi lỗi vận đơn) — 28px mỗi nút.
    meta: { width: 136, title: 'Thao tác' },
    cell: ({ row }) => (
      <RowActions
        inline
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
 * Cột file "Xuất Excel" của danh sách đơn — cố định (không theo ô chọn cột): mã, ngày giờ đặt,
 * khách, SĐT, sản phẩm, NV lên đơn, kho, tổng tiền, trạng thái, vận chuyển.
 */
const buildExportColumns = (
  carrierOf: (id: string) => CarrierRef | null,
): ExportColumn<SalesOrderListItem>[] => [
  { header: 'Mã đơn', value: (o) => o.docNumber, width: 16 },
  { header: 'Ngày đặt', value: (o) => formatDateTime(o.orderDate), width: 17 },
  { header: 'Nguồn', value: (o) => (o.pancakeOrderId ? `Pancake #${o.pancakeOrderId}` : 'ERP') },
  { header: 'Khách hàng', value: (o) => o.recipientName ?? o.customer.name, width: 24 },
  {
    header: 'SĐT',
    value: (o) => (o.phone ? (normalizePhone(o.phone) ?? o.phone) : null),
    width: 13,
  },
  { header: 'Địa chỉ nhận', value: (o) => o.addressLine ?? null, width: 36 },
  { header: 'Tỉnh/TP', value: (o) => o.province ?? null, width: 16 },
  {
    header: 'Sản phẩm',
    value: (o) => {
      const p = o.product;
      if (!p) return null;
      const more = p.moreCount > 0 ? ` (+${p.moreCount} sản phẩm khác)` : '';
      return `${p.name} × ${formatQuantity(p.qty)}${more}`;
    },
    width: 40,
  },
  { header: 'NV lên đơn', value: (o) => o.creatorName ?? null, width: 20 },
  { header: 'Page', value: (o) => o.facebookPageName ?? null, width: 18 },
  { header: 'Kho', value: (o) => o.warehouseName ?? null, width: 16 },
  { header: 'Tổng tiền', value: (o) => decimalCell(o.total), width: 13 },
  {
    header: 'Trạng thái',
    value: (o) =>
      orderFlowLabel(o.flow) + (o.sameDayCount > 0 ? ` · Trùng ${o.sameDayCount + 1} đơn` : ''),
    width: 18,
  },
  {
    header: 'Hãng vận chuyển',
    value: (o) => {
      const picked = o.carrierId ? carrierOf(o.carrierId) : null;
      return o.shipment?.carrierName ?? picked?.name ?? o.shipment?.carrierCode ?? null;
    },
    width: 18,
  },
  { header: 'Mã vận đơn', value: (o) => o.shipment?.trackingNo ?? null, width: 20 },
  { header: 'Phí vận chuyển', value: (o) => decimalCell(o.shipment?.shipFee ?? null) },
  { header: 'Thực thu ĐVVC', value: (o) => decimalCell(o.shipment?.collectedAmount ?? null) },
  { header: 'Ghi chú', value: (o) => o.note ?? null, width: 30 },
];

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
  // Nhãn hãng tô nền màu riêng từng hãng (2026-11-03, user) — cùng bảng màu thẻ hãng màn đơn.
  const tone = carrierTone(code);
  const chip = (
    <span
      title={fullName ?? undefined}
      className={cn(
        'inline-flex rounded-sm px-1 font-semibold',
        code ? cn(tone.bg, 'text-primary-foreground') : '',
      )}
    >
      {short}
    </span>
  );
  return (
    <div className="space-y-1 text-xs">
      {short ? (
        <span className="block whitespace-nowrap">
          {s?.trackingNo ? (
            <CopyText value={s.trackingNo} what="mã vận đơn" className="hover:no-underline">
              {chip}
            </CopyText>
          ) : (
            chip
          )}
          {s?.shipFee ? (
            <span className="text-muted-foreground">
              {' '}
              · phí {formatMoney(s.shipFee, { unit: '' })}
            </span>
          ) : null}
        </span>
      ) : (
        // Chưa gán hãng chỉ hiện "—" (mockup 2026-10-29); lọc "chưa gán hãng" ở ô Hãng VC.
        <span className="block text-muted-foreground" title="Chưa gán hãng">
          —
        </span>
      )}
      {s?.trackingNo ? (
        // Bấm mã → tab tra cứu của hãng (2026-11-03); hãng không có link → sao chép như cũ.
        <TrackingLink
          trackingNo={s.trackingNo}
          url={s.trackingUrl}
          prefilled={s.trackingUrlPrefilled}
          className="max-w-48 truncate font-mono text-muted-foreground"
        />
      ) : (
        <WeightNote order={order} />
      )}
      {order.waybillErrorCode ? (
        // Lỗi vận đơn (2026-10-28): lý do hãng từ chối, đủ câu ở tooltip.
        <span
          className="block max-w-48 truncate font-semibold text-destructive"
          title={waybillErrorText(order.waybillErrorCode, order.waybillError)}
          data-testid="waybill-error"
        >
          {order.waybillErrorCode === 'CARRIER_REJECTED' && order.waybillError
            ? order.waybillError
            : 'Lỗi vận đơn'}
        </span>
      ) : null}
      {order.sentToCarrierAt ? (
        <span
          className="block whitespace-nowrap text-muted-foreground"
          title="Lúc gửi sang đơn vị vận chuyển"
        >
          Gửi {formatDateTime(order.sentToCarrierAt)}
        </span>
      ) : null}
      <PrintStatusNote order={order} />
    </div>
  );
}

/**
 * In tem (2026-11-02): lý do "Đóng gói + in" không đóng gói được (câu theo mã — luật 6), hoặc mốc
 * in tem gần nhất / "Chưa in tem" khi đã có mã vận đơn. Bộ lọc tương ứng: ô "In tem".
 */
function PrintStatusNote({ order }: { order: SalesOrderListItem }) {
  if (order.packErrorCode) {
    const reason = messageForItemCode(order.packErrorCode);
    return (
      <span
        className="block max-w-64 whitespace-normal font-semibold text-destructive"
        title={`Không đóng gói được lúc ${formatDateTime(order.packErrorAt)}: ${reason}`}
        data-testid="pack-error"
      >
        Không in được: {reason}
      </span>
    );
  }
  if (order.labelPrintedAt) {
    return (
      <span className="block text-muted-foreground" data-testid="label-printed">
        Đã in tem {formatDateTime(order.labelPrintedAt)}
      </span>
    );
  }
  if (order.shipment?.trackingNo && order.status !== 'CANCELLED' && !order.waybillErrorCode) {
    return (
      <span className="block font-semibold text-warning" data-testid="label-not-printed">
        Chưa in tem
      </span>
    );
  }
  return null;
}

/** Ô lọc "Sản phẩm" (2026-11-02): chọn một SKU — đơn có dòng SKU đó, kể cả thành phần combo. */
export function ProductFilter({
  skuId,
  onChange,
}: {
  skuId: string;
  onChange: (v: string) => void;
}) {
  const detail = useSkuDetail(skuId);
  return (
    <EntityPicker
      className="h-9 w-64"
      value={skuId}
      onChange={(id) => onChange(id)}
      useSearch={useSkuSearch}
      selectedLabel={detail.data ? `${detail.data.code} · ${detail.data.name}` : undefined}
      placeholder="Sản phẩm: tất cả"
      searchPlaceholder="Gõ tên / mã sản phẩm…"
      emptyText="Không tìm thấy sản phẩm"
    />
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

type TotalOp = 'gte' | 'lte' | 'eq' | 'between';
const TOTAL_OPS: ReadonlyArray<{ value: TotalOp; label: string }> = [
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
  { value: 'eq', label: '=' },
  { value: 'between', label: 'Từ … đến' },
];

/** Toán tử đang áp, suy từ URL: chỉ min = ≥, chỉ max = ≤, hai cận bằng nhau = "=", khác = khoảng. */
export function totalOpOf(min: string | undefined, max: string | undefined): TotalOp {
  if (min && max) return min === max ? 'eq' : 'between';
  return max ? 'lte' : 'gte';
}

/** "1.500.000", "1 500 000 ₫" → "1500000"; không có chữ số → undefined. Tiền đồng, số nguyên. */
export function parseVnd(s: string): string | undefined {
  const d = s.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  return d === '' || d.length > 15 ? undefined : d;
}

/** Chuỗi tiền đồng nguyên → "1.500.000" để hiện trong ô (không tính toán, chỉ chèn dấu chấm). */
const groupVnd = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Lọc giá trị đơn (tổng tiền) — chọn toán tử rồi gõ số, Enter / rời ô mới áp lên URL
 * (totalMin / totalMax). "=" gửi hai cận bằng nhau.
 */
export function TotalValueFilter({
  min,
  max,
  onChange,
}: {
  min: string | undefined;
  max: string | undefined;
  onChange: (next: { totalMin: string | undefined; totalMax: string | undefined }) => void;
}) {
  const [op, setOp] = useState<TotalOp>(totalOpOf(min, max));
  const [a, setA] = useState(groupVnd((op === 'lte' ? max : min) ?? ''));
  const [b, setB] = useState(groupVnd(max ?? ''));
  // Toán tử người dùng đang chọn — đọc trong effect mà không đưa vào deps.
  const opRef = useRef(op);
  opRef.current = op;
  useEffect(() => {
    // Đang chọn "Từ … đến" thì GIỮ hai ô (user 2026-11-03): mới nhập một cận (URL chỉ có min hoặc
    // max) hay hai cận bằng nhau không được tự nhảy sang "≥" / "≤" / "=". Toán tử khác suy từ URL.
    const o = opRef.current === 'between' ? 'between' : totalOpOf(min, max);
    setOp(o);
    setA(groupVnd((o === 'lte' ? max : min) ?? ''));
    setB(groupVnd(max ?? ''));
  }, [min, max]);
  const apply = (nextOp: TotalOp, rawA: string, rawB: string) => {
    const va = parseVnd(rawA);
    const vb = parseVnd(rawB);
    const next =
      nextOp === 'gte'
        ? { totalMin: va, totalMax: undefined }
        : nextOp === 'lte'
          ? { totalMin: undefined, totalMax: va }
          : nextOp === 'eq'
            ? { totalMin: va, totalMax: va }
            : { totalMin: va, totalMax: vb };
    if (next.totalMin === min && next.totalMax === max) return;
    onChange(next);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') apply(op, a, b);
  };
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <span>Giá trị đơn</span>
      <Select
        value={op}
        onValueChange={(v) => {
          const o = v as TotalOp;
          setOp(o);
          if (a.trim() !== '') apply(o, a, b);
        }}
      >
        <SelectTrigger className="h-9 w-24" aria-label="Toán tử giá trị đơn">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TOTAL_OPS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={a}
        onChange={(e) => setA(groupVnd(parseVnd(e.target.value) ?? ''))}
        onBlur={() => apply(op, a, b)}
        onKeyDown={onKeyDown}
        inputMode="numeric"
        placeholder={op === 'between' ? 'từ' : 'số tiền'}
        aria-label={op === 'between' ? 'Giá trị đơn từ (₫)' : 'Giá trị đơn (₫)'}
        className="h-9 w-28 text-right tabular-nums"
      />
      {op === 'between' ? (
        <>
          <span>–</span>
          <Input
            value={b}
            onChange={(e) => setB(groupVnd(parseVnd(e.target.value) ?? ''))}
            onBlur={() => apply(op, a, b)}
            onKeyDown={onKeyDown}
            inputMode="numeric"
            placeholder="đến"
            aria-label="Giá trị đơn đến (₫)"
            className="h-9 w-28 text-right tabular-nums"
          />
        </>
      ) : null}
      <span>₫</span>
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
        Đơn vào tab này khi kho chọn đơn rồi bấm <strong>Chuyển Chờ hàng</strong>, hoặc sale để{' '}
        <strong>Chờ hàng</strong> trên Pancake. Đơn rời tab khi <strong>Gửi sang ĐVVC</strong>, kho
        bấm <strong>Đưa lại Đã xác nhận</strong>, hoặc sale xác nhận lại trên Pancake. Hàng về đủ
        không tự chuyển — kho tự quyết.{' '}
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
export function CarrierFilter({
  noCarrier,
  carrierId,
  carrierAccountId,
  onChange,
  withNone = true,
  filter,
}: {
  /** false = bỏ lựa chọn "Chưa gán hãng" (màn Đơn đã gán vận chuyển). */
  withNone?: boolean;
  /** Lọc bớt dòng hãng (vd màn Theo dõi đơn bỏ Giao thủ công, user 2026-11-03). */
  filter?: (o: CarrierAccountOption) => boolean;
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
      filter={filter}
      specials={[
        { value: ANY, label: 'Hãng VC: tất cả' },
        ...(withNone ? [{ value: NO_CARRIER, label: 'Chưa gán hãng' }] : []),
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

/** Chip khoảng giá trị / cân nặng: "≥ a", "≤ b", "= a", "a – b"; không cận nào = không chip. */
function rangeChip(min: string, max: string, fmt: (v: string) => string): string | null {
  if (min && max) return min === max ? `= ${fmt(min)}` : `${fmt(min)} – ${fmt(max)}`;
  if (min) return `≥ ${fmt(min)}`;
  if (max) return `≤ ${fmt(max)}`;
  return null;
}

export function OrderListScreen() {
  const { state, set, skipTake } = useListState<OrderFilter>(DEFAULTS);
  const urlFlow = parseOrderFlow(state.filters.flow);
  // Tab trạng thái v3 (2026-11-04): 14 trạng thái hiện cùng lúc, luôn chọn đúng một (mặc định Đơn
  // mới). Ô tìm có chữ / link `group=all` (từ màn khác) → xem mọi trạng thái (tìm đơn đã giao không
  // ra 0 vì đang ở tab khác). `?group=<nhóm>` cũ bỏ qua.
  // 2026-11-04 (user): bấm tab khi ô tìm có chữ GIỮ chữ — lọc chữ trong đúng tab đó (URL ghi
  // `flow` tường minh, kể cả NEW, bỏ `group`); gõ chữ từ ô trống → `group=all`, tìm mọi trạng thái.
  // Link chỉ có `?q=` (quét mã, màn khác) cũng tìm mọi trạng thái.
  const searching = state.filters.group === 'all' || (state.q !== '' && !urlFlow);
  const currentFlow: OrderFlow = urlFlow ?? DEFAULT_ORDER_FLOW;
  const flow = searching ? undefined : currentFlow;
  const status = parseOrderStatus(state.filters.status);
  const customerId = state.filters.customerId ?? '';
  const weightMin = state.filters.weightMin ?? '';
  const weightMax = state.filters.weightMax ?? '';
  const totalMin = state.filters.totalMin ?? '';
  const totalMax = state.filters.totalMax ?? '';
  const noCarrier = state.filters.noCarrier === 'true';
  const carrierId = state.filters.carrierId ?? '';
  const carrierAccountId = state.filters.carrierAccountId ?? '';
  const carrierSource = parseCarrierSource(state.filters.carrierSource);
  const shortSkuId = state.filters.shortSkuId ?? '';
  const printStatus = parsePrintStatus(state.filters.printStatus);
  const skuId = state.filters.skuId ?? '';
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
  const dateField = DATE_FIELDS.some((f) => f.value === state.filters.dateField)
    ? (state.filters.dateField as OrderDateField)
    : undefined;
  const duplicate = state.filters.duplicate === 'true';
  const itemOrigin = parseItemOrigin(state.filters.itemOrigin);
  // Ô NV lên đơn chỉ với người có `sales_order.filter_team` (2026-11-02); ô Phòng ban với người có
  // `sales_order.filter_dept` (Admin, kế toán, kho — user 2026-11-04) hoặc `report.sales_all`. Không
  // có quyền thì bỏ luôn giá trị trên URL (link dán từ đồng nghiệp) để không lọc ngầm.
  const ability = useAbility();
  const canFilterTeam = ability.can('filter_team', 'SalesOrder');
  const canFilterDept =
    ability.can('filter_dept', 'SalesOrder') || ability.can('sales_all', 'Report');
  const team = canFilterDept ? (state.filters.team ?? '') : '';
  const creatorId = canFilterTeam ? (state.filters.creatorId ?? '') : '';
  const fbPage = state.filters.fbPage ?? '';
  const carrierStatus = state.filters.carrierStatus ?? '';
  const carrierStatusText = useMemo(() => decodeList(carrierStatus), [carrierStatus]);
  const carrierStatuses = useCarrierStatusOptions();
  const teamOptions = useTeamFilterOptions(canFilterDept);
  const facebookPages = useFacebookPageOptions();
  // Cột ẩn + sắp xếp lưu theo người dùng ở server (đăng xuất / đổi máy vẫn giữ). Sắp xếp trên URL
  // (link dán cho đồng nghiệp) thắng; URL không có thì lấy lần sắp gần nhất của người dùng.
  const prefs = useOrderListPrefs();
  const savePrefs = useSaveOrderListPrefs();
  const savedHidden = prefs.data?.hidden;
  const hidden = useMemo(
    () => (savedHidden ?? DEFAULT_HIDDEN).filter((id) => !ALWAYS_SHOWN.has(id)),
    [savedHidden],
  );
  // Lọc theo Ngày gán ĐVVC mà URL chưa chọn cột sắp → sắp theo giờ gửi hãng, mới nhất trước
  // (2026-11-03) — thắng lần sắp đã lưu của người dùng.
  const sort: SortState | null =
    state.sort ??
    (dateField === 'sentToCarrierAt' ? { id: 'shipping', desc: true } : null) ??
    prefs.data?.sort ??
    null;
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
      totalMin,
      totalMax,
      noCarrier,
      carrierId,
      carrierAccountId,
      carrierSource,
      shortSkuId,
      printStatus,
      skuId,
      source,
      pancakeShopId: posShopId || undefined,
      from,
      to,
      dateField,
      itemOrigin,
      teamIds: team || undefined,
      creatorId,
      facebookPageIds: fbPage || undefined,
      carrierStatusText,
    }),
    [
      state.q,
      duplicate,
      status,
      customerId,
      weightMin,
      weightMax,
      totalMin,
      totalMax,
      noCarrier,
      carrierId,
      carrierAccountId,
      carrierSource,
      shortSkuId,
      printStatus,
      skuId,
      source,
      posShopId,
      from,
      to,
      dateField,
      itemOrigin,
      team,
      creatorId,
      fbPage,
      carrierStatusText,
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
  // Chữ chip "Đang lọc" của hai ô tự vẽ (sản phẩm, hãng) — cùng nguồn dữ liệu với ô chọn.
  const skuChip = useSkuDetail(skuId);
  const carrierChip = useMemo(() => {
    if (noCarrier) return 'Chưa gán hãng';
    const list = carriers.data ?? [];
    if (carrierAccountId) {
      const c = list.find((x) => x.accounts.some((a) => a.id === carrierAccountId));
      const a = c?.accounts.find((x) => x.id === carrierAccountId);
      return c && a ? `${c.code} ${carrierAccountLabel(c, a)}` : 'đã chọn';
    }
    if (carrierId) return list.find((x) => x.id === carrierId)?.name ?? 'đã chọn';
    return null;
  }, [noCarrier, carrierAccountId, carrierId, carriers.data]);
  const router = useRouter();
  const canUpdate = ability.can('update', 'SalesOrder');
  const canCreate = ability.can('create', 'SalesOrder');
  const canPack = ability.can('pack', 'Shipment');
  const canCancelAny = ability.can('cancel', 'SalesOrder');
  const canCancelAfterCarrier = ability.can('cancel_after_carrier', 'SalesOrder');
  const canEditAny = ability.can('edit_all', 'SalesOrder');
  const canCancel = canCancelAny || canCancelAfterCarrier || canCreate;
  const creatorOptions = useOrderCreatorOptions(canFilterTeam);
  const [peek, setPeek] = useState<SalesOrderListItem | null>(null);
  // Nút Hủy trên dòng → hộp xác nhận dùng chung với hủy hàng loạt (một đơn).
  const [cancelling, setCancelling] = useState<SalesOrderListItem | null>(null);
  const requestWaybill = useRequestWaybill();
  const columns = useMemo(() => {
    const carrierById = new Map((carriers.data ?? []).map((c) => [c.id, c]));
    const all = buildColumns((id) => carrierById.get(id) ?? null, {
      canUpdate,
      canCreate,
      canPack,
      canCancel,
      canCancelAny,
      canCancelAfterCarrier,
      canEditAny,
      onPeek: setPeek,
      onCancel: setCancelling,
      onRetryWaybill: (o) => {
        if (!o.shipment?.carrierCode) return;
        requestWaybill.mutate(
          { shipmentId: o.shipment.id, carrierCode: o.shipment.carrierCode },
          {
            onSuccess: (r) =>
              r.outcome === 'QUEUED'
                ? toast.warning(`Hãng chưa phản hồi — đơn ${o.docNumber} sẽ được xin lại tự động.`)
                : toast.success(`Đã cấp vận đơn ${r.trackingNo ?? ''} cho đơn ${o.docNumber}`),
            onError: (err) => toast.error(`Đơn ${o.docNumber}: ${messageFor(err)}`),
          },
        );
      },
    });
    return all;
    // requestWaybill.mutate ổn định giữa các lần render (TanStack Query).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    carriers.data,
    canUpdate,
    canCreate,
    canPack,
    canCancel,
    canCancelAny,
    canCancelAfterCarrier,
    canEditAny,
  ]);
  const pickerColumns = useMemo(
    () =>
      columns
        .filter((c) => c.id !== 'actions')
        .map((c) => ({
          id: c.id!,
          title: c.meta?.title ?? (typeof c.header === 'string' ? c.header : c.id!),
          required: ALWAYS_SHOWN.has(c.id!),
        })),
    [columns],
  );
  // Chờ sắp xếp đã lưu của người dùng (trừ khi URL có sẵn sort) rồi mới tải danh sách — trước đây
  // tải 2 lần (lần đầu chưa có sort, lần sau có), mỗi lần ~5 s trên prod (sự cố pool 2026-11-02).
  // Đọc prefs lỗi thì vẫn tải (isPending = false).
  const query = useOrders(params, { enabled: state.sort != null || !prefs.isPending });
  // Đếm cả 14 trạng thái trong một lần (GROUP BY flow).
  const counts = useOrderFlowCounts(filterParams);
  const grandTotal = useOrderGrandTotal();
  // Xuất Excel = mọi trang của đúng bộ lọc + tab + sắp xếp đang xem.
  const exportParams = useMemo(
    () => ({
      ...filterParams,
      flow,
      sortBy,
      sortDir: sortBy ? (sort?.desc ? ('desc' as const) : ('asc' as const)) : undefined,
    }),
    [filterParams, flow, sortBy, sort?.desc],
  );
  const exportColumns = useMemo(() => {
    const carrierById = new Map((carriers.data ?? []).map((c) => [c.id, c]));
    return buildExportColumns((id) => carrierById.get(id) ?? null);
  }, [carriers.data]);
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
    totalMin !== '' ||
    totalMax !== '' ||
    noCarrier ||
    carrierId !== '' ||
    carrierAccountId !== '' ||
    carrierSource !== undefined ||
    carrierStatus !== '' ||
    shortSkuId !== '' ||
    printStatus !== undefined ||
    skuId !== '' ||
    source !== undefined ||
    from !== '' ||
    to !== '' ||
    duplicate ||
    itemOrigin !== undefined ||
    team !== '' ||
    creatorId !== '';
  const customerName = query.data?.items[0]?.customer.name;
  const selectedRows = (query.data?.items ?? []).filter((r) => selected[r.id]);
  const clearSelection = () => setSelected({});

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        description={
          // "544 / 108.000" = đơn khớp bộ lọc / tổng mọi đơn, to, đậm (user 2026-11-03).
          <span className="block">
            <span>
              {query.data ? 'Đơn khớp bộ lọc / tổng số đơn' : 'Đang đếm số đơn khớp bộ lọc…'}
            </span>
            {query.data ? (
              <span
                data-testid="order-count"
                className="block text-2xl font-bold leading-tight text-foreground"
              >
                {groupVi(String(query.data.total))}
                {grandTotal.data ? (
                  <span className="text-muted-foreground">
                    {' / '}
                    {groupVi(String(grandTotal.data.total))}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        }
        breadcrumb={[{ label: 'Bán hàng' }, { label: 'Đơn hàng' }]}
        actions={
          <>
            <OrderScanButton onScan={onScan} />
            <Can I="map" a="Sync">
              <PancakeOrderResyncButton defaultShopId={posShopId} />
            </Can>
            <ExportExcelButton
              fileName="don-hang"
              columns={exportColumns}
              fetchPage={(page, size) => fetchOrdersPage(exportParams, page, size)}
              disabled={!query.data?.total}
            />
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

      <OrderFlowTabs
        flow={currentFlow}
        counts={counts.data}
        searching={searching}
        searchingLabel={state.q}
        onFlowChange={(f) =>
          set({
            filters: {
              ...state.filters,
              group: undefined,
              flow: f === DEFAULT_ORDER_FLOW && state.q === '' ? undefined : f,
            },
          })
        }
        onExitSearch={() => set({ q: '', filters: { ...state.filters, group: undefined } })}
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
          onQChange={(q) =>
            // Bắt đầu tìm từ ô trống → mọi trạng thái (`group=all`, giữ `flow` cho nút "Quay lại");
            // xóa hết chữ → về tab; sửa chữ đang tìm → giữ nguyên (tab đã chọn vẫn lọc).
            set(
              state.q === '' && q !== ''
                ? { q, filters: { ...state.filters, group: 'all' } }
                : q === ''
                  ? { q, filters: { ...state.filters, group: undefined } }
                  : { q },
            )
          }
          filters={[
            {
              key: 'from',
              toKey: 'to',
              label: 'Ngày đặt',
              type: 'dateRange',
              rememberKey: 'date.orders',
              // Mở màn lần đầu (chưa ghi nhớ, URL không có ngày) → 30 ngày qua (user 2026-11-03).
              defaultPreset: 'last30',
              fieldKey: 'dateField',
              fields: DATE_FIELDS,
            },
            {
              key: 'printStatus',
              label: 'In tem',
              type: 'select',
              group: 'Vận chuyển',
              options: PRINT_STATUS_OPTIONS,
            },
            {
              key: 'skuId',
              label: 'Sản phẩm',
              type: 'custom',
              chip: skuId ? (skuChip.data?.name ?? 'đã chọn') : null,
              render: () => (
                <ProductFilter
                  skuId={skuId}
                  onChange={(v) => setFilter({ skuId: v || undefined })}
                />
              ),
            },
            {
              // Một ô cho cả "chưa gán hãng" lẫn "đã gán hãng X" — hai key URL (noCarrier / carrierId)
              // loại trừ nhau.
              key: 'carrierId',
              label: 'Hãng VC',
              type: 'custom',
              chip: carrierChip,
              clearKeys: ['noCarrier', 'carrierAccountId'],
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
              group: 'Vận chuyển',
              options: CARRIER_SOURCE_OPTIONS,
            },
            {
              key: 'source',
              label: 'Nguồn',
              type: 'select',
              group: 'Nguồn & người',
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
              key: 'fbPage',
              label: 'Page',
              type: 'multiSelect',
              group: 'Nguồn & người',
              unit: 'page',
              options: (facebookPages.data ?? []).map((p) => ({
                value: p.id,
                label: p.isActive ? p.name : `${p.name} (ngưng)`,
                hint: p.shopIds.length ? `${p.shopIds.length} POS` : undefined,
              })),
            },
            {
              key: 'carrierStatus',
              label: 'Trạng thái hãng',
              type: 'multiSelect',
              group: 'Vận chuyển',
              unit: 'trạng thái',
              options: carrierStatusOptions(carrierStatuses.data ?? []),
            },
            // Phòng ban: quyền `sales_order.filter_dept` (2026-11-04), chọn nhiều — phòng CSKH + phòng Sale/MKT
            // đã có đơn; chưa chọn = tất cả.
            ...(canFilterDept
              ? [
                  {
                    key: 'team' as const,
                    label: 'Phòng ban',
                    type: 'multiSelect' as const,
                    group: 'Nguồn & người',
                    unit: 'phòng',
                    options: (teamOptions.data ?? []).map((t) => ({
                      value: t.teamId,
                      label: t.isActive ? t.name : `${t.name} (ngừng hoạt động)`,
                      hint: t.group === 'CSKH' ? 'CSKH' : 'Sale/MKT',
                    })),
                  },
                ]
              : []),
            // NV lên đơn: chỉ người có `sales_order.filter_team` (2026-11-02).
            ...(canFilterTeam
              ? [
                  {
                    // Danh sách theo người xem (2026-10-30): leader CSKH → nhân viên team, trưởng
                    // nhóm → nhóm mình, nhân viên CSKH → mình; người khác mọi nhân viên.
                    key: 'creatorId' as const,
                    label: 'NV lên đơn',
                    type: 'select' as const,
                    searchable: true,
                    options: (creatorOptions.data ?? []).map((s) => ({
                      value: s.id,
                      label: s.fullName,
                    })),
                  },
                ]
              : []),
            {
              key: 'duplicate',
              label: 'Trùng trong ngày',
              type: 'select',
              group: 'Đơn',
              options: [{ value: 'true', label: 'Chỉ đơn trùng trong ngày' }],
            },
            {
              key: 'itemOrigin',
              label: 'Sản phẩm ngoài ERP',
              type: 'select',
              group: 'Đơn',
              options: ITEM_ORIGIN_OPTIONS,
            },
            {
              key: 'totalMin',
              label: 'Giá trị đơn',
              type: 'custom',
              group: 'Đơn',
              chip: rangeChip(totalMin, totalMax, (v) => formatMoney(v)),
              clearKeys: ['totalMax'],
              render: () => (
                <TotalValueFilter
                  min={state.filters.totalMin}
                  max={state.filters.totalMax}
                  onChange={setFilter}
                />
              ),
            },
            {
              key: 'weightMin',
              label: 'Cân nặng',
              type: 'custom',
              group: 'Đơn',
              chip: rangeChip(weightMin, weightMax, (v) => `${v} kg`),
              clearKeys: ['weightMax'],
              render: () => (
                <WeightRangeFilter
                  min={state.filters.weightMin}
                  max={state.filters.weightMax}
                  onChange={setFilter}
                />
              ),
            },
          ]}
          values={{
            status: state.filters.status,
            customerId: state.filters.customerId,
            weightMin: state.filters.weightMin,
            weightMax: state.filters.weightMax,
            totalMin: state.filters.totalMin,
            totalMax: state.filters.totalMax,
            noCarrier: state.filters.noCarrier,
            carrierId: state.filters.carrierId,
            carrierAccountId: state.filters.carrierAccountId,
            carrierSource: state.filters.carrierSource,
            source: state.filters.source,
            from: state.filters.from,
            to: state.filters.to,
            dateField: state.filters.dateField,
            duplicate: state.filters.duplicate,
            itemOrigin: state.filters.itemOrigin,
            team,
            creatorId,
            fbPage: state.filters.fbPage,
            carrierStatus: state.filters.carrierStatus,
            printStatus: state.filters.printStatus,
            skuId: state.filters.skuId,
          }}
          onFilterChange={(patch) =>
            // Chọn "In tem" khi chưa lọc ngày → mặc định đơn gán ĐVVC HÔM NAY (2026-11-02); đổi
            // khoảng ngày / trường ngày ở ô ngày như thường.
            setFilter(
              patch.printStatus && !from && !to
                ? {
                    ...patch,
                    dateField: 'sentToCarrierAt',
                    from: toLocalDateKey(new Date()) ?? undefined,
                    to: toLocalDateKey(new Date()) ?? undefined,
                  }
                : patch,
            )
          }
          pinned={['carrierId', 'creatorId', 'skuId']}
          secondRow={['totalMin', 'weightMin']}
          searchPlaceholder="Mã đơn, SĐT, tên SP, mã vận đơn… nhiều giá trị cách dấu phẩy"
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
      {cancelling ? (
        <BulkCancelDialog
          rows={[cancelling]}
          open
          onOpenChange={(o) => {
            if (!o) setCancelling(null);
          }}
          onDone={() => setCancelling(null)}
        />
      ) : null}
    </>
  );
}

type BulkDialog = 'shipping' | 'reprint' | 'retry-waybill' | 'cancel-waybill' | null;

/**
 * Thanh chọn nhiều (design system BulkActionBar, thay chỗ thanh lọc): tổng tiền / COD của các đơn
 * đã chọn; nút phụ Hủy đơn · Chuyển kho · Đóng gói + in vận đơn; "Khác" gom Gán hãng / cân nặng · Xin lại vận đơn ·
 * In lại vận đơn; nút chính "Gửi sang ĐVVC" ở mép phải. Hộp thoại mở từ "Khác" sống ngoài menu
 * (menu đóng là gỡ nội dung). Hủy đơn (2026-10-29) hiện cho cả người lên đơn — người lên đơn hủy
 * đơn mình, trưởng phòng / trưởng nhóm CSKH hủy đơn nhân viên; server kiểm từng đơn, đơn không
 * được hủy vào `failed`.
 */
function OrderBulkBar({ rows, onClear }: { rows: SalesOrderListItem[]; onClear: () => void }) {
  const ability = useAbility();
  const [dialog, setDialog] = useState<BulkDialog>(null);
  const openChange = (d: Exclude<BulkDialog, null>) => (o: boolean) => setDialog(o ? d : null);
  const total = rows.reduce((s, r) => s.plus(r.total), new Decimal(0));
  const cod = rows.reduce((s, r) => s.plus(r.shipment?.codAmount ?? r.total), new Decimal(0));
  // Gán hãng / cân nặng + Gửi sang ĐVVC + Chờ hàng: chỉ kho / admin (`send_carrier`, 2026-10-31) —
  // sale / CSKH không chọn hãng.
  const canUpdate = ability.can('send_carrier', 'SalesOrder');
  const waiting = useSetOrdersWaitingStock();
  const setWaiting = (on: boolean) =>
    waiting.mutate(
      { orderIds: rows.map((r) => r.id), waiting: on },
      {
        onSuccess: (r) => {
          const verb = on ? 'chuyển Chờ hàng' : 'đưa lại Đã xác nhận';
          if (r.updated.length > 0) toast.success(`Đã ${verb} ${r.updated.length} đơn`);
          if (r.failed.length > 0) {
            toast.error(
              `${r.failed.length} đơn không ${verb} được: ${messageForCode(r.failed[0]!.code, 409)}`,
            );
          }
          if (r.failed.length === 0) onClear();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  const canReprint = ability.can('pack', 'Shipment');
  // Hủy vận đơn (2026-11-02) — đi cùng Gửi sang ĐVVC: chỉ người chọn hãng (kho / admin).
  const canCancelWaybill = canUpdate;
  const withWaybill = rows.filter((r) => r.shipment?.trackingNo);
  // Xin lại vận đơn hàng loạt (2026-11-02) — cùng quyền với nút trên dòng (`pack` Shipment).
  const retryable = rows.filter(retryableWaybill);
  const canCancel =
    ability.can('cancel', 'SalesOrder') ||
    ability.can('cancel_after_carrier', 'SalesOrder') ||
    ability.can('create', 'SalesOrder');

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
        {canCancel ? <BulkCancelDialog rows={rows} onDone={onClear} /> : null}
        <Can I="update" a="SalesOrder">
          <BulkMoveWarehouseDialog rows={rows} onDone={onClear} />
        </Can>
        <Can I="fulfil_manual" a="SalesOrder">
          <BulkFulfilPrintDialog rows={rows} onDone={onClear} />
        </Can>
        {canUpdate || canReprint || canCancelWaybill ? (
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
              {canUpdate ? (
                <DropdownMenuItem onSelect={() => setWaiting(true)}>
                  Chuyển Chờ hàng
                </DropdownMenuItem>
              ) : null}
              {canUpdate ? (
                <DropdownMenuItem onSelect={() => setWaiting(false)}>
                  Đưa lại Đã xác nhận
                </DropdownMenuItem>
              ) : null}
              {canReprint ? (
                <DropdownMenuItem onSelect={() => setDialog('reprint')}>
                  In lại vận đơn
                </DropdownMenuItem>
              ) : null}
              {canReprint ? (
                <DropdownMenuItem
                  disabled={retryable.length === 0}
                  onSelect={() => setDialog('retry-waybill')}
                >
                  Xin lại vận đơn{retryable.length > 0 ? ` (${retryable.length})` : ''}
                </DropdownMenuItem>
              ) : null}
              {canCancelWaybill ? (
                <DropdownMenuItem
                  danger
                  disabled={withWaybill.length === 0}
                  onSelect={() => setDialog('cancel-waybill')}
                >
                  Hủy vận đơn{withWaybill.length > 0 ? ` (${withWaybill.length})` : ''}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {canUpdate ? <SendToCarrierMenu rows={rows} onDone={onClear} /> : null}
      </BulkActionBar>
      {canUpdate ? (
        <BulkShippingDialog
          rows={rows}
          onDone={onClear}
          open={dialog === 'shipping'}
          onOpenChange={openChange('shipping')}
        />
      ) : null}
      {canCancelWaybill ? (
        <CancelWaybillDialog
          rows={withWaybill.map((r) => ({
            id: r.id,
            docNumber: r.docNumber,
            trackingNo: r.shipment?.trackingNo ?? null,
          }))}
          open={dialog === 'cancel-waybill'}
          onOpenChange={openChange('cancel-waybill')}
          onDone={onClear}
        />
      ) : null}
      {canReprint ? (
        <BulkReprintWaybillDialog
          rows={rows}
          open={dialog === 'reprint'}
          onOpenChange={openChange('reprint')}
        />
      ) : null}
      {canReprint ? (
        <BulkRetryWaybillDialog
          rows={rows}
          open={dialog === 'retry-waybill'}
          onOpenChange={openChange('retry-waybill')}
          onDone={onClear}
        />
      ) : null}
    </div>
  );
}
