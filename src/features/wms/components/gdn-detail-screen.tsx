'use client';

import Decimal from 'decimal.js';
import { AlertTriangle, Lock } from 'lucide-react';
import Link from 'next/link';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatQuantity } from '@/lib/format';
import {
  GDN_KIND_LABEL,
  gdnStage,
  useGoodsIssue,
  type GoodsIssueDetail,
} from '../api/use-goods-issues';
import { taskStatusLabel } from '../labels';

/**
 * Chi tiết phiếu xuất kho (design GdnDetail) — GET /goods-issues/:id. CHỈ ĐỌC:
 * mọi chuyển động của phiếu do luồng pick→pack quyết định; POSTED = đóng gói
 * xong (điểm trừ tồn duy nhất, PLAN-gdn-transfer).
 *
 * Khác design (backend chưa mô tả được): không có tiến độ realtime của người
 * đang pick (dòng hiện tại, SLA giao vận), không có "In phiếu pick" / "Gán lại
 * người pick" — hai việc đó nằm ở bảng điều phối; panel "Tồn của phiếu" rút gọn
 * còn ghi chú reserve/trừ tồn (API không trả số reservation).
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function DetailBody({ issue }: { issue: GoodsIssueDetail }) {
  const totalPlanned = issue.lines.reduce((acc, l) => acc.plus(l.qtyPlanned), new Decimal(0));
  const totalDone = issue.lines.reduce((acc, l) => acc.plus(l.qtyDone), new Decimal(0));
  const exceptions = issue.lines.filter((l) => l.exceptionNote !== null);

  return (
    <div className="flex flex-col gap-3">
      {issue.status === 'POSTED' ? (
        <p className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          <span>
            <b>
              Đã post{issue.postedAt ? ` lúc ${formatDateTime(issue.postedAt)}` : ''}
              {issue.postedByName ? ` bởi ${issue.postedByName}` : ''}.
            </b>{' '}
            Tồn đã trừ trong chính transaction đóng gói — chứng từ bất biến.
          </span>
        </p>
      ) : null}

      {exceptions.length > 0 ? (
        <p className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />
          <span>
            {exceptions.length} dòng ngoại lệ (thiếu tồn khi điều phối) — phần thiếu không được
            xuất, xử lý ở bảng điều phối.
          </span>
        </p>
      ) : null}

      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-4">
        <Field label="Số phiếu">
          <span className="font-mono">{issue.docNumber}</span>
        </Field>
        <Field label="Kho xuất">{issue.warehouseName}</Field>
        <Field label="Tham chiếu">
          {issue.refType === 'SalesOrder' && issue.refId ? (
            <Link href={`/crm/orders/${issue.refId}`} className="text-primary hover:underline">
              Đơn bán
            </Link>
          ) : (
            '—'
          )}
        </Field>
        <Field label="Ngày tạo">{formatDateTime(issue.createdAt)}</Field>
        <Field label="Task pick">
          {issue.pickStatus ? taskStatusLabel(issue.pickStatus) : '—'}
        </Field>
        <Field label="Task đóng gói">
          {issue.packStatus ? taskStatusLabel(issue.packStatus) : '—'}
        </Field>
        <Field label="SL kế hoạch">
          <span className="tabular-nums">{formatQuantity(totalPlanned.toString())}</span>
        </Field>
        <Field label="SL đã xuất">
          <b className="tabular-nums">
            {issue.status === 'POSTED' ? formatQuantity(totalDone.toString()) : '—'}
          </b>
        </Field>
      </div>

      <section className="overflow-hidden rounded-md border bg-card">
        <header className="border-b px-3 py-2 text-sm font-semibold">
          Dòng xuất · {issue.lineCount} dòng
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5 text-xs">#</TableHead>
                <TableHead className="px-2.5 text-xs">Sản phẩm</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">Vị trí lấy</TableHead>
                <TableHead className="w-24 px-2.5 text-xs">Lô</TableHead>
                <TableHead className="w-28 px-2.5 text-right text-xs">SL kế hoạch</TableHead>
                <TableHead className="w-28 px-2.5 text-right text-xs">SL đã xuất</TableHead>
                <TableHead className="px-2.5 text-xs">Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issue.lines.map((l) => (
                <TableRow key={l.id} className={l.exceptionNote ? 'bg-warning/5' : undefined}>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.lineNo}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="font-semibold">{l.skuName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{l.skuCode}</div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                    {l.locationCode ?? '—'}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                    {l.lotNumber ?? '—'}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatQuantity(l.qtyPlanned)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums font-semibold">
                    {issue.status === 'POSTED' ? formatQuantity(l.qtyDone) : '—'}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {l.exceptionNote ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

export function GdnDetailScreen({ id }: { id: string }) {
  const query = useGoodsIssue(id);
  const issue = query.data;
  const stage = issue ? gdnStage(issue) : null;
  const kind = issue ? GDN_KIND_LABEL[issue.kind] : null;

  return (
    <>
      <PageHeader
        title={issue?.docNumber ?? 'Phiếu xuất kho'}
        description={
          issue ? `${issue.warehouseName} · tạo ${formatDateTime(issue.createdAt)}` : 'Đang tải…'
        }
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Xuất kho', href: '/wms/gdn' },
          { label: issue?.docNumber ?? '…' },
        ]}
      />
      {stage && kind ? (
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge tone={stage.tone}>{stage.label}</StatusBadge>
          <StatusBadge tone={kind.tone}>{kind.label}</StatusBadge>
        </div>
      ) : null}

      <QueryState query={query} skeleton={<DetailSkeleton />}>
        {(i) => <DetailBody issue={i} />}
      </QueryState>
    </>
  );
}
