'use client';

import { AlertTriangle, Gift, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { NotFoundCard } from '@/components/layout/not-found-screen';
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
import { toast } from '@/components/ui/toaster';
import { isApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useCarriers } from '@/features/wms/api/use-shipping';
import {
  useOrder,
  usePickupWarehouses,
  useShippingQuote,
  useUpdateOrder,
  type SalesOrderDetail,
  type SalesOrderStatus,
} from '../api/use-orders';
import {
  manualStatusTargets,
  orderChannelLabel,
  orderEditable,
  orderStatusLabel,
  orderStatusTone,
} from '../labels';

/**
 * D-05 Sửa đơn — trang riêng (không popup), bố cục hai cột theo màn sửa đơn của Pancake mà
 * người dùng đã quen: trái = sản phẩm + giá trị đơn, phải = thông tin / khách hàng / vận chuyển.
 *
 * Sửa được tại chỗ (PATCH /sales-orders/{id}, quyền `sales_order.update`):
 *   - Trạng thái: chỉ các đích server cho phép sửa tay VÀ người dùng có quyền tương ứng
 *     (`manualStatusTargets` chép đúng state machine backend — ghi chú D-05).
 *   - Hãng vận chuyển: tới khi đơn kết thúc (POSTED / CANCELLED).
 * Phần còn lại (dòng hàng, giá, khách, địa chỉ) thuộc chứng từ đã chốt → chỉ đọc, đường sửa vẫn là
 * "hủy & tạo lại" ở màn chi tiết. Không bịa ô nhập cho thứ API chưa có (ghi chú, thanh toán).
 *
 * Bốn trạng thái (luật 13): skeleton / 404 / lỗi / thành công; thiếu quyền update → chỉ đọc có banner.
 * Phím: Ctrl+S lưu, Esc quay về chi tiết.
 */
const NO_CARRIER = '__none__';
const NO_WAREHOUSE = '__none__';
const money = (v: string) => formatMoney(v, { unit: '' });

function Card({
  title,
  aside,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-semibold">{title}</span>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm">
      <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>{children}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-2 px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function Editor({ order }: { order: SalesOrderDetail }) {
  const router = useRouter();
  const ability = useAbility();
  const canUpdate = ability.can('update', 'SalesOrder');
  const update = useUpdateOrder(order.id);
  const carriers = useCarriers();
  const warehouses = usePickupWarehouses();

  const [status, setStatus] = useState<SalesOrderStatus>(order.status);
  const [carrierId, setCarrierId] = useState<string>(order.carrierId ?? NO_CARRIER);
  const [warehouseId, setWarehouseId] = useState<string>(order.warehouseId ?? NO_WAREHOUSE);
  const [reason, setReason] = useState('');

  const targets = manualStatusTargets(order.status, (a) => ability.can(a, 'SalesOrder'));
  const carrierEditable = canUpdate && orderEditable(order.status);
  const statusEditable = canUpdate && targets.length > 0;
  const activeCarriers = (carriers.data ?? []).filter(
    (c) => c.isActive || c.id === order.carrierId,
  );

  const nextCarrier = carrierId === NO_CARRIER ? null : carrierId;
  const nextWarehouse = warehouseId === NO_WAREHOUSE ? null : warehouseId;
  const selectedWarehouse = (warehouses.data ?? []).find((w) => w.id === nextWarehouse) ?? null;
  // Hãng có bảng cước (GHTK, GHN…) → hỏi cước ngay khi chọn để sale thấy trước khi lưu.
  // Hãng nội bộ (MANUAL) không có `quote` → không hỏi, không hiện dòng cước.
  // Kho lấy hàng đang chọn đi kèm (chưa cần lưu) → hãng tính cước từ đúng địa chỉ kho đó.
  const selectedCarrier = activeCarriers.find((c) => c.id === nextCarrier) ?? null;
  const canQuote = Boolean(selectedCarrier?.operations.includes('quote'));
  const quote = useShippingQuote(order.id, canQuote ? nextCarrier : null, nextWarehouse);
  const statusChanged = status !== order.status;
  const carrierChanged = nextCarrier !== (order.carrierId ?? null);
  const warehouseChanged = nextWarehouse !== (order.warehouseId ?? null);
  const dirty = statusChanged || carrierChanged || warehouseChanged;

  const detailHref = `/crm/orders/${order.id}`;
  const totalQty = order.lines.reduce(
    (s, l) => s + Number(formatQuantity(l.qtyBase).replace(/\D/g, '') || 0),
    0,
  );

  const save = () => {
    if (!canUpdate || update.isPending) return;
    if (!dirty) {
      toast.info('Không có gì thay đổi');
      router.push(detailHref);
      return;
    }
    update.mutate(
      {
        ...(statusChanged ? { status } : {}),
        ...(carrierChanged ? { carrierId: nextCarrier } : {}),
        ...(warehouseChanged ? { warehouseId: nextWarehouse } : {}),
        ...(statusChanged && status === 'CANCELLED' && reason.trim()
          ? { reason: reason.trim() }
          : {}),
      },
      {
        onSuccess: (r) => {
          toast.success('Đã lưu thay đổi', {
            description: `${order.docNumber} · ${r.changed
              .map((c) =>
                c === 'status'
                  ? `trạng thái → ${orderStatusLabel(r.status)}`
                  : c === 'warehouseId'
                    ? 'kho lấy hàng'
                    : 'hãng vận chuyển',
              )
              .join(', ')}`,
          });
          router.push(detailHref);
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  // Ctrl+S lưu, Esc về chi tiết — listener gắn một lần, đọc hàm mới nhất qua ref.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      } else if (
        e.key === 'Escape' &&
        !(e.target instanceof HTMLElement && e.target.closest('[role="listbox"]'))
      ) {
        router.push(detailHref);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, detailHref]);

  const readOnlyReason = !canUpdate
    ? 'Bạn chỉ có quyền xem đơn này — cần quyền sửa đơn (sales_order.update) để lưu thay đổi.'
    : order.status === 'CANCELLED'
      ? 'Đơn đã hủy — trạng thái cuối, không sửa được gì nữa.'
      : null;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={`Sửa đơn ${order.docNumber}`}
        description={`${order.customer.name} · Đặt ngày ${formatDate(order.orderDate)} · Kênh ${orderChannelLabel(order.channel)}`}
        breadcrumb={[
          { label: 'Bán hàng' },
          { label: 'Đơn hàng', href: '/crm/orders' },
          { label: order.docNumber, href: detailHref },
          { label: 'Sửa' },
        ]}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href={detailHref}>Hủy bỏ</Link>
            </Button>
            {canUpdate ? (
              <Button
                size="sm"
                onClick={save}
                disabled={update.isPending || readOnlyReason !== null}
              >
                {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}{' '}
                <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
                  Ctrl S
                </kbd>
              </Button>
            ) : null}
          </>
        }
      />

      {readOnlyReason ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
        >
          <Lock className="h-3.5 w-3.5 text-warning" aria-hidden />
          {readOnlyReason}
        </div>
      ) : null}

      <div className="grid items-start gap-3 lg:grid-cols-5">
        {/* ── Cột trái: sản phẩm + giá trị đơn ─────────────────────── */}
        <div className="flex flex-col gap-3 lg:col-span-3">
          <Card
            title="Sản phẩm"
            aside={
              <span className="text-xs text-muted-foreground">
                Số mẫu mã: <b className="text-foreground">{order.lines.length}</b> · Số lượng SP:{' '}
                <b className="text-foreground">{totalQty}</b>
              </span>
            }
          >
            <ul className="divide-y">
              {order.lines.map((l) => (
                <li key={l.id} className="grid gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded border px-1.5 font-mono text-xs text-primary">
                        {l.skuCode}
                      </span>
                      <span className="font-medium">{l.skuName}</span>
                      {l.isGift ? (
                        <StatusBadge tone="brand">
                          <Gift className="h-3 w-3" aria-hidden />
                          Hàng tặng
                        </StatusBadge>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      <span>Chiết khấu: {money(l.discount)} ₫</span>
                      <span>Đang giữ: {formatQuantity(l.reservedQty)}</span>
                      <span>Đã pick: {formatQuantity(l.pickedQty)}</span>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-sm">
                      {money(l.unitPrice)} ₫ <span className="text-muted-foreground">×</span>{' '}
                      {formatQuantity(l.qty)} {l.uomCode}
                    </div>
                    <div className="font-semibold text-primary">{money(l.lineTotal)} ₫</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Dòng hàng và giá thuộc chứng từ đã chốt — muốn đổi thì{' '}
              <Link href={detailHref} className="text-primary underline">
                hủy &amp; tạo lại
              </Link>{' '}
              ở màn chi tiết.
            </p>
          </Card>

          <Card title="Giá trị đơn hàng">
            <div className="py-1">
              <Row label="Tạm tính">{money(order.subtotal)} ₫</Row>
              <Row label="Giảm giá">{money(order.discount)} ₫</Row>
              <Row label="Phí vận chuyển (thu khách)">{money(order.shippingFee)} ₫</Row>
              <Row label="Thuế">{money(order.taxAmount)} ₫</Row>
            </div>
            <div className="border-t py-1">
              <Row label="Tổng số tiền" strong>
                {money(order.total)} {order.currencyCode}
              </Row>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-base font-semibold">Tiền cần thu</span>
                <span className="text-lg font-semibold tabular-nums text-primary">
                  {money(order.total)} {order.currencyCode}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Cột phải: thông tin / khách hàng / vận chuyển ─────────── */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Card
            title="Thông tin"
            aside={
              <StatusBadge tone={orderStatusTone(order.status)}>
                {orderStatusLabel(order.status)}
              </StatusBadge>
            }
          >
            <div className="py-1">
              <Field label="Trạng thái">
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as SalesOrderStatus)}
                  disabled={!statusEditable}
                >
                  <SelectTrigger aria-label="Trạng thái" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={order.status}>
                      {orderStatusLabel(order.status)} (hiện tại)
                    </SelectItem>
                    {targets.map((t) => (
                      <SelectItem key={t} value={t}>
                        {orderStatusLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {statusChanged && status === 'CANCELLED' ? (
                <Field label="Lý do hủy">
                  <Input
                    aria-label="Lý do hủy"
                    className="h-8"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Khách đổi ý, đặt nhầm… (tùy chọn)"
                    maxLength={1000}
                  />
                </Field>
              ) : null}
              <p className="px-3 pb-1 text-xs text-muted-foreground">
                {canUpdate && targets.length === 0
                  ? order.status === 'PENDING_APPROVAL'
                    ? 'Đơn chờ duyệt: duyệt ở hàng chờ duyệt; ở đây chỉ hủy được khi có quyền hủy.'
                    : 'Không có bước chuyển nào bạn được phép đặt tay.'
                  : 'Chỉ hiện các bước server cho phép và bạn có quyền (duyệt / chốt / hủy).'}
              </p>
              <Field label="Tạo lúc">{formatDateTime(order.createdAt)}</Field>
              <Field label="Ngày đặt">{formatDate(order.orderDate)}</Field>
              <Field label="Nhân viên phụ trách">
                {order.ownerId ? (
                  'đã có người phụ trách'
                ) : (
                  <span className="text-muted-foreground">đơn của team, chưa chia cho ai</span>
                )}
              </Field>
              {order.postedAt ? (
                <Field label="Đã chốt lúc">{formatDateTime(order.postedAt)}</Field>
              ) : null}
            </div>
          </Card>

          <Card title="Khách hàng">
            <div className="py-1">
              <Field label="Tên">
                <Link
                  href={`/crm/customers/${order.customer.id}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {order.customer.name}
                </Link>
              </Field>
              <Field label="Mã khách">
                <span className="font-mono text-xs">{order.customer.code}</span>
              </Field>
              <p className="px-3 pb-1 text-xs text-muted-foreground">
                Đổi khách, liên hệ, địa chỉ nhận hàng: sửa ở hồ sơ khách hàng; đơn không đổi khách
                sau khi chốt.
              </p>
            </div>
          </Card>

          <Card title="Vận chuyển">
            <div className="py-1">
              <Field label="Kho lấy hàng">
                <Select
                  value={warehouseId}
                  onValueChange={setWarehouseId}
                  disabled={!carrierEditable || warehouses.isPending}
                >
                  <SelectTrigger aria-label="Kho lấy hàng" className="h-8">
                    <SelectValue placeholder="Chưa chọn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_WAREHOUSE}>— Chưa chọn —</SelectItem>
                    {(warehouses.data ?? []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.code}){w.pickupReady ? '' : ' — chưa khai địa chỉ'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {selectedWarehouse ? (
                <p className="px-3 pb-1 text-xs text-muted-foreground">
                  {selectedWarehouse.pickupReady
                    ? `Điểm lấy hàng gửi hãng: ${[
                        selectedWarehouse.address,
                        selectedWarehouse.ward,
                        selectedWarehouse.district,
                        selectedWarehouse.province,
                      ]
                        .filter(Boolean)
                        .join(', ')}`
                    : 'Kho này chưa khai tỉnh/huyện/xã hoặc số điện thoại — hãng sẽ nhận điểm lấy mặc định của server. Khai ở Kho › Sửa kho.'}
                </p>
              ) : null}
              <Field label="ĐVVC">
                <Select
                  value={carrierId}
                  onValueChange={setCarrierId}
                  disabled={!carrierEditable || carriers.isPending}
                >
                  <SelectTrigger aria-label="Hãng vận chuyển" className="h-8">
                    <SelectValue placeholder="Chưa chọn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CARRIER}>— Chưa chọn —</SelectItem>
                    {activeCarriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.code}){c.isActive ? '' : ' — đã tắt'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {canQuote ? (
                <Field label="Cước hãng báo">
                  <span role="status" aria-live="polite" className="tabular-nums">
                    {quote.isPending
                      ? 'Đang hỏi cước…'
                      : quote.isError
                        ? messageFor(quote.error)
                        : quote.data
                          ? `${money(quote.data.fee)} ${quote.data.currency}` +
                            (quote.data.weightKg === '0.0000'
                              ? ' · SKU chưa khai cân nặng'
                              : ` · ${quote.data.weightKg} kg`) +
                            ` · lấy tại ${quote.data.pickupSummary}`
                          : null}
                  </span>
                </Field>
              ) : null}
              <Field label="Phí thu khách">
                {money(order.shippingFee)} {order.currencyCode}
              </Field>
              <p className="px-3 pb-1 text-xs text-muted-foreground">
                {carrierEditable
                  ? 'Phiếu giao tạo sau khi pick sẽ lấy sẵn hãng này; mã vận đơn và cước hãng cấp ở bàn đóng gói.'
                  : canUpdate
                    ? 'Đơn đã kết thúc — không đổi hãng.'
                    : 'Cần quyền sửa đơn để đổi hãng.'}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function OrderEditScreen({ orderId }: { orderId: string }) {
  const query = useOrder(orderId);
  return isApiError(query.error) && query.error.isNotFound ? (
    <NotFoundCard
      title="Không có đơn hàng này"
      path={`/crm/orders/${orderId}/edit`}
      description="Số đơn có thể gõ sai, hoặc đơn thuộc khách hàng không trong phạm vi phụ trách của bạn."
      backHref="/crm/orders"
      backLabel="Về danh sách Đơn hàng"
    />
  ) : (
    <QueryState query={query} skeleton={<DetailSkeleton fields={10} />}>
      {(order) => <Editor order={order} />}
    </QueryState>
  );
}
