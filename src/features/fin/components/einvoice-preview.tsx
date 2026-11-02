'use client';

import Decimal from 'decimal.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { formatMoney, formatQuantity, moneyInWordsVi, toLocalDateKey } from '@/lib/format';
import { useHotkey } from '@/lib/use-hotkey';
import { useEInvoice, type EInvoiceDetail, type EInvoiceLine } from '../api/use-einvoices';
import { EINVOICE_ISSUE, issueLabel } from '../einvoice-labels';

/**
 * Bản xem trước hóa đơn GTGT — bố cục theo hóa đơn MISA công ty đang phát hành (ký hiệu 1C26MAB):
 * người bán, người mua, bảng hàng (tách ngược VAT), tổng hợp theo thuế suất, số tiền bằng chữ.
 * Số / mã CQT chỉ có sau khi phát hành trên meInvoice — bản nháp để trống.
 */

type RateKey = 'KKKNT' | 'KCT' | '0' | '5' | '8' | '10' | 'OTHER';
const RATE_ROWS: { key: RateKey; label: string }[] = [
  { key: 'KKKNT', label: 'Không kê khai thuế GTGT:' },
  { key: 'KCT', label: 'Không chịu thuế GTGT:' },
  { key: '0', label: 'Thuế suất 0%:' },
  { key: '5', label: 'Thuế suất 5%:' },
  { key: '8', label: 'Thuế suất 8%:' },
  { key: '10', label: 'Thuế suất 10%:' },
  { key: 'OTHER', label: 'Thuế suất KHÁC:' },
];
/** Ô bảng kẻ viền như mẫu in. */
const CELL = 'border px-1.5 py-1';
/** Bảng hàng luôn đủ ít nhất ngần này dòng như mẫu in. */
const MIN_ROWS = 6;

function rateKey(l: EInvoiceLine): RateKey {
  if (l.taxKind === 'NOT_DECLARED') return 'KKKNT';
  if (l.taxKind === 'EXEMPT') return 'KCT';
  const p = l.ratePercent === null ? null : new Decimal(l.ratePercent).toString();
  return p === '0' || p === '5' || p === '8' || p === '10' ? p : 'OTHER';
}

function rateText(l: EInvoiceLine): string {
  if (l.taxKind === 'NOT_DECLARED') return 'KKKNT';
  if (l.taxKind === 'EXEMPT') return 'KCT';
  if (l.ratePercent === null) return 'Chưa gán';
  return `${new Decimal(l.ratePercent).toString()}%`;
}

const money = (v: string | Decimal) =>
  formatMoney(typeof v === 'string' ? v : v.toFixed(0), { unit: '' });

/** "Ngày 22 tháng 10 năm 2026" theo giờ Việt Nam. */
function longDate(iso: string | null): string {
  const key = toLocalDateKey(iso ?? new Date()) ?? '';
  const [y, m, d] = key.split('-');
  return `Ngày ${d} tháng ${m} năm ${y}`;
}

export function InvoicePaper({ inv }: { inv: EInvoiceDetail }) {
  const s = inv.seller;
  const b = inv.buyer;
  const totals = useMemo(() => {
    const m = new Map<RateKey, { net: Decimal; vat: Decimal }>();
    for (const l of inv.lines) {
      const k = rateKey(l);
      const cur = m.get(k) ?? { net: new Decimal(0), vat: new Decimal(0) };
      m.set(k, { net: cur.net.plus(l.netAmount), vat: cur.vat.plus(l.vatAmount) });
    }
    return m;
  }, [inv.lines]);
  const fillers = Math.max(0, MIN_ROWS - inv.lines.length);

  const field = (label: string, value: string | null | undefined, className?: string) => (
    <p className={cn('truncate', className)}>
      {label}: <span className="font-semibold">{value ?? ''}</span>
    </p>
  );

  return (
    <article
      aria-label={`Bản xem trước hóa đơn đơn ${inv.orderDocNumber}`}
      className="space-y-3 rounded-lg border-2 border-primary bg-card p-4 text-sm text-foreground"
    >
      <header className="flex items-start gap-3">
        <div className="flex-1 text-center">
          <h3 className="text-lg font-bold uppercase">Hóa đơn giá trị gia tăng</h3>
          <p className="italic">{longDate(inv.invDate)}</p>
          <p className="italic text-muted-foreground">
            Mã CQT: {inv.invCode ?? '(cấp khi phát hành)'}
          </p>
        </div>
        <div className="space-y-0.5 text-right">
          <p>
            Ký hiệu: <span className="font-semibold">{inv.invSeries ?? s.invSeries ?? '—'}</span>
          </p>
          <p>
            Số: <span className="font-semibold">{inv.invNo ?? '(chưa cấp)'}</span>
          </p>
        </div>
      </header>

      <section aria-label="Người bán" className="space-y-0.5 border-b pb-2">
        <p className="text-base font-bold uppercase">
          {s.name ?? <span className="text-muted-foreground">Tên công ty — nhập ở Cài đặt</span>}
        </p>
        {field('Mã số thuế', s.taxCode)}
        {field('Địa chỉ', s.address)}
        {field('Số tài khoản', s.bank)}
      </section>

      <section aria-label="Người mua" className="space-y-0.5">
        {field('Họ và tên người mua hàng', b.fullName)}
        {field('Tên đơn vị', b.legalName)}
        {field('MST/CCCD chủ hộ', b.taxCode)}
        {field('Địa chỉ', b.address)}
        <div className="grid grid-cols-2 gap-3">
          {field('Điện thoại', b.phone)}
          {field('CCCD người mua', b.idNumber)}
        </div>
        {field('Hình thức thanh toán', 'TM/CK')}
      </section>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="font-semibold">
            <th className={cn(CELL, 'w-8')}>STT</th>
            <th className={CELL}>Tên hàng hóa, dịch vụ</th>
            <th className={cn(CELL, 'w-14')}>Đơn vị tính</th>
            <th className={cn(CELL, 'w-16')}>Số lượng</th>
            <th className={cn(CELL, 'w-24')}>Đơn giá</th>
            <th className={cn(CELL, 'w-24')}>Thành tiền</th>
            <th className={cn(CELL, 'w-16')}>Thuế suất GTGT</th>
            <th className={cn(CELL, 'w-24')}>Tiền thuế GTGT</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={l.key}>
              <td className={cn(CELL, 'text-center')}>{i + 1}</td>
              <td className={CELL}>
                {l.name}
                {l.itemType === 2 ? (
                  <span className="text-muted-foreground"> (hàng khuyến mại)</span>
                ) : null}
              </td>
              <td className={cn(CELL, 'text-center')}>{l.unitName}</td>
              <td className={cn(CELL, 'text-right tabular-nums')}>{formatQuantity(l.quantity)}</td>
              <td className={cn(CELL, 'text-right tabular-nums')}>
                {formatMoney(l.unitPrice, { unit: '', dp: 2 })}
              </td>
              <td className={cn(CELL, 'text-right tabular-nums')}>{money(l.netAmount)}</td>
              <td
                className={cn(
                  CELL,
                  'text-right',
                  l.ratePercent === null && l.taxKind === null && 'text-destructive',
                )}
              >
                {rateText(l)}
              </td>
              <td className={cn(CELL, 'text-right tabular-nums')}>{money(l.vatAmount)}</td>
            </tr>
          ))}
          {Array.from({ length: fillers }, (_, i) => (
            <tr key={`f${i}`} aria-hidden>
              {Array.from({ length: 8 }, (__, j) => (
                <td key={j} className={CELL}>
                  &nbsp;
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="font-semibold">
            <th className={CELL}>Tổng hợp</th>
            <th className={cn(CELL, 'w-32')}>Thành tiền trước thuế GTGT</th>
            <th className={cn(CELL, 'w-28')}>Tiền thuế GTGT</th>
            <th className={cn(CELL, 'w-32')}>Cộng tiền thanh toán</th>
          </tr>
        </thead>
        <tbody>
          {RATE_ROWS.map((r) => {
            const t = totals.get(r.key);
            return (
              <tr key={r.key}>
                <td className={CELL}>{r.label}</td>
                <td className={cn(CELL, 'text-right tabular-nums')}>{t ? money(t.net) : ''}</td>
                <td className={cn(CELL, 'text-right tabular-nums')}>{t ? money(t.vat) : ''}</td>
                <td className={cn(CELL, 'text-right tabular-nums')}>
                  {t ? money(t.net.plus(t.vat)) : ''}
                </td>
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className={CELL}>Tổng cộng:</td>
            <td className={cn(CELL, 'text-right tabular-nums')}>{money(inv.subtotal)}</td>
            <td className={cn(CELL, 'text-right tabular-nums')}>{money(inv.vatAmount)}</td>
            <td className={cn(CELL, 'text-right tabular-nums')}>{money(inv.total)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Số tiền viết bằng chữ:{' '}
        <span className="font-semibold italic">{moneyInWordsVi(inv.total)}</span>
      </p>

      <footer className="grid grid-cols-2 pt-2 text-center">
        <div>
          <p className="font-semibold">Người mua hàng</p>
          <p className="italic text-muted-foreground">(Chữ ký số (nếu có))</p>
        </div>
        <div>
          <p className="font-semibold">Người bán hàng</p>
          <p className="italic text-muted-foreground">(Chữ ký điện tử, Chữ ký số)</p>
        </div>
      </footer>
    </article>
  );
}

/**
 * Hộp xem trước trước khi duyệt: lật qua từng hóa đơn đã chọn (← →), hóa đơn còn vấn đề chặn hiện
 * cảnh báo + link sửa. `onApprove` có → nút "Duyệt n hóa đơn" ở chân.
 */
export function EInvoicePreviewDialog({
  ids,
  open,
  onOpenChange,
  onApprove,
  approving,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApprove?: () => void;
  approving?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (open) setIdx(0);
  }, [open, ids.length]);
  const id = ids[Math.min(idx, ids.length - 1)] ?? '';
  const query = useEInvoice(id, open);
  const go = (d: number) => setIdx((i) => Math.min(Math.max(i + d, 0), ids.length - 1));
  useHotkey('ArrowLeft', () => go(-1), { enabled: open && ids.length > 1 });
  useHotkey('ArrowRight', () => go(1), { enabled: open && ids.length > 1 });

  const blocking = query.data?.issues.filter((i) => EINVOICE_ISSUE[i]?.block) ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !approving && onOpenChange(o)}>
      <DialogContent xl>
        <DialogHeader>
          <DialogTitle>
            Xem trước hóa đơn{ids.length > 1 ? ` ${idx + 1}/${ids.length}` : ''}
            {query.data ? ` · đơn ${query.data.orderDocNumber}` : ''}
          </DialogTitle>
          <DialogDescription>
            Bản nháp theo mẫu hóa đơn GTGT — số hóa đơn và mã CQT có sau khi phát hành trên
            meInvoice.
          </DialogDescription>
        </DialogHeader>
        {blocking.length ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge tone="err">Chưa duyệt được</StatusBadge>
            {blocking.map(issueLabel).join(' · ')} —{' '}
            <Link href={`/fin/einvoices/${id}`} className="text-primary underline">
              Mở hóa đơn để sửa
            </Link>
          </p>
        ) : null}
        <QueryState query={query} skeleton={<DetailSkeleton />}>
          {(inv) => <InvoicePaper inv={inv} />}
        </QueryState>
        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            {ids.length > 1 ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={idx === 0}
                  onClick={() => go(-1)}
                  aria-label="Hóa đơn trước"
                >
                  <ChevronLeft aria-hidden /> Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={idx >= ids.length - 1}
                  onClick={() => go(1)}
                  aria-label="Hóa đơn sau"
                >
                  Sau <ChevronRight aria-hidden />
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={approving} onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            {onApprove ? (
              <Button loading={approving} onClick={onApprove}>
                Duyệt {ids.length} hóa đơn
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
