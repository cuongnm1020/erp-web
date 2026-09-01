'use client';

import Decimal from 'decimal.js';
import { Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import {
  useApproveCycleCount,
  useCreateCycleCount,
  useCycleCount,
  useCycleCounts,
  useRecordCount,
  useRejectCycleCount,
  useSubmitCycleCount,
  type CycleCountDetail,
  type CycleCountLine,
  type CycleCountStatus,
} from '../api/use-stocktake';
import { useWarehouses } from '../api/use-warehouses';

/**
 * Kiểm kê định kỳ (P2-07, design Stocktake) — /cycle-counts.
 * Luồng: mở phiên (snapshot tồn sổ) → đếm từng dòng (chỉ khi DRAFT) → gửi duyệt
 * → duyệt (ghi COUNT_GAIN/COUNT_LOSS vào sổ cái) hoặc từ chối (về đếm lại).
 * Phiên chọn qua ?cc= trên URL (luật 8).
 *
 * Khác design: không có "Giá trị lệch" bằng tiền (API không trả giá vốn theo
 * dòng — giá thật chỉ chốt lúc duyệt qua FIFO); "đếm mù" là quy ước vận hành
 * trên PDA, web vẫn thấy tồn sổ vì đây là màn của quản lý.
 */
const STATUS_LABEL: Record<CycleCountStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Đang đếm', tone: 'draft' },
  PENDING_APPROVAL: { label: 'Chờ duyệt chênh lệch', tone: 'warn' },
  APPROVED: { label: 'Đã duyệt', tone: 'brand' },
  POSTED: { label: 'Đã ghi sổ', tone: 'ok' },
  CANCELLED: { label: 'Hủy', tone: 'err' },
};

function CreateDialog({ open, onClose }: { open: boolean; onClose: (id?: string) => void }) {
  const warehouses = useWarehouses();
  const create = useCreateCycleCount();
  const [warehouseId, setWarehouseId] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mở phiên kiểm kê</DialogTitle>
          <DialogDescription>
            Tồn sổ được chụp NGAY lúc mở phiên làm cột đối chiếu. Mỗi dòng tồn (SKU × vị trí × lô)
            là một dòng đếm.
          </DialogDescription>
        </DialogHeader>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger aria-label="Kho kiểm kê">
            <SelectValue placeholder="Chọn kho" />
          </SelectTrigger>
          <SelectContent>
            {(warehouses.data ?? [])
              .filter((w) => w.isActive)
              .map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" disabled={create.isPending} onClick={() => onClose()}>
            Hủy bỏ
          </Button>
          <Button
            disabled={!warehouseId || create.isPending}
            onClick={() =>
              create
                .mutateAsync({ warehouseId })
                .then((r) => {
                  toast.success(`Đã mở phiên ${r.docNumber} · ${r.lineCount} dòng`);
                  onClose(r.countId);
                })
                .catch((err) => toast.error(messageFor(err)))
            }
          >
            {create.isPending ? 'Đang mở…' : 'Mở phiên kiểm kê'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Một dòng đếm — input số đếm + lý do, lưu từng dòng (khớp nhịp PDA quét từng ô). */
function CountLineRow({
  line,
  countId,
  editable,
}: {
  line: CycleCountLine;
  countId: string;
  editable: boolean;
}) {
  const record = useRecordCount(countId);
  const [qty, setQty] = useState(line.qtyCounted ?? '');
  const [note, setNote] = useState(line.note ?? '');
  const dirty = qty !== (line.qtyCounted ?? '') || note !== (line.note ?? '');
  const variance = line.variance === null ? null : new Decimal(line.variance);

  return (
    <TableRow className={variance && !variance.isZero() ? 'bg-warning/5' : undefined}>
      <TableCell className="px-2.5 py-1.5">
        <div className="font-mono text-xs font-semibold">{line.skuCode}</div>
        <div className="text-xs text-muted-foreground">{line.skuName}</div>
      </TableCell>
      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{line.locationCode}</TableCell>
      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{line.lotNumber ?? '—'}</TableCell>
      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
        {formatQuantity(line.qtySystem)}
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-right">
        {editable ? (
          <Input
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label={`Đếm thực ${line.skuCode} tại ${line.locationCode}`}
            className="h-8 w-24 text-right tabular-nums"
          />
        ) : (
          <span className="tabular-nums font-semibold">
            {line.qtyCounted === null ? '—' : formatQuantity(line.qtyCounted)}
          </span>
        )}
      </TableCell>
      <TableCell
        className={cn(
          'px-2.5 py-1.5 text-right tabular-nums font-semibold',
          variance && variance.isNegative() && 'text-destructive',
          variance && variance.isPositive() && !variance.isZero() && 'text-success',
        )}
      >
        {variance === null ? '—' : variance.isZero() ? '0' : formatQuantity(line.variance!)}
      </TableCell>
      <TableCell className="px-2.5 py-1.5">
        {editable ? (
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lý do lệch (bắt buộc khi lệch)"
            aria-label={`Lý do ${line.skuCode} tại ${line.locationCode}`}
            className="h-8 w-56"
          />
        ) : (
          <span className="text-muted-foreground">{line.note ?? '—'}</span>
        )}
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
        {line.countedByName ?? '—'}
      </TableCell>
      <TableCell className="px-2.5 py-1.5">
        {editable ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty || qty === '' || record.isPending}
            onClick={() =>
              record
                .mutateAsync({ lineId: line.id, qtyCounted: qty, ...(note ? { note } : {}) })
                .then(() => toast.success(`Đã ghi số đếm ${line.skuCode}`))
                .catch((err) => toast.error(messageFor(err)))
            }
          >
            {record.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function DetailPanel({ countId }: { countId: string }) {
  const query = useCycleCount(countId);
  const submit = useSubmitCycleCount();
  const approve = useApproveCycleCount();
  const reject = useRejectCycleCount();
  const ability = useAbility();
  const canCount = ability.can('count', 'Stock');
  const canAdjust = ability.can('adjust', 'Stock');
  const [onlyVariance, setOnlyVariance] = useState(false);

  const act =
    (fn: (id: string) => Promise<unknown>, doneMsg: string): (() => void) =>
    () => {
      fn(countId)
        .then(() => toast.success(doneMsg))
        .catch((err) => toast.error(messageFor(err)));
    };

  return (
    <QueryState query={query} skeleton={<ListSkeleton rows={6} columns={7} />}>
      {(count: CycleCountDetail) => {
        const editable = canCount && count.status === 'DRAFT';
        const lines = onlyVariance
          ? count.lines.filter((l) => l.variance !== null && !new Decimal(l.variance).isZero())
          : count.lines;
        return (
          <section className="mt-3 overflow-hidden rounded-md border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <h2 className="text-sm font-semibold">{count.docNumber}</h2>
              <StatusBadge tone={STATUS_LABEL[count.status].tone}>
                {STATUS_LABEL[count.status].label}
              </StatusBadge>
              <span className="text-xs text-muted-foreground">
                {count.warehouseName} · đã đếm {count.countedLineCount}/{count.lineCount} dòng ·{' '}
                {count.varianceLineCount} dòng lệch
                {count.countedAt ? ` · đếm xong ${formatDateTime(count.countedAt)}` : ''}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {canCount && count.status === 'DRAFT' ? (
                  <Button
                    size="sm"
                    disabled={submit.isPending || count.countedLineCount < count.lineCount}
                    title={
                      count.countedLineCount < count.lineCount
                        ? 'Đếm đủ mọi dòng mới gửi duyệt được'
                        : undefined
                    }
                    onClick={act((id) => submit.mutateAsync(id), 'Đã gửi duyệt chênh lệch')}
                  >
                    {submit.isPending ? 'Đang gửi…' : 'Gửi duyệt chênh lệch'}
                  </Button>
                ) : null}
                {canAdjust && count.status === 'PENDING_APPROVAL' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reject.isPending || approve.isPending}
                      onClick={act(
                        (id) => reject.mutateAsync(id),
                        'Đã trả phiên về đếm lại — tồn sổ giữ nguyên',
                      )}
                    >
                      Từ chối
                    </Button>
                    <Button
                      size="sm"
                      disabled={approve.isPending || reject.isPending}
                      onClick={act(
                        (id) => approve.mutateAsync(id),
                        'Đã duyệt — chênh lệch ghi vào sổ cái',
                      )}
                    >
                      {approve.isPending ? 'Đang duyệt…' : 'Duyệt chênh lệch'}
                    </Button>
                  </>
                ) : null}
              </div>
            </header>

            <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
              <Checkbox
                id="only-variance"
                checked={onlyVariance}
                onCheckedChange={(v) => setOnlyVariance(v === true)}
              />
              <label htmlFor="only-variance">Chỉ dòng chênh lệch ({count.varianceLineCount})</label>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="px-2.5 text-xs">SKU</TableHead>
                    <TableHead className="w-28 px-2.5 text-xs">Vị trí</TableHead>
                    <TableHead className="w-24 px-2.5 text-xs">Lô</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Tồn sổ</TableHead>
                    <TableHead className="w-28 px-2.5 text-right text-xs">Đếm thực</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Chênh lệch</TableHead>
                    <TableHead className="px-2.5 text-xs">Lý do</TableHead>
                    <TableHead className="w-32 px-2.5 text-xs">Người đếm</TableHead>
                    <TableHead className="w-24 px-2.5 text-xs">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <CountLineRow key={l.id} line={l} countId={countId} editable={editable} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      }}
    </QueryState>
  );
}

export function StocktakeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selectedId = search.get('cc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const ability = useAbility();
  const canCount = ability.can('count', 'Stock');
  const query = useCycleCounts({ take: 50, skip: 0 });

  const select = (id?: string) => {
    const params = new URLSearchParams(search);
    if (id) params.set('cc', id);
    else params.delete('cc');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Kiểm kê"
        description="Đếm mù trên PDA · duyệt chênh lệch ở đây — duyệt xong sổ cái mới đổi"
        breadcrumb={[{ label: 'Kho' }, { label: 'Kiểm kê' }]}
        actions={
          canCount ? (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus aria-hidden />
              Mở phiên kiểm kê
            </Button>
          ) : undefined
        }
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={5} columns={7} />}
        isEmpty={(d) => d.total === 0}
        empty={
          <EmptyState
            title="Chưa có phiên kiểm kê nào"
            description="Mở phiên để chụp tồn sổ và bắt đầu đếm."
            action={
              canCount ? (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus aria-hidden />
                  Mở phiên kiểm kê
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-40 px-2.5 text-xs">Số phiên</TableHead>
                    <TableHead className="px-2.5 text-xs">Kho</TableHead>
                    <TableHead className="w-44 px-2.5 text-xs">Trạng thái</TableHead>
                    <TableHead className="w-28 px-2.5 text-right text-xs">Đã đếm</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Dòng lệch</TableHead>
                    <TableHead className="w-36 px-2.5 text-xs">Người mở</TableHead>
                    <TableHead className="w-40 px-2.5 text-xs">Ngày mở</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      data-state={r.id === selectedId ? 'selected' : undefined}
                      onClick={() => select(r.id === selectedId ? undefined : r.id)}
                    >
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs font-semibold text-primary">
                        {r.docNumber}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">{r.warehouseName}</TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <StatusBadge tone={STATUS_LABEL[r.status].tone}>
                          {STATUS_LABEL[r.status].label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {r.countedLineCount}/{r.lineCount}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {r.varianceLineCount}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                        {r.createdByName ?? '—'}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </QueryState>

      {selectedId ? <DetailPanel countId={selectedId} /> : null}

      {dialogOpen ? (
        <CreateDialog
          open={dialogOpen}
          onClose={(id) => {
            setDialogOpen(false);
            if (id) select(id);
          }}
        />
      ) : null}
    </>
  );
}
