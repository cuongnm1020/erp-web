'use client';

import Decimal from 'decimal.js';
import { Boxes, Copy, CornerDownRight, Gift, MoreHorizontal, Printer } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { CopyButton } from '@/components/data/copy-button';
import { PdfPrintDialog } from '@/components/data/pdf-print-dialog';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { NotFoundCard } from '@/components/layout/not-found-screen';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  formatQuantity,
  normalizePhone,
  phoneCarrier,
} from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { usePrint } from '@/lib/print';
import { useInvalidateOn } from '@/lib/realtime';
import { useHotkey } from '@/lib/use-hotkey';
import { useShipmentStatusLog } from '@/features/wms/api/use-shipping';
import { carrierOutcome, carrierSource, shipmentStatusBadge } from '@/features/wms/labels';
import {
  orderKeys,
  useCancelOrder,
  useDecideOrder,
  useOrder,
  useOrders,
  type SalesOrderDetail,
  type SalesOrderLine,
} from '../api/use-orders';
import {
  detailOrderFlow,
  fulfilmentLabel,
  fulfilmentTone,
  orderAddressLine,
  orderChannelLabel,
  orderSourceLabel,
  orderStatusLabel,
  orderStatusTone,
  manualDiscountNote,
} from '../labels';
import { groupOrderLines } from '../combo-lines';
import { OrderPrintSheet } from './order-print-sheet';
import { OrderProgress } from './order-progress';
import { TelcoBadge } from './order-quick-view';
import { ReprintWaybillDialog } from './bulk-reprint-waybill-dialog';
import { PancakeOrderLink } from './pancake-order-link';

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
 * - "Tạo phiếu xuất": chưa nối mutation. "Hủy đơn" đã nối POST /:id/cancel.
 * - "In phiếu đơn": in A5 qua trình duyệt với mã vạch docNumber (`OrderPrintSheet`,
 *   PLAN-barcode-pick-pack A3).
 * - Thẻ "Vận đơn": `order.shipment` (phiếu giao sinh khi pick xong) — hãng, mã vận đơn, lần in
 *   nhãn; "In nhãn" mở PDF `GET /shipments/:id/label` (PLAN-barcode-pick-pack C4).
 */
const LABEL_SIZES = ['A6', 'A5'] as const;
type LabelSize = (typeof LABEL_SIZES)[number];
const LABEL_SIZE_KEY = 'erp.label.pageSize';

function readLabelSize(): LabelSize {
  try {
    const v = window.localStorage.getItem(LABEL_SIZE_KEY);
    return v === 'A5' ? 'A5' : 'A6';
  } catch {
    return 'A6';
  }
}

const SHIPMENT_STATUS_LABEL: Record<
  SalesOrderDetail['shipment'] extends infer S
    ? S extends { status: infer T }
      ? T & string
      : never
    : never,
  string
> = {
  PENDING: 'Chờ lấy',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  OUT_FOR_DELIVERY: 'Đang giao hàng',
  DELIVERED: 'Thành công',
  FAILED: 'Giao lỗi',
  RETURNED: 'Sự cố hoàn',
  CARRIER_CANCELLED: 'Hãng hủy',
  CANCELLED: 'Đã hủy theo đơn',
};

/**
 * Hành trình từ hãng — mọi tín hiệu (webhook + đối soát) ghi ở `wms.CarrierStatusLog`, kể cả
 * mã không đổi trạng thái (shipper báo) và mã lệch pha: người chạy thử đơn thật nhìn thấy GHTK
 * gửi gì, lúc nào, hệ thống áp hay không. Nguồn: GET /shipments/:id/status-log (quyền
 * shipment.read — sale có sẵn theo seed).
 */
function CarrierTimeline({ shipmentId }: { shipmentId: string }) {
  const query = useShipmentStatusLog(shipmentId);
  return (
    <div className="border-t px-3 py-2">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">Hành trình từ hãng</p>
      {query.isPending ? (
        <p className="text-xs text-muted-foreground">Đang tải…</p>
      ) : query.isError ? (
        <p className="text-xs text-destructive">{messageFor(query.error)}</p>
      ) : query.data.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Chưa nhận tín hiệu nào từ hãng cho phiếu này — webhook về sẽ hiện ở đây.
        </p>
      ) : (
        <ol className="max-h-64 space-y-1.5 overflow-y-auto" aria-label="Hành trình từ hãng">
          {query.data.items.map((e) => {
            const o = carrierOutcome(e.outcome);
            const mapped = e.mappedStatus ? shipmentStatusBadge(e.mappedStatus) : null;
            return (
              <li key={e.id} className="rounded-md border p-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular-nums text-muted-foreground">
                    {formatDateTime(e.occurredAt ?? e.createdAt)}
                  </span>
                  <StatusBadge tone="neutral">{carrierSource(e.source)}</StatusBadge>
                  <span className="font-mono">{e.carrierStatusCode}</span>
                  {mapped ? <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge> : null}
                  <StatusBadge tone={o.tone}>{o.label}</StatusBadge>
                </div>
                {e.note ? <p className="mt-0.5 text-muted-foreground">{e.note}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Thẻ vận đơn — dữ liệu từ `order.shipment`; "In nhãn" nhúng PDF của hãng qua proxy /api. */
function ShipmentCard({ order, autoPrint }: { order: SalesOrderDetail; autoPrint?: boolean }) {
  const s = order.shipment;
  const [printing, setPrinting] = useState(false);
  const [size, setSize] = useState<LabelSize>('A6');
  const openPrint = () => {
    setSize(readLabelSize());
    setPrinting(true);
  };
  // ?printLabel=1 (về từ "Đã đóng gói" tay): mở nhãn in ngay khi phiếu đã có mã vận đơn — một
  // lần cho mỗi lần vào trang, đóng rồi không bật lại.
  const autoOpened = useRef(false);
  const trackingNo = s?.trackingNo ?? null;
  useEffect(() => {
    if (!autoPrint || !trackingNo || autoOpened.current) return;
    autoOpened.current = true;
    setSize(readLabelSize());
    setPrinting(true);
  }, [autoPrint, trackingNo]);
  const changeSize = (v: LabelSize) => {
    setSize(v);
    try {
      window.localStorage.setItem(LABEL_SIZE_KEY, v);
    } catch {
      // localStorage bị chặn — chỉ mất tiện ích nhớ khổ giấy
    }
  };
  return (
    <Card
      title={
        <span className="flex items-center justify-between gap-2">
          <span>Vận đơn</span>
          {s?.trackingNo ? (
            <Can I="pack" a="Shipment">
              <span className="flex items-center gap-2">
                {/* Tem ERP 100×75: ERP tự vẽ, không hỏi hãng — in được cả khi hãng đã lấy hàng. */}
                <ReprintWaybillDialog shipments={[s]} triggerLabel="In tem ERP" />
                {/* Nhãn PDF của hãng chỉ khi hãng chưa lấy hàng — sau đó hãng (GHTK) thường không
                    trả nhãn nữa (lỗi thật SO2610-00002, 2026-10-16). */}
                {s.status === 'PENDING' ? (
                  <Button variant="outline" size="sm" onClick={openPrint}>
                    <Printer aria-hidden />
                    In nhãn hãng
                  </Button>
                ) : null}
              </span>
            </Can>
          ) : null}
        </span>
      }
    >
      {s ? (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 py-3">
            <Field label="Phiếu giao">
              <span className="font-mono text-xs">{s.docNumber}</span>
            </Field>
            <Field label="Trạng thái giao">{SHIPMENT_STATUS_LABEL[s.status]}</Field>
            <Field label="Hãng trên phiếu">
              {s.carrierCode ? (
                <>
                  <span className="font-mono text-xs">{s.carrierCode}</span>
                  {s.carrierAccountName ? (
                    <span className="text-xs text-muted-foreground"> · {s.carrierAccountName}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">chưa gán — chọn khi đóng gói xong</span>
              )}
            </Field>
            <Field label="Mã vận đơn">
              {s.trackingNo ? (
                <span className="font-mono">{s.trackingNo}</span>
              ) : (
                <span className="text-muted-foreground">chưa cấp — cấp khi đóng gói xong</span>
              )}
            </Field>
            <Field label="Nhãn đã in">
              {s.labelPrintedAt
                ? `${s.labelPrintCount} lần · gần nhất ${formatDateTime(s.labelPrintedAt)}`
                : 'chưa in'}
            </Field>
          </dl>
          <CarrierTimeline shipmentId={s.id} />
        </>
      ) : (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          Chưa có phiếu giao — phiếu sinh khi kho pick xong đơn này.
        </p>
      )}
      {s && printing ? (
        <PdfPrintDialog
          open={printing}
          onOpenChange={setPrinting}
          url={`/api/shipments/${s.id}/label?pageSize=${size}&orientation=portrait`}
          title={`Nhãn vận đơn ${s.trackingNo ?? ''}`}
          description={`Phiếu giao ${s.docNumber} · hãng ${s.carrierCode ?? '—'}`}
          extra={
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Khổ</span>
              {LABEL_SIZES.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={v === size ? 'default' : 'outline'}
                  onClick={() => changeSize(v)}
                >
                  {v}
                </Button>
              ))}
            </div>
          }
        />
      ) : null}
    </Card>
  );
}

/** Một dòng SKU; `component` = dòng thành phần combo (thụt vào, giá đã phân bổ hiện mờ). */
/**
 * Món gõ tay trên Pancake (không gắn sản phẩm — 2026-10-22): chỉ hiển thị cho người đóng hàng tìm
 * theo tên; không giữ chỗ / trừ tồn nên hai cột kho để trống.
 */
function CustomItemRow({ c }: { c: SalesOrderDetail['customItems'][number] }) {
  const unit = c.unitPrice ? new Decimal(c.unitPrice).minus(c.discount || 0) : null;
  return (
    <TableRow data-testid="custom-item-row">
      <TableCell className="px-2.5 py-1.5 text-muted-foreground">—</TableCell>
      <TableCell className="px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5 font-semibold">
          {c.name}
          <StatusBadge tone="warn">Gõ tay trên Pancake</StatusBadge>
        </div>
        <div className="text-xs text-muted-foreground">Không trừ tồn — tự lấy hàng theo tên</div>
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-muted-foreground">—</TableCell>
      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{qty(c.qty)}</TableCell>
      <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
        {c.unitPrice ? money(c.unitPrice) : '—'}
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
        {unit ? money(unit.toString()) : '—'}
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
        {money(new Decimal(c.discount || 0).mul(c.qty || 1).toString())}
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
        {unit ? money(unit.mul(c.qty || 1).toString()) : '—'}
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">—</TableCell>
      <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">—</TableCell>
    </TableRow>
  );
}

function LineRow({ l, component = false }: { l: SalesOrderLine; component?: boolean }) {
  return (
    <TableRow data-testid={component ? 'combo-component-row' : undefined}>
      <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.lineNo}</TableCell>
      <TableCell className="px-2.5 py-1.5">
        <div
          className={
            component
              ? 'flex items-center gap-1.5 pl-4 text-muted-foreground'
              : 'flex items-center gap-1.5 font-semibold'
          }
        >
          {component ? <CornerDownRight className="h-3 w-3" aria-hidden /> : null}
          {l.skuName}
          {l.isGift ? (
            <StatusBadge tone="brand">
              <Gift className="h-3 w-3" aria-hidden />
              Hàng tặng
            </StatusBadge>
          ) : null}
        </div>
        <div
          className={
            component
              ? 'pl-8 font-mono text-xs text-muted-foreground'
              : 'font-mono text-xs text-muted-foreground'
          }
        >
          {l.skuCode}
          {component && l.combo ? ` · ${qty(l.combo.componentQty)} / combo` : ''}
        </div>
        {l.pancakeName && l.pancakeName !== l.skuName ? (
          <div
            className={
              component ? 'pl-8 text-xs text-muted-foreground' : 'text-xs text-muted-foreground'
            }
          >
            Trên Pancake: {l.pancakeName}
            {l.pancakeSkuCode ? ` · ${l.pancakeSkuCode}` : ''}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="px-2.5 py-1.5">{l.uomCode}</TableCell>
      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
        {qty(l.qty)}
        <div className="text-xs text-muted-foreground">{qty(l.qtyBase)} ĐVT cơ sở</div>
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
        {money(l.listPrice)}
      </TableCell>
      <TableCell
        className={
          component
            ? 'px-2.5 py-1.5 text-right tabular-nums text-muted-foreground'
            : 'px-2.5 py-1.5 text-right tabular-nums'
        }
      >
        {money(l.unitPrice)}
      </TableCell>
      <TableCell
        className={
          component
            ? 'px-2.5 py-1.5 text-right tabular-nums text-muted-foreground'
            : 'px-2.5 py-1.5 text-right tabular-nums'
        }
      >
        {money(l.discount)}
      </TableCell>
      <TableCell
        className={
          component
            ? 'px-2.5 py-1.5 text-right tabular-nums text-muted-foreground'
            : 'px-2.5 py-1.5 text-right font-semibold tabular-nums'
        }
      >
        {money(l.lineTotal)}
      </TableCell>
      {l.nonStock ? (
        // Món gõ tay Pancake (SKU một lần, 2026-10-22): không giữ chỗ / lấy hàng / trừ tồn.
        <TableCell colSpan={2} className="px-2.5 py-1.5 text-right text-xs text-muted-foreground">
          Gõ tay trên Pancake — không quản lý tồn
        </TableCell>
      ) : (
        <>
          <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-primary">
            {qty(l.reservedQty)}
          </TableCell>
          <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
            {qty(l.pickedQty)}
          </TableCell>
        </>
      )}
    </TableRow>
  );
}

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
    <section className={cn('rounded-lg border bg-card', className)}>
      <header className="flex min-h-card-header items-center border-b px-3.5 text-sm font-semibold">
        <div className="w-full">{title}</div>
      </header>
      {children}
    </section>
  );
}

/**
 * Đơn Chờ duyệt: lý do (tên quy tắc) + Duyệt / Từ chối cho đúng người duyệt (`approval.canAct` —
 * server quyết: trưởng nhóm team người tạo đơn với "Đơn giá dưới trần chiết khấu"). Từ chối → đơn
 * về Nháp.
 */
function ApprovalBar({
  order,
  approval,
}: {
  order: SalesOrderDetail;
  approval: NonNullable<SalesOrderDetail['approval']>;
}) {
  const decide = useDecideOrder(order.id);
  const [comment, setComment] = useState('');
  const act = (decision: 'approve' | 'reject') =>
    decide.mutate(
      { decision, requestId: approval.requestId, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setComment('');
          toast.success(decision === 'approve' ? 'Đã duyệt đơn' : 'Đã từ chối đơn', {
            description: order.docNumber,
          });
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm"
    >
      <span className="min-w-0 flex-1">
        <b className="font-semibold">Chờ duyệt</b>
        {approval.ruleName ? ` — ${approval.ruleName}` : ''}
        {approval.canAct ? '' : '. Chờ trưởng nhóm duyệt.'}
      </span>
      {approval.canAct ? (
        <>
          <Input
            aria-label="Ghi chú duyệt"
            placeholder="Ghi chú (tùy chọn)"
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            className="h-8 w-56"
          />
          <Button size="sm" disabled={decide.isPending} onClick={() => act('approve')}>
            Duyệt đơn
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={decide.isPending}
            onClick={() => act('reject')}
          >
            Từ chối
          </Button>
        </>
      ) : null}
    </div>
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
            {groupOrderLines(order.lines).map((g) =>
              g.kind === 'line' ? (
                <LineRow key={g.line.id} l={g.line} />
              ) : (
                /* Combo: một dòng tổng (giá combo × số combo) + các dòng thành phần thụt vào —
                   kho giữ / pick trên thành phần nên hai cột cuối chỉ có ở dòng thành phần. */
                <Fragment key={`combo-${g.groupNo}`}>
                  <TableRow className="bg-muted/40" data-testid="combo-row">
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground" />
                    <TableCell className="px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5 font-semibold">
                        {g.skuName}
                        <StatusBadge tone="brand">
                          <Boxes className="h-3 w-3" aria-hidden />
                          Combo
                        </StatusBadge>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{g.skuCode}</div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">combo</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {qty(g.qty)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {money(g.listPrice)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {money(g.unitPrice)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {money(g.discount)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                      {money(g.lineTotal)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5" />
                    <TableCell className="px-2.5 py-1.5" />
                  </TableRow>
                  {g.lines.map((l) => (
                    <LineRow key={l.id} l={l} component />
                  ))}
                </Fragment>
              ),
            )}
            {order.customItems.map((c, i) => (
              <CustomItemRow key={`custom-${i}`} c={c} />
            ))}
          </TableBody>
        </Table>
      </div>
      <OrderTotals order={order} />
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
      <DialogContent>
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

/** Hàng đã rời kho (đã đóng gói trở đi) → kho lập được phiếu nhập hàng hoàn (2026-10-02). */
const RETURNABLE_FULFILMENT: ReadonlySet<SalesOrderDetail['fulfilment']['status']> = new Set([
  'PACKED',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
]);

/** Tổng tiền cuối bảng dòng hàng — căn phải, dòng 0 đồng thì ẩn (trừ Tạm tính / Tổng). */
function OrderTotals({ order }: { order: SalesOrderDetail }) {
  const nonZero = (v: string) => !new Decimal(v || 0).isZero();
  const prepaid = new Decimal(order.prepaidAmount || 0);
  const cod = Decimal.max(new Decimal(order.total).minus(prepaid), 0).toFixed();
  const manual = manualDiscountNote(order);
  const Row = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <>
      <dt className="text-muted-foreground">
        {label}
        {hint ? <span className="block text-xs text-subtle-foreground">{hint}</span> : null}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </>
  );
  return (
    <div className="flex justify-end border-t px-3.5 py-3">
      <dl className="grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-right text-sm">
        <Row label="Tạm tính" value={money(order.subtotal)} />
        {nonZero(order.discount) ? (
          <Row label="Chiết khấu" value={`−${money(order.discount)}`} hint={manual ?? undefined} />
        ) : null}
        {nonZero(order.taxAmount) ? <Row label="Thuế" value={money(order.taxAmount)} /> : null}
        <Row
          label="Phí ship thu khách"
          value={order.freeShipping ? 'Miễn phí' : money(order.shippingFee)}
          hint={order.shipFeeOnReturnOnly ? 'chỉ thu nếu hoàn' : undefined}
        />
        {nonZero(order.surcharge) ? <Row label="Phụ thu" value={money(order.surcharge)} /> : null}
        <dt className="border-t pt-1.5 font-semibold">Tổng cộng</dt>
        <dd className="border-t pt-1.5 font-semibold tabular-nums">{money(order.total)}</dd>
        {!prepaid.isZero() ? (
          <Row label="Đã chuyển khoản" value={`−${money(prepaid.toFixed())}`} />
        ) : null}
        <dt className="text-base font-semibold">Thu hộ (COD)</dt>
        <dd className="text-base font-semibold tabular-nums text-primary">{formatMoney(cod)}</dd>
      </dl>
    </div>
  );
}

/**
 * Danh sách nhãn – giá trị của cột Hồ sơ 320px: nhãn `caption` nằm trên giá trị (cột hẹp không đủ
 * chỗ cho nhãn `detail-label-width` 140px bên cạnh — SĐT + nhà mạng bị bẻ dòng).
 */
function ProfileList({ children }: { children: ReactNode }) {
  return <dl className="grid gap-y-2.5 px-3.5 py-3 text-sm">{children}</dl>;
}

function ProfileItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/**
 * Redesign Bán hàng 2026-10-22 (canvas "Redesign Bán hàng", màn 4, đã duyệt): PageHeader ≤ 3 nút
 * + "⋯" (In phiếu đơn · Nhân bản đơn [D] · ⋯ · Sửa đơn [E]); thanh tiến độ; cột trái 320px
 * khách / giao hàng / phân công / ghi chú; cột phải dòng hàng + tổng tiền + vận đơn. Bỏ dải 4 ô
 * tổng tiền và thẻ "Chưa nối được". Tên NV + giờ từng bước: `ownerName…` / `timeline` (API 2026-10-22).
 */
function Detail({ order }: { order: SalesOrderDetail }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'cancel' | 'recreate' | null>(null);
  const printer = usePrint();
  const ability = useAbility();
  const autoPrint = useSearchParams().get('printLabel') === '1';
  const live = order.status !== 'CANCELLED';
  const canEdit = live && ability.can('update', 'SalesOrder');
  const canCreate = ability.can('create', 'SalesOrder');
  const canCancel = live && ability.can('cancel', 'SalesOrder');
  const canRecreate = canCancel && canCreate;
  const canReturn =
    RETURNABLE_FULFILMENT.has(order.fulfilment.status) && ability.can('receive', 'Stock');
  const flow = detailOrderFlow(order.status, order.fulfilment.status);
  const addr = order.shippingAddress;
  const phone = addr?.phone ? (normalizePhone(addr.phone) ?? addr.phone) : null;
  const telco = phoneCarrier(addr?.phone ?? null);

  useHotkey('e', () => router.push(`/crm/orders/${order.id}/edit`), { enabled: canEdit });
  useHotkey('d', () => router.push(`/crm/orders/new?from=${order.id}`), { enabled: canCreate });

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Bán hàng' },
          { label: 'Đơn hàng', href: '/crm/orders' },
          { label: order.docNumber },
        ]}
        title={`Đơn ${order.docNumber}`}
        status={
          <>
            <CopyButton value={order.docNumber} label="mã đơn" />
            <StatusBadge tone={orderStatusTone(order.status)}>
              {orderStatusLabel(order.status)}
            </StatusBadge>
            {live ? (
              <StatusBadge tone={fulfilmentTone(order.fulfilment.status)}>
                {fulfilmentLabel(order.fulfilment.status)}
              </StatusBadge>
            ) : null}
          </>
        }
        description={
          <>
            Đặt {formatDate(order.orderDate)} · {orderChannelLabel(order.channel)}
            {order.source ? ` · nguồn ${orderSourceLabel(order.source)}` : ''}
            {order.pancakeOrderId ? (
              <>
                {' '}
                · <PancakeOrderLink orderId={order.pancakeOrderId} link={order.pancakeOrderLink} />
              </>
            ) : null}
            {order.ownerName ? (
              <>
                {' '}
                · NV phụ trách <b className="font-semibold text-foreground">{order.ownerName}</b>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={printer.print}>
              <Printer aria-hidden />
              In phiếu đơn
            </Button>
            {canCreate ? (
              <Button variant="outline" asChild shortcut="D">
                <Link href={`/crm/orders/new?from=${order.id}`}>
                  <Copy aria-hidden />
                  Nhân bản đơn
                </Link>
              </Button>
            ) : null}
            {canRecreate || canReturn || canCancel ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Thao tác khác">
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canRecreate ? (
                    <DropdownMenuItem onSelect={() => setDialog('recreate')}>
                      Sửa (hủy &amp; tạo lại)
                    </DropdownMenuItem>
                  ) : null}
                  {canReturn ? (
                    <DropdownMenuItem asChild>
                      <Link href={`/wms/returns/new?orderId=${order.id}`}>Nhập hàng hoàn</Link>
                    </DropdownMenuItem>
                  ) : null}
                  {canCancel ? (
                    <>
                      {canRecreate || canReturn ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem danger onSelect={() => setDialog('cancel')}>
                        Hủy đơn…
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {canEdit ? (
              <Button asChild shortcut="E">
                <Link href={`/crm/orders/${order.id}/edit`}>Sửa đơn</Link>
              </Button>
            ) : null}
          </>
        }
      />
      {order.status === 'PENDING_APPROVAL' && order.approval ? (
        <ApprovalBar order={order} approval={order.approval} />
      ) : null}
      <OrderPrintSheet order={order} printer={printer} />
      <CancelOrderDialog
        order={order}
        open={dialog !== null}
        recreate={dialog === 'recreate'}
        onOpenChange={(o) => setDialog(o ? dialog : null)}
      />

      {flow && flow !== 'CANCELLED' && flow !== 'RETURNED' && flow !== 'CARRIER_CANCELLED' ? (
        <section className="rounded-lg border bg-card px-4 py-3" aria-label="Tiến độ">
          <OrderProgress flow={flow} timeline={order.timeline} />
        </section>
      ) : null}

      <div className="flex flex-col items-start gap-3 lg:flex-row">
        <div className="flex w-full min-w-0 flex-col gap-3 lg:w-detail-aside lg:flex-none">
          <Card title="Khách & giao hàng">
            <ProfileList>
              <ProfileItem label="Khách hàng">
                {/* Kho mở đơn bằng sales_order.read_all nhưng không có customer.read → link
                    sẽ 404; hiện chữ thường thay vì dẫn vào ngõ cụt. */}
                {ability.can('read', 'Customer') ? (
                  <Link
                    href={`/crm/customers/${order.customer.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {order.customer.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{order.customer.name}</span>
                )}
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {order.customer.code}
                </span>
              </ProfileItem>
              {phone ? (
                <ProfileItem label="Điện thoại">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{formatPhone(addr?.phone ?? null)}</span>
                    {telco ? <TelcoBadge name={telco} /> : null}
                    <CopyButton value={phone} label="số điện thoại" />
                  </span>
                </ProfileItem>
              ) : null}
              <ProfileItem label="Giao tới">
                {addr ? (
                  <>
                    {addr.recipient ? (
                      <span className="block font-semibold">{addr.recipient}</span>
                    ) : null}
                    {orderAddressLine(addr)}
                    {addr.source === 'CUSTOMER_DEFAULT' ? (
                      <span className="block text-xs text-muted-foreground">
                        địa chỉ mặc định của khách
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Chưa có — thêm địa chỉ ở hồ sơ khách
                  </span>
                )}
              </ProfileItem>
              {order.expectedDeliveryDate ? (
                <ProfileItem label="Hẹn nhận">
                  {formatDate(`${order.expectedDeliveryDate}T00:00:00Z`)}
                </ProfileItem>
              ) : null}
              <ProfileItem label="Kho lấy hàng">
                {order.warehouse ? (
                  <>
                    {order.warehouse.name}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      {order.warehouse.code}
                    </span>
                  </>
                ) : (
                  <span className="text-warning">Chưa chọn kho</span>
                )}
              </ProfileItem>
              <ProfileItem label="Hãng vận chuyển">
                {order.carrier ? (
                  <>
                    {order.carrier.name}
                    <span className="block text-xs text-muted-foreground">
                      tài khoản {order.carrierAccount?.name ?? 'mặc định'}
                    </span>
                  </>
                ) : (
                  <span className="text-warning">Chưa gán hãng</span>
                )}
              </ProfileItem>
            </ProfileList>
          </Card>

          <Card title="Phân công & ghi chú">
            <ProfileList>
              <ProfileItem label="NV phụ trách">
                {order.ownerName ??
                  (order.ownerId ? (
                    'Đã có người phụ trách'
                  ) : (
                    <span className="text-muted-foreground">Đơn của team, chưa chia</span>
                  ))}
              </ProfileItem>
              {order.careStaffName ? (
                <ProfileItem label="NV chăm sóc">{order.careStaffName}</ProfileItem>
              ) : null}
              {order.packerName ? (
                <ProfileItem label="NV đóng hàng">{order.packerName}</ProfileItem>
              ) : null}
              {order.marketerName ? (
                <ProfileItem label="Marketer">{order.marketerName}</ProfileItem>
              ) : null}
              {order.tags.length > 0 ? (
                <ProfileItem label="Thẻ">
                  <span className="flex flex-wrap gap-1">
                    {order.tags.map((t) => (
                      <span key={t.id} className="rounded-chip bg-muted px-2 text-xs">
                        {t.name}
                      </span>
                    ))}
                  </span>
                </ProfileItem>
              ) : null}
              <ProfileItem label="Ghi chú nội bộ">
                {order.internalNote ? (
                  <span className="whitespace-pre-line">{order.internalNote}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </ProfileItem>
              <ProfileItem label="In vận đơn">
                {order.printNote ? (
                  <span className="whitespace-pre-line">{order.printNote}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </ProfileItem>
              {order.attachments.length > 0 ? (
                <ProfileItem label={`Đính kèm (${order.attachments.length})`}>
                  <span className="flex flex-col gap-0.5">
                    {order.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary hover:underline"
                      >
                        {a.fileName}
                      </a>
                    ))}
                  </span>
                </ProfileItem>
              ) : null}
            </ProfileList>
          </Card>

          <Card title="Chứng từ">
            <ProfileList>
              <ProfileItem label="Tạo lúc">
                {formatDateTime(order.createdAt)}
                {order.createdByName ? (
                  <span className="text-muted-foreground"> · {order.createdByName}</span>
                ) : null}
              </ProfileItem>
              <ProfileItem label="Cập nhật">{formatDateTime(order.updatedAt)}</ProfileItem>
              {order.postedAt ? (
                <ProfileItem label="Đã chốt lúc">{formatDateTime(order.postedAt)}</ProfileItem>
              ) : null}
            </ProfileList>
          </Card>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <Lines order={order} />
          <ShipmentCard order={order} autoPrint={autoPrint} />
        </div>
      </div>
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
      {/* Có dữ liệu thì PageHeader của Detail vẽ breadcrumb (dính khi cuộn). */}
      {query.data ? null : (
        <Breadcrumb
          items={[
            { label: 'Bán hàng' },
            { label: 'Đơn hàng', href: '/crm/orders' },
            { label: 'Chi tiết' },
          ]}
        />
      )}
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
