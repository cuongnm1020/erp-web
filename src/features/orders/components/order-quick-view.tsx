'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import Decimal from 'decimal.js';
import { Copy, X } from 'lucide-react';
import Link from 'next/link';
import { CopyButton } from '@/components/data/copy-button';
import { Button } from '@/components/ui/button';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { messageFor } from '@/lib/error-messages';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  formatQuantity,
  normalizePhone,
  phoneCarrier,
  toDecimal,
} from '@/lib/format';
import { Can } from '@/lib/permission';
import { useShipmentStatusLog } from '@/features/wms/api/use-shipping';
import { shipmentStatusBadge } from '@/features/wms/labels';
import { cn } from '@/lib/cn';
import { useOrder, type OrderFlow, type SalesOrderListItem } from '../api/use-orders';
import { orderFlowClass, orderFlowLabel, telcoClass } from '../labels';
import { OrderProgress } from './order-progress';
import { PancakeOrderLink } from './pancake-order-link';

/**
 * Xem nhanh một đơn từ danh sách (ngăn kéo phải 480px) — tiến độ, người nhận, sản phẩm, tiền,
 * vận chuyển, hành trình hãng, ghi chú — không rời danh sách. Chi tiết đơn từ GET
 * /sales-orders/:id; hành trình từ GET /shipments/:id/status-log (chỉ các mốc đổi trạng thái).
 * Tiền trên dòng danh sách (thực thu ĐVVC, COD) lấy từ `row` để khớp con số vừa thấy ở bảng.
 * Redesign Bán hàng 2026-10-22: sao chép mã / SĐT / mã vận đơn, chân ngăn kéo 3 nút
 * (Nhân bản đơn · Sửa đơn · Mở đơn đầy đủ).
 */
export function OrderQuickView({
  row,
  onClose,
}: {
  row: SalesOrderListItem | null;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={row !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-drawer flex-col border-l bg-card shadow-dialog focus:outline-none"
          aria-describedby={undefined}
        >
          {row ? <Body row={row} /> : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

function Body({ row }: { row: SalesOrderListItem }) {
  const detail = useOrder(row.id);
  const d = detail.data;
  const shipmentId = d?.shipment?.id ?? '';
  const telco = phoneCarrier(row.phone);
  const phone = row.phone ? (normalizePhone(row.phone) ?? row.phone) : null;
  const prepaid = toDecimal(d?.prepaidAmount ?? '0') ?? new Decimal(0);
  const cod =
    row.shipment?.codAmount ?? Decimal.max(new Decimal(row.total).minus(prepaid), 0).toFixed();
  const tracking = row.shipment?.trackingNo ?? null;
  const carrierName =
    row.shipment?.carrierName ?? d?.carrier?.name ?? row.shipment?.carrierCode ?? null;
  const accountName = d?.shipment?.carrierAccountName ?? d?.carrierAccount?.name ?? null;
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <DialogPrimitive.Title className="font-mono text-sm font-semibold">
              {row.docNumber}
            </DialogPrimitive.Title>
            <CopyButton value={row.docNumber} label="mã đơn" />
            <FlowBadge flow={row.flow} />
          </div>
          <p className="text-xs text-muted-foreground">
            {row.pancakeOrderId ? (
              <PancakeOrderLink orderId={row.pancakeOrderId} link={row.pancakeOrderLink} />
            ) : (
              'Tạo trong ERP'
            )}{' '}
            · đặt {formatDate(row.orderDate)} · tạo {formatDateTime(row.createdAt)}
            {row.ownerName ? ` · ${row.ownerName}` : ''}
          </p>
        </div>
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Đóng xem nhanh">
            <X aria-hidden />
          </Button>
        </DialogPrimitive.Close>
      </div>

      <div className="flex-1 overflow-y-auto text-sm">
        {PROGRESS_FLOWS.has(row.flow) ? (
          <div className="border-b px-5 py-3">
            <OrderProgress flow={row.flow} timeline={d?.timeline} />
          </div>
        ) : null}

        <Section title="Người nhận">
          <p className="font-semibold">{row.recipientName ?? row.customer.name}</p>
          {phone ? (
            <p className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-mono text-xs">{formatPhone(row.phone)}</span>
              {telco ? <TelcoBadge name={telco} /> : null}
              <CopyButton value={phone} label="số điện thoại" />
            </p>
          ) : null}
          <p className="text-muted-foreground">
            {[row.addressLine, row.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ giao'}
          </p>
        </Section>

        <Section title={d ? `Sản phẩm · ${d.lines.length} dòng` : 'Sản phẩm'}>
          {detail.isPending ? (
            <div className="space-y-1.5" aria-label="Đang tải sản phẩm">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : detail.isError ? (
            <p className="text-xs text-destructive">{messageFor(detail.error)}</p>
          ) : (
            <ul className="space-y-1">
              {detail.data.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {l.skuName}{' '}
                    <span className="text-muted-foreground">
                      × {formatQuantity(l.qty)} {l.uomCode}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatMoney(l.lineTotal, { unit: '' })}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-2 space-y-0.5 border-t pt-2 tabular-nums">
            <Money label="Tạm tính" value={formatMoney(row.subtotal, { unit: '' })} />
            <Money label="Phí ship thu khách" value={formatMoney(row.shippingFee, { unit: '' })} />
            {d && !prepaid.isZero() ? (
              <Money label="Đã chuyển khoản" value={formatMoney(prepaid.toFixed(), { unit: '' })} />
            ) : null}
            <Money label="Tổng tiền" value={formatMoney(row.total, { unit: '' })} />
            <Money label="Thu hộ (COD)" value={formatMoney(cod, { unit: '' })} strong />
            {row.shipment?.collectedAmount ? (
              <Money
                label="Thực thu từ ĐVVC (ước tính)"
                value={formatMoney(row.shipment.collectedAmount, { unit: '' })}
              />
            ) : null}
          </dl>
        </Section>

        <Section title="Vận chuyển">
          {carrierName ? (
            <p>
              <span className="font-semibold">{carrierName}</span>
              {accountName ? (
                <span className="text-muted-foreground"> · tài khoản {accountName}</span>
              ) : null}
            </p>
          ) : (
            <p className="text-warning">Chưa gán hãng</p>
          )}
          {tracking ? (
            <p className="flex items-center gap-1.5">
              <span className="truncate font-mono text-xs">{tracking}</span>
              <CopyButton value={tracking} label="mã vận đơn" />
            </p>
          ) : (
            <p className="text-muted-foreground">Kho chưa tạo phiếu giao cho đơn này.</p>
          )}
          {shipmentId ? <Journey shipmentId={shipmentId} /> : null}
        </Section>

        <Section title="Ghi chú" last>
          {d?.internalNote || d?.printNote || row.note ? (
            <dl className="grid grid-cols-detail gap-x-3 gap-y-1">
              {d?.internalNote || row.note ? (
                <>
                  <dt className="text-muted-foreground">Nội bộ</dt>
                  <dd className="whitespace-pre-line">{d?.internalNote ?? row.note}</dd>
                </>
              ) : null}
              {d?.printNote ? (
                <>
                  <dt className="text-muted-foreground">In vận đơn</dt>
                  <dd className="whitespace-pre-line">{d.printNote}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="text-muted-foreground">Không có ghi chú.</p>
          )}
        </Section>
      </div>

      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Can I="create" a="SalesOrder">
          <Button asChild variant="outline">
            <Link href={`/crm/orders/new?from=${row.id}`}>
              <Copy aria-hidden />
              Nhân bản đơn
            </Link>
          </Button>
        </Can>
        {row.status !== 'CANCELLED' ? (
          <Can I="update" a="SalesOrder">
            <Button asChild variant="outline">
              <Link href={`/crm/orders/${row.id}/edit`}>Sửa đơn</Link>
            </Button>
          </Can>
        ) : null}
        <Button asChild>
          <Link href={`/crm/orders/${row.id}`}>Mở đơn đầy đủ</Link>
        </Button>
      </div>
    </>
  );
}

/** Luồng có thanh tiến độ — đơn sự cố / hủy chỉ hiện chip trạng thái. */
const PROGRESS_FLOWS: ReadonlySet<OrderFlow> = new Set<OrderFlow>([
  'PENDING_APPROVAL',
  'WAREHOUSE',
  'PICKING',
  'PACKED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

function Journey({ shipmentId }: { shipmentId: string }) {
  const log = useShipmentStatusLog(shipmentId);
  if (log.isPending) return <p className="text-xs text-muted-foreground">Đang tải hành trình…</p>;
  if (log.isError) return <p className="text-xs text-destructive">{messageFor(log.error)}</p>;
  if (log.data.items.length === 0)
    return <p className="text-xs text-muted-foreground">Chưa có mốc nào từ hãng.</p>;
  return (
    <ol className="space-y-2" aria-label="Hành trình từ hãng">
      {log.data.items.map((e) => (
        <li key={e.id} className="flex items-start gap-2.5">
          <span aria-hidden className="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary" />
          <span className="flex flex-col">
            <span className="font-medium">
              {e.mappedStatus ? shipmentStatusBadge(e.mappedStatus).label : e.carrierStatusCode}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(e.occurredAt ?? e.createdAt)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Section({
  title,
  last,
  children,
}: {
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-1.5 px-5 py-3', !last && 'border-b')}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong ? 'flex justify-between font-semibold' : 'flex justify-between text-muted-foreground'
      }
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Nhãn nhà mạng cạnh SĐT — mỗi nhà mạng một màu nền; dùng chung bảng + xem nhanh. */
export function TelcoBadge({ name }: { name: string }) {
  return (
    <span
      className={cn(
        'flex-none whitespace-nowrap rounded-sm px-1 text-xs font-semibold leading-4',
        telcoClass(name),
      )}
    >
      {name}
    </span>
  );
}

/** Chip trạng thái đơn — mỗi trạng thái một màu chữ (token --flow-*); dùng chung bảng + xem nhanh. */
export function FlowBadge({ flow }: { flow: OrderFlow }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center whitespace-nowrap rounded-sm px-1.5 text-xs font-semibold',
        orderFlowClass(flow),
      )}
    >
      {orderFlowLabel(flow)}
    </span>
  );
}
