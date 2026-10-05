'use client';

import { useCallback, useMemo } from 'react';
import { normalizeRange, type DateRange } from '@/components/data/date-range-picker';
import { toLocalDateKey } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import type { SalesChannel, SalesFilter } from '../api/use-sales-report';

/** Trần khoảng ngày của API báo cáo bán hàng (SALES_REPORT_MAX_DAYS) — chặn trước để không 422. */
export const SALES_MAX_DAYS = 366;

/**
 * Mọi trạng thái màn Báo cáo doanh thu nằm trên URL (luật 8): tab, khoảng ngày, bộ lọc chung, và
 * tham số riêng từng tab. `ownerName` / `teamName` chỉ để hiện chip khi lọc bằng cách bấm vào dòng
 * nhân viên (người không có danh sách nhân viên vẫn thấy mình đang lọc ai).
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
  // Tổng quan
  'gran',
  'metric',
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

export const CHANNELS: Array<{ value: SalesChannel; label: string }> = [
  { value: 'DIRECT', label: 'Trực tiếp' },
  { value: 'MARKETPLACE', label: 'Sàn TMĐT' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'POS', label: 'Tại quầy' },
];
const CHANNEL_VALUES = new Set<string>(CHANNELS.map((c) => c.value));

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
  const filter = useMemo<SalesFilter>(
    () => ({
      from: range.from,
      to: range.to,
      channel:
        channelRaw && CHANNEL_VALUES.has(channelRaw) ? (channelRaw as SalesChannel) : undefined,
      teamId: state.filters.teamId,
      ownerId: state.filters.ownerId,
    }),
    [range, channelRaw, state.filters.teamId, state.filters.ownerId],
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
