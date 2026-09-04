'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { formatDate, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { dateKeySchema } from '@/lib/shared';
import { toSkipTake, useListState } from '@/lib/url-state';
import { useLotCount, useLots, useUpdateLot, type LotRow } from '../api/use-lots';
import { useWarehouses } from '../api/use-products';

/**
 * F4 (PLAN-master-data-lot-uom) — màn Lô & hạn dùng nối API thật:
 * GET /lots (FEFO view — hạn gần lên đầu, kèm tồn gộp theo lô), KPI đếm từ
 * cùng endpoint, sửa HSD/NSX qua PATCH /lots/:id (stock.adjust, có audit).
 * Trạng thái lọc/trang trên URL (luật 8).
 *
 * Khác design canvas (chờ backend): "Xuất sai FEFO", "Xuất CSV", "Tạo phiếu
 * điều chỉnh" và cột Kho theo từng lô (tồn đang gộp mọi kho trừ khi lọc) —
 * ghi PENDING_API.
 */
const PENDING_API: Array<{ title: string; need: string }> = [
  { title: 'Xuất sai FEFO (7 ngày)', need: 'chưa có API đối chiếu movement với thứ tự FEFO' },
  { title: 'Xuất CSV / phiếu điều chỉnh từ lô chọn', need: 'chưa có endpoint' },
  { title: 'Giá vốn tồn theo lô', need: 'CostLayer chưa gắn lotId (quyết định Q3 — giữ FIFO)' },
];

const DEFAULTS = { size: 40, filterKeys: ['warehouseId', 'state'] as const };
type LotFilter = (typeof DEFAULTS.filterKeys)[number];

type LotState = 'expired' | 'near' | 'ok' | 'empty' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

function stateOf(row: LotRow): { state: LotState; daysLeft: number | null } {
  const onHand = Number(row.onHand);
  if (!row.expiryDate) return { state: onHand > 0 ? 'none' : 'empty', daysLeft: null };
  const daysLeft = Math.ceil((new Date(row.expiryDate).getTime() - Date.now()) / DAY_MS);
  if (onHand <= 0) return { state: 'empty', daysLeft };
  if (daysLeft < 0) return { state: 'expired', daysLeft };
  if (daysLeft <= 30) return { state: 'near', daysLeft };
  return { state: 'ok', daysLeft };
}

const STATE_BADGE: Record<LotState, { tone: 'err' | 'warn' | 'ok' | 'neutral'; label: string }> = {
  expired: { tone: 'err', label: 'Hết hạn' },
  near: { tone: 'warn', label: 'Sắp hết hạn' },
  ok: { tone: 'ok', label: 'Còn hạn' },
  empty: { tone: 'neutral', label: 'Đã xuất hết' },
  none: { tone: 'neutral', label: 'Không HSD' },
};

const ROW_BG: Record<LotState, string | undefined> = {
  expired: 'bg-destructive/10 hover:bg-destructive/10',
  near: 'bg-warning/10 hover:bg-warning/10',
  ok: undefined,
  empty: undefined,
  none: undefined,
};

const lotEditSchema = z.object({
  expiryDate: z.union([dateKeySchema, z.literal('')]),
  mfgDate: z.union([dateKeySchema, z.literal('')]),
});
type LotEditValues = z.infer<typeof lotEditSchema>;

function LotEditDialog({
  lot,
  open,
  onOpenChange,
}: {
  lot: LotRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateLot();
  const form = useForm<LotEditValues>({
    resolver: zodResolver(lotEditSchema),
    defaultValues: {
      expiryDate: lot.expiryDate ? lot.expiryDate.slice(0, 10) : '',
      mfgDate: lot.mfgDate ? lot.mfgDate.slice(0, 10) : '',
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    update.mutate(
      {
        id: lot.id,
        body: { expiryDate: v.expiryDate || null, mfgDate: v.mfgDate || null },
      },
      {
        onSuccess: () => {
          toast.success(`Đã lưu thay đổi cho lô ${lot.lotNumber}`);
          onOpenChange(false);
        },
        onError: (err) =>
          applyServerErrors(form, err as ApiError, { knownFields: ['expiryDate', 'mfgDate'] }),
      },
    );
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !update.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Sửa lô {lot.lotNumber} · {lot.skuCode}
          </DialogTitle>
          <DialogDescription>
            Đổi hạn dùng đổi luôn thứ tự FEFO khi xuất — thao tác được ghi audit.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="mfgDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày sản xuất</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hạn dùng</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={update.isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function KpiTile({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: 'err' | 'warn';
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-md border bg-card px-3 py-2.5',
        accent === 'err' && 'border-l-4 border-l-destructive',
        accent === 'warn' && 'border-l-4 border-l-warning',
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-xl font-semibold tabular-nums',
          accent === 'err' && 'text-destructive',
          accent === 'warn' && 'text-warning',
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-card text-foreground',
      )}
    >
      {children}
    </button>
  );
}

const NUM_CELL = 'px-2.5 py-1.5 text-right tabular-nums';
const ALL = '__all__';

export function LotsScreen() {
  const { state, set } = useListState<LotFilter>(DEFAULTS);
  const ability = useAbility();
  const canAdjust = ability.can('adjust', 'Stock');
  const warehouses = useWarehouses();
  const [editing, setEditing] = useState<LotRow | null>(null);

  // Chip trạng thái: 'expired' | 'soon' | 'stock' — một chiều, nằm trên URL
  const chip = state.filters.state ?? '';
  const params = useMemo(
    () => ({
      ...toSkipTake(state),
      ...(state.q ? { q: state.q } : {}),
      ...(state.filters.warehouseId ? { warehouseId: state.filters.warehouseId } : {}),
      ...(chip === 'expired' ? { expiringInDays: 0, hasStock: true } : {}),
      ...(chip === 'soon' ? { expiringInDays: 30 } : {}),
      ...(chip === 'stock' ? { hasStock: true } : {}),
    }),
    [state, chip],
  );
  const query = useLots(params);

  // KPI — 3 lần đếm rẻ trên cùng endpoint (chỉ đọc total)
  const expired = useLotCount({ expiringInDays: 0, hasStock: true });
  const in30 = useLotCount({ expiringInDays: 30, hasStock: true });
  const in90 = useLotCount({ expiringInDays: 90, hasStock: true });
  const between = in90.data !== undefined && in30.data !== undefined ? in90.data - in30.data : null;

  const toggleChip = (key: string) =>
    set({ filters: { ...state.filters, state: chip === key ? undefined : key } });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / state.size)) : 1;

  return (
    <>
      <PageHeader
        title="Lô & hạn dùng"
        description={
          query.data ? `${query.data.total} lô theo bộ lọc hiện tại · xuất theo FEFO` : 'Đang tải…'
        }
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Lô & hạn dùng' }]}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Đã hết hạn, còn tồn"
          value={expired.data !== undefined ? `${expired.data} lô` : '…'}
          note="cần phiếu hủy / điều chỉnh"
          accent="err"
        />
        <KpiTile
          label="Hết hạn trong 30 ngày"
          value={in30.data !== undefined ? `${in30.data} lô` : '…'}
          note="gồm cả lô đã hết hạn"
          accent="warn"
        />
        <KpiTile
          label="Hết hạn 31–90 ngày"
          value={between !== null ? `${between} lô` : '…'}
          note="ưu tiên bán trước theo FEFO"
        />
        <KpiTile label="Xuất sai FEFO (7 ngày)" value="—" note="chờ API đối chiếu (PENDING)" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-64 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm">
          <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            value={state.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Tìm theo số lô…"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Select
          value={state.filters.warehouseId || ALL}
          onValueChange={(v) =>
            set({ filters: { ...state.filters, warehouseId: v === ALL ? undefined : v } })
          }
        >
          <SelectTrigger className="h-7 w-40" aria-label="Kho">
            <SelectValue placeholder="Kho: Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Kho: Tất cả</SelectItem>
            {(warehouses.data ?? []).map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterChip active={chip === 'soon'} onClick={() => toggleChip('soon')}>
          Hết hạn trong 30 ngày
        </FilterChip>
        <FilterChip active={chip === 'expired'} onClick={() => toggleChip('expired')}>
          Đã hết hạn
        </FilterChip>
        <FilterChip active={chip === 'stock'} onClick={() => toggleChip('stock')}>
          Còn tồn &gt; 0
        </FilterChip>
        <span className="ml-auto text-xs text-muted-foreground">Sắp xếp: HSD gần nhất ↑</span>
      </div>

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={9} />}
        isEmpty={(d) => d.total === 0}
        empty={
          <EmptyState
            title="Chưa có lô nào theo bộ lọc"
            description="Lô sinh ra khi nhập kho SKU theo dõi lô (khai số lô + HSD trên phiếu nhập)."
          />
        }
      >
        {(data) => (
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-32 px-2.5 text-xs">Lô</TableHead>
                    <TableHead className="w-32 px-2.5 text-xs">SKU</TableHead>
                    <TableHead className="px-2.5 text-xs">Tên sản phẩm</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Tồn thực</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Khả dụng</TableHead>
                    <TableHead className="w-24 px-2.5 text-xs">NSX</TableHead>
                    <TableHead className="w-28 px-2.5 text-xs">HSD ↑</TableHead>
                    <TableHead className="w-28 px-2.5 text-right text-xs">Còn lại</TableHead>
                    <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
                    <TableHead className="w-16 px-2.5 text-xs">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((r) => {
                    const { state: st, daysLeft } = stateOf(r);
                    return (
                      <TableRow key={r.id} className={ROW_BG[st]}>
                        <TableCell className="px-2.5 py-1.5 font-mono text-xs font-semibold">
                          {r.lotNumber}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                          {r.skuCode}
                        </TableCell>
                        <TableCell className="max-w-64 truncate px-2.5 py-1.5" title={r.skuName}>
                          {r.skuName}
                        </TableCell>
                        <TableCell className={NUM_CELL}>{formatQuantity(r.onHand)}</TableCell>
                        <TableCell className={NUM_CELL}>{formatQuantity(r.available)}</TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {r.mfgDate ? formatDate(r.mfgDate) : '—'}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {r.expiryDate ? formatDate(r.expiryDate) : '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            NUM_CELL,
                            st === 'expired' && 'font-semibold text-destructive',
                            st === 'near' && 'font-semibold text-warning',
                          )}
                        >
                          {daysLeft === null
                            ? '—'
                            : daysLeft < 0
                              ? `quá ${-daysLeft} ngày`
                              : `${daysLeft} ngày`}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          <StatusBadge tone={STATE_BADGE[st].tone}>
                            {STATE_BADGE[st].label}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {canAdjust ? (
                            <RowActions onEdit={() => setEditing(r)} editLabel="Sửa HSD/NSX" />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
              <span>
                Hiển thị {data.items.length === 0 ? 0 : (state.page - 1) * state.size + 1}–
                {(state.page - 1) * state.size + data.items.length} / {data.total}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2"
                  disabled={state.page <= 1}
                  onClick={() => set({ page: state.page - 1 })}
                >
                  ‹ Trước
                </Button>
                <span className="px-1 tabular-nums">
                  {state.page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2"
                  disabled={state.page >= totalPages}
                  onClick={() => set({ page: state.page + 1 })}
                >
                  Sau ›
                </Button>
              </div>
            </div>
          </div>
        )}
      </QueryState>

      <section className="mt-3 rounded-md border bg-card">
        <header className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-semibold">
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          Bổ sung khi API sẵn sàng
        </header>
        <ul className="flex flex-col gap-1.5 px-3 py-2 text-sm">
          {PENDING_API.map((m) => (
            <li key={m.title}>
              <span className="font-medium">{m.title}</span>{' '}
              <span className="text-xs text-muted-foreground">— {m.need}</span>
            </li>
          ))}
        </ul>
      </section>

      {editing ? (
        <LotEditDialog
          key={editing.id}
          lot={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}
    </>
  );
}
