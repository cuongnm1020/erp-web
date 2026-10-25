'use client';

import { AlertTriangle, Check } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { QueryState } from '@/components/data/states';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatQuantity, formatWaited } from '@/lib/format';
import { useReceiptWaitingMatch, type WaitingMatch } from '../api/use-waiting-stock';

const items = (list: { skuName: string; qty: string }[]) =>
  list.map((i) => `${i.skuName} × ${formatQuantity(i.qty)}`).join(', ');

/**
 * "Khớp đơn chờ hàng" trên phiếu nhập (2026-10-25, mockup duyệt) — hàng của phiếu đủ cho bao
 * nhiêu đơn chờ hàng ở kho của phiếu: đủ hàng cả đơn trước, rồi đơn còn thiếu SP khác (cảnh báo),
 * hết phần = chưa tới lượt. CHỈ thống kê: giữ hàng vẫn theo luật hàng vào kệ → lập lại PICK.
 */
export function GrnWaitingMatch({ receiptId }: { receiptId: string }) {
  const query = useReceiptWaitingMatch(receiptId);
  return (
    <section className="overflow-hidden rounded-md border bg-card" aria-labelledby="grn-wait-title">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h2 id="grn-wait-title" className="text-sm font-semibold">
          Khớp đơn chờ hàng
        </h2>
        <span className="text-xs text-muted-foreground">
          Chỉ thống kê — giữ hàng vẫn chạy như hiện tại khi cất lên kệ
        </span>
        <Link href="/wms/waiting-stock" className="ml-auto text-sm text-primary hover:underline">
          Xem toàn bộ hàng chờ
        </Link>
      </header>
      <QueryState
        query={query}
        skeleton={<Skeleton className="m-3 h-24" />}
        isEmpty={(d) => d.fullOrders + d.partialOrders + d.laterOrders === 0}
        empty={
          <p className="p-3 text-sm text-muted-foreground">
            Không có đơn chờ hàng nào ở kho này cần sản phẩm của phiếu.
          </p>
        }
      >
        {(data) => <MatchBody data={data} />}
      </QueryState>
    </section>
  );
}

function Tile({
  tone,
  icon,
  label,
  value,
  detail,
}: {
  tone: 'success' | 'warning' | 'neutral';
  icon?: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-md border px-3 py-2.5',
        tone === 'warning' && 'border-warning-line bg-warning-weak text-warning',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-sm font-semibold',
          tone === 'success' && 'text-success',
          tone === 'neutral' && 'text-muted-foreground',
        )}
      >
        {icon}
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums">{value} đơn</span>
      <span className={cn('text-xs', tone !== 'warning' && 'text-muted-foreground')}>{detail}</span>
    </div>
  );
}

function MatchBody({ data }: { data: WaitingMatch }) {
  return (
    <div>
      <div className="grid gap-3 p-3 sm:grid-cols-3">
        <Tile
          tone="success"
          icon={<Check className="h-4 w-4" aria-hidden />}
          label="Đủ hàng cả đơn"
          value={data.fullOrders}
          detail="phiếu này về là đóng được ngay"
        />
        <Tile
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          label="Khớp nhưng còn thiếu SP khác"
          value={data.partialOrders}
          detail="đủ SP của phiếu này, vẫn chờ SP khác"
        />
        <Tile
          tone="neutral"
          label="Chưa tới lượt"
          value={data.laterOrders}
          detail="cần SP của phiếu nhưng hết phần chia"
        />
      </div>
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead>SKU</TableHead>
              <TableHead>Sản phẩm</TableHead>
              <TableHead className="text-right">SL về</TableHead>
              <TableHead className="text-right">Đơn chờ cần (SL)</TableHead>
              <TableHead className="text-right">Chia cho</TableHead>
              <TableHead className="text-right">Đủ cả đơn</TableHead>
              <TableHead className="text-right">Còn thiếu SP khác</TableHead>
              <TableHead className="text-right">Chưa tới lượt</TableHead>
              <TableHead className="text-right">Dư sau chia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lines.map((l) => (
              <TableRow key={l.skuId}>
                <TableCell className="font-mono text-xs">{l.skuCode}</TableCell>
                <TableCell className="max-w-64 truncate" title={l.skuName}>
                  {l.skuName}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatQuantity(l.qty)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.needOrders} đơn · {formatQuantity(l.needQty)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatQuantity(l.given)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-success">
                  {l.full}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-warning">
                  {l.partial}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.later}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQuantity(l.left)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Thứ tự chia: (1) đơn sẽ đủ hàng cả đơn nhờ phiếu này, chờ lâu trước → (2) đơn khớp nhưng còn
        thiếu SP khác, chờ lâu trước. Mỗi dòng thiếu nhận đủ hoặc không, không chia lẻ.
      </p>
      {data.warnings.length > 0 ? (
        <div className="border-t">
          <h3 className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
            {data.partialOrders} đơn khớp nhưng còn thiếu sản phẩm khác
          </h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Khớp từ phiếu này</TableHead>
                  <TableHead>Vẫn thiếu</TableHead>
                  <TableHead className="text-right">Chờ từ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.warnings.map((w) => (
                  <TableRow key={w.orderId}>
                    <TableCell>
                      <Link
                        href={`/crm/orders/${w.orderId}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {w.docNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-48 truncate" title={w.customerName}>
                      {w.customerName}
                    </TableCell>
                    <TableCell className="text-success">{items(w.got)}</TableCell>
                    <TableCell className="font-semibold text-warning">{items(w.missing)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {formatWaited(w.waitingSince)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data.partialOrders > data.warnings.length ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Hiện {data.warnings.length} đơn chờ lâu nhất trên {data.partialOrders} đơn.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
