'use client';

import Decimal from 'decimal.js';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { formatMoney, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { quantitySchema } from '@/lib/shared';
import {
  useCreateReturn,
  usePostReturn,
  useReturnable,
  type CreateReturnBody,
  type ReturnableLine,
  type ReturnableOrder,
} from '../api/use-returns';

/**
 * Lập phiếu nhập hàng hoàn (2026-10-02) — tra đơn theo số đơn (hoặc ?orderId= từ màn đơn), mỗi
 * dòng đơn nhập SL "Nhập lại kho" và SL "Hủy (hỏng)". Tổng ≤ phần còn hoàn được = đã xuất − đã
 * hoàn (server kiểm lại lúc tạo và lúc post). Hoàn một phần: chỉ nhập SL các dòng / số cái trả.
 *
 * Bin / lô nhận lại mặc định là nơi đã lấy hàng cho dòng đó (server chọn); giá vốn nhập lại là giá
 * FIFO đã xuất — màn chỉ hiển thị. Số lượng tính bằng decimal.js (luật 10).
 */
const REASONS = [
  'Khách trả hàng',
  'ĐVVC hoàn (giao không thành)',
  'Sai hàng / thiếu hàng',
  'Hàng lỗi',
];

interface LineInput {
  restock: string;
  scrap: string;
}

const qtyOk = (v: string) => v === '' || quantitySchema.safeParse(v).success;
const dec = (v: string) => (v && quantitySchema.safeParse(v).success ? new Decimal(v) : null);

function lineError(l: ReturnableLine, input: LineInput | undefined): string | null {
  if (!input) return null;
  if (!qtyOk(input.restock) || !qtyOk(input.scrap)) return 'SL không hợp lệ';
  const total = (dec(input.restock) ?? new Decimal(0)).add(dec(input.scrap) ?? 0);
  if (total.gt(l.qtyReturnable)) return `Tối đa ${formatQuantity(l.qtyReturnable)}`;
  return null;
}

function LinesForm({ order }: { order: ReturnableOrder }) {
  const router = useRouter();
  const create = useCreateReturn();
  const post = usePostReturn();
  const [inputs, setInputs] = useState<Record<string, LineInput>>({});
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState('');
  // Idempotency-Key theo phiên form — sinh khi bấm lần đầu, đổi khi form đổi (luật 4).
  const idemKey = useRef<string | null>(null);
  const pending = create.isPending || post.isPending;

  const setLine = (id: string, patch: Partial<LineInput>) => {
    idemKey.current = null;
    setInputs((cur) => ({ ...cur, [id]: { restock: '', scrap: '', ...cur[id], ...patch } }));
  };
  const fillAll = () => {
    idemKey.current = null;
    setInputs(
      Object.fromEntries(
        order.lines
          .filter((l) => new Decimal(l.qtyReturnable).gt(0))
          .map((l) => [
            l.orderLineId,
            { restock: new Decimal(l.qtyReturnable).toString(), scrap: '' },
          ]),
      ),
    );
  };

  const errors = order.lines.map((l) => lineError(l, inputs[l.orderLineId]));
  const body: CreateReturnBody['lines'] = order.lines.flatMap((l) => {
    const i = inputs[l.orderLineId];
    const out: CreateReturnBody['lines'] = [];
    if (i && dec(i.restock)?.gt(0)) out.push({ orderLineId: l.orderLineId, qty: i.restock });
    if (i && dec(i.scrap)?.gt(0)) {
      out.push({ orderLineId: l.orderLineId, qty: i.scrap, disposition: 'SCRAP' });
    }
    return out;
  });
  const canSubmit = body.length > 0 && errors.every((e) => e === null) && !pending;
  const nothingLeft = order.lines.every((l) => new Decimal(l.qtyReturnable).isZero());

  const submit = async (thenPost: boolean) => {
    idemKey.current ??= crypto.randomUUID();
    try {
      const draft = await create.mutateAsync({
        key: idemKey.current,
        body: {
          orderId: order.orderId,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          lines: body,
        },
      });
      if (thenPost) {
        try {
          await post.mutateAsync(draft.receiptId);
          toast.success(`Đã nhập hàng hoàn ${draft.docNumber}`);
        } catch (err) {
          toast.error(messageFor(err));
        }
      } else {
        toast.success(`Đã lưu nháp ${draft.docNumber}`);
      }
      router.push(`/wms/returns/${draft.receiptId}`);
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  if (nothingLeft) {
    return (
      <EmptyState
        title={`Đơn ${order.docNumber} không còn hàng để hoàn`}
        description="Đơn chưa đóng gói (chưa xuất kho) hoặc đã hoàn hết số đã xuất."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Lý do
          <Input
            list="return-reasons"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            aria-label="Lý do hoàn"
          />
          <datalist id="return-reasons">
            {REASONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
          Ghi chú
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Mã vận đơn hoàn, tình trạng hàng…"
            aria-label="Ghi chú"
          />
        </label>
      </div>

      <section className="overflow-hidden rounded-md border bg-card">
        <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
          <span>Dòng đơn {order.docNumber}</span>
          <Button variant="outline" size="sm" onClick={fillAll}>
            Hoàn hết (nhập lại kho)
          </Button>
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5 text-xs">#</TableHead>
                <TableHead className="px-2.5 text-xs">Sản phẩm</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Đã xuất</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Đã hoàn</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Còn hoàn được</TableHead>
                <TableHead className="px-2.5 text-xs">Nhập lại kho</TableHead>
                <TableHead className="px-2.5 text-xs">Hủy (hỏng)</TableHead>
                <TableHead className="px-2.5 text-xs">Vị trí · lô nhận lại</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Giá vốn / đv</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((l, idx) => {
                const input = inputs[l.orderLineId] ?? { restock: '', scrap: '' };
                const err = errors[idx];
                const none = new Decimal(l.qtyReturnable).isZero();
                return (
                  <TableRow key={l.orderLineId} className={none ? 'opacity-60' : undefined}>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {l.lineNo}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <div className="font-semibold">{l.skuName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{l.skuCode}</div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {formatQuantity(l.qtyShipped)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatQuantity(l.qtyReturned)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                      {formatQuantity(l.qtyReturnable)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        disabled={none}
                        value={input.restock}
                        onChange={(e) => setLine(l.orderLineId, { restock: e.target.value.trim() })}
                        aria-label={`Nhập lại kho dòng ${l.lineNo}`}
                        className={cn('h-8 w-24 text-right', err && 'border-destructive')}
                      />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        disabled={none}
                        value={input.scrap}
                        onChange={(e) => setLine(l.orderLineId, { scrap: e.target.value.trim() })}
                        aria-label={`Hủy dòng ${l.lineNo}`}
                        className={cn('h-8 w-24 text-right', err && 'border-destructive')}
                      />
                      {err ? <div className="mt-0.5 text-xs text-destructive">{err}</div> : null}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                      {l.defaultLocationCode ?? '—'}
                      {l.defaultLotNumber ? ` · ${l.defaultLotNumber}` : ''}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {l.unitCost ? formatMoney(l.unitCost) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          Nhập lại kho: hàng vào lại đúng bin + lô đã lấy, giá vốn FIFO đã xuất. Hủy (hỏng): không
          nhập kho, giá vốn tính vào chi phí. Báo cáo lợi nhuận trừ doanh thu của cả hai phần.
        </p>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={!canSubmit} onClick={() => submit(false)}>
          Lưu nháp
        </Button>
        <Button disabled={!canSubmit} onClick={() => submit(true)}>
          {pending ? 'Đang lưu…' : 'Lưu & post'}
        </Button>
      </div>
    </div>
  );
}

export function ReturnCreateScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const canReceive = useAbility().can('receive', 'Stock');
  const orderId = params.get('orderId') ?? undefined;
  const docNumber = params.get('order') ?? undefined;
  const [search, setSearch] = useState(docNumber ?? '');
  const query = useReturnable(orderId ? { orderId } : { docNumber });

  const lookup = () => {
    const v = search.trim();
    if (v) router.replace(`/wms/returns/new?order=${encodeURIComponent(v)}`);
  };

  return (
    <>
      <PageHeader
        title="Nhập hàng hoàn"
        description="Hàng khách trả (một phần hoặc cả đơn) và hàng ĐVVC hoàn về kho"
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Nhập hàng hoàn', href: '/wms/returns' },
          { label: 'Lập phiếu' },
        ]}
      />
      <form
        className="mb-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Số đơn bán
          <Input
            className="h-9 w-64 font-mono"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SO2610-00001"
            aria-label="Số đơn bán"
            autoFocus
          />
        </label>
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Tìm đơn
        </Button>
      </form>

      {!orderId && !docNumber ? (
        <EmptyState
          title="Nhập số đơn để bắt đầu"
          description="Gõ hoặc quét số đơn trên phiếu giao / vận đơn hoàn."
        />
      ) : (
        <QueryState query={query} skeleton={<ListSkeleton rows={4} columns={8} />}>
          {(order) =>
            canReceive ? (
              <LinesForm key={order.orderId} order={order} />
            ) : (
              <EmptyState
                title="Bạn không có quyền nhập kho"
                description="Cần quyền nhập kho để lập phiếu nhập hàng hoàn."
              />
            )
          }
        </QueryState>
      )}
    </>
  );
}
