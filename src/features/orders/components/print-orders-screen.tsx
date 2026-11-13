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
import { Checkbox } from '@/components/ui/checkbox';
import { CopyButton } from '@/components/data/copy-button';
import { CopyText } from '@/components/data/copy-text';
import { ExportExcelButton, type ExportColumn } from '@/components/data/export-excel-button';
import { pancakeShopLabel } from '@/components/data/pancake-shop-select';
import {
  DataTable,
  FilterBar,
  ORDER_PAGE_SIZES,
  type ColumnDef,
} from '@/components/data/data-table';
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
} from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useHotkey } from '@/lib/use-hotkey';
import { useListState, type SortState } from '@/lib/url-state';
import { decimalCell } from '@/lib/xlsx-writer';
import { useCarriers } from '@/features/wms/api/use-shipping';
import { carrierFilterOptions, parseCarrierFilter } from '../carrier-filter';
import {
  fetchOrdersPage,
  orderKeys,
  useOrderFlowCounts,
  useOrderPackerOptions,
  useOrderTabCounts,
  useOrderListPrefs,
  useOrders,
  useRequestWaybill,
  useSetOrdersWaitingStock,
  useBulkConfirmOrders,
  isUnconfirmedErp,
  useTeamFilterOptions,
  useFacebookPageOptions,
  usePancakeShops,
  useSaveOrderListPrefs,
  useOrderErrorOptions,
  type CarrierIssue,
  type OrderErrorOption,
  type OrderDateField,
  type OrderFlow,
  type OrderSortField,
  type SalesOrderListItem,
} from '../api/use-orders';
import {
  CARRIER_ISSUES_ALL,
  parseCarrierIssue,
  fulfilmentLabel,
  orderCancellable,
  orderFlowLabel,
  DEFAULT_ORDER_FLOW,
  parseOrderFlow,
  parseOrderStatus,
  PICKUP_OPTIONS,
  PRINT_OPTIONS,
  pickOption,
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
import { CarrierStageTag, IssueChips, OrderViewTabs, type OrderTabView } from './order-tabs';
import { FlowBadge, OrderQuickView, TelcoBadge } from './order-quick-view';
import { rangeChip, WeightRangeFilter } from './weight-range-filter';
import { OrderScanButton } from './order-scan-button';
import { PancakeOrderResyncButton } from './pancake-order-resync-button';
import { SendToCarrierMenu } from './send-to-carrier-menu';
import { PancakeErpLockedBadge, PancakeMirrorBadge, PancakeOrderLink } from './pancake-order-link';
import { SameDayOrdersHover } from './same-day-orders-hover';
import { MarketplaceBadge, MaskedPhoneBadge, waybillErrorText } from './waybill-error';
import { EntityMultiPicker } from '@/components/data/form';
import { useNonComboSkuSearch, useSkuDetail, useSkuOptions } from '../api/use-line-entry';

/**
 * In đơn (2026-11-04, user): màn Kho phục vụ in đơn, menu ngay dưới "Theo dõi đơn" — bản CLONE từ
 * màn Đơn hàng (`order-list-screen.tsx`, /crm/orders) để tuỳ biến riêng; sửa màn này KHÔNG đụng
 * màn Đơn hàng và ngược lại. Cột ẩn + sắp xếp lưu riêng (`orders.print`), nhớ ngày riêng
 * (`date.print-orders`). Phần dưới là chú thích gốc của màn Đơn hàng.
 *
 * 2026-11-04 (tối, user): bỏ nút "Bộ lọc đã lưu" + "Cột" — luôn hiện hết cột (lựa chọn ẩn đã lưu bị
 * bỏ qua, chỉ còn nhớ sắp xếp); bỏ panel "Bộ lọc khác" — mọi ô lọc bày trên thanh, "Xóa lọc (n)"
 * đứng ngay cạnh; tab trạng thái một dãy chip liền (không khối giai đoạn); tab + thanh lọc / thanh
 * chọn nhiều GHIM dưới thanh trên khi cuộn (đầu trang cuộn theo — khác luật chung của design system
 * "BulkActionBar không dính theo trang", user chốt riêng cho màn này).
 *
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
  // 1000 dòng / trang (2026-11-12, user chốt) — GET /sales-orders nhận take ≤ 1000.
  maxSize: 1000,
  filterKeys: [
    'flow',
    // Tab cha "Cần xử lý" (`view=issues`) + chip của nó (`ci`) — clone từ màn Đơn hàng 2026-11-09.
    'view',
    'ci',
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
    // POS Pancake (mã shop nối dấu phẩy, chọn nhiều) thay ô Nguồn (2026-11-04).
    'pos',
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
    // Hãng đã / chưa lấy hàng (2026-11-10, như màn Theo dõi đơn) — lọc kèm các tab.
    'pickup',
    // Đơn có sản phẩm (SKU) này, kể cả thành phần combo (2026-11-02).
    'skuId',
    // `true` = chỉ đơn mà mọi dòng đều là SKU đó — "lọc sản phẩm duy nhất" (2026-11-04).
    'skuOnly',
    // Loại trừ sản phẩm (2026-11-10): id SKU nối dấu phẩy — bỏ đơn có SP đó (kể cả trong combo).
    'excludeSku',
    // Lỗi đơn (2026-11-10): khoá lỗi mã hoá URI, nối dấu phẩy.
    'orderError',
    // Hãng VC (2026-11-10): `c:<hãng>` = mọi tài khoản của hãng, `a:<tài khoản>`, nối dấu phẩy.
    'carrier',
    // NV đóng hàng (`SalesOrder.packerId`, chọn khi Gửi ĐVVC) — 2026-11-13.
    'packerId',
    // Ô "SĐT" riêng (2026-11-13): chỉ đuôi SĐT khách / người nhận, vd 4 số cuối.
    'phone',
  ] as const,
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
  // Cột Sản phẩm (2026-11-04): abc tên sản phẩm, cùng tên thì ít mặt hàng trước — cùng luật xếp
  // tem in hàng loạt; server sắp trong bộ nhớ (tối đa 20.000 đơn khớp).
  product: 'items',
  // Cột Cân nặng (2026-11-06): cân hiệu lực đặt tay ?? Σ dòng, server sắp trong bộ nhớ.
  weight: 'weight',
};

/**
 * Luôn hiện hết cột (user chốt 2026-11-04 tối, bỏ nút "Cột"). Lựa chọn ẩn đã lưu từ trước trong
 * `orders.print` bị bỏ qua; khi lưu sắp xếp ghi lại mảng rỗng.
 */
const NO_HIDDEN: string[] = [];

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
  /**
   * Dòng đang tích nhưng đã RỜI bộ lọc / tab sau thao tác hàng loạt (2026-11-10) — vẫn hiện tại
   * chỗ cũ tới khi bỏ tích hoặc tải lại trang, kèm trạng thái mới.
   */
  isLeft: (orderId: string) => boolean;
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
/**
 * Tab còn trước khi kho thao tác — người lên đơn / NV xử lý / leader còn sửa + hủy được
 * (2026-10-31). Chờ hàng: sửa từ 2026-11-03, hủy từ 2026-11-07 (user chốt).
 */
const OPEN_FLOWS: readonly string[] = ['NEW', 'PENDING_APPROVAL', 'WAREHOUSE', 'WAITING_STOCK'];
const EDIT_OPEN_FLOWS = OPEN_FLOWS;
const STAGE_LOCKED = 'Kho đã xử lý đơn — không sửa / hủy được nữa';
const SENT_LOCKED = 'Đã gửi ĐVVC — hủy vận đơn để sửa đơn';

function orderRowItems(o: SalesOrderListItem, ctx: RowActionContext): RowActionItem[] {
  const stageOpen = OPEN_FLOWS.includes(o.flow);
  // Cần sửa mà CHƯA gửi hãng: người lên đơn sửa được — server kiểm lại (assertOrderStageOpen).
  const editOpen =
    EDIT_OPEN_FLOWS.includes(o.flow) || (o.flow === 'NEEDS_FIX' && !o.sentToCarrierAt);
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
                : // 2026-11-07: đã gửi hãng thì không ai sửa — trừ tab Cần sửa (hãng từ chối cấp mã).
                  o.sentToCarrierAt && o.flow !== 'NEEDS_FIX'
                  ? SENT_LOCKED
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
                : // 2026-11-07: đã gửi hãng → chỉ quyền Hủy đơn (`cancel`); cancel_after_carrier chỉ hủy vận đơn.
                  o.sentToCarrierAt && !ctx.canCancelAny
                  ? 'Đã gửi ĐVVC — chỉ người có quyền Hủy đơn hủy được (hoặc hủy vận đơn)'
                  : !orderCancellable(o.status, o.fulfilmentStatus, ctx.canCancelAny)
                    ? ctx.canCancelAny
                      ? 'Hãng đã lấy hàng — xử lý bằng hoàn hàng'
                      : 'Kho đã đóng gói — nhờ người có quyền Hủy đơn'
                    : !stageOpen && !ctx.canCancelAny
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
              // Mở tab mới (2026-11-12, user chốt) — danh sách giữ nguyên bộ lọc + dòng đang tích.
              target="_blank"
              rel="noreferrer"
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
          {actions.isLeft(o.id) ? (
            <div
              className="flex flex-wrap items-center gap-1 text-xs text-info"
              data-testid="row-left"
              title="Đơn không còn khớp tab / bộ lọc — giữ lại để bạn xem kết quả; bỏ tích hoặc tải lại trang để ẩn"
            >
              Đã chuyển <FlowBadge flow={o.flow} />
            </div>
          ) : null}
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
    // Không đặt width — xem cột Địa chỉ nhận. Sắp được (2026-11-04): ít mặt hàng trước + abc.
    meta: { sortable: true },
    cell: ({ row }) => {
      // Màn In đơn hiện HẾT sản phẩm của đơn (2026-11-04) — mỗi dòng một hàng, không "+N khác".
      const items = row.original.items;
      if (items.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="min-w-40 space-y-0.5" data-testid="order-items">
          {items.map((it, i) => {
            const name = `${it.name} × ${formatQuantity(it.qty)}`;
            return (
              <span key={i} className="block break-words" title={name}>
                {name}
              </span>
            );
          })}
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
          {o.packerName ? (
            // NV đóng hàng chọn lúc "Đóng gói + in vận đơn" (2026-11-04).
            <span
              className="block break-words text-xs text-muted-foreground"
              title="NV đóng hàng"
              data-testid="order-packer"
            >
              Đóng: {o.packerName}
            </span>
          ) : null}
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
    // Cột riêng, sắp theo cân hiệu lực (2026-11-06, user: "sắp xếp theo cân nặng chưa đúng" — bấm
    // cột Vận chuyển là sắp theo lúc gửi ĐVVC, không theo cân).
    id: 'weight',
    header: 'Cân nặng',
    meta: { align: 'right', width: 84, sortable: true },
    cell: ({ row }) => <WeightNote order={row.original} />,
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
            {/* Trạng thái hãng (như màn Đơn hàng) — chữ hãng gần nhất khi rê chuột. */}
            {o.carrierStage ? (
              <span title={o.carrierStatusText ?? undefined}>
                <CarrierStageTag stage={o.carrierStage} />
              </span>
            ) : null}
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
    // Hết sản phẩm của đơn, cách nhau dấu "; " (2026-11-04).
    value: (o) =>
      o.items.length > 0
        ? o.items.map((it) => `${it.name} × ${formatQuantity(it.qty)}`).join('; ')
        : null,
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
      ) : null}
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

/**
 * Ô lọc "Sản phẩm" (2026-11-02): đơn có dòng SKU đó, kể cả thành phần combo. Màn In đơn
 * (2026-11-04): tick "Chỉ sản phẩm này" = đơn không có sản phẩm nào khác (in theo lô cùng một mặt
 * hàng). Tích chọn nhiều (2026-11-10, user chốt): đơn có MỘT trong các SP; "Chỉ các SP này" = mọi
 * dòng thuộc các SP đã chọn.
 */
function ProductFilter({
  skuIds,
  only,
  onChange,
  onOnlyChange,
}: {
  skuIds: string[];
  only: boolean;
  onChange: (ids: string[]) => void;
  onOnlyChange: (on: boolean) => void;
}) {
  const selected = useSkuOptions(skuIds);
  return (
    <div className="flex items-center gap-3" data-testid="filter-sku">
      <EntityMultiPicker
        label="Sản phẩm"
        unit="SP"
        max={SKU_FILTER_MAX}
        values={skuIds}
        onChange={onChange}
        // Chỉ sản phẩm thường, bỏ combo (2026-11-04) — đơn có combo chứa SP vẫn lọc ra.
        useSearch={useNonComboSkuSearch}
        selectedOptions={selected}
        searchPlaceholder="Gõ tên / mã sản phẩm…"
        emptyText="Không tìm thấy sản phẩm"
      />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={only}
          disabled={skuIds.length === 0}
          onCheckedChange={(v) => onOnlyChange(v === true)}
          data-testid="filter-sku-only"
        />
        {skuIds.length > 1 ? 'Chỉ các sản phẩm này' : 'Chỉ sản phẩm này'}
      </label>
    </div>
  );
}

/** Khoá "SP ngoài hệ thống" của ô Lỗi đơn — trùng `NON_ERP_ITEMS_ERROR` bên API. */
const NON_ERP_ITEMS_ERROR = 'NON_ERP_ITEMS';

/** Giá trị URL nối dấu phẩy, mỗi phần mã hoá URI (câu hãng có dấu phẩy); phần hỏng bỏ qua. */
const decodeKeys = (v: string): string[] =>
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

/**
 * Lựa chọn ô "Lỗi đơn" (2026-11-10): "Có SP ngoài hệ thống" + nhóm lỗi vận đơn. Hãng từ chối →
 * câu hãng đã gom (chữ như cột Vận chuyển hiện); lỗi khác → câu theo mã (luật 6).
 */
function orderErrorFilterOptions(rows: OrderErrorOption[]) {
  return [
    { value: NON_ERP_ITEMS_ERROR, label: 'Có SP ngoài hệ thống', hint: 'Cần sửa' },
    ...rows.map((r) => ({
      value: encodeURIComponent(r.key),
      label: r.message ?? messageForCode(r.code),
      hint: r.message ? 'Hãng từ chối' : 'Lỗi vận đơn',
    })),
  ];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Khớp `@ArrayMaxSize(20)` của `skuIds` / `excludeSkuIds` bên API. */
const SKU_FILTER_MAX = 20;

/** Danh sách id SKU trên URL (nối dấu phẩy): chỉ giữ UUID (link dán sai bỏ qua), tối đa 20. */
const parseSkuIds = (v: string | undefined): string =>
  (v ?? '')
    .split(',')
    .filter((s) => UUID_RE.test(s))
    .slice(0, SKU_FILTER_MAX)
    .join(',');

/**
 * Ô "Loại trừ SP" (2026-11-10, user: có kết quả rồi muốn bỏ đơn có LION): tích chọn nhiều sản
 * phẩm. Đơn có SP đó (kể cả nằm trong combo) bị loại khỏi danh sách.
 */
function ExcludeProductFilter({
  skuIds,
  onChange,
}: {
  skuIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const selected = useSkuOptions(skuIds);
  return (
    <div data-testid="filter-exclude-sku">
      <EntityMultiPicker
        label="Loại trừ SP"
        unit="SP"
        max={SKU_FILTER_MAX}
        values={skuIds}
        onChange={onChange}
        emptySummary="Loại trừ SP: không"
        // Như ô Sản phẩm: chỉ SP thường — bỏ SP thì đơn có combo chứa SP đó cũng bị loại.
        useSearch={useNonComboSkuSearch}
        selectedOptions={selected}
        searchPlaceholder="Gõ tên / mã sản phẩm cần bỏ…"
        emptyText="Không tìm thấy sản phẩm"
      />
    </div>
  );
}

/**
 * Cân nặng gửi hãng hiệu lực (`weightKg` = đặt tay ?? Σ dòng × cân nặng SKU) — cột Cân nặng
 * (2026-11-06, trước nằm dưới cột Vận chuyển khi chưa có mã). Đặt tay có dấu ✎ + tooltip Σ dòng;
 * 0 = SKU chưa khai → "—".
 */
function WeightNote({ order }: { order: SalesOrderListItem }) {
  const manual = order.shippingWeightKg !== null;
  if ((toDecimal(order.weightKg)?.isZero() ?? true) && !manual) {
    return <span className="block text-muted-foreground">—</span>;
  }
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
        bấm <strong>Chuyển sang Đã xác nhận</strong>, hoặc sale xác nhận lại trên Pancake. Hàng về
        đủ không tự chuyển — kho tự quyết.{' '}
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

export function PrintOrdersScreen() {
  const { state, set, skipTake } = useListState<OrderFilter>(DEFAULTS);
  const urlFlow = parseOrderFlow(state.filters.flow);
  // Tab trạng thái v3 (2026-11-04): 14 trạng thái hiện cùng lúc, luôn chọn đúng một (mặc định Đơn
  // mới). Ô tìm có chữ / link `group=all` (từ màn khác) → xem mọi trạng thái (tìm đơn đã giao không
  // ra 0 vì đang ở tab khác). `?group=<nhóm>` cũ bỏ qua.
  // 2026-11-04 (user): bấm tab khi ô tìm có chữ GIỮ chữ — lọc chữ trong đúng tab đó (URL ghi
  // `flow` tường minh, kể cả NEW, bỏ `group`); gõ chữ từ ô trống → `group=all`, tìm mọi trạng thái.
  // Link chỉ có `?q=` (quét mã, màn khác) cũng tìm mọi trạng thái.
  // Tab cha (2026-11-09, clone màn Đơn hàng): `?view=issues` = "Cần xử lý" (chip `?ci=`, trống =
  // Tất cả = mọi chip đỏ trừ Chưa đối soát); còn lại = "Đơn hàng" (các tab trạng thái cũ giữ
  // nguyên). Ô tìm có chữ trong "Cần xử lý" lọc trong đúng chip đang chọn.
  const view: OrderTabView = state.filters.view === 'issues' ? 'issues' : 'orders';
  const issue: CarrierIssue | null = parseCarrierIssue(state.filters.ci) ?? null;
  const searching =
    view === 'orders' && (state.filters.group === 'all' || (state.q !== '' && !urlFlow));
  const currentFlow: OrderFlow = urlFlow ?? DEFAULT_ORDER_FLOW;
  const flow = view === 'orders' && !searching ? currentFlow : undefined;
  const carrierIssue = useMemo(
    () => (view === 'issues' ? (issue ? [issue] : CARRIER_ISSUES_ALL) : undefined),
    [view, issue],
  );
  const status = parseOrderStatus(state.filters.status);
  const customerId = state.filters.customerId ?? '';
  const shortSkuId = state.filters.shortSkuId ?? '';
  // Sản phẩm (tích chọn nhiều 2026-11-10): `?skuId=` nối dấu phẩy — link cũ một SKU vẫn đúng.
  const skuId = parseSkuIds(state.filters.skuId);
  const skuIds = useMemo(() => (skuId ? skuId.split(',') : []), [skuId]);
  const skuOnly = skuId !== '' && state.filters.skuOnly === 'true';
  // Loại trừ sản phẩm (2026-11-10): chỉ giữ id dạng UUID (link dán sai bỏ qua), tối đa 20 như API.
  const excludeSku = parseSkuIds(state.filters.excludeSku);
  const excludeSkuIds = useMemo(() => (excludeSku ? excludeSku.split(',') : []), [excludeSku]);
  const orderError = state.filters.orderError ?? '';
  const orderErrorKeys = useMemo(() => decodeKeys(orderError), [orderError]);
  const orderErrorOptions = useOrderErrorOptions();
  const carrierFilter = parseCarrierFilter(state.filters.carrier);
  // Cân nặng (2026-11-06, user "clone phần lọc cân nặng từ Bán hàng › Đơn hàng"): cân gửi hãng
  // hiệu lực (đặt tay ?? Σ dòng × cân SKU), API lọc như màn Đơn hàng.
  const weightMin = state.filters.weightMin ?? '';
  const weightMax = state.filters.weightMax ?? '';
  // Ô POS (2026-11-04, thay ô Nguồn): chọn nhiều POS Pancake, mã shop nối dấu phẩy — đơn Pancake
  // của POS đó + đơn ERP chọn POS đó khi tạo. Chỉ giữ mã dạng số (link cũ `POS:<mã>` bỏ qua).
  const pos = (state.filters.pos ?? '')
    .split(',')
    .filter((s) => /^\d+$/.test(s))
    .join(',');
  const pancakeShops = usePancakeShops();
  const from = state.filters.from ?? '';
  const to = state.filters.to ?? '';
  const dateField = DATE_FIELDS.some((f) => f.value === state.filters.dateField)
    ? (state.filters.dateField as OrderDateField)
    : undefined;
  // Ô Phòng ban với người có `sales_order.filter_dept` (Admin, kế toán, kho — user 2026-11-04) hoặc
  // `report.sales_all`. Không có quyền thì bỏ luôn giá trị trên URL (link dán từ đồng nghiệp) để
  // không lọc ngầm. Các ô đã bỏ khỏi màn này (2026-11-04) không đọc từ URL nữa.
  const ability = useAbility();
  const canFilterDept =
    ability.can('filter_dept', 'SalesOrder') || ability.can('sales_all', 'Report');
  const team = canFilterDept ? (state.filters.team ?? '') : '';
  const fbPage = state.filters.fbPage ?? '';
  // Hãng lấy hàng / In tem (2026-11-10, user) — cùng ô với màn Theo dõi đơn, lọc kèm mọi tab.
  const pickupStatus = pickOption(PICKUP_OPTIONS, state.filters.pickup);
  const printStatus = pickOption(PRINT_OPTIONS, state.filters.printStatus);
  const teamOptions = useTeamFilterOptions(canFilterDept);
  const facebookPages = useFacebookPageOptions();
  // NV đóng hàng (2026-11-13): người TỪNG được gán đóng hàng ở kho đang làm việc, kể cả đã nghỉ
  // (user: "hiện thị cả người nghỉ") — GET /sales-orders/packer-options; "Tất cả kho" → mọi kho.
  const packers = useOrderPackerOptions();
  const packerId = state.filters.packerId ?? '';
  // Ô "SĐT" (2026-11-13, user: gõ 4 số cuối chỉ tìm theo SĐT): < 3 chữ số thì chưa gửi (API 400).
  const phone = state.filters.phone ?? '';
  const phoneQuery = phone.replace(/\D/g, '').length >= 3 ? phone : undefined;
  // Sắp xếp lưu theo người dùng ở server (đăng xuất / đổi máy vẫn giữ). Sắp xếp trên URL (link
  // dán cho đồng nghiệp) thắng; URL không có thì lấy lần sắp gần nhất của người dùng. Cột ẩn không
  // còn (luôn hiện hết cột).
  const prefs = useOrderListPrefs('orders.print');
  const savePrefs = useSaveOrderListPrefs('orders.print');
  // Lọc theo Ngày gán ĐVVC mà URL chưa chọn cột sắp → sắp theo giờ gửi hãng, mới nhất trước
  // (2026-11-03) — thắng lần sắp đã lưu của người dùng. Đang tìm kiếm (ô tìm có chữ) mà chưa
  // chọn cột sắp → ưu tiên đơn ít sản phẩm trước + abc tên sản phẩm (user 2026-11-04) để kho
  // đóng theo lô; bấm cột khác thì theo cột đó.
  const sort: SortState | null =
    state.sort ??
    (state.q !== '' ? { id: 'product', desc: false } : null) ??
    (dateField === 'sentToCarrierAt' ? { id: 'shipping', desc: true } : null) ??
    prefs.data?.sort ??
    null;
  const sortBy = sort ? SORT_FIELD[sort.id] : undefined;
  const changeSort = (next: SortState | null) => {
    set({ sort: next });
    savePrefs.mutate({ hidden: NO_HIDDEN, sort: next });
  };
  const filterParams = useMemo(
    () => ({
      q: state.q,
      phone: phoneQuery,
      status,
      customerId,
      shortSkuId,
      skuIds,
      skuOnly,
      excludeSkuIds,
      orderError: orderErrorKeys,
      weightMin,
      weightMax,
      pancakeShopId: pos || undefined,
      from,
      to,
      dateField,
      teamIds: team || undefined,
      facebookPageIds: fbPage || undefined,
      pickupStatus,
      printStatus,
      carrierIds: carrierFilter.carrierIds || undefined,
      carrierAccountIds: carrierFilter.carrierAccountIds || undefined,
      packerId: packerId || undefined,
      // Tab Đã xác nhận màn In đơn chỉ đơn chưa có mã vận đơn (2026-11-06) — cả danh sách lẫn số đếm.
      warehouseNoWaybill: true,
    }),
    [
      phoneQuery,
      packerId,
      carrierFilter.carrierIds,
      carrierFilter.carrierAccountIds,
      state.q,
      status,
      customerId,
      shortSkuId,
      skuIds,
      skuOnly,
      excludeSkuIds,
      orderErrorKeys,
      weightMin,
      weightMax,
      pos,
      from,
      to,
      dateField,
      team,
      fbPage,
      pickupStatus,
      printStatus,
    ],
  );
  const params = useMemo(
    () => ({
      ...filterParams,
      flow,
      carrierIssue,
      sortBy,
      sortDir: sortBy ? (sort?.desc ? ('desc' as const) : ('asc' as const)) : undefined,
      // Doanh số dưới số đơn (2026-11-10): Σ giá trị đơn mọi đơn khớp tab + bộ lọc.
      withTotalAmount: true,
      ...skipTake,
    }),
    [filterParams, flow, carrierIssue, sortBy, sort?.desc, skipTake],
  );
  const carriers = useCarriers();
  // Chữ chip "Đang lọc" của ô Sản phẩm — cùng nguồn dữ liệu với ô chọn.
  const skuChip = useSkuDetail(skuIds.length === 1 ? skuIds[0]! : '');
  const excludeChip = useSkuDetail(excludeSkuIds.length === 1 ? excludeSkuIds[0]! : '');
  const router = useRouter();
  // Kho / admin sửa người nhận / ngày tạo đơn của mọi đơn kho mình, cả khi kho đã thao tác (2026-11-05).
  const canEditFields =
    ability.can('edit_receiver', 'SalesOrder') || ability.can('set_order_date', 'SalesOrder');
  const canUpdate = ability.can('update', 'SalesOrder') || canEditFields;
  const canCreate = ability.can('create', 'SalesOrder');
  const canPack = ability.can('pack', 'Shipment');
  const canCancelAny = ability.can('cancel', 'SalesOrder');
  const canCancelAfterCarrier = ability.can('cancel_after_carrier', 'SalesOrder');
  const canEditAny = ability.can('edit_all', 'SalesOrder') || canEditFields;
  const canCancel = canCancelAny || canCancelAfterCarrier || canCreate;
  const [peek, setPeek] = useState<SalesOrderListItem | null>(null);
  // Nút Hủy trên dòng → hộp xác nhận dùng chung với hủy hàng loạt (một đơn).
  const [cancelling, setCancelling] = useState<SalesOrderListItem | null>(null);
  const requestWaybill = useRequestWaybill();
  // Id dòng đang tích đã rời bộ lọc (tính lại mỗi lần render bên dưới) — ref để cột không dựng lại.
  const leftIdsRef = useRef(new Set<string>());
  const columns = useMemo(() => {
    const carrierById = new Map((carriers.data ?? []).map((c) => [c.id, c]));
    const all = buildColumns((id) => carrierById.get(id) ?? null, {
      isLeft: (id) => leftIdsRef.current.has(id),
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
  // Chờ sắp xếp đã lưu của người dùng (trừ khi URL có sẵn sort) rồi mới tải danh sách — trước đây
  // tải 2 lần (lần đầu chưa có sort, lần sau có), mỗi lần ~5 s trên prod (sự cố pool 2026-11-02).
  // Đọc prefs lỗi thì vẫn tải (isPending = false).
  const query = useOrders(params, { enabled: state.sort != null || !prefs.isPending });
  // Đếm cả 14 trạng thái trong một lần (GROUP BY flow).
  const counts = useOrderFlowCounts(filterParams);
  // Số chip "Cần xử lý" — số trên tab cha hiện cả khi đang ở "Đơn hàng".
  const issueCounts = useOrderTabCounts(filterParams, 'issues');
  // Xuất Excel = mọi trang của đúng bộ lọc + tab + sắp xếp đang xem.
  const exportParams = useMemo(
    () => ({
      ...filterParams,
      flow,
      carrierIssue,
      sortBy,
      sortDir: sortBy ? (sort?.desc ? ('desc' as const) : ('asc' as const)) : undefined,
    }),
    [filterParams, flow, carrierIssue, sortBy, sort?.desc],
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
    shortSkuId !== '' ||
    skuId !== '' ||
    excludeSku !== '' ||
    orderError !== '' ||
    weightMin !== '' ||
    weightMax !== '' ||
    pos !== '' ||
    from !== '' ||
    to !== '' ||
    team !== '' ||
    fbPage !== '' ||
    pickupStatus !== undefined ||
    printStatus !== undefined ||
    carrierFilter.value !== '' ||
    packerId !== '' ||
    phone !== '';
  const customerName = query.data?.items[0]?.customer.name;
  // Dòng đã chọn: nhớ cả dòng vừa RỜI bộ lọc (sự cố 2026-11-07, màn In đơn: Gửi ĐVVC xong đơn sang
  // tab Đang đóng hàng → tab Đã xác nhận không còn dòng chọn → thanh chọn nhiều bị gỡ kéo theo hộp
  // Sang ĐVVC đang hỏi "Đóng gói + in vận đơn luôn?"). Chỉ bỏ nhớ khi bỏ chọn.
  // 2026-11-10 (user): thao tác hàng loạt xong KHÔNG tự bỏ tích — đơn đã rời tab vẫn hiện đúng
  // chỗ cũ (dữ liệu mới nhất qua `ids`) tới khi bỏ tích / tải lại trang, để bỏ tích đơn đã xong rồi
  // làm tiếp với đơn lỗi (vd 6 đơn gửi GHTK được, 4 đơn lỗi đẩy sang Viettel).
  const selectedRowCache = useRef(new Map<string, SalesOrderListItem>());
  const items = query.data?.items ?? [];
  const itemIds = new Set(items.map((r) => r.id));
  const leftIds = [...selectedRowCache.current.keys()].filter(
    (id) => selected[id] && !itemIds.has(id),
  );
  const leftQuery = useOrders(
    { ids: leftIds, take: Math.min(Math.max(leftIds.length, 1), 200), skip: 0 },
    { enabled: leftIds.length > 0 && !query.isPlaceholderData },
  );
  for (const r of items) if (selected[r.id]) selectedRowCache.current.set(r.id, r);
  for (const r of leftQuery.data?.items ?? []) {
    if (selected[r.id] && !itemIds.has(r.id)) selectedRowCache.current.set(r.id, r);
  }
  for (const id of [...selectedRowCache.current.keys()]) {
    if (!selected[id]) selectedRowCache.current.delete(id);
  }
  leftIdsRef.current = new Set(leftIds);
  // Vị trí cũ của từng dòng (lần hiện trước) — dòng đã rời chèn lại đúng chỗ đó.
  const lastOrder = useRef<string[]>([]);
  const displayRows = useMemo(() => {
    const out = [...items];
    const pos = new Map(lastOrder.current.map((id, i) => [id, i]));
    const left = leftIds
      .map((id) => selectedRowCache.current.get(id))
      .filter((r): r is SalesOrderListItem => r !== undefined)
      .sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
    for (const r of left) out.splice(Math.min(pos.get(r.id) ?? out.length, out.length), 0, r);
    return out;
    // leftIds / cache đổi theo selected + dữ liệu hai query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, leftIds.join(','), leftQuery.data, selected]);
  useEffect(() => {
    lastOrder.current = displayRows.map((r) => r.id);
  }, [displayRows]);
  const selectedRows = displayRows.filter((r) => selected[r.id]);
  const clearSelection = () => setSelected({});
  // In lại từ tem số N (2026-11-10): bỏ tích đơn của các tem đã ra giấy.
  const deselect = (ids: string[]) => {
    const drop = new Set(ids);
    setSelected((s) => Object.fromEntries(Object.entries(s).filter(([id]) => !drop.has(id))));
  };

  return (
    <>
      <PageHeader
        // Tên theo menu Kho › Đơn hàng (user 2026-11-05) — "In đơn" giờ là màn /wms/waybills.
        title="Đơn hàng"
        sticky={false}
        description={
          // Số đơn khớp bộ lọc, to, đậm (user 2026-11-03); bỏ "/ tổng số đơn" (user 2026-11-05).
          <span className="block">
            <span>{query.data ? 'Đơn khớp bộ lọc' : 'Đang đếm số đơn khớp bộ lọc…'}</span>
            {query.data ? (
              <span
                data-testid="order-count"
                className="block text-2xl font-bold leading-tight text-foreground"
              >
                {groupVi(String(query.data.total))}
              </span>
            ) : null}
            {query.data?.totalAmount !== undefined ? (
              // Doanh số (2026-11-10, user): Σ giá trị đơn (gồm phí ship) của đúng số đơn trên.
              <span data-testid="order-amount" className="block text-sm">
                Doanh số{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatMoney(query.data.totalAmount)}
                </span>
              </span>
            ) : null}
          </span>
        }
        breadcrumb={[{ label: 'Kho' }, { label: 'Đơn hàng' }]}
        actions={
          <>
            <OrderScanButton onScan={onScan} />
            <Can I="map" a="Sync">
              {/* Đang lọc đúng một POS → gợi ý POS đó khi đồng bộ lại đơn Pancake. */}
              <PancakeOrderResyncButton defaultShopId={pos.includes(',') ? '' : pos} />
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

      {/*
        Khối ghim (user 2026-11-04): tab trạng thái + ghi chú chờ hàng + thanh lọc / thanh chọn nhiều
        dính dưới thanh trên khi cuộn bảng; đầu trang cuộn theo (PageHeader sticky={false}). flex-col
        để lề dưới của FilterBar / OrderFlowTabs không tràn ra ngoài khối (nền che kín bảng bên dưới).
        z-40 ngang PageHeader, trên ô dính của bảng.
      */}
      <div className="sticky top-sticky-page-header z-40 -mx-5 flex flex-col bg-background px-5">
        <div className="mb-2">
          <OrderViewTabs
            view={view}
            issueCounts={issueCounts.data}
            onViewChange={(v) =>
              set({
                filters: {
                  ...state.filters,
                  view: v === 'issues' ? 'issues' : undefined,
                  ci: v === 'issues' ? (issue ?? undefined) : undefined,
                },
              })
            }
          />
        </div>
        {view === 'orders' ? (
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
            onShowAll={() => set({ filters: { ...state.filters, group: 'all' } })}
          />
        ) : (
          <div className="mb-3">
            <IssueChips
              issue={issue}
              issueCounts={issueCounts.data}
              onIssueChange={(i) =>
                set({ filters: { ...state.filters, view: 'issues', ci: i ?? undefined } })
              }
            />
          </div>
        )}

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
          <OrderBulkBar
            rows={selectedRows}
            onClear={clearSelection}
            onDone={KEEP_SELECTION}
            onDeselect={deselect}
          />
        ) : (
          <FilterBar<OrderFilter>
            busy={query.isPlaceholderData}
            q={state.q}
            onQChange={(q) =>
              // Bắt đầu tìm từ ô trống → mọi trạng thái (`group=all`, giữ `flow` cho nút "Quay lại");
              // xóa hết chữ → về tab; sửa chữ đang tìm → giữ nguyên (tab đã chọn vẫn lọc).
              // Tab cha "Cần xử lý": chỉ lọc chữ trong chip đang chọn.
              set(
                view === 'issues'
                  ? { q }
                  : state.q === '' && q !== ''
                    ? { q, filters: { ...state.filters, group: 'all' } }
                    : q === ''
                      ? { q, filters: { ...state.filters, group: undefined } }
                      : { q },
              )
            }
            filters={[
              // Ô SĐT riêng cạnh ô tìm (2026-11-13, user): 4 số cuối chỉ khớp SĐT khách / người
              // nhận, không ra đơn trùng đuôi mã đơn / mã vận đơn như ô tìm chung.
              { key: 'phone', label: 'SĐT', type: 'text', placeholder: 'SĐT · 4 số cuối' },
              {
                key: 'from',
                toKey: 'to',
                label: 'Ngày đặt',
                type: 'dateRange',
                rememberKey: 'date.print-orders',
                // Mở màn lần đầu (chưa ghi nhớ, URL không có ngày) → 30 ngày qua (user 2026-11-03).
                defaultPreset: 'last30',
                fieldKey: 'dateField',
                fields: DATE_FIELDS,
              },
              {
                key: 'skuId',
                label: 'Sản phẩm',
                type: 'custom',
                chip:
                  skuIds.length > 1
                    ? `${skuOnly ? 'Chỉ ' : ''}${skuIds.length} sản phẩm`
                    : skuIds.length === 1
                      ? `${skuOnly ? 'Chỉ ' : ''}${skuChip.data?.name ?? 'đã chọn'}`
                      : null,
                render: () => (
                  <ProductFilter
                    skuIds={skuIds}
                    only={skuOnly}
                    onChange={(ids) =>
                      setFilter({
                        skuId: ids.join(',') || undefined,
                        ...(ids.length ? {} : { skuOnly: undefined }),
                      })
                    }
                    onOnlyChange={(on) => setFilter({ skuOnly: on ? 'true' : undefined })}
                  />
                ),
              },
              {
                key: 'excludeSku',
                label: 'Loại trừ SP',
                type: 'custom',
                chip:
                  excludeSkuIds.length > 1
                    ? `Bỏ ${excludeSkuIds.length} sản phẩm`
                    : excludeSkuIds.length === 1
                      ? `Bỏ ${excludeChip.data?.name ?? 'sản phẩm đã chọn'}`
                      : null,
                render: () => (
                  <ExcludeProductFilter
                    skuIds={excludeSkuIds}
                    onChange={(ids) => setFilter({ excludeSku: ids.join(',') || undefined })}
                  />
                ),
              },
              // POS, Page, Phòng ban bày ngay trên thanh cạnh ô Sản phẩm (user 2026-11-04); không
              // `pinned` → không có panel "Bộ lọc khác", "Xóa lọc (n)" đứng cạnh ô lọc cuối. Ô POS
              // chọn nhiều thay ô Nguồn (ERP / Pancake).
              {
                key: 'pos',
                label: 'POS',
                type: 'multiSelect',
                unit: 'POS',
                options: (pancakeShops.data ?? []).map((s) => ({
                  value: s.shopId,
                  label: pancakeShopLabel(s),
                })),
              },
              // Hãng VC (2026-11-10, user): dòng hãng = mọi tài khoản, tài khoản liệt kê dưới hãng.
              {
                key: 'carrier',
                label: 'Hãng VC',
                type: 'multiSelect',
                unit: 'lựa chọn',
                options: carrierFilterOptions(carriers.data),
              },
              {
                key: 'fbPage',
                label: 'Page',
                type: 'multiSelect',
                unit: 'page',
                options: (facebookPages.data ?? []).map((p) => ({
                  value: p.id,
                  label: p.isActive ? p.name : `${p.name} (ngưng)`,
                  hint: p.shopIds.length ? `${p.shopIds.length} POS` : undefined,
                })),
              },
              // Phòng ban: quyền `sales_order.filter_dept` (2026-11-04), chọn nhiều — phòng CSKH + phòng Sale/MKT
              // đã có đơn; chưa chọn = tất cả.
              ...(canFilterDept
                ? [
                    {
                      key: 'team' as const,
                      label: 'Phòng ban',
                      type: 'multiSelect' as const,
                      unit: 'phòng',
                      options: (teamOptions.data ?? []).map((t) => ({
                        value: t.teamId,
                        label: t.isActive ? t.name : `${t.name} (ngừng hoạt động)`,
                        hint: t.group === 'CSKH' ? 'CSKH' : 'Sale/MKT',
                      })),
                    },
                  ]
                : []),
              // Cân nặng (đưa lại 2026-11-06, user) — cùng ô với Bán hàng › Đơn hàng.
              {
                key: 'weightMin',
                label: 'Cân nặng',
                type: 'custom',
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
              // Hãng lấy hàng + In tem (2026-11-10, user: "thêm 2 filter này … lọc kèm các tab") —
              // cùng ô với màn Theo dõi đơn.
              { key: 'pickup', label: 'Hãng lấy hàng', type: 'select', options: PICKUP_OPTIONS },
              { key: 'printStatus', label: 'In tem', type: 'select', options: PRINT_OPTIONS },
              // NV đóng hàng (2026-11-13, user) — người đã nghỉ vẫn chọn được, ghi "(đã nghỉ)".
              {
                key: 'packerId',
                label: 'NV đóng hàng',
                type: 'select',
                searchable: true,
                options: (packers.data ?? []).map((p) => ({
                  value: p.userId,
                  label: p.isActive ? p.fullName : `${p.fullName} (đã nghỉ)`,
                  hint: p.code,
                })),
              },
              // Lỗi đơn (2026-11-10, user): lỗi đang hiện trên danh sách — SP ngoài hệ thống + lỗi
              // vận đơn gom theo câu hãng. Giá trị mã hoá URI (câu hãng có dấu phẩy).
              {
                key: 'orderError',
                label: 'Lỗi đơn',
                type: 'multiSelect',
                unit: 'lỗi',
                options: orderErrorFilterOptions(orderErrorOptions.data ?? []),
              },
              // Bỏ 2026-11-04 (user): Hãng VC (đưa lại 2026-11-10 dạng chọn nhiều), NV lên đơn, nhóm Vận chuyển (Gán hãng, Trạng thái
              // hãng), nhóm Đơn (Trùng trong ngày, SP ngoài ERP, Giá trị đơn).
            ]}
            values={{
              status: state.filters.status,
              customerId: state.filters.customerId,
              pos,
              from: state.filters.from,
              to: state.filters.to,
              dateField: state.filters.dateField,
              team,
              fbPage: state.filters.fbPage,
              skuId: skuId || undefined,
              excludeSku: excludeSku || undefined,
              weightMin: state.filters.weightMin,
              weightMax: state.filters.weightMax,
              pickup: pickupStatus,
              printStatus,
              orderError: orderError || undefined,
              carrier: carrierFilter.value || undefined,
              packerId: packerId || undefined,
              phone: phone || undefined,
            }}
            onFilterChange={(patch) =>
              // Như ô tìm chung: bắt đầu tìm SĐT từ ô trống → mọi trạng thái (`group=all`); xóa hết
              // → về tab. Tab cha "Cần xử lý" giữ chip đang chọn.
              'phone' in patch && view !== 'issues' && state.q === ''
                ? setFilter({
                    ...patch,
                    ...(phone === '' && patch.phone
                      ? { group: 'all' }
                      : !patch.phone
                        ? { group: undefined }
                        : {}),
                  })
                : setFilter(patch)
            }
            searchPlaceholder="Mã đơn, SĐT, tên SP, mã vận đơn… nhiều giá trị cách dấu phẩy hoặc dấu cách"
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
              </>
            }
          />
        )}
      </div>

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={9} />}
        isEmpty={(d) => d.items.length === 0 && leftIds.length === 0}
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
            rows={data.items === items ? displayRows : data.items}
            getRowId={(r) => r.id}
            total={data.total}
            page={state.page}
            size={state.size}
            sort={sortBy ? sort : null}
            pageSizes={ORDER_PAGE_SIZES}
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

/** Thao tác hàng loạt xong: giữ nguyên tích (user 2026-11-10) — chỉ "Bỏ chọn" / bỏ tích tay. */
const KEEP_SELECTION = () => undefined;

/**
 * Thanh chọn nhiều (design system BulkActionBar, thay chỗ thanh lọc): tổng tiền / COD của các đơn
 * đã chọn; nút phụ Hủy đơn · Chuyển kho · Đóng gói + in vận đơn; "Khác" gom Gán hãng / cân nặng · Xin lại vận đơn ·
 * In lại vận đơn; nút chính "Gửi sang ĐVVC" ở mép phải. Hộp thoại mở từ "Khác" sống ngoài menu
 * (menu đóng là gỡ nội dung). Hủy đơn (2026-10-29) hiện cho cả người lên đơn — người lên đơn hủy
 * đơn mình, trưởng phòng / trưởng nhóm CSKH hủy đơn nhân viên; server kiểm từng đơn, đơn không
 * được hủy vào `failed`.
 */
function OrderBulkBar({
  rows,
  onClear,
  onDone,
  onDeselect,
}: {
  rows: SalesOrderListItem[];
  /** Nút "Bỏ chọn". */
  onClear: () => void;
  /** Sau khi một thao tác hàng loạt xong — màn In đơn giữ nguyên tích (2026-11-10). */
  onDone: () => void;
  onDeselect: (orderIds: string[]) => void;
}) {
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
          const verb = on ? 'chuyển Chờ hàng' : 'chuyển sang Đã xác nhận';
          if (r.updated.length > 0) toast.success(`Đã ${verb} ${r.updated.length} đơn`);
          if (r.failed.length > 0) {
            toast.error(
              `${r.failed.length} đơn không ${verb} được: ${messageForCode(r.failed[0]!.code, 409)}`,
            );
          }
          onDone();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  const canReprint = ability.can('pack', 'Shipment');
  // Hủy vận đơn → đơn về Đã xác nhận (2026-11-07): quyền `cancel_after_carrier` hoặc `cancel`.
  const canCancelWaybill =
    ability.can('cancel_after_carrier', 'SalesOrder') || ability.can('cancel', 'SalesOrder');
  const withWaybill = rows.filter((r) => r.shipment?.trackingNo);
  // Xin lại vận đơn hàng loạt (2026-11-02) — cùng quyền với nút trên dòng (`pack` Shipment).
  const retryable = rows.filter(retryableWaybill);
  const canCancel =
    ability.can('cancel', 'SalesOrder') ||
    ability.can('cancel_after_carrier', 'SalesOrder') ||
    ability.can('create', 'SalesOrder');
  // Xác nhận hàng loạt (2026-11-06): đơn ERP Đơn mới / Chờ duyệt (đơn Pancake xác nhận trên POS).
  const confirm = useBulkConfirmOrders();
  const unconfirmed = rows.filter(isUnconfirmedErp);
  const confirmAll = () =>
    confirm.mutate(
      unconfirmed.map((r) => r.id),
      {
        onSuccess: (r) => {
          if (r.confirmed.length > 0) toast.success(`Đã xác nhận ${r.confirmed.length} đơn`);
          if (r.failed.length > 0) {
            toast.error(
              `${r.failed.length} đơn không xác nhận được: ${messageForCode(r.failed[0]!.code, 409)}`,
            );
          }
          onDone();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );

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
        {canCancel ? <BulkCancelDialog rows={rows} onDone={onDone} /> : null}
        {ability.can('create', 'SalesOrder') && unconfirmed.length > 0 ? (
          <Button variant="outline" size="sm" loading={confirm.isPending} onClick={confirmAll}>
            Xác nhận đơn ({unconfirmed.length})
          </Button>
        ) : null}
        {/* Kho chuyển kho đơn bằng `send_carrier` (2026-11-04, user chốt) như sale có `update`. */}
        {ability.can('update', 'SalesOrder') || canUpdate ? (
          <BulkMoveWarehouseDialog rows={rows} onDone={onDone} />
        ) : null}
        <Can I="fulfil_manual" a="SalesOrder">
          {/* Màn In đơn: chọn NV đóng hàng trước khi in (2026-11-04). */}
          <BulkFulfilPrintDialog rows={rows} onDone={onDone} askPacker />
        </Can>
        {canReprint ? (
          // Ra ngoài menu "Khác" (user 2026-11-06) — như màn Đơn lỗi; đếm đơn đã có mã vận đơn.
          <Button
            variant="outline"
            size="sm"
            disabled={withWaybill.length === 0}
            onClick={() => setDialog('reprint')}
          >
            In lại vận đơn{withWaybill.length > 0 ? ` (${withWaybill.length})` : ''}
          </Button>
        ) : null}
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
                  Chuyển sang Đã xác nhận
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
        {canUpdate ? <SendToCarrierMenu rows={rows} onDone={onDone} /> : null}
      </BulkActionBar>
      {canUpdate ? (
        <BulkShippingDialog
          rows={rows}
          onDone={onDone}
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
          onDone={onDone}
        />
      ) : null}
      {canReprint ? (
        <BulkReprintWaybillDialog
          rows={rows}
          open={dialog === 'reprint'}
          onOpenChange={openChange('reprint')}
          onDeselect={onDeselect}
        />
      ) : null}
      {canReprint ? (
        <BulkRetryWaybillDialog
          rows={rows}
          open={dialog === 'retry-waybill'}
          onOpenChange={openChange('retry-waybill')}
          onDone={onDone}
        />
      ) : null}
    </div>
  );
}
