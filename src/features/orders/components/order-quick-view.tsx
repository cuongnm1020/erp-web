'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { messageFor } from '@/lib/error-messages';
import {
  formatDateTime,
  formatMoney,
  formatPhone,
  formatQuantity,
  phoneCarrier,
} from '@/lib/format';
import { useShipmentStatusLog } from '@/features/wms/api/use-shipping';
import { shipmentStatusBadge } from '@/features/wms/labels';
import { cn } from '@/lib/cn';
import { useOrder, type OrderFlow, type SalesOrderListItem } from '../api/use-orders';
import { orderFlowClass, orderFlowLabel, telcoClass } from '../labels';

/**
 * Xem nhanh một đơn từ danh sách (khung bên phải) — người nhận, sản phẩm, tiền, vận chuyển,
 * hành trình hãng — không rời danh sách. Chi tiết đơn từ GET /sales-orders/:id; hành trình từ
 * GET /shipments/:id/status-log (chỉ các mốc đổi trạng thái). Tiền trên dòng danh sách (thực
 * thu ĐVVC) lấy từ `row` để khớp đúng con số người dùng vừa thấy ở bảng.
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
        <DialogOverlay className="bg-black/20" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-lg focus:outline-none"
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
  const shipmentId = detail.data?.shipment?.id ?? '';
  const telco = phoneCarrier(row.phone);
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <DialogPrimitive.Title className="font-mono text-base font-semibold">
              {row.docNumber}
            </DialogPrimitive.Title>
            <FlowBadge flow={row.flow} />
          </div>
          <p className="text-xs text-muted-foreground">
            {row.pancakeOrderId ? `Pancake #${row.pancakeOrderId}` : 'Tạo trong ERP'} · tạo{' '}
            {formatDateTime(row.createdAt)}
            {row.ownerName ? ` · ${row.ownerName}` : ''}
          </p>
        </div>
        <DialogPrimitive.Close asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Đóng xem nhanh">
            <X aria-hidden />
          </Button>
        </DialogPrimitive.Close>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
        <Section title="Người nhận">
          <p className="font-semibold">{row.recipientName ?? row.customer.name}</p>
          <p className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-mono">{formatPhone(row.phone)}</span>
            {telco ? <TelcoBadge name={telco} /> : null}
          </p>
          <p className="text-muted-foreground">
            {[row.addressLine, row.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ giao'}
          </p>
        </Section>

        <Section title="Sản phẩm">
          {detail.isPending ? (
            <p className="text-xs text-muted-foreground">Đang tải…</p>
          ) : detail.isError ? (
            <p className="text-xs text-destructive">{messageFor(detail.error)}</p>
          ) : (
            <ul className="space-y-1.5">
              {detail.data.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span>
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
          <dl className="mt-2 space-y-1 border-t border-dashed pt-2 tabular-nums">
            <Money label="Phí ship thu khách" value={formatMoney(row.shippingFee, { unit: '' })} />
            <Money label="Tổng tiền" value={formatMoney(row.total, { unit: '' })} strong />
            <Money
              label="Thực thu từ ĐVVC (ước tính)"
              value={
                row.shipment?.collectedAmount
                  ? formatMoney(row.shipment.collectedAmount, { unit: '' })
                  : '—'
              }
            />
          </dl>
        </Section>

        <Section title="Vận chuyển">
          {row.shipment ? (
            <>
              <p>
                <span className="font-semibold">
                  {row.shipment.carrierName ?? row.shipment.carrierCode ?? 'Chưa gán hãng'}
                </span>
                {row.shipment.trackingNo ? (
                  <span className="font-mono"> · {row.shipment.trackingNo}</span>
                ) : null}
              </p>
              {shipmentId ? <Journey shipmentId={shipmentId} /> : null}
            </>
          ) : (
            <p className="text-muted-foreground">Kho chưa tạo phiếu giao cho đơn này.</p>
          )}
        </Section>

        <Section title="Ghi chú">
          <p className="text-muted-foreground">{row.note ?? 'Không có ghi chú.'}</p>
        </Section>
      </div>

      <div className="flex gap-2 border-t px-5 py-3">
        <Button asChild size="sm">
          <Link href={`/crm/orders/${row.id}`}>Mở đơn đầy đủ</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/crm/orders/${row.id}/edit`}>Sửa đơn</Link>
        </Button>
      </div>
    </>
  );
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
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
