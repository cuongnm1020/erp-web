'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatDate, formatQuantity, toLocalDateKey } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import {
  useProductivity,
  type ProductivityRow,
  type ProductivitySection,
} from '../api/use-productivity';
import { useWarehouses } from '../api/use-warehouses';

/**
 * Năng suất kho (2026-09-28) — GET /tasks/productivity. Hai bảng theo nhân viên: đơn đã LẤY
 * (task PICK xong) và đơn đã ĐÓNG GÓI (task PACK xong) trong khoảng ngày giờ VN, kèm số dòng,
 * số lượng, số đơn báo thiếu, thời gian trung bình / đơn; cột "Đang giao" là việc đang nằm trên
 * tay từng người LÚC NÀY (không theo khoảng ngày) để điều phối chia việc. Một task PICK/PACK =
 * một đơn; việc trong lượt gộp tính cho người giữ lượt. Mọi con số do API tính (luật 10).
 * Khoảng ngày + kho nằm trên URL (luật 8) — dán link cho đồng nghiệp xem đúng khoảng đó.
 */
const DEFAULTS = { filterKeys: ['from', 'to', 'warehouseId'] as const };
type Filter = (typeof DEFAULTS.filterKeys)[number];
const ALL = '__all__';
/** Trần của API (PRODUCTIVITY_MAX_DAYS) — chặn trước ở màn để không bắn 422. */
const MAX_DAYS = 92;

/** Cộng ngày trên khoá YYYY-MM-DD (thuần lịch, không phụ thuộc múi giờ máy). */
function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map((x) => Number.parseInt(x, 10));
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** 95 → "1 phút 35 giây"; 3900 → "1 giờ 05 phút". null = không đo được. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds} giây`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} phút ${String(seconds % 60).padStart(2, '0')} giây`;
  return `${Math.floor(m / 60)} giờ ${String(m % 60).padStart(2, '0')} phút`;
}

export function ProductivityScreen() {
  const { state, set } = useListState<Filter>(DEFAULTS);
  const today = toLocalDateKey(new Date()) ?? '';
  const from = state.filters.from ?? today;
  const to = state.filters.to ?? from;
  const warehouseId = state.filters.warehouseId ?? '';
  const params = useMemo(() => ({ from, to, warehouseId }), [from, to, warehouseId]);
  const query = useProductivity(params);
  const warehouses = useWarehouses();

  const setRange = useCallback(
    (f: string, t: string) => set({ filters: { ...state.filters, from: f, to: t } }),
    [set, state.filters],
  );
  // "Từ ngày" sau "Đến ngày" → kéo đầu kia theo; quá 92 ngày → co về đúng 92 ngày.
  const onFrom = (v: string) => {
    if (!v) return;
    const t = v > to ? v : daysBetween(v, to) >= MAX_DAYS ? shiftDay(v, MAX_DAYS - 1) : to;
    setRange(v, t);
  };
  const onTo = (v: string) => {
    if (!v) return;
    const f = v < from ? v : daysBetween(from, v) >= MAX_DAYS ? shiftDay(v, -(MAX_DAYS - 1)) : from;
    setRange(f, v);
  };

  const presets: Array<{ label: string; from: string; to: string }> = [
    { label: 'Hôm nay', from: today, to: today },
    { label: 'Hôm qua', from: shiftDay(today, -1), to: shiftDay(today, -1) },
    { label: '7 ngày', from: shiftDay(today, -6), to: today },
    { label: 'Tháng này', from: `${today.slice(0, 8)}01`, to: today },
  ];
  const rangeLabel = from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Năng suất kho"
        description={`Đơn đã lấy và đã đóng gói theo nhân viên · ${rangeLabel} · cột "Đang giao" là số lúc này`}
        breadcrumb={[{ label: 'Kho' }, { label: 'Năng suất kho' }]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wms/dispatch">Mở bảng điều phối</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card px-3 py-2">
        <div className="flex gap-1" role="group" aria-label="Chọn nhanh khoảng ngày">
          {presets.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant={p.from === from && p.to === to ? 'default' : 'outline'}
              onClick={() => setRange(p.from, p.to)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          Từ ngày
          <Input
            type="date"
            className="h-8 w-40"
            value={from}
            max={today}
            onChange={(e) => onFrom(e.target.value)}
            aria-label="Từ ngày"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          Đến ngày
          <Input
            type="date"
            className="h-8 w-40"
            value={to}
            max={today}
            onChange={(e) => onTo(e.target.value)}
            aria-label="Đến ngày"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          Kho
          <Select
            value={warehouseId || ALL}
            onValueChange={(v) =>
              set({ filters: { ...state.filters, warehouseId: v === ALL ? undefined : v } })
            }
          >
            <SelectTrigger className="h-8 w-48" aria-label="Kho">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi kho</SelectItem>
              {(warehouses.data ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {query.isPending || (query.data === undefined && !query.error) ? (
        <ListSkeleton rows={8} columns={8} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Đơn đã lấy"
              value={query.data.pick.totals.done.orders}
              detail={`${formatQuantity(query.data.pick.totals.done.qty)} sản phẩm`}
            />
            <KpiCard
              label="Đơn đã đóng gói"
              value={query.data.pack.totals.done.orders}
              detail={`${formatQuantity(query.data.pack.totals.done.qty)} sản phẩm`}
            />
            <KpiCard
              label="Đơn báo thiếu"
              value={query.data.pick.totals.done.shortOrders}
              detail="trong các đơn đã lấy"
            />
            <KpiCard
              label="Đang giao lấy hàng"
              value={openCount(query.data.pick)}
              detail={`${query.data.pick.totals.open.inProgress} đang làm`}
            />
            <KpiCard
              label="Đang giao đóng gói"
              value={openCount(query.data.pack)}
              detail={`${query.data.pack.totals.open.inProgress} đang làm`}
            />
            <KpiCard
              label="Chờ giao việc"
              value={query.data.pick.totals.unassigned + query.data.pack.totals.unassigned}
              detail={`${query.data.pick.totals.unassigned} lấy · ${query.data.pack.totals.unassigned} đóng gói`}
            />
          </div>
          <StaffTable
            title="Nhân viên lấy hàng"
            section={query.data.pick}
            doneLabel="Đơn đã lấy"
            showShort
            emptyText="Chưa có nhân viên lấy hàng nào. Gán role Nhân viên lấy đơn ở Quản trị › Nhân viên."
          />
          <StaffTable
            title="Nhân viên đóng gói"
            section={query.data.pack}
            doneLabel="Đơn đã đóng"
            showShort={false}
            emptyText="Chưa có nhân viên đóng gói nào. Gán role Nhân viên đóng hàng ở Quản trị › Nhân viên."
          />
        </>
      ) : null}
    </div>
  );
}

const openCount = (s: ProductivitySection) => s.totals.open.assigned + s.totals.open.inProgress;

function StaffTable({
  title,
  section,
  doneLabel,
  showShort,
  emptyText,
}: {
  title: string;
  section: ProductivitySection;
  doneLabel: string;
  showShort: boolean;
  emptyText: string;
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {section.rows.length === 0 ? (
        <EmptyState
          title="Chưa có ai trong bảng này"
          description={emptyText}
          action={
            <Button variant="outline" asChild>
              <Link href="/admin/users">Mở danh sách nhân viên</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân viên</TableHead>
                <TableHead className="text-right">{doneLabel}</TableHead>
                <TableHead className="text-right">Dòng SKU</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                {showShort ? <TableHead className="text-right">Báo thiếu</TableHead> : null}
                <TableHead className="text-right">TB / đơn</TableHead>
                <TableHead className="text-right">Đang giao</TableHead>
                <TableHead className="text-right">Đang làm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.rows.map((r) => (
                <StaffRow key={r.userId} row={r} showShort={showShort} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function StaffRow({ row, showShort }: { row: ProductivityRow; showShort: boolean }) {
  const idle = row.open.assigned + row.open.inProgress === 0;
  return (
    <TableRow>
      <TableCell>
        <span className="flex flex-col">
          <span>{row.fullName || row.code}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
        </span>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{row.done.orders}</TableCell>
      <TableCell className="text-right tabular-nums">{row.done.lines}</TableCell>
      <TableCell className="text-right tabular-nums">{formatQuantity(row.done.qty)}</TableCell>
      {showShort ? (
        <TableCell
          className={cn(
            'text-right tabular-nums',
            row.done.shortOrders > 0 && 'font-semibold text-warning',
          )}
        >
          {row.done.shortOrders}
        </TableCell>
      ) : null}
      <TableCell className="text-right tabular-nums">
        {formatDuration(row.done.avgSeconds)}
      </TableCell>
      <TableCell
        className={cn('text-right tabular-nums', idle && 'text-muted-foreground')}
        title={idle ? 'Đang rảnh — có thể giao thêm việc' : undefined}
      >
        {idle ? 'rảnh' : row.open.assigned}
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.open.inProgress}</TableCell>
    </TableRow>
  );
}
