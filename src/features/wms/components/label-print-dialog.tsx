'use client';

import { Printer, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Barcode } from '@/components/data/barcode';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { messageFor, messageForCode } from '@/lib/error-messages';
import { labelUrl, useRequestWaybill, useShipment, type PdaWaybill } from '../api/use-pda';
import { useCarriers } from '../api/use-shipping';

type PageSize = 'A6' | 'A5';
const PAGE_SIZE_KEY = 'erp.pack.labelPageSize';

function readPageSize(): PageSize {
  try {
    const v = localStorage.getItem(PAGE_SIZE_KEY);
    return v === 'A5' ? 'A5' : 'A6';
  } catch {
    return 'A6';
  }
}

/**
 * Popup nhãn sau khi đóng gói xong (PLAN-barcode-pick-pack D1, quyết định 2 & 5).
 * Rẽ nhánh theo `waybill.outcome` của POST /pda/complete:
 *  - ISSUED / ALREADY_ISSUED → iframe nhãn PDF từ hãng (qua proxy), tự in khi tải xong;
 *  - QUEUED → chờ hãng: poll GET /shipments/:id mỗi 5 s tới khi có vận đơn;
 *  - NO_CARRIER → chọn hãng tại chỗ → POST /shipments/:id/waybill;
 *  - FAILED → lỗi phía mình (thiếu địa chỉ…) — hàng ĐÃ trừ tồn, sửa đơn rồi xin lại;
 *  - hãng không có nhãn (MANUAL → 501) → ghi mã vận đơn nội bộ, hiện mã vạch to để chép/dán.
 * Khổ giấy nhớ trong localStorage (tiện ích cá nhân, không phải dữ liệu).
 */
export function LabelPrintDialog({
  open,
  waybill,
  orderId,
  onClose,
}: {
  open: boolean;
  waybill: PdaWaybill | null;
  orderId: string | null;
  onClose: () => void;
}) {
  const [pageSize, setPageSize] = useState<PageSize>('A6');
  useEffect(() => setPageSize(readPageSize()), []);
  const changePageSize = (v: PageSize) => {
    setPageSize(v);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, v);
    } catch {
      // private mode — bỏ qua
    }
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
      <DialogContent className="sm:max-w-2xl" hideClose>
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
          />
        ) : local.outcome === 'NO_CARRIER' ? (
          <CarrierPicker
            shipmentId={local.shipmentId}
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
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">Hàng đã trừ tồn nhưng chưa xin được vận đơn.</p>
            <p className="mt-1 text-muted-foreground">
              {local.errorCode ? messageForCode(local.errorCode) : (local.reason ?? '')}
            </p>
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
            className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
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
            Đóng và quét đơn tiếp
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
}: {
  shipmentId: string;
  trackingNo: string;
  carrierCode: string | null;
  pageSize: PageSize;
  onPageSize: (v: PageSize) => void;
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);
  const src = `${labelUrl(shipmentId, pageSize)}&n=${nonce}`;

  // Hãng nội bộ (MANUAL) không có nhãn → 501: hiện mã vận đơn nội bộ để chép tay, không nhúng iframe.
  const supported = carrierCode !== 'MANUAL';

  const print = () => {
    try {
      frame.current?.contentWindow?.print();
    } catch {
      toast.error('Trình duyệt không cho in trực tiếp — dùng nút in trong khung nhãn.');
    }
  };

  useEffect(() => {
    if (!supported) setState('unsupported');
  }, [supported]);

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border p-4 text-center">
        <p className="text-sm">Hãng này không có nhãn in từ API. Ghi mã vận đơn nội bộ lên kiện:</p>
        <Barcode value={trackingNo} symbology="code128" height={16} scale={3} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={pageSize} onValueChange={(v) => onPageSize(v as PageSize)}>
          <SelectTrigger className="h-9 w-40" aria-label="Khổ nhãn">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A6">Khổ A6 dọc</SelectItem>
            <SelectItem value="A5">Khổ A5 dọc</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={print} disabled={state !== 'ready'}>
          <Printer aria-hidden />
          In lại
        </Button>
        <Button variant="ghost" onClick={() => setNonce((n) => n + 1)}>
          Tải lại nhãn
        </Button>
        {state === 'loading' ? (
          <span className="text-xs text-muted-foreground">Đang lấy nhãn từ hãng…</span>
        ) : null}
      </div>
      <iframe
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
  onIssued,
}: {
  shipmentId: string;
  onIssued: (r: {
    outcome: PdaWaybill['outcome'];
    trackingNo: string | null;
    carrierCode: string;
    reason: string | null;
  }) => void;
}) {
  const carriers = useCarriers();
  const request = useRequestWaybill();
  const [code, setCode] = useState('');
  const options = (carriers.data ?? []).filter((c) => c.isActive);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Đơn chưa gán hãng vận chuyển. Chọn hãng để xin vận đơn ngay cho kiện này.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={code} onValueChange={setCode}>
          <SelectTrigger className="h-9 w-64" aria-label="Hãng vận chuyển">
            <SelectValue placeholder={carriers.isPending ? 'Đang tải hãng…' : 'Chọn hãng…'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
                {c.operations.includes('printLabel') ? '' : ' (không in nhãn được)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!code || request.isPending}
          onClick={() =>
            request.mutate(
              { shipmentId, carrierCode: code },
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
