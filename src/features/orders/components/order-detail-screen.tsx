'use client';

import { Gift, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { NotFoundCard } from '@/components/layout/not-found-screen';
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
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { isApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import {
  orderKeys,
  useCancelOrder,
  useOrder,
  useOrders,
  type SalesOrderDetail,
} from '../api/use-orders';
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
 * - Nút "In" / "Tạo phiếu xuất": chưa nối mutation. "Hủy đơn" đã nối POST /:id/cancel.
 */
const MISSING: Array<{ title: string; need: string }> = [
  {
    title: 'Vận đơn / tracking',
    need: 'hãng đã chọn được trên đơn; mã vận đơn cấp ở bàn đóng gói, chưa có DTO gắn với đơn',
  },
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

/**
 * Hủy đơn — hành động không hoàn tác (server tự nhả reservation). Lý do là tùy chọn,
 * đi vào event OrderCancelled cho đối chiếu sau này.
 * `recreate`: luồng "sửa đơn" = hủy & tạo lại — hủy xong chuyển sang form tạo đơn đổ sẵn nội dung
 * (chứng từ đã chốt là bất biến nên không có sửa tại chỗ).
 */
function CancelOrderDialog({
  order,
  open,
  recreate,
  onOpenChange,
}: {
  order: SalesOrderDetail;
  open: boolean;
  recreate: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const cancel = useCancelOrder(order.id);
  const [reason, setReason] = useState('');
  const confirm = () => {
    cancel.mutate(
      { reason: reason.trim() || (recreate ? 'Sửa đơn — hủy & tạo lại' : undefined) },
      {
        onSuccess: () => {
          toast.success(`Đã hủy đơn ${order.docNumber}`, {
            description: 'Hàng đang giữ cho đơn này đã được nhả về khả dụng.',
          });
          onOpenChange(false);
          if (recreate) router.push(`/crm/orders/new?from=${order.id}`);
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !cancel.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {recreate
              ? `Sửa đơn ${order.docNumber} — hủy & tạo lại?`
              : `Hủy đơn ${order.docNumber}?`}
          </DialogTitle>
          <DialogDescription>
            {recreate
              ? 'Đơn đã chốt không sửa tại chỗ được. Đơn này sẽ bị hủy (hàng đang giữ được nhả), rồi mở form tạo đơn mới đổ sẵn nội dung cũ để chỉnh và chốt lại — số chứng từ sẽ cấp mới.'
              : 'Không hoàn tác được. Hàng đang giữ cho đơn sẽ được nhả về khả dụng; muốn bán lại thì tạo đơn mới.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Lý do hủy (tùy chọn)</Label>
          <Input
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Khách đổi ý, đặt nhầm…"
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={cancel.isPending} onClick={() => onOpenChange(false)}>
            Không hủy
          </Button>
          <Button variant="destructive" disabled={cancel.isPending} onClick={confirm}>
            {recreate ? 'Hủy & tạo lại' : 'Hủy đơn'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ order }: { order: SalesOrderDetail }) {
  const [dialog, setDialog] = useState<'cancel' | 'recreate' | null>(null);
  const ability = useAbility();
  const canRecreate = ability.can('cancel', 'SalesOrder') && ability.can('create', 'SalesOrder');
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
        <div className="flex shrink-0 gap-2">
          {order.status !== 'CANCELLED' ? (
            <>
              <Can I="update" a="SalesOrder">
                <Button size="sm" asChild>
                  <Link href={`/crm/orders/${order.id}/edit`}>Sửa đơn</Link>
                </Button>
              </Can>
              {canRecreate ? (
                <Button variant="outline" size="sm" onClick={() => setDialog('recreate')}>
                  Sửa (hủy & tạo lại)
                </Button>
              ) : null}
              <Can I="cancel" a="SalesOrder">
                <Button variant="destructive" size="sm" onClick={() => setDialog('cancel')}>
                  Hủy đơn
                </Button>
              </Can>
            </>
          ) : (
            <Can I="create" a="SalesOrder">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/crm/orders/new?from=${order.id}`}>Tạo lại đơn</Link>
              </Button>
            </Can>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/crm/orders">Về danh sách đơn</Link>
          </Button>
        </div>
      </div>
      <CancelOrderDialog
        order={order}
        open={dialog !== null}
        recreate={dialog === 'recreate'}
        onOpenChange={(o) => setDialog(o ? dialog : null)}
      />

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
            <Field label="Hãng vận chuyển">
              {order.carrier ? (
                <>
                  {order.carrier.name}{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({order.carrier.code})
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">chưa chọn — chọn ở trang Sửa đơn</span>
              )}
            </Field>
            {order.postedAt ? (
              <Field label="Đã chốt lúc">{formatDateTime(order.postedAt)}</Field>
            ) : null}
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

/**
 * 404 theo design/404.png: mã lỗi + đường dẫn, giải thích, gợi ý "có phải bạn tìm" CHỈ từ
 * đơn TRONG scope (API đã scope sẵn — bản ghi ngoài scope trả 404 chứ không 403, không lộ
 * là đơn tồn tại), lối về danh sách + tìm toàn cục.
 */
function OrderNotFound({ orderId }: { orderId: string }) {
  const recent = useOrders({ take: 2, skip: 0 });
  return (
    <NotFoundCard
      title="Không có đơn hàng này"
      path={`/crm/orders/${orderId}`}
      description="Số đơn có thể gõ sai, đơn đã bị xóa nháp, hoặc đơn thuộc khách hàng không trong phạm vi phụ trách của bạn."
      backHref="/crm/orders"
      backLabel="Về danh sách Đơn hàng"
    >
      {recent.data && recent.data.items.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">Có phải bạn tìm:</p>
          <ul className="mt-1 space-y-1">
            {recent.data.items.map((o) => (
              <li key={o.id} className="flex items-baseline gap-2 text-sm">
                <Link
                  href={`/crm/orders/${o.id}`}
                  className="shrink-0 font-mono text-xs text-primary hover:underline"
                >
                  {o.docNumber}
                </Link>
                <span className="truncate text-muted-foreground">
                  {o.customer.name} · {formatDate(o.orderDate)} · {money(o.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </NotFoundCard>
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
        <OrderNotFound orderId={orderId} />
      ) : (
        <QueryState query={query} skeleton={<DetailSkeleton fields={9} />}>
          {(order) => <Detail order={order} />}
        </QueryState>
      )}
    </div>
  );
}
