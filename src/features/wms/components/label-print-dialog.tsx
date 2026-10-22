'use client';

import { Printer, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { carrierSaid, messageFor, messageForCode } from '@/lib/error-messages';
import { usePrint } from '@/lib/print';
import {
  labelUrl,
  useRequestWaybill,
  useShipment,
  useShipmentLabelData,
  type PdaWaybill,
} from '../api/use-pda';
import { carrierAccountOptions, useCarriers } from '../api/use-shipping';
import { WaybillLabel, WaybillLabelPrintSheet, type WaybillOrientation } from './waybill-label';

/** A6 / A5 = PDF của hãng; `ERP_100x75` = nhãn ERP tự vẽ cho máy in nhiệt 3 inch (2026-10-13). */
type PageSize = 'ERP_100x75' | 'A6' | 'A5';
const PAGE_SIZE_KEY = 'erp.pack.labelPageSize';
const ORIENTATION_KEY = 'erp.pack.labelOrientation';

function readPageSize(): PageSize {
  try {
    const v = localStorage.getItem(PAGE_SIZE_KEY);
    return v === 'A5' || v === 'A6' ? v : 'ERP_100x75';
  } catch {
    return 'ERP_100x75';
  }
}

/** Hướng tem đã nhớ — dùng chung với "In lại vận đơn" trên danh sách đơn. */
export function readOrientation(): WaybillOrientation {
  try {
    return localStorage.getItem(ORIENTATION_KEY) === 'portrait' ? 'portrait' : 'landscape';
  } catch {
    return 'landscape';
  }
}

export function rememberOrientation(v: WaybillOrientation) {
  remember(ORIENTATION_KEY, v);
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode — bỏ qua
  }
}

/**
 * Popup nhãn sau khi đóng gói xong (PLAN-barcode-pick-pack D1, quyết định 2 & 5).
 * Rẽ nhánh theo `waybill.outcome` của POST /pda/complete:
 *  - ISSUED / ALREADY_ISSUED → iframe nhãn PDF từ hãng (qua proxy), tự in khi tải xong;
 *  - QUEUED → chờ hãng: poll GET /shipments/:id mỗi 5 s tới khi có vận đơn;
 *  - NO_CARRIER → chọn hãng tại chỗ → POST /shipments/:id/waybill;
 *  - FAILED → lỗi phía mình (thiếu địa chỉ…) — hàng ĐÃ trừ tồn, sửa đơn rồi xin lại;
 *  - hãng không có nhãn (MANUAL → 501) → chỉ in được nhãn ERP tự vẽ.
 * Khổ mặc định là nhãn ERP 100×75 mm (ngang/dọc) cho máy in nhiệt 3 inch; A6/A5 là PDF của hãng.
 * Khổ + hướng giấy nhớ trong localStorage (tiện ích cá nhân, không phải dữ liệu).
 */
export function LabelPrintDialog({
  open,
  waybill,
  orderId,
  onClose,
  closeLabel = 'Đóng và quét đơn tiếp',
}: {
  open: boolean;
  waybill: PdaWaybill | null;
  orderId: string | null;
  onClose: () => void;
  /** Nhãn nút đóng — mở lại từ "Đã đóng gói" thì không phải "quét đơn tiếp". */
  closeLabel?: string;
}) {
  const [pageSize, setPageSize] = useState<PageSize>('ERP_100x75');
  const [orientation, setOrientation] = useState<WaybillOrientation>('landscape');
  useEffect(() => {
    setPageSize(readPageSize());
    setOrientation(readOrientation());
  }, []);
  const changePageSize = (v: PageSize) => {
    setPageSize(v);
    remember(PAGE_SIZE_KEY, v);
  };
  const changeOrientation = (v: WaybillOrientation) => {
    setOrientation(v);
    rememberOrientation(v);
  };

  const [local, setLocal] = useState<PdaWaybill | null>(waybill);
  useEffect(() => setLocal(waybill), [waybill]);
  const shipmentId = local?.shipmentId ?? null;
  const waiting = local?.outcome === 'QUEUED';
  const shipment = useShipment(open && shipmentId ? shipmentId : null, { poll: waiting });
  const trackingNo = local?.trackingNo ?? shipment.data?.trackingNo ?? null;
  const carrierCode = local?.carrierCode ?? shipment.data?.carrierCode ?? null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide hideClose>
        <DialogHeader>
          <DialogTitle>
            {trackingNo ? `Nhãn vận đơn ${trackingNo}` : 'Vận đơn cho kiện vừa đóng'}
          </DialogTitle>
          <DialogDescription>
            {local ? `Phiếu giao ${local.shipmentDocNumber}` : 'Chưa có phiếu giao'}
            {carrierCode ? ` · hãng ${carrierCode}` : ''}
          </DialogDescription>
        </DialogHeader>

        {!local ? (
          <p className="text-sm text-muted-foreground">
            Đơn này không có phiếu giao — báo điều phối kiểm tra.
          </p>
        ) : trackingNo && shipmentId ? (
          <LabelFrame
            shipmentId={shipmentId}
            trackingNo={trackingNo}
            carrierCode={carrierCode}
            pageSize={pageSize}
            onPageSize={changePageSize}
            orientation={orientation}
            onOrientation={changeOrientation}
          />
        ) : local.outcome === 'NO_CARRIER' ? (
          <CarrierPicker
            shipmentId={local.shipmentId}
            currentCarrier={local.carrierCode}
            onIssued={(r) =>
              setLocal({
                ...local,
                outcome: r.outcome,
                trackingNo: r.trackingNo,
                carrierCode: r.carrierCode,
                reason: r.reason,
              })
            }
          />
        ) : local.outcome === 'FAILED' ? (
          <div className="rounded-md border border-destructive-line bg-destructive-weak p-3 text-sm">
            <p className="font-medium">Hàng đã trừ tồn nhưng chưa xin được vận đơn.</p>
            <p className="mt-1 text-muted-foreground">
              {local.errorCode ? messageForCode(local.errorCode) : (local.reason ?? '')}
            </p>
            {local.errorCode === 'CARRIER_REJECTED' && local.reason ? (
              <p className="mt-1 font-medium">{carrierSaid(local.reason)}</p>
            ) : null}
            {orderId ? (
              <a
                href={`/crm/orders/${orderId}/edit`}
                className="mt-2 inline-block text-primary hover:underline"
              >
                Sửa đơn rồi xin vận đơn lại
              </a>
            ) : null}
          </div>
        ) : (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-warning-line bg-warning-weak p-3 text-sm"
          >
            <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            <span>
              Hãng chưa cấp vận đơn — đang thử lại, nhãn sẽ hiện ngay khi có.
              {local.reason ? ` (${local.reason})` : ''}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LabelFrame({
  shipmentId,
  trackingNo,
  carrierCode,
  pageSize,
  onPageSize,
  orientation,
  onOrientation,
}: {
  shipmentId: string;
  trackingNo: string;
  carrierCode: string | null;
  pageSize: PageSize;
  onPageSize: (v: PageSize) => void;
  orientation: WaybillOrientation;
  onOrientation: (v: WaybillOrientation) => void;
}) {
  // Hãng nội bộ (MANUAL) không có nhãn PDF → 501: chỉ còn nhãn ERP tự vẽ.
  const supported = carrierCode !== 'MANUAL';
  const erp = pageSize === 'ERP_100x75' || !supported;

  const sizePicker = (
    <Select value={erp ? 'ERP_100x75' : pageSize} onValueChange={(v) => onPageSize(v as PageSize)}>
      <SelectTrigger className="h-9 w-52" aria-label="Khổ nhãn">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ERP_100x75">Tem 100×75 mm (máy in nhiệt)</SelectItem>
        {supported ? <SelectItem value="A6">Khổ A6 dọc (nhãn hãng)</SelectItem> : null}
        {supported ? <SelectItem value="A5">Khổ A5 dọc (nhãn hãng)</SelectItem> : null}
      </SelectContent>
    </Select>
  );

  if (erp) {
    return (
      <ErpLabel
        shipmentId={shipmentId}
        sizePicker={sizePicker}
        orientation={orientation}
        onOrientation={onOrientation}
      />
    );
  }
  return (
    <CarrierPdfLabel
      shipmentId={shipmentId}
      trackingNo={trackingNo}
      pageSize={pageSize === 'A5' ? 'A5' : 'A6'}
      sizePicker={sizePicker}
    />
  );
}

/**
 * Nhãn ERP tự vẽ 100×75 mm: xem trước đúng tỉ lệ thật, tự in một lần khi dữ liệu về (như
 * nhãn PDF của hãng), đổi hướng giấy thì bấm "In lại".
 */
function ErpLabel({
  shipmentId,
  sizePicker,
  orientation,
  onOrientation,
}: {
  shipmentId: string;
  sizePicker: ReactNode;
  orientation: WaybillOrientation;
  onOrientation: (v: WaybillOrientation) => void;
}) {
  const label = useShipmentLabelData(shipmentId);
  const printer = usePrint();
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const autoPrinted = useRef(false);
  const print = printer.print;

  useEffect(() => {
    if (label.data && !autoPrinted.current) {
      autoPrinted.current = true;
      setPrintedAt(new Date());
      print();
    }
  }, [label.data, print]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {sizePicker}
        <Select value={orientation} onValueChange={(v) => onOrientation(v as WaybillOrientation)}>
          <SelectTrigger className="h-9 w-32" aria-label="Hướng giấy">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="landscape">Ngang</SelectItem>
            <SelectItem value="portrait">Dọc</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => {
            setPrintedAt(new Date());
            print();
          }}
          disabled={!label.data}
        >
          <Printer aria-hidden />
          In lại
        </Button>
      </div>
      {label.data ? (
        <>
          <div className="flex justify-center rounded-md border bg-muted p-4">
            <div className="shadow-md">
              <WaybillLabel data={label.data} orientation={orientation} printedAt={printedAt} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Hộp thoại in: chọn máy in tem, khổ giấy 100×75 mm, lề “Không có”, tỉ lệ 100%.
          </p>
          <WaybillLabelPrintSheet
            data={label.data}
            orientation={orientation}
            printedAt={printedAt}
            printer={printer}
          />
        </>
      ) : label.error ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span>{messageFor(label.error)}</span>
          <Button variant="outline" size="sm" onClick={() => void label.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="flex justify-center rounded-md border bg-muted p-4">
          <Skeleton
            style={
              orientation === 'landscape'
                ? { width: '100mm', height: '75mm' }
                : { width: '75mm', height: '100mm' }
            }
          />
        </div>
      )}
    </div>
  );
}

/** Nhãn PDF của hãng (A6/A5) qua proxy API, nhúng iframe và tự in khi tải xong. */
function CarrierPdfLabel({
  shipmentId,
  trackingNo,
  pageSize,
  sizePicker,
}: {
  shipmentId: string;
  trackingNo: string;
  pageSize: 'A6' | 'A5';
  sizePicker: ReactNode;
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // "Tải lại nhãn" dựng lại iframe qua `key`, KHÔNG thêm query chống cache: API validate
  // query chặt (forbidNonWhitelisted) → `&n=` bị 400; nhãn đã trả `Cache-Control: no-store`.
  const [nonce, setNonce] = useState(0);
  const src = labelUrl(shipmentId, pageSize);

  const print = () => {
    try {
      frame.current?.contentWindow?.print();
    } catch {
      toast.error('Trình duyệt không cho in trực tiếp — dùng nút in trong khung nhãn.');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {sizePicker}
        <Button onClick={print} disabled={state !== 'ready'}>
          <Printer aria-hidden />
          In lại
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setState('loading');
            setNonce((n) => n + 1);
          }}
        >
          Tải lại nhãn
        </Button>
        {state === 'loading' ? (
          <span className="text-xs text-muted-foreground">Đang lấy nhãn từ hãng…</span>
        ) : null}
      </div>
      <iframe
        key={nonce}
        ref={frame}
        title={`Nhãn vận đơn ${trackingNo}`}
        src={src}
        className="h-[60vh] w-full rounded-md border bg-card"
        onLoad={() => {
          setState('ready');
          // Tự in ngay khi nhãn tải xong (quyết định: popup hiện và in nhãn).
          try {
            frame.current?.contentWindow?.print();
          } catch {
            // trình duyệt chặn — người dùng bấm "In lại"
          }
        }}
        onError={() => setState('error')}
      />
      {state === 'error' ? (
        <p className="text-sm text-destructive">{messageForCode('CARRIER_LABEL_UNAVAILABLE')}</p>
      ) : null}
    </div>
  );
}

function CarrierPicker({
  shipmentId,
  currentCarrier = null,
  onIssued,
}: {
  shipmentId: string;
  /** Hãng đã gán nhưng chưa cấp vận đơn (lỗi lúc đóng) — chọn sẵn để xin lại. */
  currentCarrier?: string | null;
  onIssued: (r: {
    outcome: PdaWaybill['outcome'];
    trackingNo: string | null;
    carrierCode: string;
    reason: string | null;
  }) => void;
}) {
  const carriers = useCarriers();
  const request = useRequestWaybill();
  const options = carrierAccountOptions(carriers.data);
  // Mặc định: tài khoản đầu (mặc định) của hãng đang gán; chưa tải xong hãng thì chưa chọn.
  const [picked, setPicked] = useState('');
  const value =
    picked || options.find((o) => !o.disabled && o.carrier.code === currentCarrier)?.value || '';
  const option = options.find((o) => o.value === value);
  // Danh mục hãng chưa tải xong vẫn xin lại được theo hãng đang gán.
  const carrierCode = option?.carrier.code ?? (picked ? '' : (currentCarrier ?? ''));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {currentCarrier
          ? `Hãng ${currentCarrier} chưa cấp vận đơn cho kiện này. Xin lại vận đơn (đổi hãng được).`
          : 'Đơn chưa gán hãng vận chuyển. Chọn hãng để xin vận đơn ngay cho kiện này.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={value} onValueChange={setPicked}>
          <SelectTrigger className="h-9 w-64" aria-label="Hãng vận chuyển">
            <SelectValue placeholder={carriers.isPending ? 'Đang tải hãng…' : 'Chọn hãng…'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
                {o.carrier.operations.includes('printLabel') ? '' : ' (không in nhãn được)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!carrierCode || request.isPending}
          onClick={() =>
            request.mutate(
              {
                shipmentId,
                carrierCode,
                // Chỉ gửi tài khoản khi người dùng tự chọn một trong nhiều tài khoản — chọn sẵn
                // thì để server dùng tài khoản đã gán trên đơn (không ghi đè về mặc định).
                ...(picked && option?.accountId && option.carrier.accounts.length > 1
                  ? { carrierAccountId: option.accountId }
                  : {}),
              },
              {
                onSuccess: (r) => onIssued(r),
                onError: (err) => toast.error(messageFor(err)),
              },
            )
          }
        >
          {request.isPending ? 'Đang xin vận đơn…' : 'Xin vận đơn'}
        </Button>
      </div>
      {carriers.error ? (
        <p className="text-sm text-destructive">{messageFor(carriers.error)}</p>
      ) : null}
    </div>
  );
}
