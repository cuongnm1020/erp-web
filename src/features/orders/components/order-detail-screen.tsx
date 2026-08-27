'use client';

import { Gift, Info } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { DetailSkeleton, EmptyState, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { useInvalidateOn } from '@/lib/realtime';
import { orderKeys, useOrder, type SalesOrderDetail } from '../api/use-orders';
import { orderChannelLabel, orderStatusLabel, orderStatusTone } from '../labels';

/**
 * D-04 Chi tiết đơn hàng — GET /sales-orders/{id}.
 *
 * Ba con số của một dòng hàng được giữ TÁCH BIỆT đúng như bất biến 3: đặt (`qtyBase`) ≠
 * đang giữ (`reservedQty`) ≠ đã pick (`pickedQty`). Không cộng gộp, không suy diễn.
 *
 * Phần bỏ so với bản UI-first vì `SalesOrderDetailDto` không có trường tương ứng:
 * - "Đã xuất": DTO chỉ có `reservedQty` và `pickedQty`, không có số đã xuất kho.
 * - "CK%": dòng hàng trả `discount` là SỐ TIỀN, không phải tỉ lệ — hiện tiền, không quy ra %.
 * - "Tạo bởi" / "Sale": chỉ có `ownerId` (UUID), chưa có endpoint danh bạ user.
 * - "Kho xuất": đơn không mang thông tin kho.
 * - Liên hệ, địa chỉ giao, ghi chú giao: `SalesOrderCustomerDto` chỉ có id/code/name.
 * - Thẻ "Vận chuyển", "Thanh toán", "Lịch sử": chưa có endpoint/DTO cho vận đơn, thu tiền,
 *   dòng thời gian chứng từ. Luật 2 cấm tự khai shape ở frontend nên màn nói thẳng là
 *   chưa nối được, thay vì hiện số bịa cạnh một đơn thật.
 * - Nút "In" / "Hủy đơn" / "Tạo phiếu xuất": lượt này chỉ nối mặt ĐỌC, chưa nối mutation.
 */
const MISSING: Array<{ title: string; need: string }> = [
  { title: 'Vận chuyển', need: 'chưa có DTO vận đơn gắn với đơn bán' },
  { title: 'Thanh toán / còn phải thu', need: 'chưa có mặt đọc công nợ theo đơn' },
  { title: 'Dòng thời gian chứng từ', need: 'chưa có endpoint lịch sử trạng thái đơn' },
  { title: 'Người tạo, người phụ trách', need: 'chỉ có ownerId; chưa có danh bạ user' },
  { title: 'Địa chỉ giao, ghi chú giao', need: 'DTO khách trong đơn chỉ có mã và tên' },
];

function Card({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={className ? `rounded-md border bg-card ${className}` : 'rounded-md border bg-card'}
    >
      <header className="border-b px-3 py-2 text-sm font-semibold">{title}</header>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const money = (v: string) => formatMoney(v, { unit: '' });
const qty = (v: string) => formatQuantity(v);

function Lines({ order }: { order: SalesOrderDetail }) {
  return (
    <Card
      title={
        <span className="flex items-center justify-between gap-2">
          <span>
            Dòng hàng <span className="font-normal text-muted-foreground">· {order.lineCount}</span>
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            Đã đặt ≠ đang giữ ≠ đã pick — ba bước tách biệt
          </span>
        </span>
      }
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="h-8 w-8 px-2.5 text-xs">#</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">Sản phẩm</TableHead>
              <TableHead className="h-8 w-16 px-2.5 text-xs">ĐVT</TableHead>
              <TableHead className="h-8 w-20 px-2.5 text-right text-xs">SL đặt</TableHead>
              <TableHead className="h-8 w-24 px-2.5 text-right text-xs">Giá niêm yết</TableHead>
              <TableHead className="h-8 w-24 px-2.5 text-right text-xs">Đơn giá bán</TableHead>
              <TableHead className="h-8 w-24 px-2.5 text-right text-xs">Chiết khấu</TableHead>
              <TableHead className="h-8 w-28 px-2.5 text-right text-xs">Thành tiền</TableHead>
              <TableHead className="h-8 w-24 px-2.5 text-right text-xs">Đang giữ</TableHead>
              <TableHead className="h-8 w-24 px-2.5 text-right text-xs">Đã pick</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.lineNo}</TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {l.skuName}
                    {l.isGift ? (
                      <StatusBadge tone="brand">
                        <Gift className="h-3 w-3" aria-hidden />
                        Hàng tặng
                      </StatusBadge>
                    ) : null}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{l.skuCode}</div>
                </TableCell>
                <TableCell className="px-2.5 py-1.5">{l.uomCode}</TableCell>
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                  {qty(l.qty)}
                  <div className="text-xs text-muted-foreground">{qty(l.qtyBase)} ĐVT cơ sở</div>
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                  {money(l.listPrice)}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                  {money(l.unitPrice)}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                  {money(l.discount)}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                  {money(l.lineTotal)}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-primary">
                  {qty(l.reservedQty)}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                  {qty(l.pickedQty)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap gap-6 border-t px-3 py-2 text-sm text-muted-foreground">
        <span>
          Tạm tính{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {money(order.subtotal)}
          </span>
        </span>
        <span>
          Chiết khấu{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {money(order.discount)}
          </span>
        </span>
        <span>
          Thuế{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {money(order.taxAmount)}
          </span>
        </span>
        <span>
          Vận chuyển{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {money(order.shippingFee)}
          </span>
        </span>
        <span className="ml-auto">
          Tổng cộng{' '}
          <span className="text-base font-semibold tabular-nums text-foreground">
            {money(order.total)}
          </span>{' '}
          {order.currencyCode}
        </span>
      </div>
    </Card>
  );
}

function Detail({ order }: { order: SalesOrderDetail }) {
  return (
    <>
      <div className="flex min-h-9 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold leading-tight">
            Đơn <span className="font-mono">{order.docNumber}</span>
            <StatusBadge tone={orderStatusTone(order.status)}>
              {orderStatusLabel(order.status)}
            </StatusBadge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Đặt ngày {formatDate(order.orderDate)} · Kênh {orderChannelLabel(order.channel)} ·{' '}
            {order.lineCount} dòng hàng
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/crm/orders">Về danh sách đơn</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tạm tính" value={money(order.subtotal)} detail="trước thuế và vận chuyển" />
        <KpiCard label="Chiết khấu" value={money(order.discount)} detail="giảm trừ khuyến mãi" />
        <KpiCard label="Thuế" value={money(order.taxAmount)} detail="theo dòng hàng" />
        <KpiCard label="Tổng cộng" value={money(order.total)} detail={order.currencyCode} />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Thông tin đơn">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 py-3 sm:grid-cols-3">
            <Field label="Khách hàng">
              <Link
                href={`/crm/customers/${order.customer.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {order.customer.name}
              </Link>
            </Field>
            <Field label="Mã khách hàng">
              <span className="font-mono text-xs">{order.customer.code}</span>
            </Field>
            <Field label="Số chứng từ">
              <span className="font-mono text-xs">{order.docNumber}</span>
            </Field>
            <Field label="Kênh bán">{orderChannelLabel(order.channel)}</Field>
            <Field label="Ngày đặt">{formatDate(order.orderDate)}</Field>
            <Field label="Tiền tệ">{order.currencyCode}</Field>
            <Field label="Tạo lúc">{formatDateTime(order.createdAt)}</Field>
            <Field label="Cập nhật gần nhất">{formatDateTime(order.updatedAt)}</Field>
            <Field label="Phân công">
              {order.ownerId ? 'đã có người phụ trách' : 'đơn của team, chưa chia cho ai'}
            </Field>
          </dl>
        </Card>

        <Card
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              Chưa nối được
            </span>
          }
        >
          <ul className="flex flex-col gap-2 px-3 py-3 text-sm">
            {MISSING.map((m) => (
              <li key={m.title} className="flex flex-col">
                <span className="font-medium">{m.title}</span>
                <span className="text-xs text-muted-foreground">{m.need}</span>
              </li>
            ))}
          </ul>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Luật 2: shape response phải sinh từ OpenAPI của apps/api. Khi backend khai báo DTO cho
            các mục trên thì nối được ngay, không cần sửa gì ở màn hình.
          </p>
        </Card>
      </div>

      <Lines order={order} />
    </>
  );
}

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const query = useOrder(orderId);
  useInvalidateOn('order.updated', [orderKeys.detail(orderId)], {
    filter: (p) => typeof p === 'object' && p !== null && (p as { id?: unknown }).id === orderId,
  });

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        items={[
          { label: 'Bán hàng' },
          { label: 'Đơn hàng', href: '/crm/orders' },
          { label: query.data?.docNumber ?? 'Chi tiết' },
        ]}
      />
      {isApiError(query.error) && query.error.isNotFound ? (
        <EmptyState
          title="Không tìm thấy đơn hàng"
          description="Đơn này có thể đã bị xóa, hoặc thuộc khách do người khác phụ trách."
          action={
            <Button variant="outline" asChild>
              <Link href="/crm/orders">Về danh sách đơn</Link>
            </Button>
          }
        />
      ) : (
        <QueryState query={query} skeleton={<DetailSkeleton fields={9} />}>
          {(order) => <Detail order={order} />}
        </QueryState>
      )}
    </div>
  );
}
