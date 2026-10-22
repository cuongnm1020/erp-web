'use client';

import { AlertTriangle, Boxes, CornerDownRight, Gift, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
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
import { groupOrderLines } from '../combo-lines';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor, messageForCode } from '@/lib/error-messages';
import { formatDate, formatMoney, formatQuantity, toDecimal } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useCarriers } from '@/features/wms/api/use-shipping';
import { useCustomerBrief } from '../api/use-line-entry';
import {
  useFulfilOrder,
  useOrder,
  usePickupWarehouses,
  useShippingQuote,
  useMoveOrdersWarehouse,
  useUpdateOrder,
  type SalesOrderDetail,
  type SalesOrderStatus,
} from '../api/use-orders';
import {
  fulfilTargetLabel,
  fulfilmentLabel,
  fulfilmentTone,
  manualFulfilTargets,
  manualStatusTargets,
  orderAddressLine,
  orderChannelLabel,
  orderEditable,
  orderStatusLabel,
  orderStatusTone,
  type FulfilTarget,
  manualDiscountNote,
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
/** Không chọn địa chỉ trên đơn → server rơi về địa chỉ mặc định / duy nhất của khách. */
const NO_ADDRESS = '__none__';
/** "Trạng thái kho" giữ nguyên (Radix Select không nhận value rỗng). */
const CURRENT_FULFILMENT = '__current__';
const money = (v: string) => formatMoney(v, { unit: '' });

function Card({
  title,
  aside,
  className,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      <header className="flex min-h-card-header items-center justify-between gap-2 border-b px-3.5">
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
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>{children}</span>
    </div>
  );
}

/** Ô của form sửa đơn: nhãn `caption` trên, ô nhập, gợi ý dưới (design system Form chứng từ). */
function FormField({
  label,
  help,
  wide,
  children,
}: {
  label: string;
  help?: ReactNode;
  /** Chiếm cả hai cột của lưới. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', wide && 'sm:col-span-2')}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {help ? <span className="text-xs text-muted-foreground">{help}</span> : null}
    </div>
  );
}

/** Ô vừa đổi chưa lưu: viền + nền `warning` (design system — Ma trận chọn / form). */
const DIRTY = 'border-warning bg-warning-weak';

/**
 * Ô cân nặng gửi hãng: trống → null (dùng Σ dòng); "1,2" hay "1.2" → "1.2"; số ≤ 0, quá 4 số
 * lẻ hoặc chữ → null kèm cờ không hợp lệ ở caller (khớp luật DTO `shippingWeightKg`).
 */
export function normalizeWeightInput(raw: string): string | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  if (!/^\d{1,8}(\.\d{1,4})?$/.test(s)) return null;
  const d = toDecimal(s);
  return d && d.gt(0) ? d.toString() : null;
}

function Editor({ order }: { order: SalesOrderDetail }) {
  const router = useRouter();
  const ability = useAbility();
  const canUpdate = ability.can('update', 'SalesOrder');
  const update = useUpdateOrder(order.id);
  const moveWarehouse = useMoveOrdersWarehouse();
  const carriers = useCarriers();
  const warehouses = usePickupWarehouses();

  const [status, setStatus] = useState<SalesOrderStatus>(order.status);
  const [carrierId, setCarrierId] = useState<string>(order.carrierId ?? NO_CARRIER);
  const [warehouseId, setWarehouseId] = useState<string>(order.warehouseId ?? NO_WAREHOUSE);
  const [addressId, setAddressId] = useState<string>(order.addressId ?? NO_ADDRESS);
  // Danh sách địa chỉ của khách chỉ tải được khi có customer.read (kho mở đơn bằng read_all
  // thì không) — khi đó chỉ hiện địa chỉ hiệu lực server trả, không có ô chọn.
  const canReadCustomer = ability.can('read', 'Customer');
  const customer = useCustomerBrief(canReadCustomer ? order.customer.id : '');
  const addresses = customer.data?.addresses ?? [];
  // Cân nặng gửi hãng: ô trống = dùng cân nặng tính từ dòng (server: shippingWeightKg null).
  const [weightKg, setWeightKg] = useState<string>(order.shippingWeightKg ?? '');
  // "Trạng thái kho" đặt tay (2026-09-15): đóng pick / đóng gói KHÔNG quét — quyền riêng
  // sales_order.fulfil_manual (kho + admin), chỉ đơn ĐÃ DUYỆT; đích chép từ bảng của server.
  const fulfil = useFulfilOrder(order.id);
  const [fulfilTarget, setFulfilTarget] = useState<FulfilTarget | ''>('');
  const canFulfil = ability.can('fulfil_manual', 'SalesOrder');
  const fulfilTargets =
    canFulfil && order.status === 'APPROVED' ? manualFulfilTargets(order.fulfilment.status) : [];
  const [reason, setReason] = useState('');

  const targets = manualStatusTargets(order.status, (a) => ability.can(a, 'SalesOrder'));
  const carrierEditable = canUpdate && orderEditable(order.status);
  const statusEditable = canUpdate && targets.length > 0;
  const activeCarriers = (carriers.data ?? []).filter(
    (c) => c.isActive || c.id === order.carrierId,
  );

  const nextCarrier = carrierId === NO_CARRIER ? null : carrierId;
  const nextWarehouse = warehouseId === NO_WAREHOUSE ? null : warehouseId;
  const nextAddress = addressId === NO_ADDRESS ? null : addressId;
  // Địa chỉ sẽ HIỆU LỰC sau khi lưu: đang chọn → địa chỉ đó; bỏ chọn → mặc định của khách
  // (server quyết; khi chưa tải được danh sách thì dùng địa chỉ hiệu lực server đã trả).
  const effectiveAddress =
    (nextAddress ? addresses.find((a) => a.id === nextAddress) : undefined) ??
    (nextAddress === null && addresses.length > 0
      ? (addresses.find((a) => a.isDefault) ?? (addresses.length === 1 ? addresses[0] : undefined))
      : undefined) ??
    (nextAddress === (order.addressId ?? null) ? order.shippingAddress : null);
  const selectedWarehouse = (warehouses.data ?? []).find((w) => w.id === nextWarehouse) ?? null;
  // Hãng có bảng cước (GHTK, GHN…) → hỏi cước ngay khi chọn để sale thấy trước khi lưu.
  // Hãng nội bộ (MANUAL) không có `quote` → không hỏi, không hiện dòng cước.
  // Kho lấy hàng đang chọn đi kèm (chưa cần lưu) → hãng tính cước từ đúng địa chỉ kho đó.
  const selectedCarrier = activeCarriers.find((c) => c.id === nextCarrier) ?? null;
  const canQuote = Boolean(selectedCarrier?.operations.includes('quote'));
  const quote = useShippingQuote(
    order.id,
    canQuote ? nextCarrier : null,
    nextWarehouse,
    nextAddress,
  );
  const statusChanged = status !== order.status;
  const carrierChanged = nextCarrier !== (order.carrierId ?? null);
  const warehouseChanged = nextWarehouse !== (order.warehouseId ?? null);
  const addressChanged = nextAddress !== (order.addressId ?? null);
  const nextWeight = normalizeWeightInput(weightKg);
  const weightInvalid = weightKg.trim() !== '' && nextWeight === null;
  const weightChanged =
    !weightInvalid &&
    (nextWeight === null
      ? order.shippingWeightKg !== null
      : order.shippingWeightKg === null || !toDecimal(order.shippingWeightKg)?.eq(nextWeight));
  // Đổi kho đi đường chuyển đơn (PLAN-warehouse-context K3: dời giữ chỗ + lập lại PICK) — không
  // qua PATCH (PATCH chặn ORDER_WAREHOUSE_LOCKED khi hàng đã giữ ở kho cũ).
  const moveTo = warehouseChanged && nextWarehouse ? nextWarehouse : null;
  const patchDirty =
    statusChanged || carrierChanged || addressChanged || weightChanged || moveTo !== null;

  const detailHref = `/crm/orders/${order.id}`;
  const totalQty = order.lines.reduce(
    (s, l) => s + Number(formatQuantity(l.qtyBase).replace(/\D/g, '') || 0),
    0,
  );

  /**
   * POST /sales-orders/{id}/fulfil — chạy SAU khi PATCH đã lưu (hãng phải nằm trên đơn trước
   * khi xin vận đơn). Vận đơn có mã → về chi tiết kèm ?printLabel=1 để mở nhãn in ngay.
   */
  const runFulfil = (target: FulfilTarget) => {
    fulfil.mutate(
      // Cân nặng chỉ gửi kèm khi người dùng vừa đổi — phiếu giao đã chép cân nặng của đơn.
      { target, ...(weightChanged && nextWeight ? { weightKg: nextWeight } : {}) },
      {
        onSuccess: (r) => {
          const w = r.waybill;
          toast.success(`Đã chuyển ${fulfilTargetLabel(target).toLowerCase()}`, {
            description:
              target === 'PACKED'
                ? w?.outcome === 'QUEUED'
                  ? `${order.docNumber} · hãng ${w.carrierCode} chưa cấp vận đơn — hệ thống đang thử lại`
                  : `${order.docNumber} · vận đơn ${w?.trackingNo ?? '—'} (${w?.carrierCode ?? ''})`
                : `${order.docNumber} · phiếu giao ${r.shipmentDocNumber ?? '—'} sẵn sàng đóng gói`,
          });
          router.push(w?.trackingNo ? `${detailHref}?printLabel=1` : detailHref);
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  const save = () => {
    if (update.isPending || fulfil.isPending || moveWarehouse.isPending) return;
    if (weightInvalid) {
      toast.error('Cân nặng gửi hãng phải là số kg lớn hơn 0, tối đa 4 số lẻ');
      return;
    }
    if (fulfilTarget === 'PACKED' && nextCarrier === null) {
      toast.error(
        'Chọn hãng vận chuyển (ĐVVC) trước khi đóng gói — vận đơn được xin ngay trong cùng thao tác',
      );
      return;
    }
    if (!patchDirty) {
      if (fulfilTarget) {
        runFulfil(fulfilTarget);
        return;
      }
      toast.info('Không có gì thay đổi');
      router.push(detailHref);
      return;
    }
    if (!canUpdate) return;
    if (moveTo) {
      moveWarehouse.mutate(
        { orderIds: [order.id], warehouseId: moveTo },
        {
          onSuccess: (r) => {
            const failed = r.failed[0];
            if (failed) {
              toast.error(messageForCode(failed.code, 409));
              setWarehouseId(order.warehouseId ?? NO_WAREHOUSE);
              return;
            }
            if (statusChanged || carrierChanged || addressChanged || weightChanged) patch();
            else {
              toast.success('Đã lưu thay đổi', {
                description: `${order.docNumber} · kho lấy hàng`,
              });
              if (fulfilTarget) runFulfil(fulfilTarget);
              else router.push(detailHref);
            }
          },
          onError: (err) => toast.error(messageFor(err)),
        },
      );
      return;
    }
    patch();
  };

  const patch = () => {
    update.mutate(
      {
        ...(statusChanged ? { status } : {}),
        ...(carrierChanged ? { carrierId: nextCarrier } : {}),
        ...(addressChanged ? { addressId: nextAddress } : {}),
        ...(weightChanged ? { shippingWeightKg: nextWeight } : {}),
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
                  : c === 'addressId'
                    ? 'địa chỉ giao'
                    : c === 'shippingWeightKg'
                      ? 'cân nặng gửi hãng'
                      : 'hãng vận chuyển',
              )
              .join(', ')}`,
          });
          if (fulfilTarget) runFulfil(fulfilTarget);
          else router.push(detailHref);
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

  const readOnlyReason =
    !canUpdate && !(canFulfil && fulfilTargets.length > 0)
      ? 'Bạn chỉ có quyền xem đơn này — cần quyền sửa đơn (sales_order.update) để lưu thay đổi.'
      : order.status === 'CANCELLED'
        ? 'Đơn đã hủy — trạng thái cuối, không sửa được gì nữa.'
        : null;

  const carrierLabel = (id: string | null) =>
    id ? (activeCarriers.find((c) => c.id === id)?.name ?? 'hãng khác') : 'Chưa chọn';
  const warehouseLabel = (id: string | null) =>
    id
      ? ((warehouses.data ?? []).find((w) => w.id === id)?.name ??
        (id === order.warehouseId ? (order.warehouse?.name ?? 'kho cũ') : 'kho khác'))
      : 'Chưa chọn';
  const weightLabel = (w: string | null) =>
    w ? formatQuantity(w, { unit: 'kg' }) : 'theo cân nặng SKU';
  // "n thay đổi chưa lưu" ở PageHeader + thẻ liệt kê cũ → mới ở cột phải.
  const changes: Array<{ label: string; from: string; to: string }> = [
    ...(statusChanged
      ? [
          {
            label: 'Trạng thái',
            from: orderStatusLabel(order.status),
            to: orderStatusLabel(status),
          },
        ]
      : []),
    ...(fulfilTarget
      ? [
          {
            label: 'Trạng thái kho',
            from: fulfilmentLabel(order.fulfilment.status),
            to: fulfilTargetLabel(fulfilTarget),
          },
        ]
      : []),
    ...(addressChanged ? [{ label: 'Địa chỉ giao', from: 'địa chỉ cũ', to: 'địa chỉ mới' }] : []),
    ...(warehouseChanged
      ? [
          {
            label: 'Kho lấy hàng',
            from: warehouseLabel(order.warehouseId ?? null),
            to: warehouseLabel(nextWarehouse),
          },
        ]
      : []),
    ...(carrierChanged
      ? [
          {
            label: 'ĐVVC',
            from: carrierLabel(order.carrierId ?? null),
            to: carrierLabel(nextCarrier),
          },
        ]
      : []),
    ...(weightChanged
      ? [
          {
            label: 'Cân nặng gửi hãng',
            from: weightLabel(order.shippingWeightKg),
            to: weightLabel(nextWeight),
          },
        ]
      : []),
  ];
  const saving = update.isPending || fulfil.isPending || moveWarehouse.isPending;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={`Sửa đơn ${order.docNumber}`}
        status={
          <>
            <StatusBadge tone={orderStatusTone(order.status)}>
              {orderStatusLabel(order.status)}
            </StatusBadge>
            <StatusBadge tone={fulfilmentTone(order.fulfilment.status)}>
              {fulfilmentLabel(order.fulfilment.status)}
            </StatusBadge>
          </>
        }
        description={`${order.customer.name} · đặt ${formatDate(order.orderDate)} · ${orderChannelLabel(order.channel)}`}
        breadcrumb={[
          { label: 'Bán hàng' },
          { label: 'Đơn hàng', href: '/crm/orders' },
          { label: order.docNumber, href: detailHref },
          { label: 'Sửa' },
        ]}
        actions={
          <>
            {changes.length > 0 ? (
              <span className="text-xs font-semibold text-warning" role="status">
                {changes.length} thay đổi chưa lưu
              </span>
            ) : null}
            <Button variant="ghost" asChild shortcut="Esc">
              <Link href={detailHref}>Hủy bỏ</Link>
            </Button>
            {canUpdate || canFulfil ? (
              <Button
                onClick={save}
                shortcut="Ctrl S"
                loading={saving}
                loadingText="Đang lưu…"
                disabled={readOnlyReason !== null}
              >
                Lưu thay đổi
              </Button>
            ) : null}
          </>
        }
      />

      {readOnlyReason ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm"
        >
          <Lock className="h-3.5 w-3.5 text-warning" aria-hidden />
          {readOnlyReason}
        </div>
      ) : (
        <div
          role="note"
          className="flex items-center gap-2 rounded-md border border-info-line bg-info-weak px-3 py-2 text-sm"
        >
          <Lock className="h-3.5 w-3.5 flex-none text-info" aria-hidden />
          <span>
            Khách, dòng hàng và giá đã chốt. Muốn đổi:{' '}
            <Can I="create" a="SalesOrder">
              <Link
                href={`/crm/orders/new?from=${order.id}`}
                className="font-semibold text-primary hover:underline"
              >
                Nhân bản đơn
              </Link>{' '}
              (giữ đơn này) hoặc{' '}
            </Can>
            <Link href={detailHref} className="font-semibold text-primary hover:underline">
              Hủy &amp; tạo lại
            </Link>{' '}
            ở màn chi tiết (hủy đơn này).
          </span>
        </div>
      )}

      <div className="flex flex-col items-start gap-3 lg:flex-row">
        {/* ── Cột trái: các phần sửa được ─────────────────────────── */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <Card title="Trạng thái">
            <div className="grid gap-3.5 p-3.5 sm:grid-cols-2">
              <FormField
                label="Trạng thái đơn"
                help={
                  canUpdate && targets.length === 0
                    ? order.status === 'PENDING_APPROVAL'
                      ? 'Đơn chờ duyệt: duyệt ở màn chi tiết; ở đây chỉ hủy được khi có quyền hủy.'
                      : 'Không có bước chuyển nào bạn được phép đặt tay.'
                    : 'Chỉ hiện bước bạn có quyền chuyển (duyệt / chốt / hủy).'
                }
              >
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as SalesOrderStatus)}
                  disabled={!statusEditable}
                >
                  <SelectTrigger aria-label="Trạng thái" className={cn(statusChanged && DIRTY)}>
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
              </FormField>
              <FormField
                label="Trạng thái kho"
                help={
                  fulfilTarget ? (
                    <span className="text-warning">
                      {fulfilTarget === 'PACKED'
                        ? 'Đóng gói KHÔNG quét: trừ tồn ngay, xin vận đơn của hãng đã chọn (ĐVVC) và mở nhãn in. Không hoàn tác được.'
                        : 'Đóng việc pick KHÔNG quét: phiếu giao sinh ngay, chưa trừ tồn — trừ khi đóng gói.'}
                    </span>
                  ) : fulfilTargets.length > 0 ? (
                    '"Đã pick xong / Đã đóng gói" làm tay cần chọn ĐVVC trước.'
                  ) : undefined
                }
              >
                {fulfilTargets.length > 0 ? (
                  <Select
                    value={fulfilTarget || CURRENT_FULFILMENT}
                    onValueChange={(v) =>
                      setFulfilTarget(v === CURRENT_FULFILMENT ? '' : (v as FulfilTarget))
                    }
                    disabled={fulfil.isPending}
                  >
                    <SelectTrigger
                      aria-label="Trạng thái kho"
                      className={cn(fulfilTarget && DIRTY)}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CURRENT_FULFILMENT}>
                        {fulfilmentLabel(order.fulfilment.status)} (hiện tại)
                      </SelectItem>
                      {fulfilTargets.map((t) => (
                        <SelectItem key={t} value={t}>
                          {fulfilTargetLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="flex h-control items-center">
                    <StatusBadge tone={fulfilmentTone(order.fulfilment.status)}>
                      {fulfilmentLabel(order.fulfilment.status)}
                    </StatusBadge>
                  </span>
                )}
              </FormField>
              {statusChanged && status === 'CANCELLED' ? (
                <FormField label="Lý do hủy" wide>
                  <Input
                    aria-label="Lý do hủy"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Khách đổi ý, đặt nhầm… (tùy chọn)"
                    maxLength={1000}
                  />
                </FormField>
              ) : null}
            </div>
          </Card>

          <Card title="Giao hàng">
            <div className="grid gap-3.5 p-3.5 sm:grid-cols-2">
              <FormField
                label="Địa chỉ giao"
                wide
                help={
                  <>
                    {effectiveAddress
                      ? `Giao tới: ${effectiveAddress.recipient} · ${effectiveAddress.phone} · ${orderAddressLine(effectiveAddress)}`
                      : canReadCustomer && !customer.isPending && addresses.length === 0
                        ? 'Khách chưa có địa chỉ giao — thêm ở hồ sơ khách hàng rồi quay lại chọn.'
                        : canReadCustomer && !customer.isPending
                          ? 'Khách có nhiều địa chỉ mà chưa đặt mặc định — chọn một địa chỉ để tra cước / gửi hãng.'
                          : 'Chưa có địa chỉ giao — thêm ở hồ sơ khách hàng.'}
                    <span className="block">
                      Thêm hay sửa nội dung địa chỉ ở{' '}
                      <Link
                        href={`/crm/customers/${order.customer.id}`}
                        className="text-primary hover:underline"
                      >
                        hồ sơ khách
                      </Link>{' '}
                      — đơn chỉ chọn địa chỉ có sẵn.
                    </span>
                  </>
                }
              >
                {canReadCustomer ? (
                  <Select
                    value={addressId}
                    onValueChange={setAddressId}
                    disabled={!carrierEditable || customer.isPending}
                  >
                    <SelectTrigger
                      aria-label="Địa chỉ giao"
                      className={cn(addressChanged && DIRTY)}
                    >
                      <SelectValue placeholder="Mặc định của khách" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ADDRESS}>— Mặc định của khách —</SelectItem>
                      {addresses.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label ? `${a.label} · ` : ''}
                          {a.recipient} · {orderAddressLine(a)}
                          {a.isDefault ? ' (mặc định)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm">
                    {order.shippingAddress
                      ? orderAddressLine(order.shippingAddress)
                      : 'Chưa có địa chỉ giao'}
                  </span>
                )}
              </FormField>
              <FormField
                label="Kho lấy hàng"
                wide
                help={
                  selectedWarehouse
                    ? selectedWarehouse.pickupReady
                      ? `Điểm lấy hàng gửi hãng: ${[
                          selectedWarehouse.address,
                          selectedWarehouse.hamlet,
                          selectedWarehouse.ward,
                          selectedWarehouse.province,
                        ]
                          .filter(Boolean)
                          .join(', ')}`
                      : 'Kho này chưa khai tỉnh/thành, phường/xã hoặc số điện thoại — không tra cước / gửi hãng được từ kho này. Khai ở Kho › Sửa kho.'
                    : undefined
                }
              >
                <Select
                  value={warehouseId}
                  onValueChange={setWarehouseId}
                  disabled={!carrierEditable || warehouses.isPending}
                >
                  <SelectTrigger
                    aria-label="Kho lấy hàng"
                    className={cn(warehouseChanged && DIRTY)}
                  >
                    <SelectValue placeholder="Chưa chọn" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Đơn đã có kho thì chỉ chuyển sang kho khác, không bỏ kho. */}
                    {order.warehouseId ? null : (
                      <SelectItem value={NO_WAREHOUSE}>— Chưa chọn —</SelectItem>
                    )}
                    {(warehouses.data ?? []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.code}){w.pickupReady ? '' : ' — chưa khai địa chỉ'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </Card>

          <Card title="Vận chuyển">
            <div className="grid gap-3.5 p-3.5 sm:grid-cols-2">
              <FormField
                label="Đơn vị vận chuyển"
                help={
                  carrierChanged && order.carrierId ? (
                    <span className="text-warning">Đã đổi từ {carrierLabel(order.carrierId)}</span>
                  ) : carrierEditable ? (
                    'Phiếu giao tạo sau khi pick lấy sẵn hãng này.'
                  ) : canUpdate ? (
                    'Đơn đã kết thúc — không đổi hãng.'
                  ) : (
                    'Cần quyền sửa đơn để đổi hãng.'
                  )
                }
              >
                <Select
                  value={carrierId}
                  onValueChange={setCarrierId}
                  disabled={!carrierEditable || carriers.isPending}
                >
                  <SelectTrigger
                    aria-label="Hãng vận chuyển"
                    className={cn(carrierChanged && DIRTY)}
                  >
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
              </FormField>
              <FormField label="Cân nặng gửi hãng" help="kg · để trống = tính từ cân nặng SKU">
                <Input
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  inputMode="decimal"
                  placeholder={`Tính từ dòng: ${formatQuantity(order.lineWeightKg, { unit: 'kg' })}`}
                  aria-label="Cân nặng gửi hãng (kg)"
                  aria-invalid={weightInvalid || undefined}
                  disabled={!carrierEditable}
                  className={cn('text-right tabular-nums', weightChanged && DIRTY)}
                />
              </FormField>
              {canQuote ? (
                <FormField label="Cước hãng báo">
                  <span
                    role="status"
                    aria-live="polite"
                    className="flex min-h-control items-center text-sm tabular-nums"
                  >
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
                </FormField>
              ) : null}
              <FormField label="Phí thu khách">
                <span className="flex min-h-control items-center text-sm tabular-nums">
                  {money(order.shippingFee)} {order.currencyCode}
                </span>
              </FormField>
            </div>
          </Card>

          <Card
            title="Ghi chú & phân công"
            aside={<span className="text-xs text-muted-foreground">chỉ đọc ở màn này</span>}
          >
            <dl className="grid gap-3.5 p-3.5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Ghi chú nội bộ</dt>
                <dd className="whitespace-pre-line">{order.internalNote || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">In vận đơn</dt>
                <dd className="whitespace-pre-line">{order.printNote || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Phụ trách</dt>
                <dd>{order.ownerId ? 'Đã có người phụ trách' : 'Đơn của team, chưa chia'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Thẻ</dt>
                <dd>{order.tags.length > 0 ? order.tags.map((t) => t.name).join(', ') : '—'}</dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* ── Cột phải: đơn chỉ đọc + thay đổi chưa lưu ──────────────── */}
        <aside className="flex w-full flex-col gap-3 lg:sticky lg:top-28 lg:w-detail-aside lg:flex-none">
          <Card
            title="Đơn hàng"
            aside={
              <span className="text-xs text-muted-foreground">
                {order.lines.length} mẫu · {totalQty} SP · chỉ đọc
              </span>
            }
          >
            <ul className="divide-y">
              {groupOrderLines(order.lines).map((g) =>
                g.kind === 'line' ? (
                  <li key={g.line.id} className="px-3.5 py-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="font-semibold">{g.line.skuName}</span>
                        {g.line.isGift ? (
                          <StatusBadge tone="brand" className="ml-1.5">
                            <Gift className="h-3 w-3" aria-hidden />
                            Tặng
                          </StatusBadge>
                        ) : null}
                      </span>
                      <span className="tabular-nums">{money(g.line.lineTotal)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{g.line.skuCode}</span> ·{' '}
                      {formatQuantity(g.line.qty)} {g.line.uomCode} × {money(g.line.unitPrice)}
                      {g.line.nonStock ? ' · gõ tay, không quản lý tồn' : ''}
                    </div>
                  </li>
                ) : (
                  <li key={`combo-${g.groupNo}`} className="px-3.5 py-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                        {g.skuName}
                        <StatusBadge tone="brand">
                          <Boxes className="h-3 w-3" aria-hidden />
                          Combo
                        </StatusBadge>
                      </span>
                      <span className="tabular-nums">{money(g.lineTotal)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{g.skuCode}</span> · {formatQuantity(g.qty)} combo
                      × {money(g.unitPrice)}
                    </div>
                    {g.lines.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center gap-1 pl-2 text-xs text-muted-foreground"
                      >
                        <CornerDownRight className="h-3 w-3" aria-hidden />
                        {l.skuName} × {formatQuantity(l.qty)} {l.uomCode}
                      </div>
                    ))}
                  </li>
                ),
              )}
            </ul>
            <div className="space-y-1 border-t px-3.5 py-3">
              <Row label="Tạm tính">{money(order.subtotal)}</Row>
              <Row label="Giảm giá">{money(order.discount)}</Row>
              {manualDiscountNote(order) ? (
                <p className="text-right text-xs text-muted-foreground">
                  trong đó {manualDiscountNote(order)}
                </p>
              ) : null}
              <Row label="Phí ship thu khách">{money(order.shippingFee)}</Row>
              {toDecimal(order.taxAmount)?.isZero() ? null : (
                <Row label="Thuế">{money(order.taxAmount)}</Row>
              )}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-base font-semibold">Thu hộ (COD)</span>
                <span className="text-base font-semibold tabular-nums text-primary">
                  {formatMoney(
                    Decimal.max(
                      new Decimal(order.total).minus(order.prepaidAmount || 0),
                      0,
                    ).toFixed(),
                  )}
                </span>
              </div>
            </div>
            <p className="flex items-start gap-1.5 border-t px-3.5 py-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
              Dòng hàng và giá thuộc chứng từ đã chốt — không sửa ở đây.
            </p>
          </Card>

          {changes.length > 0 ? (
            <section
              className="rounded-lg border border-warning-line bg-card"
              aria-label="Thay đổi chưa lưu"
            >
              <header className="flex min-h-card-header items-center border-b border-warning-line bg-warning-weak px-3.5 text-sm font-semibold text-warning">
                {changes.length} thay đổi chưa lưu
              </header>
              <dl className="space-y-1.5 px-3.5 py-3 text-sm">
                {changes.map((c) => (
                  <div key={c.label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{c.label}</dt>
                    <dd className="text-right">
                      <s className="text-muted-foreground">{c.from}</s> →{' '}
                      <b className="font-semibold">{c.to}</b>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </aside>
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
