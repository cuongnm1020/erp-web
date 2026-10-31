'use client';

import {
  Boxes,
  CornerDownRight,
  Gift,
  Lock,
  Pencil,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWatch } from 'react-hook-form';
import { CopyButton } from '@/components/data/copy-button';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { NotFoundCard } from '@/components/layout/not-found-screen';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { formatDate, formatDateTime, formatMoney, formatQuantity, toDecimal } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useCarriers } from '@/features/wms/api/use-shipping';
import { CarrierSelect } from '@/features/wms/components/carrier-select';
import { useCustomerBrief } from '../api/use-line-entry';
import {
  useFulfilOrder,
  useOrder,
  usePickupWarehouses,
  useShippingQuote,
  useMoveOrdersWarehouse,
  useReplaceOrderLines,
  useRequestWaybill,
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
  orderSourceLabel,
  orderStatusLabel,
  orderStatusTone,
  type FulfilTarget,
  manualDiscountNote,
} from '../labels';
import { CarrierStatusCard } from './carrier-status-card';
import { MarketplaceBadge, waybillErrorText } from './waybill-error';
import { CART_GRID } from './order-create/cart-line';
import { DENSE } from './order-create/order-draft-form';
import { Card } from './order-create/order-side-cards';
import { OrderTagsField } from './order-tags-field';
import { OrderEditHistory } from './order-edit-history';
import { linesChange, OrderEditLines, useOrderLinesForm } from './order-edit-lines';
import { normalizePhoneInput } from '../schema';

/**
 * D-05 Sửa đơn — trang riêng (không popup), bố cục chép màn tạo đơn (user yêu cầu 2026-10-22):
 * dùng chung Card / lưới giỏ / mật độ 32px của `order-create/`, khối Lưu dính đáy cột phải.
 *
 * Sửa được tại chỗ (PATCH /sales-orders/{id}, quyền `sales_order.update`):
 *   - Trạng thái: chỉ các đích server cho phép sửa tay VÀ người dùng có quyền tương ứng
 *     (`manualStatusTargets` chép đúng state machine backend — ghi chú D-05).
 *   - Hãng vận chuyển: tới khi đơn kết thúc (POSTED / CANCELLED).
 *   - Sản phẩm (2026-10-29): thêm / bỏ / đổi SL, đơn giá — PUT /sales-orders/{id}/lines, tới khi
 *     kho bắt đầu lấy hàng (`linesLockedReason` của server). Người nhận gõ tay → địa chỉ mới của khách.
 *   - Chỉ người tạo đơn / NV xử lý / trưởng nhóm của họ sửa được (`order.canEdit`); người khác chỉ
 *     đổi trạng thái theo quyền duyệt / hủy. Mỗi lần lưu ghi "Lịch sử sửa đơn".
 * Khách, thanh toán vẫn chỉ đọc.
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

/** Ô vừa đổi chưa lưu: viền + nền `warning` (design system — Ma trận chọn / form). */
const DIRTY = 'border-warning bg-warning-weak';
/** "Tài khoản mặc định của hãng" (Radix Select không nhận value rỗng). */
const DEFAULT_ACCOUNT = '__default__';

/** `YYYY-MM-DD` → "01/11/2026". */
const formatYmd = (ymd: string) => formatDate(`${ymd}T00:00:00Z`);

/** Tên trường trong `changed` của PATCH → chữ trên toast "Đã lưu thay đổi". */
function changedLabel(c: string): string {
  switch (c) {
    case 'addressId':
      return 'địa chỉ giao';
    case 'shippingWeightKg':
      return 'cân nặng gửi hãng';
    case 'carrierAccountId':
      return 'tài khoản hãng';
    case 'internalNote':
      return 'ghi chú nội bộ';
    case 'printNote':
      return 'ghi chú in vận đơn';
    case 'tagIds':
      return 'thẻ';
    case 'expectedDeliveryDate':
      return 'ngày hẹn nhận';
    case 'warehouseId':
      return 'kho lấy hàng';
    case 'recipientPhone':
      return 'SĐT người nhận';
    case 'lines':
      return 'sản phẩm';
    default:
      return 'hãng vận chuyển';
  }
}

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
  const replaceLines = useReplaceOrderLines(order.id);
  const linesForm = useOrderLinesForm(order);
  const watchedLines = useWatch({ control: linesForm.control, name: 'lines' });
  const lineEdit = order.linesLockedReason
    ? { body: null, invalid: false }
    : linesChange(order, watchedLines ?? []);
  const linesChanged = lineEdit.body !== null;
  const moveWarehouse = useMoveOrdersWarehouse();
  const carriers = useCarriers();
  const warehouses = usePickupWarehouses();

  const [status, setStatus] = useState<SalesOrderStatus>(order.status);
  const [carrierId, setCarrierId] = useState<string>(order.carrierId ?? NO_CARRIER);
  const [warehouseId, setWarehouseId] = useState<string>(order.warehouseId ?? NO_WAREHOUSE);
  const [addressId, setAddressId] = useState<string>(order.addressId ?? NO_ADDRESS);
  // Sửa người nhận gõ tay (2026-10-29) → server lưu thành địa chỉ mới của khách rồi gắn đơn.
  const [receiver, setReceiver] = useState<ReceiverDraft | null>(null);
  // Danh sách địa chỉ của khách chỉ tải được khi có customer.read (kho mở đơn bằng read_all
  // thì không) — khi đó chỉ hiện địa chỉ hiệu lực server trả, không có ô chọn.
  const canReadCustomer = ability.can('read', 'Customer');
  const customer = useCustomerBrief(canReadCustomer ? order.customer.id : '');
  const addresses = customer.data?.addresses ?? [];
  // Cân nặng gửi hãng: ô trống = dùng cân nặng tính từ dòng (server: shippingWeightKg null).
  const [weightKg, setWeightKg] = useState<string>(order.shippingWeightKg ?? '');
  // Ghi chú / thẻ / hẹn nhận / tài khoản hãng — PATCH nhận từ 2026-10-22 (đơn chưa kết thúc).
  const [internalNote, setInternalNote] = useState(order.internalNote ?? '');
  const [printNote, setPrintNote] = useState(order.printNote ?? '');
  const [tagIds, setTagIds] = useState<string[]>(() => order.tags.map((t) => t.id));
  const [expectedDate, setExpectedDate] = useState(order.expectedDeliveryDate ?? '');
  const [accountId, setAccountId] = useState<string>(order.carrierAccountId ?? DEFAULT_ACCOUNT);
  // SĐT người nhận riêng cho đơn (2026-10-28) — đơn sàn SĐT bị che: nhập số thật rồi xin lại vận đơn.
  const [recipientPhone, setRecipientPhone] = useState(order.recipientPhone ?? '');
  const canPack = ability.can('pack', 'Shipment');
  const requestWaybill = useRequestWaybill();
  /** Bấm "Lưu và xin lại vận đơn": lưu xong thì xin lại vận đơn trước khi rời màn. */
  const retryAfterSave = useRef(false);
  const waybillError = order.shipment?.waybillErrorCode ? order.shipment : null;
  // "Trạng thái kho" đặt tay (2026-09-15): đóng pick / đóng gói KHÔNG quét — quyền riêng
  // sales_order.fulfil_manual (kho + admin), chỉ đơn ĐÃ DUYỆT; đích chép từ bảng của server.
  const fulfil = useFulfilOrder(order.id);
  const [fulfilTarget, setFulfilTarget] = useState<FulfilTarget | ''>('');
  const canFulfil = ability.can('fulfil_manual', 'SalesOrder');
  const fulfilTargets =
    canFulfil && order.status === 'APPROVED' ? manualFulfilTargets(order.fulfilment.status) : [];
  const [reason, setReason] = useState('');

  const targets = manualStatusTargets(order.status, (a) => ability.can(a, 'SalesOrder'));
  // Chỉ người tạo đơn / NV xử lý / trưởng nhóm của họ sửa được các ô (server: order.canEdit).
  const carrierEditable = canUpdate && orderEditable(order.status) && order.canEdit;
  // Hãng vận chuyển chỉ kho / admin chọn (2026-10-31) — sale / CSKH chỉ xem hãng đã gán.
  const canChooseCarrier = ability.can('send_carrier', 'SalesOrder');
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
  const receiverBody = receiver ? receiverAddress(receiver) : null;
  const receiverInvalid = receiver !== null && receiverBody === null;
  const receiverChanged =
    receiverBody !== null && !sameReceiver(receiverBody, order.shippingAddress);
  const addressChanged = !receiver && nextAddress !== (order.addressId ?? null);
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
  const trimOrNull = (v: string) => (v.trim() === '' ? null : v.trim());
  const internalChanged = trimOrNull(internalNote) !== (order.internalNote ?? null);
  const printChanged = trimOrNull(printNote) !== (order.printNote ?? null);
  const recipientPhoneChanged = trimOrNull(recipientPhone) !== (order.recipientPhone ?? null);
  const originalTags = order.tags.map((t) => t.id);
  const tagsChanged =
    tagIds.length !== originalTags.length || tagIds.some((t) => !originalTags.includes(t));
  const dateChanged = (expectedDate || null) !== (order.expectedDeliveryDate ?? null);
  const nextAccount = accountId === DEFAULT_ACCOUNT ? null : accountId;
  // Đổi hãng → server tự về tài khoản mặc định; chỉ gửi tài khoản khi người dùng chọn khác đi.
  const accountChanged = carrierChanged
    ? nextAccount !== null
    : nextAccount !== (order.carrierAccountId ?? null);
  const extrasChanged =
    internalChanged ||
    printChanged ||
    tagsChanged ||
    dateChanged ||
    accountChanged ||
    recipientPhoneChanged;
  const patchFieldsDirty =
    statusChanged || carrierChanged || addressChanged || weightChanged || extrasChanged;
  const patchFieldsDirtyAll = patchFieldsDirty || receiverChanged;
  const patchDirty = patchFieldsDirtyAll || moveTo !== null || linesChanged;
  const carrierAccounts = selectedCarrier?.accounts ?? [];

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

  /** Xin lại vận đơn cho phiếu lỗi (tab Lỗi vận đơn) rồi về chi tiết đơn. */
  const runRetryWaybill = () => {
    retryAfterSave.current = false;
    if (!waybillError?.carrierCode) return;
    requestWaybill.mutate(
      { shipmentId: waybillError.id, carrierCode: waybillError.carrierCode },
      {
        onSuccess: (r) => {
          if (r.outcome === 'QUEUED') {
            toast.warning('Hãng chưa phản hồi — hệ thống tự xin lại vận đơn.');
          } else {
            toast.success(`Đã cấp vận đơn ${r.trackingNo ?? ''}`, {
              description: `${order.docNumber} · rời tab Lỗi vận đơn`,
            });
          }
          router.push(r.trackingNo ? `${detailHref}?printLabel=1` : detailHref);
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  const save = () => {
    if (update.isPending || fulfil.isPending || moveWarehouse.isPending) return;
    if (requestWaybill.isPending || replaceLines.isPending) return;
    if (lineEdit.invalid) {
      toast.error('Kiểm tra lại sản phẩm: đơn cần ít nhất một dòng, số lượng lớn hơn 0');
      return;
    }
    if (receiverInvalid) {
      toast.error('Người nhận cần đủ tên, SĐT (10 số), địa chỉ và tỉnh/thành');
      return;
    }
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
      if (retryAfterSave.current) {
        runRetryWaybill();
        return;
      }
      if (fulfilTarget) {
        runFulfil(fulfilTarget);
        return;
      }
      toast.info('Không có gì thay đổi');
      router.push(detailHref);
      return;
    }
    if (!canUpdate) return;
    // Sản phẩm lưu TRƯỚC (giữ chỗ + PICK lại), rồi mới chuyển kho / PATCH các ô còn lại.
    if (lineEdit.body) {
      replaceLines.mutate(lineEdit.body, {
        onSuccess: (r) => {
          if (moveTo || patchFieldsDirtyAll) saveRest();
          else {
            toast.success('Đã lưu thay đổi', {
              description: `${order.docNumber} · sản phẩm, tổng tiền ${formatMoney(r.total)}`,
            });
            if (fulfilTarget) runFulfil(fulfilTarget);
            else router.push(detailHref);
          }
        },
        onError: (err) => toast.error(messageFor(err)),
      });
      return;
    }
    saveRest();
  };

  const saveRest = () => {
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
            if (patchFieldsDirtyAll) patch();
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
        ...(receiverChanged && receiverBody ? { address: receiverBody } : {}),
        ...(weightChanged ? { shippingWeightKg: nextWeight } : {}),
        ...(accountChanged ? { carrierAccountId: nextAccount } : {}),
        ...(internalChanged ? { internalNote: trimOrNull(internalNote) } : {}),
        ...(printChanged ? { printNote: trimOrNull(printNote) } : {}),
        ...(recipientPhoneChanged ? { recipientPhone: trimOrNull(recipientPhone) } : {}),
        ...(tagsChanged ? { tagIds } : {}),
        ...(dateChanged ? { expectedDeliveryDate: expectedDate || null } : {}),
        ...(statusChanged && status === 'CANCELLED' && reason.trim()
          ? { reason: reason.trim() }
          : {}),
      },
      {
        onSuccess: (r) => {
          toast.success('Đã lưu thay đổi', {
            description: `${order.docNumber} · ${r.changed
              .map((c) =>
                c === 'status' ? `trạng thái → ${orderStatusLabel(r.status)}` : changedLabel(c),
              )
              .join(', ')}`,
          });
          if (retryAfterSave.current) runRetryWaybill();
          else if (fulfilTarget) runFulfil(fulfilTarget);
          else router.push(detailHref);
        },
        onError: (err) => {
          retryAfterSave.current = false;
          // 422 path recipientPhone: màn không có form để tô ô → nói thẳng ô nào sai.
          if (
            isApiError(err) &&
            err.status === 422 &&
            JSON.stringify(err.details ?? '').includes('recipientPhone')
          ) {
            toast.error('SĐT người nhận không hợp lệ — nhập đủ 10 số, không có dấu *.');
            return;
          }
          toast.error(messageFor(err));
        },
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
      : !order.canEdit && orderEditable(order.status) && !statusEditable
        ? 'Đơn của người khác — chỉ người tạo đơn, NV xử lý hoặc trưởng nhóm / leader của họ được sửa.'
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
    ...(linesChanged
      ? [
          {
            label: 'Sản phẩm',
            from: `${collapsedCount(order)} dòng`,
            to: `${watchedLines.length} dòng`,
          },
        ]
      : []),
    ...(addressChanged ? [{ label: 'Địa chỉ giao', from: 'địa chỉ cũ', to: 'địa chỉ mới' }] : []),
    ...(receiverChanged && receiverBody
      ? [
          {
            label: 'Người nhận',
            from: order.shippingAddress?.recipient ?? 'chưa có',
            to: `${receiverBody.recipient} · ${receiverBody.phone}`,
          },
        ]
      : []),
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
    ...(accountChanged
      ? [
          {
            label: 'Tài khoản hãng',
            from: order.carrierAccount?.name ?? 'Mặc định',
            to: carrierAccounts.find((a) => a.id === nextAccount)?.name ?? 'Mặc định',
          },
        ]
      : []),
    ...(dateChanged
      ? [
          {
            label: 'Hẹn nhận',
            from: order.expectedDeliveryDate ? formatYmd(order.expectedDeliveryDate) : 'Chưa đặt',
            to: expectedDate ? formatYmd(expectedDate) : 'Bỏ hẹn',
          },
        ]
      : []),
    ...(internalChanged ? [{ label: 'Ghi chú nội bộ', from: 'cũ', to: 'mới' }] : []),
    ...(printChanged ? [{ label: 'Ghi chú in vận đơn', from: 'cũ', to: 'mới' }] : []),
    ...(recipientPhoneChanged
      ? [
          {
            label: 'SĐT người nhận',
            from: order.recipientPhone ?? 'theo địa chỉ',
            to: trimOrNull(recipientPhone) ?? 'theo địa chỉ',
          },
        ]
      : []),
    ...(tagsChanged
      ? [
          {
            label: 'Thẻ',
            from: `${originalTags.length} thẻ`,
            to: `${tagIds.length} thẻ`,
          },
        ]
      : []),
  ];
  const saving =
    update.isPending ||
    fulfil.isPending ||
    moveWarehouse.isPending ||
    requestWaybill.isPending ||
    replaceLines.isPending;
  // Ô SĐT riêng còn trống mà SĐT hiệu lực bị che → tô đỏ, hãng sẽ từ chối.
  const phoneStillMasked = order.recipientPhoneMasked && trimOrNull(recipientPhone) === null;
  const prepaid = new Decimal(order.prepaidAmount || 0);
  const cod = Decimal.max(new Decimal(order.total).minus(prepaid), 0).toFixed(4);
  const nonZero = (v: string) => !(toDecimal(v)?.isZero() ?? true);
  const lineWeight = toDecimal(order.lineWeightKg);

  return (
    <div className={cn('flex flex-col gap-3', DENSE)}>
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
        breadcrumb={[
          { label: 'Bán hàng' },
          { label: 'Đơn hàng', href: '/crm/orders' },
          { label: order.docNumber, href: detailHref },
          { label: 'Sửa' },
        ]}
      />

      {readOnlyReason ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm"
        >
          <Lock className="h-3.5 w-3.5 text-warning" aria-hidden />
          {readOnlyReason}
        </div>
      ) : canUpdate && !order.canEdit && orderEditable(order.status) ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm"
        >
          <Lock className="h-3.5 w-3.5 text-warning" aria-hidden />
          Đơn của người khác — chỉ đổi được trạng thái. Sản phẩm, người nhận, vận chuyển, ghi chú do
          người tạo đơn, NV xử lý hoặc trưởng nhóm / leader của họ sửa.
        </div>
      ) : null}

      {/* Bố cục chép màn tạo đơn (user yêu cầu 2026-10-22): trái = Thông tin đơn + Sản phẩm + Giá
          trị đơn + Thanh toán + Ghi chú; phải = Khách hàng + Nhận hàng + Vận chuyển + Giờ tạo đơn +
          khối Lưu dính đáy. Ô PATCH chưa nhận (khách, dòng hàng, giá, tiền) hiện chỉ đọc. */}
      <div className="flex flex-wrap items-start gap-3">
        {/* ── Cột trái ── */}
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
          <Card title="Thông tin đơn" className="py-2.5">
            {/* Ô sửa được: Trạng thái đơn · Trạng thái kho · Kho xuất một hàng, Thẻ dưới (user 2026-10-22). */}
            <div className="grid gap-x-2.5 gap-y-2 sm:grid-cols-3">
              <HeaderField label="Trạng thái đơn">
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
              </HeaderField>
              <HeaderField label="Trạng thái kho">
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
                  <span className="flex h-8 items-center">
                    <StatusBadge tone={fulfilmentTone(order.fulfilment.status)}>
                      {fulfilmentLabel(order.fulfilment.status)}
                    </StatusBadge>
                  </span>
                )}
              </HeaderField>
              <HeaderField label="Kho xuất">
                <Select
                  value={warehouseId}
                  onValueChange={setWarehouseId}
                  disabled={!carrierEditable || warehouses.isPending}
                >
                  <SelectTrigger
                    aria-label="Kho lấy hàng"
                    className={cn(warehouseChanged && DIRTY)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <WarehouseIcon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        <SelectValue placeholder="Chưa chọn" />
                      </span>
                    </div>
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
              </HeaderField>
              {statusChanged && status === 'CANCELLED' ? (
                <div className="sm:col-span-3">
                  <HeaderField label="Lý do hủy">
                    <Input
                      aria-label="Lý do hủy"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Khách đổi ý, đặt nhầm… (tùy chọn)"
                      maxLength={1000}
                    />
                  </HeaderField>
                </div>
              ) : null}
            </div>
            <HeaderField label="Thẻ">
              <OrderTagsField
                value={tagIds}
                onChange={setTagIds}
                disabled={!carrierEditable}
                dirty={tagsChanged}
              />
            </HeaderField>
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {fulfilTarget ? (
                <p className="text-warning">
                  {fulfilTarget === 'PACKED'
                    ? 'Đóng gói KHÔNG quét: trừ tồn ngay, xin vận đơn của hãng đã chọn (ĐVVC) và mở nhãn in. Không hoàn tác được.'
                    : 'Đóng việc pick KHÔNG quét: phiếu giao sinh ngay, chưa trừ tồn — trừ khi đóng gói.'}
                </p>
              ) : fulfilTargets.length > 0 ? (
                <p>&quot;Đã pick xong / Đã đóng gói&quot; làm tay cần chọn ĐVVC trước.</p>
              ) : null}
              {canUpdate && targets.length === 0 && order.status === 'PENDING_APPROVAL' ? (
                <p>Đơn chờ duyệt: duyệt ở màn chi tiết; ở đây chỉ hủy được khi có quyền hủy.</p>
              ) : null}
              {selectedWarehouse?.pickupReady ? (
                <p>
                  Điểm lấy hàng gửi hãng:{' '}
                  {[
                    selectedWarehouse.address,
                    selectedWarehouse.hamlet,
                    selectedWarehouse.ward,
                    selectedWarehouse.province,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              ) : selectedWarehouse ? (
                <p className="text-warning">
                  Kho này chưa khai tỉnh/thành, phường/xã hoặc số điện thoại — không tra cước / gửi
                  hãng được từ kho này. Khai ở Kho › Sửa kho.
                </p>
              ) : null}
            </div>
            {/* Khối chỉ xem tách khỏi các ô sửa được (user 2026-10-22). */}
            <section
              aria-label="Thông tin chỉ xem"
              className="flex flex-col gap-1.5 rounded-md bg-muted/40 px-3 py-2"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Chỉ xem
              </span>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                <ReadOnlyItem label="Kênh">{orderChannelLabel(order.channel)}</ReadOnlyItem>
                <ReadOnlyItem label="Nguồn đơn">
                  {order.source ? orderSourceLabel(order.source) : '—'}
                </ReadOnlyItem>
                <ReadOnlyItem label="NV xử lý">
                  {order.ownerName ??
                    (order.ownerId ? 'Đã có người phụ trách' : 'Đơn của team, chưa chia')}
                </ReadOnlyItem>
              </dl>
            </section>
          </Card>

          <OrderEditLines
            form={linesForm}
            order={order}
            lockedReason={order.linesLockedReason}
            dirty={linesChanged}
            readOnly={
              <>
                <p className="text-sm text-muted-foreground">
                  Đổi sản phẩm, số lượng, giá hay khách:{' '}
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
                  ở màn chi tiết.
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <div className="min-w-[680px]">
                    <div
                      className={cn(
                        CART_GRID,
                        'hidden border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground sm:grid',
                      )}
                    >
                      <span>#</span>
                      <span>Sản phẩm</span>
                      <span className="text-center">SL</span>
                      <span className="text-right">Đơn giá</span>
                      <span className="text-right">Thành tiền</span>
                      <span />
                    </div>
                    <ul className="divide-y">
                      {groupOrderLines(order.lines).map((g, i) =>
                        g.kind === 'line' ? (
                          <li key={g.line.id} className={cn(CART_GRID, 'text-sm')}>
                            <span className="text-muted-foreground">{i + 1}</span>
                            <span className="min-w-0">
                              <span className="font-semibold">{g.line.skuName}</span>
                              {g.line.isGift ? (
                                <StatusBadge tone="brand" className="ml-1.5">
                                  <Gift className="h-3 w-3" aria-hidden />
                                  Tặng
                                </StatusBadge>
                              ) : null}
                              <span className="block text-xs text-muted-foreground">
                                <span className="font-mono">{g.line.skuCode}</span>
                                {g.line.nonStock ? ' · gõ tay, không quản lý tồn' : ''}
                              </span>
                            </span>
                            <span className="text-center tabular-nums">
                              {formatQuantity(g.line.qty)} {g.line.uomCode}
                            </span>
                            <span className="text-right tabular-nums">
                              {money(g.line.unitPrice)}
                            </span>
                            <span className="text-right font-semibold tabular-nums">
                              {money(g.line.lineTotal)}
                            </span>
                            <span />
                          </li>
                        ) : (
                          <li key={`combo-${g.groupNo}`} className={cn(CART_GRID, 'text-sm')}>
                            <span className="text-muted-foreground">{i + 1}</span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 font-semibold">
                                {g.skuName}
                                <StatusBadge tone="brand">
                                  <Boxes className="h-3 w-3" aria-hidden />
                                  Combo
                                </StatusBadge>
                              </span>
                              <span className="block font-mono text-xs text-muted-foreground">
                                {g.skuCode}
                              </span>
                              {g.lines.map((l) => (
                                <span
                                  key={l.id}
                                  className="flex items-center gap-1 text-xs text-muted-foreground"
                                >
                                  <CornerDownRight className="h-3 w-3" aria-hidden />
                                  {l.skuName} × {formatQuantity(l.qty)} {l.uomCode}
                                </span>
                              ))}
                            </span>
                            <span className="text-center tabular-nums">
                              {formatQuantity(g.qty)} combo
                            </span>
                            <span className="text-right tabular-nums">{money(g.unitPrice)}</span>
                            <span className="text-right font-semibold tabular-nums">
                              {money(g.lineTotal)}
                            </span>
                            <span />
                          </li>
                        ),
                      )}
                    </ul>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
                      <span>
                        {order.lines.length} dòng · {totalQty} SP
                        {lineWeight && !lineWeight.isZero()
                          ? ` · KL ${lineWeight.toDecimalPlaces(2).toString()} kg`
                          : ''}
                      </span>
                      <span>
                        Tạm tính{' '}
                        <b className="ml-1 text-base tabular-nums text-foreground">
                          {formatMoney(order.subtotal)}
                        </b>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            }
          />

          <div className="flex flex-wrap items-start gap-3">
            <Card className="min-w-0 flex-[1_1_320px]" title="Giá trị đơn hàng">
              {order.freeShipping || order.shipFeeOnReturnOnly ? (
                <div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-sm">
                  {order.freeShipping ? <span>Miễn phí giao hàng</span> : null}
                  {order.shipFeeOnReturnOnly ? <span>Chỉ thu phí nếu hoàn</span> : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 border-t border-dashed pt-3">
                <SumRow label="Tạm tính" value={formatMoney(order.subtotal)} />
                {nonZero(order.discount) ? (
                  <SumRow label="Giảm giá" value={`−${formatMoney(order.discount)}`} tone="neg" />
                ) : null}
                {manualDiscountNote(order) ? (
                  <p className="text-right text-xs text-muted-foreground">
                    trong đó {manualDiscountNote(order)}
                  </p>
                ) : null}
                <SumRow label="Phí vận chuyển" value={formatMoney(order.shippingFee)} />
                {nonZero(order.surcharge) ? (
                  <SumRow label="Phụ thu" value={formatMoney(order.surcharge)} />
                ) : null}
                {nonZero(order.roundingAmount) ? (
                  <SumRow label="Làm tròn" value={formatMoney(order.roundingAmount)} />
                ) : null}
                {nonZero(order.taxAmount) ? (
                  <SumRow label="Thuế" value={formatMoney(order.taxAmount)} />
                ) : null}
                <SumRow label="Tổng số tiền" value={formatMoney(order.total)} />
                {prepaid.isZero() ? null : (
                  <SumRow
                    label="Đã chuyển khoản"
                    value={`−${formatMoney(prepaid.toFixed(4))}`}
                    tone="neg"
                  />
                )}
              </div>
              <div className="border-t border-dashed pt-3">
                <SumRow label="Tiền cần thu" value={formatMoney(cod)} tone="pos" big />
              </div>
            </Card>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
              <Card title="Thanh toán">
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                  <span>Tiền chuyển khoản</span>
                  <span className="tabular-nums">{formatMoney(prepaid.toFixed(4))}</span>
                </div>
              </Card>
              <NotesCard
                internalNote={internalNote}
                printNote={printNote}
                onInternalNote={setInternalNote}
                onPrintNote={setPrintNote}
                internalChanged={internalChanged}
                printChanged={printChanged}
                disabled={!carrierEditable}
              />
            </div>
          </div>
        </div>

        {/* ── Cột phải ── */}
        <div className="flex min-w-0 max-w-full flex-[1_1_380px] flex-col gap-3 xl:max-w-[520px]">
          <Card
            title="Khách hàng"
            actions={
              <Link
                href={`/crm/customers/${order.customer.id}`}
                className="text-sm text-primary hover:underline"
              >
                Hồ sơ khách
              </Link>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 font-semibold">
                {order.customer.name}
                <MarketplaceBadge marketplace={order.marketplace} />
              </span>
              <span className="font-mono text-xs text-muted-foreground">{order.customer.code}</span>
            </div>
          </Card>

          <Card
            title="Nhận hàng"
            actions={
              carrierEditable ? (
                receiver ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setReceiver(null)}>
                    Bỏ sửa
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReceiver(receiverDraftOf(effectiveAddress ?? null))}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Sửa người nhận
                  </Button>
                )
              ) : null
            }
          >
            {receiver ? (
              <ReceiverFields value={receiver} onChange={setReceiver} dirty={receiverChanged} />
            ) : null}
            {!receiver && canReadCustomer ? (
              <Select
                value={addressId}
                onValueChange={setAddressId}
                disabled={!carrierEditable || customer.isPending}
              >
                <SelectTrigger aria-label="Địa chỉ giao" className={cn(addressChanged && DIRTY)}>
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
            ) : null}
            {receiver ? null : effectiveAddress ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="font-semibold tabular-nums">
                    {`${effectiveAddress.recipient} · ${effectiveAddress.phone}`}
                  </span>
                  <CopyButton value={effectiveAddress.phone} label="Sao chép SĐT người nhận" />
                </div>
                <p className="text-muted-foreground">{orderAddressLine(effectiveAddress)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {canReadCustomer && !customer.isPending && addresses.length === 0
                  ? 'Khách chưa có địa chỉ giao — thêm ở hồ sơ khách hàng rồi quay lại chọn.'
                  : canReadCustomer && !customer.isPending
                    ? 'Khách có nhiều địa chỉ mà chưa đặt mặc định — chọn một địa chỉ để tra cước / gửi hãng.'
                    : 'Chưa có địa chỉ giao — thêm ở hồ sơ khách hàng.'}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {receiver
                ? 'Lưu thành địa chỉ mới của khách và dùng cho đơn này — địa chỉ cũ giữ nguyên.'
                : 'Chọn địa chỉ có sẵn của khách, hoặc bấm "Sửa người nhận" để nhập người nhận khác.'}
            </p>
            {order.recipientPhoneMasked && order.marketplace ? (
              <p role="note" className="rounded-md bg-warning-weak px-3 py-2 text-xs text-warning">
                Đơn sàn: sàn che SĐT người mua. Gọi khách hoặc xem đơn trên trang người bán của sàn
                để lấy số thật, nhập vào ô bên dưới.
              </p>
            ) : null}
            <Row label="SĐT người nhận cho đơn này" htmlFor="order-recipient-phone">
              <Input
                id="order-recipient-phone"
                inputMode="tel"
                autoComplete="off"
                placeholder="Trống = SĐT của địa chỉ"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                disabled={!carrierEditable}
                aria-invalid={phoneStillMasked || undefined}
                aria-describedby={phoneStillMasked ? 'order-recipient-phone-hint' : undefined}
                className={cn(
                  'tabular-nums',
                  recipientPhoneChanged && DIRTY,
                  phoneStillMasked && 'border-destructive',
                )}
              />
            </Row>
            {phoneStillMasked ? (
              <p id="order-recipient-phone-hint" className="text-xs text-destructive">
                SĐT đang bị che — hãng sẽ từ chối. Nhập đủ 10 số.
              </p>
            ) : null}
            <Row label="Hẹn nhận hàng" htmlFor="order-expected-date">
              <Input
                id="order-expected-date"
                type="date"
                aria-label="Hẹn nhận hàng"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                disabled={!carrierEditable}
                className={cn('tabular-nums', dateChanged && DIRTY)}
              />
            </Row>
          </Card>

          <Card
            title="Vận chuyển"
            actions={
              !canChooseCarrier ? (
                <span className="text-sm font-medium">
                  {order.carrierId ? carrierLabel(order.carrierId) : 'Kho chọn khi gửi hàng'}
                </span>
              ) : (
                <CarrierSelect
                  className={cn('w-64', (carrierChanged || accountChanged) && DIRTY)}
                  value={
                    carrierId === NO_CARRIER
                      ? NO_CARRIER
                      : { carrierId, accountId: accountId === DEFAULT_ACCOUNT ? null : accountId }
                  }
                  specials={[{ value: NO_CARRIER, label: '— Chưa chọn —' }]}
                  placeholder="ĐVVC"
                  disabled={!carrierEditable}
                  onChange={(v, option) => {
                    if (typeof v === 'string' || !option) {
                      setCarrierId(NO_CARRIER);
                      setAccountId(DEFAULT_ACCOUNT);
                      return;
                    }
                    setCarrierId(v.carrierId);
                    // Tài khoản mặc định = null ("theo mặc định"); đơn đã ghi đích danh id tài
                    // khoản đó thì giữ nguyên id để không báo "đã đổi" giả.
                    setAccountId(
                      v.accountId ??
                        (option.accountId && option.accountId === order.carrierAccountId
                          ? option.accountId
                          : DEFAULT_ACCOUNT),
                    );
                  }}
                />
              )
            }
          >
            {waybillError ? (
              <div
                role="alert"
                className="space-y-2 rounded-md bg-destructive-weak px-3 py-2 text-sm text-destructive"
              >
                <p>
                  <span className="font-semibold">
                    {waybillError.carrierCode ?? 'Hãng'} không cấp được vận đơn
                  </span>
                  {waybillError.waybillErrorAt
                    ? ` · ${formatDateTime(waybillError.waybillErrorAt)}`
                    : ''}
                </p>
                <p>{waybillErrorText(waybillError.waybillErrorCode, waybillError.waybillError)}</p>
                <p className="text-xs">
                  Phiếu {waybillError.docNumber} đã đóng gói (đã trừ tồn), chưa có mã — sửa đơn rồi
                  xin lại vận đơn, không đóng gói lại.
                </p>
                {canPack && waybillError.carrierCode ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      loading={saving}
                      onClick={() => {
                        retryAfterSave.current = true;
                        save();
                      }}
                    >
                      {patchDirty ? 'Lưu và xin lại vận đơn' : 'Xin lại vận đơn'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {!canChooseCarrier ? (
                'Kho chọn hãng vận chuyển khi gửi sang ĐVVC.'
              ) : carrierChanged && order.carrierId ? (
                <span className="text-warning">Đã đổi từ {carrierLabel(order.carrierId)}</span>
              ) : carrierEditable ? (
                'Phiếu giao tạo sau khi pick lấy sẵn hãng này.'
              ) : canUpdate ? (
                'Đơn đã kết thúc — không đổi hãng.'
              ) : (
                'Cần quyền sửa đơn để đổi hãng.'
              )}
            </p>
            <Row label="Khối lượng (kg)" htmlFor="order-weight">
              <Input
                id="order-weight"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                inputMode="decimal"
                placeholder={`${formatQuantity(order.lineWeightKg)} (theo SP)`}
                aria-label="Cân nặng gửi hãng (kg)"
                aria-invalid={weightInvalid || undefined}
                disabled={!carrierEditable}
                className={cn('text-right tabular-nums', weightChanged && DIRTY)}
              />
            </Row>
            {weightInvalid ? (
              <p className="text-right text-xs text-destructive">
                Nhập số kg lớn hơn 0, tối đa 4 số lẻ (vd 0,5 hay 1.25)
              </p>
            ) : null}
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="flex h-8 items-center justify-between rounded-md border bg-muted/40 px-3 text-sm">
                <span className="text-muted-foreground">Phí thu khách</span>
                <span className="tabular-nums">{money(order.shippingFee)}</span>
              </div>
              {canQuote ? (
                <div className="flex h-8 items-center justify-between rounded-md border bg-muted/40 px-3 text-sm">
                  <span className="text-muted-foreground">Cước hãng báo</span>
                  <span role="status" aria-live="polite" className="tabular-nums">
                    {quote.isPending
                      ? 'Đang tra…'
                      : quote.isError
                        ? 'Không tra được'
                        : quote.data
                          ? money(quote.data.fee)
                          : '—'}
                  </span>
                </div>
              ) : null}
            </div>
            {canQuote && quote.isError ? (
              <p className="text-xs text-destructive">{messageFor(quote.error)}</p>
            ) : null}
            {canQuote && quote.data ? (
              <p className="text-xs text-muted-foreground">
                {quote.data.weightKg === '0.0000'
                  ? 'SKU chưa khai cân nặng · '
                  : `${quote.data.weightKg} kg · `}
                Lấy hàng tại {quote.data.pickupSummary}
              </p>
            ) : null}
            {/* Thẻ hãng: Đối soát + Dịch vụ + Cập nhật cuối (mockup KDfmt8dqg3ztLcfbsGZ229). */}
            <CarrierStatusCard order={order} />
          </Card>

          <Card title="Giờ tạo đơn">
            <Row label="Tạo lúc">
              <ReadValue>{formatDateTime(order.orderDate)}</ReadValue>
            </Row>
            {order.createdByName ? (
              <Row label="Người tạo">
                <ReadValue>{order.createdByName}</ReadValue>
              </Row>
            ) : null}
          </Card>

          <OrderEditHistory orderId={order.id} />

          {/* Khối Lưu dính đáy màn khi cuộn — như khối Chốt đơn của màn tạo đơn. */}
          <section
            aria-label="Lưu thay đổi"
            className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-lg border border-input-soft bg-card p-3 shadow-popover"
          >
            {changes.length > 0 ? (
              <div className="rounded-md border border-warning-line bg-warning-weak px-3 py-2">
                <p className="text-sm font-semibold text-warning" role="status">
                  {changes.length} thay đổi chưa lưu
                </p>
                <dl className="mt-1 space-y-1 text-sm">
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
              </div>
            ) : null}
            <dl className="space-y-0.5 text-sm tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <dt>Tổng tiền</dt>
                <dd>{formatMoney(order.total)}</dd>
              </div>
              {prepaid.isZero() ? null : (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Đã chuyển khoản</dt>
                  <dd>−{formatMoney(prepaid.toFixed(4))}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t pt-1.5">
                <dt className="font-semibold">Thu hộ (COD)</dt>
                <dd className="text-2xl font-semibold text-primary">{formatMoney(cod)}</dd>
              </div>
            </dl>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild shortcut="Esc">
                <Link href={detailHref}>Hủy bỏ</Link>
              </Button>
              {canUpdate || canFulfil ? (
                <Button
                  className="flex-1"
                  onClick={save}
                  shortcut="Ctrl S"
                  loading={saving}
                  loadingText="Đang lưu…"
                  disabled={readOnlyReason !== null}
                >
                  Lưu thay đổi
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Người nhận đang gõ trên màn sửa (chuỗi thô, chưa chuẩn hoá). */
interface ReceiverDraft {
  recipient: string;
  phone: string;
  line1: string;
  ward: string;
  district: string;
  province: string;
}

/** Địa chỉ đơn / địa chỉ của khách — cùng các trường người nhận. */
interface AddressLike {
  recipient: string;
  phone: string;
  line1: string;
  ward: string | null;
  district?: string | null;
  province: string;
}

function receiverDraftOf(a: AddressLike | null): ReceiverDraft {
  return {
    recipient: a?.recipient ?? '',
    phone: a?.phone ?? '',
    line1: a?.line1 ?? '',
    ward: a?.ward ?? '',
    district: a?.district ?? '',
    province: a?.province ?? '',
  };
}

/** Body `address` của PATCH; null = thiếu ô bắt buộc / SĐT sai. */
function receiverAddress(d: ReceiverDraft) {
  const phone = normalizePhoneInput(d.phone);
  if (!d.recipient.trim() || !d.line1.trim() || !d.province.trim() || !/^0\d{9,10}$/.test(phone)) {
    return null;
  }
  return {
    recipient: d.recipient.trim(),
    phone,
    line1: d.line1.trim(),
    ...(d.ward.trim() ? { ward: d.ward.trim() } : {}),
    ...(d.district.trim() ? { district: d.district.trim() } : {}),
    province: d.province.trim(),
  };
}

function sameReceiver(
  b: NonNullable<ReturnType<typeof receiverAddress>>,
  a: AddressLike | null,
): boolean {
  if (!a) return false;
  return (
    b.recipient === a.recipient &&
    b.phone === normalizePhoneInput(a.phone) &&
    b.line1 === a.line1 &&
    (b.ward ?? null) === (a.ward ?? null) &&
    (b.district ?? null) === (a.district ?? null) &&
    b.province === a.province
  );
}

/** Số dòng giỏ ban đầu (combo tính một dòng) — cho "n dòng → m dòng" ở khối thay đổi. */
function collapsedCount(order: SalesOrderDetail): number {
  const groups = new Set<number>();
  let n = 0;
  for (const l of order.lines) {
    if (l.nonStock) continue;
    if (!l.combo) n += 1;
    else if (!groups.has(l.combo.groupNo)) {
      groups.add(l.combo.groupNo);
      n += 1;
    }
  }
  return n;
}

/** Ô người nhận gõ tay — tên, SĐT, địa chỉ, phường / quận / tỉnh. */
function ReceiverFields({
  value,
  onChange,
  dirty,
}: {
  value: ReceiverDraft;
  onChange: (v: ReceiverDraft) => void;
  dirty: boolean;
}) {
  const field = (
    key: keyof ReceiverDraft,
    label: string,
    opts: { required?: boolean; tel?: boolean } = {},
  ) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
      <span>
        {label}
        {opts.required ? <span className="text-destructive"> *</span> : null}
      </span>
      <Input
        aria-label={label}
        value={value[key]}
        inputMode={opts.tel ? 'tel' : undefined}
        autoComplete="off"
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        className={cn(opts.tel && 'tabular-nums', dirty && DIRTY)}
      />
    </label>
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {field('recipient', 'Tên người nhận', { required: true })}
      {field('phone', 'SĐT', { required: true, tel: true })}
      <div className="sm:col-span-2">
        {field('line1', 'Địa chỉ (số nhà, đường, thôn)', { required: true })}
      </div>
      {field('ward', 'Phường / xã')}
      {field('district', 'Quận / huyện')}
      <div className="sm:col-span-2">{field('province', 'Tỉnh / thành', { required: true })}</div>
    </div>
  );
}

/** Nhãn `caption` trên một ô của dải "Thông tin đơn" (giống màn tạo đơn). */
function HeaderField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Một cặp nhãn – giá trị của khối "Chỉ xem". */
function ReadOnlyItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

/** Giá trị chỉ đọc cao bằng ô nhập (32px) để dải Thông tin đơn thẳng hàng. */
function ReadValue({ children }: { children: ReactNode }) {
  return <span className="flex h-8 min-w-0 items-center truncate text-sm">{children}</span>;
}

/** Một hàng "nhãn ← → ô nhập" như card Vận chuyển / Giờ tạo đơn của màn tạo đơn. */
function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <label htmlFor={htmlFor} className="text-sm">
        {label}
      </label>
      <div className="w-full sm:w-56">{children}</div>
    </div>
  );
}

function SumRow({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: 'neg' | 'pos';
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={big ? 'text-base font-semibold' : 'text-sm'}>{label}</span>
      <b
        className={cn(
          'tabular-nums',
          big ? 'text-xl' : 'text-sm',
          tone === 'neg' && 'text-destructive',
          tone === 'pos' && 'text-success',
        )}
      >
        {value}
      </b>
    </div>
  );
}

/** Ghi chú hai tab Nội bộ / Để in — như màn tạo đơn; tab có thay đổi chưa lưu đánh dấu chấm. */
function NotesCard({
  internalNote,
  printNote,
  onInternalNote,
  onPrintNote,
  internalChanged,
  printChanged,
  disabled,
}: {
  internalNote: string;
  printNote: string;
  onInternalNote: (v: string) => void;
  onPrintNote: (v: string) => void;
  internalChanged: boolean;
  printChanged: boolean;
  disabled: boolean;
}) {
  const [tab, setTab] = useState<'internal' | 'print'>('internal');
  const internal = tab === 'internal';
  return (
    <Card title="Ghi chú">
      <div
        role="tablist"
        aria-label="Loại ghi chú"
        className="grid grid-cols-2 rounded-md bg-muted p-0.5"
      >
        {(
          [
            ['internal', 'Nội bộ', internalChanged],
            ['print', 'Để in (lên vận đơn)', printChanged],
          ] as const
        ).map(([v, label, changed]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 rounded text-sm',
              tab === v ? 'bg-card font-semibold text-primary shadow-sm' : 'text-muted-foreground',
            )}
          >
            {label}
            {changed ? (
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="đã đổi" />
            ) : null}
          </button>
        ))}
      </div>
      <Textarea
        key={tab}
        aria-label={internal ? 'Ghi chú nội bộ' : 'Ghi chú in vận đơn'}
        rows={3}
        placeholder={
          internal
            ? 'Ghi chú cho người trong công ty (kho, CSKH…)'
            : 'In lên vận đơn cho shipper — vd: cho xem hàng, gọi trước khi giao'
        }
        value={internal ? internalNote : printNote}
        onChange={(e) => (internal ? onInternalNote : onPrintNote)(e.target.value)}
        maxLength={internal ? 2000 : 500}
        disabled={disabled}
        className={cn((internal ? internalChanged : printChanged) && DIRTY)}
      />
    </Card>
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
