'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import {
  useCancelReceipt,
  usePostReceipt,
  useReceipt,
  useReceiptMovements,
  type ReceiptDetail,
  type ReceiptStatus,
} from '../api/use-receipts';

/**
 * Chi tiết phiếu nhập (design GrnDetailPosted) — GET /goods-receipts/:id.
 * Phiếu NHÁP: post / hủy tại đây. Phiếu ĐÃ POST là bất biến (bất biến 5) — mọi
 * trường chỉ đọc + bảng "Chuyển động tồn đã ghi" từ GET :id/movements.
 *
 * Khác design: chưa có "Tạo phiếu điều chỉnh" (chưa có chứng từ điều chỉnh) và
 * "In phiếu"; hủy phiếu đã post bị 409 đúng nghĩa — không có đường xóa ledger.
 */
const STATUS_LABEL: Record<ReceiptStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Nháp', tone: 'draft' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'warn' },
  APPROVED: { label: 'Đã duyệt', tone: 'brand' },
  POSTED: { label: 'Đã post', tone: 'ok' },
  CANCELLED: { label: 'Hủy', tone: 'err' },
};

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: '+ Nhập',
  PUT_AWAY: 'Cất hàng',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Movements({ id }: { id: string }) {
  const query = useReceiptMovements(id, true);
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <header className="border-b px-3 py-2 text-sm font-semibold">
        Chuyển động tồn đã ghi (sổ cái · chỉ đọc · append-only)
      </header>
      <QueryState
        query={query}
        skeleton={<div className="p-3 text-sm text-muted-foreground">Đang tải sổ cái…</div>}
        isEmpty={(d) => d.length === 0}
        empty={<p className="p-3 text-sm text-muted-foreground">Chưa có movement nào.</p>}
      >
        {(rows) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-2.5 text-xs">Thời gian</TableHead>
                  <TableHead className="px-2.5 text-xs">Loại</TableHead>
                  <TableHead className="px-2.5 text-xs">SKU</TableHead>
                  <TableHead className="px-2.5 text-xs">Lô</TableHead>
                  <TableHead className="px-2.5 text-xs">Vị trí</TableHead>
                  <TableHead className="px-2.5 text-right text-xs">+/− SL</TableHead>
                  <TableHead className="px-2.5 text-xs">Người thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {formatDateTime(m.createdAt, { seconds: true })}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={m.qtyDelta.startsWith('-') ? 'warn' : 'ok'}>
                        {MOVEMENT_LABEL[m.movementType] ?? m.movementType}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{m.skuCode}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {m.lotNumber ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {m.locationCode}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {m.qtyDelta.startsWith('-') ? '' : '+'}
                      {formatQuantity(m.qtyDelta)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {m.actorName ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
    </section>
  );
}

function DetailBody({ receipt }: { receipt: ReceiptDetail }) {
  return (
    <div className="flex flex-col gap-3">
      {receipt.status === 'POSTED' ? (
        <p className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          <span>
            <b>
              Đã post{receipt.postedAt ? ` lúc ${formatDateTime(receipt.postedAt)}` : ''}
              {receipt.postedByName ? ` bởi ${receipt.postedByName}` : ''}.
            </b>{' '}
            Chứng từ bất biến — mọi trường chỉ đọc. Sai sót → tạo phiếu điều chỉnh (chưa có trên
            web).
          </span>
        </p>
      ) : null}

      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-4">
        <Field label="Số phiếu">
          <span className="font-mono">{receipt.docNumber}</span>
        </Field>
        <Field label="Kho nhận">{receipt.warehouseName}</Field>
        <Field label="Nhà cung cấp">{receipt.supplierName ?? '— (nhập tự do)'}</Field>
        <Field label="Tham chiếu PO">
          {receipt.poNumber ? <span className="font-mono">{receipt.poNumber}</span> : '—'}
        </Field>
        <Field label="Ngày nhập">{formatDate(receipt.receivedAt)}</Field>
        <Field label="Người tạo">{receipt.createdByName ?? '—'}</Field>
        <Field label="Tổng giá trị">
          <b className="tabular-nums">{formatMoney(receipt.totalValue)}</b>
        </Field>
        <Field label="Ghi chú">{receipt.note ?? '—'}</Field>
      </div>

      <section className="overflow-hidden rounded-md border bg-card">
        <header className="border-b px-3 py-2 text-sm font-semibold">
          Dòng nhập · {receipt.lineCount} dòng · {formatQuantity(receipt.totalQty)} đơn vị cơ bản
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5 text-xs">#</TableHead>
                <TableHead className="px-2.5 text-xs">Sản phẩm</TableHead>
                <TableHead className="px-2.5 text-xs">ĐVT</TableHead>
                <TableHead className="px-2.5 text-right text-xs">SL</TableHead>
                <TableHead className="px-2.5 text-xs">Lô</TableHead>
                <TableHead className="px-2.5 text-xs">HSD</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Đơn giá</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.lineNo}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="font-semibold">{l.skuName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{l.skuCode}</div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {l.baseUomCode}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatQuantity(l.qtyBase)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                    {l.lotNumber ?? '—'}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {l.expiryDate ? formatDate(l.expiryDate) : '—'}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {l.unitCost ? formatMoney(l.unitCost) : '—'}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums font-semibold">
                    {l.lineValue ? formatMoney(l.lineValue) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {receipt.status === 'POSTED' ? <Movements id={receipt.id} /> : null}
    </div>
  );
}

export function GrnDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const query = useReceipt(id);
  const post = usePostReceipt();
  const cancel = useCancelReceipt();
  const ability = useAbility();
  const canReceive = ability.can('receive', 'Stock');
  const receipt = query.data;
  const st = receipt ? STATUS_LABEL[receipt.status] : null;

  return (
    <>
      <PageHeader
        title={receipt?.docNumber ?? 'Phiếu nhập kho'}
        description={
          receipt
            ? `Tạo bởi ${receipt.createdByName ?? '—'} · ${formatDateTime(receipt.receivedAt)} · ${receipt.warehouseName}`
            : 'Đang tải…'
        }
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Nhập kho', href: '/wms/grn' },
          { label: receipt?.docNumber ?? '…' },
        ]}
        actions={
          receipt && canReceive && receipt.status === 'DRAFT' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={cancel.isPending || post.isPending}
                onClick={() =>
                  cancel
                    .mutateAsync(receipt.id)
                    .then(() => {
                      toast.success(`Đã hủy phiếu nhập ${receipt.docNumber}`);
                      router.push('/wms/grn');
                    })
                    .catch((err) => toast.error(messageFor(err)))
                }
              >
                Hủy phiếu
              </Button>
              <Button
                size="sm"
                disabled={post.isPending || cancel.isPending}
                onClick={() =>
                  post
                    .mutateAsync(receipt.id)
                    .then(() => toast.success(`Đã post phiếu ${receipt.docNumber}`))
                    .catch((err) => toast.error(messageFor(err)))
                }
              >
                {post.isPending ? 'Đang post…' : 'Post phiếu'}
              </Button>
            </>
          ) : undefined
        }
      />
      {st ? (
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          <StatusBadge tone="neutral">{receipt?.poNumber ? 'Từ PO' : 'Nhập khác'}</StatusBadge>
        </div>
      ) : null}

      <QueryState query={query} skeleton={<DetailSkeleton />}>
        {(r) => <DetailBody receipt={r} />}
      </QueryState>
    </>
  );
}
