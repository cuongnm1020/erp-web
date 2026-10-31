'use client';

import { useCallback, useMemo } from 'react';
import { normalizeRange, type DateRange } from '@/components/data/date-range-picker';
import { toLocalDateKey } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import type {
  FulfilmentGroup,
  OrderOrigin,
  SalesChannel,
  SalesFilter,
} from '../api/use-sales-report';

/** Trần khoảng ngày của API báo cáo bán hàng (SALES_REPORT_MAX_DAYS) — chặn trước để không 422. */
export const SALES_MAX_DAYS = 366;

/**
 * Mọi trạng thái màn Báo cáo doanh thu nằm trên URL (luật 8): tab, khoảng ngày, bộ lọc chung, và
 * tham số riêng từng tab. `ownerName` / `teamName` chỉ để hiện chip khi lọc bằng cách bấm vào dòng
 * nhân viên (người không có danh sách nhân viên vẫn thấy mình đang lọc ai); `supplierName` tương tự cho
 * chip NCC ở tab Sản phẩm / Bán chạy.
 */
export const REPORT_FILTER_KEYS = [
  'tab',
  'from',
  'to',
  'channel',
  'teamId',
  'teamName',
  'ownerId',
  'ownerName',
  // POS Pancake của đơn
  'pancakeShopId',
  // Tình trạng giao — các nhóm cách nhau dấu phẩy ("DELIVERED,SHIPPING")
  'fulfilment',
  // Tổng quan
  'gran',
  'metric',
  // Sản phẩm + Bán chạy: lọc theo NCC chính (từ nút "Xem sản phẩm" ở tab Nhà cung cấp) — tên
  // chỉ để hiện chip.
  'supplierId',
  'supplierName',
  // Sản phẩm
  'group',
  // Nhân viên
  'staff',
  // Bán chạy
  'rank',
  'limit',
] as const;
export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];

const DEFAULTS = {
  filterKeys: REPORT_FILTER_KEYS,
  sort: { id: 'revenue', desc: true },
};

/** Nguồn đơn chọn ở ô Kênh (`?channel=PANCAKE|ERP` trên URL) → tham số `origin` của API. */
const ORIGINS: Array<{ value: OrderOrigin; label: string }> = [
  { value: 'PANCAKE', label: 'Pancake' },
  { value: 'ERP', label: 'Hệ thống (ERP)' },
];
const ORIGIN_VALUES = new Set<string>(ORIGINS.map((o) => o.value));

const SALES_CHANNELS: Array<{ value: SalesChannel; label: string }> = [
  { value: 'DIRECT', label: 'Trực tiếp' },
  { value: 'MARKETPLACE', label: 'Sàn TMĐT' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'POS', label: 'Tại quầy' },
];
const CHANNEL_VALUES = new Set<string>(SALES_CHANNELS.map((c) => c.value));

/** Lựa chọn ô Kênh: nguồn đơn Pancake / hệ thống trước, rồi kênh bán. */
export const CHANNELS: Array<{ value: OrderOrigin | SalesChannel; label: string }> = [
  ...ORIGINS,
  ...SALES_CHANNELS,
];

/** Nhóm tình trạng giao (GET /reports/sales/* `fulfilment`) — bỏ Hoàn = thực thu. */
export const FULFILMENT_OPTIONS: Array<{ value: FulfilmentGroup; label: string }> = [
  { value: 'DELIVERED', label: 'Thành công' },
  { value: 'SHIPPING', label: 'Đang giao' },
  { value: 'NOT_SHIPPED', label: 'Chưa gửi hàng' },
  { value: 'RETURNED', label: 'Hoàn' },
];
const FULFILMENT_VALUES = new Set<string>(FULFILMENT_OPTIONS.map((o) => o.value));

/** "DELIVERED,SHIPPING" trên URL → mảng hợp lệ, bỏ giá trị lạ; rỗng = không lọc. */
export const parseFulfilment = (raw: string | undefined): FulfilmentGroup[] =>
  (raw ?? '').split(',').filter((v): v is FulfilmentGroup => FULFILMENT_VALUES.has(v));

export function useSalesReportState() {
  const list = useListState<ReportFilterKey>(DEFAULTS);
  const { state, set } = list;
  const today = toLocalDateKey(new Date()) ?? '';
  const range = useMemo(
    () =>
      normalizeRange(
        { from: state.filters.from, to: state.filters.to },
        { from: `${today.slice(0, 8)}01`, to: today },
        SALES_MAX_DAYS,
      ),
    [state.filters.from, state.filters.to, today],
  );
  const channelRaw = state.filters.channel;
  const fulfilmentRaw = state.filters.fulfilment;
  const filter = useMemo<SalesFilter>(
    () => ({
      from: range.from,
      to: range.to,
      channel:
        channelRaw && CHANNEL_VALUES.has(channelRaw) ? (channelRaw as SalesChannel) : undefined,
      origin: channelRaw && ORIGIN_VALUES.has(channelRaw) ? (channelRaw as OrderOrigin) : undefined,
      teamId: state.filters.teamId,
      ownerId: state.filters.ownerId,
      pancakeShopId: /^[1-9]\d{0,17}$/.test(state.filters.pancakeShopId ?? '')
        ? state.filters.pancakeShopId
        : undefined,
      fulfilment: (() => {
        const v = parseFulfilment(fulfilmentRaw);
        return v.length ? v : undefined;
      })(),
    }),
    [
      range,
      channelRaw,
      fulfilmentRaw,
      state.filters.teamId,
      state.filters.ownerId,
      state.filters.pancakeShopId,
    ],
  );

  /** Ghi đè một phần filter (giữ phần còn lại), page về 1. */
  const setFilters = useCallback(
    (patch: Partial<Record<ReportFilterKey, string | undefined>>) =>
      set({ filters: { ...state.filters, ...patch } }),
    [set, state.filters],
  );
  const setRange = useCallback(
    (r: DateRange) => setFilters({ from: r.from, to: r.to }),
    [setFilters],
  );

  return { ...list, today, range, filter, setFilters, setRange };
}
