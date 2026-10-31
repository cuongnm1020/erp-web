'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PackageCheck, ScanBarcode, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  DatePicker,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MoneyInput,
  type DateKey,
} from '@/components/data/form';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { carrierSaid, messageFor, messageForCode } from '@/lib/error-messages';
import { formatDate, formatTime, toLocalDateKey } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import type { Carrier } from '@/features/wms/api/use-shipping';
import {
  useOrderLookup,
  usePickupWarehouses,
  useReleasePick,
  useSendOrdersToCarrier,
  useWaybillStatus,
  waybillResolved,
  type SalesOrder,
  type SendOrderToCarrierItem,
  type SendOrdersToCarrierResult,
  type ShipmentWaybillStatus,
} from '../api/use-orders';
import { orderEditable, orderStatusLabel, orderStatusTone } from '../labels';
import { waybillErrorText } from './waybill-error';
import {
  FulfilResultsPanel,
  ProgressLine,
  WaybillOrientationField,
  useFulfilPrint,
  type FulfilPrintOutcome,
} from './bulk-fulfil-print-dialog';
import { OrderResultsPanel, type OrderResultRow } from './order-results-panel';
import {
  CARRIER_SERVICES,
  DEFAULT_SHIPPING_OPTIONS_FORM,
  PICK_SHIFTS,
  hasPickupOptions,
  shippingOptionsFormSchema,
  toShippingOptions,
  type ShippingOptionsFormValues,
} from '../shipping-options';
import { CarrierSelect } from '@/features/wms/components/carrier-select';

const NO_SERVICE = '__default__';

/**
 * "Gửi sang ĐVVC" — dialog hai cột như Pancake: trái là các đơn đã chọn (tìm / quét mã để thêm,
 * ✕ để bỏ), phải là "Cấu hình" gửi hãng áp cho cả lô. "Cập nhật" → POST
 * /sales-orders/send-to-carrier; server lưu hãng + tuỳ chọn lên từng đơn, đơn nào kho đã pick
 * thì xin vận đơn ngay. Kết quả báo theo từng nhóm (cấp ngay / chờ hãng / lưu chờ đóng gói /
 * không gửi được). Không optimistic (luật 5): chờ server rồi mới bỏ chọn + invalidate.
 */
export function SendToCarrierDialog({
  carrier,
  accountId: pickedAccountId = null,
  rows,
  open,
  onOpenChange,
  onDone,
}: {
  carrier: Carrier;
  /** Tài khoản chọn từ menu "Sang <hãng> · <tài khoản>"; null = mặc định của hãng. */
  accountId?: string | null;
  rows: SalesOrder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [orders, setOrders] = useState<SalesOrder[]>(rows);
  const [search, setSearch] = useState('');
  const [lookupState, setLookupState] = useState<'idle' | 'busy' | 'missing'>('idle');
  /** Kết quả lô vừa gửi có đơn lỗi → dialog chuyển sang danh sách đơn lỗi thay vì đóng. */
  const [failedResult, setFailedResult] = useState<SendOrdersToCarrierResult | null>(null);
  const lookup = useOrderLookup();
  const warehouses = usePickupWarehouses();
  const send = useSendOrdersToCarrier();
  const releasePick = useReleasePick();
  const fp = useFulfilPrint();
  /**
   * Kho / admin (đóng gói nhanh được) gửi xong được hỏi "Đóng gói + in vận đơn luôn?" (2026-10-29,
   * mockup 14xWZb694H9tTFGV6BXnfG): server giữ việc lấy hàng lại (`holdPick`) tới khi chọn "Để kho
   * lấy hàng" / đóng popup → POST release-pick; bỏ ngang thì server tự thả sau 15 phút.
   */
  const canFulfil = useAbility().can('fulfil_manual', 'SalesOrder');
  /** Đơn vừa gửi đang bị giữ việc lấy hàng — thả đúng một lần. */
  const [held, setHeld] = useState<string[]>([]);
  /** Đơn sẽ đóng gói nếu chọn "Đóng gói + in" (gửi được, không cần sửa); null = không hỏi. */
  const [packIds, setPackIds] = useState<string[] | null>(null);
  const [fulfilled, setFulfilled] = useState<FulfilPrintOutcome | null>(null);
  /**
   * Mã vận đơn xin SẴN (2026-10-31): gửi xong worker xin mã ngầm — hỏi lại tới khi mọi đơn có mã /
   * có lỗi, hiện "Đã có mã x/N" + trạng thái từng đơn.
   */
  const queuedShipments = (failedResult?.sent ?? []).flatMap((x) =>
    x.outcome === 'QUEUED' && x.shipmentId ? [x.shipmentId] : [],
  );
  const waybills = useWaybillStatus(queuedShipments, failedResult !== null && fulfilled === null);
  const live = new Map((waybills.data ?? []).map((s) => [s.shipmentId, s]));
  const issuing = {
    done: queuedShipments.filter((id) => live.get(id)?.trackingNo).length,
    total: queuedShipments.length,
  };
  const allResolved = queuedShipments.every((id) => {
    const s = live.get(id);
    return s !== undefined && waybillResolved(s);
  });
  /** Đã bấm "Đóng gói + in" khi mã chưa về đủ — chạy khi đủ / quá {@link WAIT_WAYBILL_MS}. */
  const [packWhenReady, setPackWhenReady] = useState(false);
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  /**
   * Tài khoản của hãng (FE-CARRIER-ACC-1): chỉ hỏi khi hãng có từ 2 tài khoản đủ cấu hình (tài
   * khoản chưa cấu hình ẩn, 2026-10-22); chọn sẵn tài khoản chọn từ menu, không có thì mặc định
   * (chưa đủ cấu hình thì tài khoản đủ cấu hình đầu tiên).
   */
  const accounts = carrier.accounts.filter((a) => a.configured);
  const initialAccountId =
    (
      accounts.find((a) => a.id === pickedAccountId) ??
      accounts.find((a) => a.isDefault) ??
      accounts[0]
    )?.id ?? null;
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);

  // Mở lại với lô khác → nạp lại danh sách + reset form.
  useEffect(() => {
    if (open) {
      setOrders(rows);
      setSearch('');
      setLookupState('idle');
      setFailedResult(null);
      setAccountId(initialAccountId);
      setHeld([]);
      setPackIds(null);
      setFulfilled(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ nạp lại lúc mở, không theo rows đổi giữa chừng
  }, [open]);

  const form = useForm<ShippingOptionsFormValues>({
    resolver: zodResolver(shippingOptionsFormSchema),
    defaultValues: DEFAULT_SHIPPING_OPTIONS_FORM,
  });
  useEffect(() => {
    if (open) form.reset(DEFAULT_SHIPPING_OPTIONS_FORM);
  }, [open, form]);

  const sendable = useMemo(() => orders.filter((o) => orderEditable(o.status)), [orders]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) => o.docNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q),
    );
  }, [orders, search]);

  const services = CARRIER_SERVICES[carrier.code] ?? [];
  const ghtk = hasPickupOptions(carrier.code);
  const customPickup = form.watch('customPickup');

  /** Enter trong ô tìm: khớp đơn đã có thì thôi; không thì tra API theo số đơn (quét mã). */
  const addByDocNumber = async () => {
    const q = search.trim();
    if (!q) return;
    if (orders.some((o) => o.docNumber.toLowerCase() === q.toLowerCase())) {
      setSearch('');
      return;
    }
    setLookupState('busy');
    try {
      const found = await lookup(q);
      if (!found) {
        setLookupState('missing');
        return;
      }
      setOrders((cur) => (cur.some((o) => o.id === found.id) ? cur : [found, ...cur]));
      setSearch('');
      setLookupState('idle');
    } catch (err) {
      setLookupState('idle');
      toast.error(messageFor(err));
    }
  };

  const remove = (id: string) => setOrders((cur) => cur.filter((o) => o.id !== id));

  const submit = form.handleSubmit(async (v) => {
    if (sendable.length === 0 || send.isPending) return;
    try {
      const r = await send.mutateAsync({
        orderIds: sendable.map((o) => o.id),
        carrierId: carrier.id,
        ...(carrier.accounts.length > 1 && accountId ? { carrierAccountId: accountId } : {}),
        options: toShippingOptions(v),
        ...(v.customPickup && v.warehouseId ? { warehouseId: v.warehouseId } : {}),
        ...(canFulfil ? { holdPick: true } : {}),
      });
      announce(carrier.code, r, orders.length - sendable.length);
      if (canFulfil && r.sent.length > 0) {
        const sentIds = r.sent.map((x) => x.orderId);
        // Đơn cần sửa (SĐT bị sàn che) không đóng gói — hãng sẽ từ chối cấp mã.
        const ids = r.sent.filter((x) => !x.warning).map((x) => x.orderId);
        if (ids.length > 0) {
          setHeld(sentIds);
          setPackIds(ids);
        } else release(sentIds);
        setFailedResult(r);
        return;
      }
      // Nhiều đơn / có đơn lỗi / cần sửa / hãng chưa phản hồi: giữ dialog mở, hiện kết quả TỪNG đơn
      // (2026-10-28). `onDone` (bỏ chọn trên danh sách) đợi tới lúc đóng — bỏ chọn sớm sẽ gỡ luôn
      // dialog này.
      if (needsReview(r)) {
        setFailedResult(r);
        return;
      }
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(messageFor(err));
    }
  });

  /** Thả việc lấy hàng cho kho; lỗi mạng thì server vẫn tự thả sau 15 phút. */
  function release(ids: string[]) {
    if (ids.length === 0) return;
    releasePick.mutate(ids, {
      onError: (err) =>
        toast.error(messageFor(err), {
          description: 'Kho sẽ tự nhận việc lấy hàng của các đơn này sau 15 phút.',
        }),
    });
  }

  const releaseHeld = () => {
    release(held);
    setHeld([]);
  };

  const close = () => {
    // Đóng popup khi còn đang hỏi = "Để kho lấy hàng".
    releaseHeld();
    onOpenChange(false);
    if (failedResult) onDone();
  };

  const packAndPrint = async () => {
    if (!packIds || fp.pending) return;
    // Mã chưa về đủ → chờ (thanh "Đã có mã x/N"), hiệu ứng bên dưới gọi lại khi đủ / quá hạn.
    if (!allResolved && !waitTimedOut) {
      setPackWhenReady(true);
      return;
    }
    setPackWhenReady(false);
    // Đơn hãng từ chối cấp mã không đóng gói — sửa đơn rồi gửi lại.
    const rejected = new Set(
      (failedResult?.sent ?? []).flatMap((x) =>
        x.shipmentId && live.get(x.shipmentId)?.waybillError ? [x.orderId] : [],
      ),
    );
    const ids = packIds.filter((id) => !rejected.has(id));
    if (ids.length === 0) {
      toast.error('Không còn đơn nào đóng gói được — hãng không cấp mã cho các đơn đã chọn.');
      return;
    }
    const out = await fp.run(ids, new Map(orders.map((o) => [o.id, o])));
    // Lỗi cả lô (mạng…) → vẫn ở câu hỏi để thử lại hoặc chọn "Để kho lấy hàng".
    if (!out) return;
    // Đơn đóng gói xong đã hết giữ; đơn lỗi trước khi trừ tồn thì xuống kho lấy hàng.
    releaseHeld();
    setPackIds(null);
    setFulfilled(out);
  };

  // Đã bấm "Đóng gói + in" lúc mã chưa đủ: mã về đủ → chạy; quá hạn → chạy với phần đã có (đơn
  // chưa có mã đi đường xin mã đồng bộ cũ trong bulk-fulfil).
  useEffect(() => {
    if (!packWhenReady) return;
    if (allResolved || waitTimedOut) {
      void packAndPrint();
      return;
    }
    const timer = setTimeout(() => setWaitTimedOut(true), WAIT_WAYBILL_MS);
    return () => clearTimeout(timer);
    // packAndPrint đọc state mới nhất mỗi lần render — chỉ cần chạy lại khi các cờ đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packWhenReady, allResolved, waitTimedOut]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (send.isPending || fp.pending) return;
          if (o) onOpenChange(true);
          else close();
        }}
      >
        <DialogContent className="flex h-[90vh] max-w-6xl flex-col gap-0 p-0 sm:rounded-lg">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <DialogTitle className="text-base font-semibold">Sang</DialogTitle>
            <StatusBadge tone="brand" className="h-6 px-2 text-sm">
              {carrier.code}
            </StatusBadge>
            <span className="text-sm text-muted-foreground">{carrier.name}</span>
          </div>

          {fulfilled ? (
            <FulfilResultsPanel outcome={fulfilled} onClose={close} flush />
          ) : failedResult ? (
            <SendResults
              carrierCode={carrier.code}
              result={failedResult}
              orders={orders}
              onClose={close}
              ask={
                packIds
                  ? {
                      count: packIds.length,
                      field: (
                        <WaybillOrientationField
                          id="send-carrier-orientation"
                          value={fp.orientation}
                          onChange={fp.setOrientation}
                          hint={false}
                        />
                      ),
                      busyLabel:
                        fp.busyLabel ??
                        (packWhenReady ? `Chờ mã vận đơn ${issuing.done}/${issuing.total}…` : null),
                      progress: fp.progressBar,
                      onPack: () => void packAndPrint(),
                    }
                  : null
              }
              live={live}
              issuing={issuing}
            />
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              {/* ── Trái: đơn đã chọn ─────────────────────────────── */}
              <section
                aria-label="Đơn được chọn"
                className="flex min-h-0 flex-col border-b md:border-b-0 md:border-r"
              >
                <div className="space-y-2 px-4 pt-4">
                  <div className="relative">
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        if (lookupState === 'missing') setLookupState('idle');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void addByDocNumber();
                        }
                      }}
                      placeholder="Tìm đơn hàng"
                      aria-label="Tìm đơn hàng"
                      aria-invalid={lookupState === 'missing' || undefined}
                      className="h-9 pr-8"
                      autoFocus
                    />
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                    />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs italic text-muted-foreground">
                    <ScanBarcode aria-hidden className="h-3.5 w-3.5" />
                    Quét barcode (số đơn) rồi Enter để thêm đơn hàng
                    {lookupState === 'busy' ? ' — đang tìm…' : ''}
                  </p>
                  {lookupState === 'missing' ? (
                    <p role="alert" className="text-xs text-destructive">
                      Không thấy đơn &quot;{search.trim()}&quot; trong phạm vi của bạn. Kiểm tra lại
                      số đơn.
                    </p>
                  ) : null}
                  <p className="pt-1 text-sm font-semibold">{orders.length} đơn được chọn</p>
                </div>
                <ul
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3"
                  aria-label="Danh sách đơn"
                >
                  {visible.length === 0 ? (
                    <li className="py-6 text-center text-sm text-muted-foreground">
                      {orders.length === 0
                        ? 'Chưa có đơn nào. Quét mã hoặc gõ số đơn rồi Enter.'
                        : 'Không đơn nào khớp từ khoá.'}
                    </li>
                  ) : (
                    visible.map((o) => {
                      const editable = orderEditable(o.status);
                      return (
                        <li
                          key={o.id}
                          className={cn(
                            'flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm',
                            !editable && 'opacity-60',
                          )}
                        >
                          <ScanBarcode
                            aria-hidden
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                          />
                          <span className="font-semibold tabular-nums">{o.docNumber}</span>
                          <span className="text-xs text-muted-foreground">{when(o.orderDate)}</span>
                          <span className="ml-auto flex items-center gap-2">
                            {o.carrierId && o.carrierId !== carrier.id ? (
                              <span className="text-xs text-warning">đang gán hãng khác</span>
                            ) : null}
                            {!editable ? (
                              <span className="text-xs text-muted-foreground">bỏ qua</span>
                            ) : null}
                            <StatusBadge tone={orderStatusTone(o.status)}>
                              {orderStatusLabel(o.status)}
                            </StatusBadge>
                            <button
                              type="button"
                              onClick={() => remove(o.id)}
                              aria-label={`Bỏ đơn ${o.docNumber}`}
                              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>

              {/* ── Phải: cấu hình ─────────────────────────────────── */}
              <Form {...form}>
                <form
                  onSubmit={submit}
                  noValidate
                  className="flex min-h-0 flex-col"
                  aria-label="Cấu hình gửi hãng"
                >
                  <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 px-5 py-4">
                    <h3 className="text-base font-semibold">Cấu hình</h3>

                    <div className="space-y-1">
                      <label
                        htmlFor="send-carrier-account"
                        className="text-sm text-muted-foreground"
                      >
                        Tài khoản {carrier.code}
                      </label>
                      {/* Ô chọn hãng dùng chung, chỉ tài khoản của hãng này (trường cấu hình bên dưới
                        theo hãng). Một tài khoản thì chỉ hiện, không cần chọn. */}
                      <CarrierSelect
                        id="send-carrier-account"
                        aria-label={`Tài khoản ${carrier.code}`}
                        className="h-9 w-full sm:w-80"
                        filter={(o) => o.carrier.id === carrier.id}
                        value={{ carrierId: carrier.id, accountId }}
                        disabled={accounts.length <= 1}
                        onChange={(_, o) => setAccountId(o?.accountId ?? null)}
                      />
                    </div>

                    <fieldset className="space-y-2">
                      <legend className="mb-1 text-sm text-muted-foreground">Tùy chọn</legend>
                      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                        <CheckField
                          form={form}
                          name="shopPaysFee"
                          label={`Cửa hàng trả phí vận chuyển cho ${carrier.code}`}
                        />
                        <CheckField form={form} name="allowInspection" label="Cho xem hàng" />
                        {ghtk ? (
                          <CheckField form={form} name="byAir" label="Vận chuyển bằng đường bay" />
                        ) : null}
                        <CheckField
                          form={form}
                          name="callShopOnFailure"
                          label="Gọi shop khi không giao được"
                        />
                        {ghtk ? (
                          <CheckField
                            form={form}
                            name="dropAtPostOffice"
                            label="Gửi hàng tại bưu cục"
                          />
                        ) : null}
                      </div>
                    </fieldset>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="serviceCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dịch vụ vận chuyển</FormLabel>
                            {services.length > 0 ? (
                              <Select
                                value={field.value === '' ? NO_SERVICE : field.value}
                                onValueChange={(v) => field.onChange(v === NO_SERVICE ? '' : v)}
                              >
                                <FormControl>
                                  <SelectTrigger aria-label="Dịch vụ vận chuyển" className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={NO_SERVICE}>Mặc định của hãng</SelectItem>
                                  {services.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Mã dịch vụ của hãng (trống = mặc định)"
                                  className="h-9"
                                />
                              </FormControl>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="extraServices"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dịch vụ bổ sung</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Mã dịch vụ, cách nhau dấu phẩy"
                                className="h-9"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {ghtk ? (
                        <>
                          <FormField
                            control={form.control}
                            name="pickWorkShift"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Thời điểm lấy hàng</FormLabel>
                                <div
                                  className="flex flex-wrap gap-4 pt-1"
                                  role="radiogroup"
                                  aria-label="Thời điểm lấy hàng"
                                >
                                  {PICK_SHIFTS.map((s) => (
                                    <label
                                      key={s.value}
                                      className="flex items-center gap-1.5 text-sm"
                                    >
                                      <input
                                        type="radio"
                                        name="pickWorkShift"
                                        value={s.value}
                                        checked={field.value === s.value}
                                        onChange={() => field.onChange(s.value)}
                                        className="h-4 w-4 accent-primary"
                                      />
                                      {s.label}
                                    </label>
                                  ))}
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="pickDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Hẹn ngày lấy hàng</FormLabel>
                                <DatePicker
                                  id="pick-date"
                                  value={field.value as DateKey | ''}
                                  onChange={field.onChange}
                                  fromDate={new Date()}
                                  placeholder="Chọn ngày"
                                  clearable
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      ) : null}

                      <FormField
                        control={form.control}
                        name="insuranceValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Khai giá (bảo hiểm)</FormLabel>
                            <FormControl>
                              <MoneyInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Trống = theo tiền thu hộ"
                                aria-label="Khai giá"
                                className="h-9"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxWeightKg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Khối lượng tối đa (kg)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                inputMode="decimal"
                                placeholder="Trống = cân nặng của từng đơn"
                                className="h-9 text-right tabular-nums"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Ghi chú để in</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Ghi chú để in" rows={3} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="sm:col-span-2">
                        <Label className="text-sm">Kích thước gói hàng</Label>
                        <div className="mt-1.5 flex items-center gap-2">
                          {(['lengthCm', 'widthCm', 'heightCm'] as const).map((name, i) => (
                            <FormField
                              key={name}
                              control={form.control}
                              name={name}
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  {i > 0 ? <span className="text-muted-foreground">×</span> : null}
                                  <FormControl>
                                    <Input
                                      {...field}
                                      inputMode="numeric"
                                      aria-label={
                                        name === 'lengthCm'
                                          ? 'Dài (cm)'
                                          : name === 'widthCm'
                                            ? 'Rộng (cm)'
                                            : 'Cao (cm)'
                                      }
                                      placeholder="0"
                                      className="h-9 w-20 text-right tabular-nums"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          ))}
                          <span className="text-sm text-muted-foreground">(cm)</span>
                        </div>
                        <p className="text-xs text-destructive">
                          {form.formState.errors.lengthCm?.message ??
                            form.formState.errors.widthCm?.message ??
                            form.formState.errors.heightCm?.message}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <CheckField
                        form={form}
                        name="customPickup"
                        label="Tùy chọn địa chỉ lấy hàng"
                      />
                      {customPickup ? (
                        <FormField
                          control={form.control}
                          name="warehouseId"
                          render={({ field }) => (
                            <FormItem className="max-w-md">
                              <FormLabel>Kho lấy hàng cho cả lô</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger aria-label="Kho lấy hàng" className="h-9">
                                    <SelectValue placeholder="Chọn kho" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(warehouses.data ?? []).map((w) => (
                                    <SelectItem key={w.id} value={w.id}>
                                      {w.name} ({w.code})
                                      {w.pickupReady ? '' : ' — chưa khai địa chỉ'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}
                    </div>
                  </div>

                  <DialogFooter className="border-t px-5 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={send.isPending}
                    >
                      Hủy
                    </Button>
                    <Button type="submit" disabled={sendable.length === 0 || send.isPending}>
                      {send.isPending ? 'Đang gửi…' : `Cập nhật ${sendable.length} đơn`}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Tờ in tem — ngoài hộp thoại, sống tới khi popup đóng. */}
      {fp.sheet}
    </>
  );
}

/**
 * Lý do một đơn không gửi được: câu theo mã lỗi (luật 6) + nguyên văn lời hãng nếu hãng từ chối;
 * kho xuất không có hàng → nêu tên kho + từng sản phẩm thiếu.
 */
function failedReason(f: SendOrdersToCarrierResult['failed'][number]): string {
  if (f.code === 'ORDER_SKU_NOT_IN_WAREHOUSE' && f.missingSkus?.length) {
    const skus = f.missingSkus.map((s) => `${s.code} — ${s.name}`).join('; ');
    return `${f.warehouseName ?? 'Kho xuất'} không có: ${skus}. Đổi kho xuất hoặc chuyển hàng về kho rồi gửi lại.`;
  }
  const base = messageForCode(f.code);
  return f.carrierMessage ? `${base} ${carrierSaid(f.carrierMessage)}` : base;
}

/** Có gì người gửi cần xem từng đơn: nhiều đơn, đơn lỗi, đơn cần sửa, hãng chưa phản hồi. */
/** Chờ mã vận đơn xin sẵn tối đa bao lâu trước khi "Đóng gói + in" chạy với phần đã có. */
const WAIT_WAYBILL_MS = 90_000;

function needsReview(r: SendOrdersToCarrierResult): boolean {
  return (
    r.sent.length + r.failed.length > 1 ||
    r.failed.length > 0 ||
    r.sent.some((s) => s.warning || s.outcome === 'QUEUED')
  );
}

/**
 * Kết quả từng đơn của lô vừa gửi (2026-10-28): có mã vận đơn / chờ đóng gói / cần sửa (đơn lỗi +
 * đơn biết trước hãng sẽ từ chối vì SĐT bị che). Người dùng sửa từng đơn rồi gửi lại.
 */
function SendResults({
  carrierCode,
  result,
  orders,
  onClose,
  ask,
  live,
  issuing,
}: {
  carrierCode: string;
  result: SendOrdersToCarrierResult;
  orders: SalesOrder[];
  onClose: () => void;
  /** Hỏi "Đóng gói + in vận đơn luôn?" (kho / admin, 2026-10-29); null = chỉ nút Đóng. */
  ask: {
    count: number;
    /** Ô hướng tem. */
    field: ReactNode;
    /** Chữ nút khi đang chạy; null = rảnh. */
    busyLabel: string | null;
    /** Thanh tiến độ "x/N đơn" khi đang đóng gói + in (2026-10-31); null = rảnh. */
    progress: ReactNode;
    onPack: () => void;
  } | null;
  /** Trạng thái sống của mã xin sẵn, theo shipmentId (2026-10-31). */
  live: Map<string, ShipmentWaybillStatus>;
  /** Số đơn đã có mã / tổng số đơn đang xin mã. */
  issuing: { done: number; total: number };
}) {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const rows: OrderResultRow[] = [
    ...result.failed.map((f): OrderResultRow => ({
      orderId: f.orderId,
      docNumber: f.docNumber ?? byId.get(f.orderId)?.docNumber ?? f.orderId.slice(0, 8),
      customerName: byId.get(f.orderId)?.customer.name,
      marketplace: byId.get(f.orderId)?.marketplace,
      group: 'fix',
      status: 'Không gửi được',
      reason: failedReason(f),
    })),
    ...result.sent.map((s): OrderResultRow => {
      const o = byId.get(s.orderId);
      const base = {
        orderId: s.orderId,
        docNumber: s.docNumber,
        customerName: o?.customer.name,
        marketplace: o?.marketplace,
      };
      if (s.trackingNo) return { ...base, group: 'ok', status: `Có mã ${s.trackingNo}` };
      if (s.warning === 'RECIPIENT_PHONE_MASKED') {
        return {
          ...base,
          group: 'fix',
          status: 'Cần sửa trước khi đóng gói',
          reason: `SĐT người nhận bị sàn che — ${carrierCode} sẽ từ chối khi cấp vận đơn. Nhập SĐT thật ở màn sửa đơn rồi mới đóng gói.`,
        };
      }
      // Mã xin SẴN do worker (2026-10-31): trạng thái sống từ POST /shipments/waybill-status.
      const l = s.shipmentId ? live.get(s.shipmentId) : undefined;
      if (s.outcome === 'QUEUED' && l?.trackingNo) {
        return { ...base, group: 'ok', status: `Có mã ${l.trackingNo}` };
      }
      if (s.outcome === 'QUEUED' && l?.waybillError) {
        return {
          ...base,
          group: 'fix',
          status: `${carrierCode} không cấp được mã`,
          reason: waybillErrorText(l.waybillErrorCode, l.waybillError),
        };
      }
      return {
        ...base,
        group: 'wait',
        status: s.outcome === 'QUEUED' ? 'Đang xin mã vận đơn' : 'Chờ đóng gói',
        reason:
          s.outcome === 'QUEUED'
            ? 'Hãng chưa trả mã — tự cập nhật, đóng popup vẫn tiếp tục.'
            : OUTCOME_LABEL[s.outcome],
      };
    }),
  ];
  const failed = result.failed.length;
  return (
    <OrderResultsPanel
      title={
        failed > 0 ? (
          <span className="text-destructive">
            {failed} đơn không gửi được sang {carrierCode}
          </span>
        ) : (
          `Đã gửi ${result.sent.length} đơn sang ${carrierCode}`
        )
      }
      description={
        failed > 0 && result.sent.length > 0
          ? `${result.sent.length} đơn còn lại đã gửi xong. Sửa từng đơn theo lý do bên dưới rồi gửi lại.`
          : 'Hệ thống đang xin mã vận đơn của hãng cho từng đơn. Đơn hãng không cấp được mã nằm ở tab Lỗi vận đơn.'
      }
      rows={rows}
      hints={{
        ok: 'Có mã vận đơn — in được tem',
        wait: 'Đang xin mã vận đơn',
        fix: 'Cần sửa',
      }}
      footer={
        ask ? (
          <>
            {issuing.total > 0 ? (
              <div className="mx-5 mb-3">
                <ProgressLine
                  label="Đã có mã vận đơn"
                  done={issuing.done}
                  total={issuing.total}
                  ariaLabel="Tiến độ xin mã vận đơn"
                />
              </div>
            ) : null}
            <div
              role="group"
              aria-label="Đóng gói luôn"
              className="mx-5 mb-3 space-y-2.5 rounded-md border border-warning-line bg-warning-weak p-3 text-sm"
            >
              <div>
                <p className="font-semibold">Đóng gói + in vận đơn luôn {ask.count} đơn?</p>
                <p className="text-xs text-muted-foreground">
                  Trừ tồn và xin mã hãng ngay, không qua lấy hàng / quét trên PDA. Đơn cần sửa không
                  được đóng gói.
                </p>
              </div>
              {ask.field}
              {ask.progress}
            </div>
            <DialogFooter className="items-center border-t px-5 py-3">
              <span className="mr-auto text-xs text-muted-foreground">
                Đóng popup = để kho lấy hàng
              </span>
              {/* Mặc định (Enter) là để kho lấy hàng — tránh lỡ tay trừ tồn. */}
              <Button
                type="button"
                variant="outline"
                autoFocus
                disabled={ask.busyLabel !== null}
                onClick={onClose}
              >
                Để kho lấy hàng
              </Button>
              <Button type="button" disabled={ask.busyLabel !== null} onClick={ask.onPack}>
                <PackageCheck aria-hidden />
                {ask.busyLabel ?? `Đóng gói + in ${ask.count} tem`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {issuing.total > 0 && issuing.done < issuing.total ? (
              <div className="mx-5 mb-3">
                <ProgressLine
                  label="Đã có mã vận đơn"
                  done={issuing.done}
                  total={issuing.total}
                  ariaLabel="Tiến độ xin mã vận đơn"
                />
              </div>
            ) : null}
            <DialogFooter className="border-t px-5 py-3">
              <Button type="button" onClick={onClose}>
                Đóng
              </Button>
            </DialogFooter>
          </>
        )
      }
    />
  );
}

function CheckField({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<ShippingOptionsFormValues>>;
  name:
    | 'shopPaysFee'
    | 'byAir'
    | 'dropAtPostOffice'
    | 'allowInspection'
    | 'callShopOnFailure'
    | 'customPickup';
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 space-y-0">
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              aria-label={label}
            />
          </FormControl>
          <FormLabel className="cursor-pointer font-normal">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}

/** "15:11" nếu hôm nay, còn lại "21:12 08/09/2026" — như cột thời gian trên Pancake. */
function when(iso: string): string {
  const today = toLocalDateKey(new Date());
  return toLocalDateKey(iso) === today ? formatTime(iso) : `${formatTime(iso)} ${formatDate(iso)}`;
}

const OUTCOME_LABEL: Record<SendOrderToCarrierItem['outcome'], string> = {
  ISSUED: 'đã có vận đơn',
  ALREADY_ISSUED: 'đã có vận đơn từ trước',
  QUEUED: 'hãng chưa phản hồi, sẽ thử lại',
  SAVED: 'đã gán hãng, cấp vận đơn khi đóng gói',
};

/** Toast kết quả: một câu tổng + từng nhóm kết cục, đơn hỏng kèm số đơn để tìm lại. */
function announce(carrierCode: string, r: SendOrdersToCarrierResult, skipped: number) {
  const groups = (Object.keys(OUTCOME_LABEL) as SendOrderToCarrierItem['outcome'][])
    .map((k) => ({ k, n: r.sent.filter((s) => s.outcome === k).length }))
    .filter((g) => g.n > 0)
    .map((g) => `${g.n} ${OUTCOME_LABEL[g.k]}`);
  if (skipped > 0) groups.push(`${skipped} đơn đã chốt/hủy bỏ qua`);
  const failedDocs = r.failed.map((f) => f.docNumber ?? f.orderId.slice(0, 8)).join(', ');
  if (r.failed.length > 0) groups.push(`${r.failed.length} không gửi được: ${failedDocs}`);
  if (r.sent.length === 0) {
    toast.error(`Không gửi được đơn nào sang ${carrierCode}`, {
      description: groups.join(' · ') || undefined,
      duration: 10_000,
    });
    return;
  }
  toast.success(`Đã gửi ${r.sent.length} đơn sang ${carrierCode}`, {
    description: groups.join(' · ') || undefined,
    duration:
      r.failed.length > 0 || r.sent.some((s) => s.outcome === 'QUEUED') ? 10_000 : undefined,
  });
}
