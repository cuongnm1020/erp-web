'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
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
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import {
  useCancelReturn,
  usePostReturn,
  useReturnReceipt,
  type ReturnReceiptDetail,
} from '../api/use-returns';
import { DISPOSITION_LABEL, RETURN_STATUS } from './return-status';

/**
 * Chi tiết phiếu nhập hàng hoàn — GET /return-receipts/:id. Phiếu NHÁP: post / hủy tại đây.
 * POST: dòng "Nhập lại kho" ghi movement RETURN vào bin + lô đã chọn với giá vốn FIFO đã xuất;
 * dòng "Hủy (hỏng)" không nhập kho. Đã POST là bất biến (bất biến 5).
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function DetailBody({ receipt }: { receipt: ReturnReceiptDetail }) {
  const posted = receipt.status === 'POSTED';
  return (
    <div className="flex flex-col gap-3">
      {posted ? (
        <p className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          <span>
            <b>Đã post{receipt.postedAt ? ` lúc ${formatDateTime(receipt.postedAt)}` : ''}.</b> Hàng
            &quot;Nhập lại kho&quot; đã vào tồn; báo cáo lợi nhuận đã trừ phần hoàn của đơn.
          </span>
        </p>
      ) : (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Phiếu nháp chưa chạm tồn. Post để nhập lại kho các dòng &quot;Nhập lại kho&quot; — giá vốn
          lấy đúng giá FIFO đã xuất cho đơn.
        </p>
      )}

      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-4">
        <Field label="Số phiếu">
          <span className="font-mono">{receipt.docNumber}</span>
        </Field>
        <Field label="Đơn bán">
          <Link
            href={`/crm/orders/${receipt.orderId}`}
            className="font-mono text-primary hover:underline"
          >
            {receipt.orderDocNumber}
          </Link>
        </Field>
        <Field label="Kho nhận">{receipt.warehouseName}</Field>
        <Field label="Ngày">{formatDateTime(receipt.receivedAt)}</Field>
        <Field label="Lý do">{receipt.reason ?? '—'}</Field>
        <Field label="Ghi chú">{receipt.note ?? '—'}</Field>
      </div>

      <section className="overflow-hidden rounded-md border bg-card">
        <header className="border-b px-3 py-2 text-sm font-semibold">
          Dòng hoàn · {receipt.lineCount} dòng · {formatQuantity(receipt.totalQty)} đơn vị cơ bản
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5 text-xs">#</TableHead>
                <TableHead className="px-2.5 text-xs">Sản phẩm</TableHead>
                <TableHead className="px-2.5 text-right text-xs">SL</TableHead>
                <TableHead className="px-2.5 text-xs">Xử lý</TableHead>
                <TableHead className="px-2.5 text-xs">Vị trí</TableHead>
                <TableHead className="px-2.5 text-xs">Lô</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Giá vốn / đv</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Giá vốn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.lines.map((l) => {
                const d = DISPOSITION_LABEL[l.disposition];
                return (
                  <TableRow key={l.id}>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {l.lineNo}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <div className="font-semibold">{l.skuName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{l.skuCode}</div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {formatQuantity(l.qtyBase)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {l.locationCode ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {l.lotNumber ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {l.unitCost ? formatMoney(l.unitCost) : '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                      {l.costAmount ? formatMoney(l.costAmount) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

export function ReturnDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const query = useReturnReceipt(id);
  const post = usePostReturn();
  const cancel = useCancelReturn();
  const canReceive = useAbility().can('receive', 'Stock');
  const receipt = query.data;
  const st = receipt ? RETURN_STATUS[receipt.status] : null;

  return (
    <>
      <PageHeader
        title={receipt?.docNumber ?? 'Phiếu nhập hàng hoàn'}
        description={
          receipt ? `Đơn ${receipt.orderDocNumber} · ${receipt.warehouseName}` : 'Đang tải…'
        }
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Nhập hàng hoàn', href: '/wms/returns' },
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
                      toast.success(`Đã hủy phiếu ${receipt.docNumber}`);
                      router.push('/wms/returns');
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
        <div className="mb-3">
          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
        </div>
      ) : null}
      <QueryState query={query} skeleton={<DetailSkeleton />}>
        {(r) => <DetailBody receipt={r} />}
      </QueryState>
    </>
  );
}
