'use client';

import Decimal from 'decimal.js';
import { RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Copyable } from '@/components/data/copy-button';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { NotFoundCard } from '@/components/layout/not-found-screen';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
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
import { isApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useHotkey } from '@/lib/use-hotkey';
import {
  useEInvoice,
  useEInvoiceAction,
  useRebuildEInvoice,
  useUpdateEInvoice,
  type EInvoiceAction,
  type EInvoiceDetail,
  type UpdateEInvoiceInput,
} from '../api/use-einvoices';
import { CARRIER_NAME, EINVOICE_ISSUE, EINVOICE_STATUS, issueLabel } from '../einvoice-labels';

/**
 * Xem trước / chi tiết hóa đơn điện tử (canvas CVnCtWbPyUCdn7pppHaRWX màn 2 + 3): người mua, dòng
 * hàng (tách ngược VAT), tổng theo thuế suất. Chờ duyệt: kế toán sửa SL / tiền khách trả từng dòng
 * (giao một phần) + người mua → "Lưu thay đổi" → "Duyệt". Các bước sau đi theo trạng thái.
 */
export function EInvoiceDetailScreen({ id }: { id: string }) {
  const query = useEInvoice(id);
  if (query.error && isApiError(query.error) && query.error.status === 404) {
    return (
      <NotFoundCard
        title="Không có hóa đơn này"
        path={`/fin/einvoices/${id}`}
        description="Hóa đơn không tồn tại hoặc đã bị xóa."
        backHref="/fin/einvoices"
        backLabel="Về danh sách hóa đơn điện tử"
      />
    );
  }
  return (
    <QueryState query={query} skeleton={<DetailSkeleton />}>
      {(inv) => <Detail inv={inv} />}
    </QueryState>
  );
}

type Edit = { quantity: string; amount: string };
type BuyerKey = keyof EInvoiceDetail['buyer'];

const BUYER_FIELDS: { key: BuyerKey; label: string; span?: boolean; hint?: string }[] = [
  { key: 'legalName', label: 'Tên đơn vị', hint: 'Bỏ trống nếu khách lẻ' },
  { key: 'taxCode', label: 'MST / CCCD chủ hộ' },
  { key: 'fullName', label: 'Họ tên người mua' },
  { key: 'idNumber', label: 'CCCD người mua', hint: '12 chữ số, không bắt buộc' },
  { key: 'address', label: 'Địa chỉ', span: true },
  { key: 'phone', label: 'Điện thoại' },
  { key: 'email', label: 'Email nhận hóa đơn', hint: 'Để trống nếu khách không cần' },
];

const VND = /^\d{1,15}$/;
const QTY = /^\d{1,12}(\.\d{1,6})?$/;

function Detail({ inv }: { inv: EInvoiceDetail }) {
  const ability = useAbility();
  const editable = inv.status === 'PENDING_REVIEW' && ability.can('review', 'Einvoice');
  const update = useUpdateEInvoice(inv.id);
  const rebuild = useRebuildEInvoice(inv.id);
  const action = useEInvoiceAction();

  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [buyer, setBuyer] = useState<Partial<Record<BuyerKey, string>>>({});
  // Bản mới từ server (sau lưu / người khác sửa) → bỏ phần nháp đang gõ.
  useEffect(() => {
    setEdits({});
    setBuyer({});
  }, [inv.version]);

  const dirtyLines = Object.entries(edits).filter(([key, e]) => {
    const l = inv.lines.find((x) => x.key === key);
    return l && (e.quantity !== l.quantity || e.amount !== l.amount);
  });
  const dirtyBuyer = Object.entries(buyer).filter(
    ([k, v]) => (inv.buyer[k as BuyerKey] ?? '') !== v,
  );
  const dirty = dirtyLines.length > 0 || dirtyBuyer.length > 0;
  const invalid = dirtyLines.some(([, e]) => !QTY.test(e.quantity) || !VND.test(e.amount));

  /** Σ tiền khách trả theo bản đang gõ — so với tiền phải xuất. */
  const draftTotal = useMemo(
    () =>
      inv.lines.reduce(
        (s, l) =>
          s.plus(
            VND.test(edits[l.key]?.amount ?? l.amount) ? (edits[l.key]?.amount ?? l.amount) : 0,
          ),
        new Decimal(0),
      ),
    [inv.lines, edits],
  );
  const target = new Decimal(inv.targetAmount);
  const byRate = useMemo(() => {
    const m = new Map<string, { net: Decimal; vat: Decimal }>();
    for (const l of inv.lines) {
      if (l.itemType !== 0) continue;
      const k = l.ratePercent ?? '?';
      const cur = m.get(k) ?? { net: new Decimal(0), vat: new Decimal(0) };
      m.set(k, { net: cur.net.plus(l.netAmount), vat: cur.vat.plus(l.vatAmount) });
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [inv.lines]);

  const save = () => {
    if (!dirty || invalid) return;
    const body: UpdateEInvoiceInput = { version: inv.version };
    if (dirtyLines.length) body.lines = dirtyLines.map(([key, e]) => ({ key, ...e }));
    if (dirtyBuyer.length) {
      body.buyer = Object.fromEntries(dirtyBuyer.map(([k, v]) => [k, v.trim() || null]));
    }
    update.mutate(body, {
      onSuccess: () => toast.success('Đã lưu thay đổi'),
      onError: (e) => toast.error(messageFor(e)),
    });
  };
  useHotkey(
    'mod+s',
    (e) => {
      e.preventDefault();
      save();
    },
    { enabled: editable },
  );

  const run = (a: EInvoiceAction, done: string) =>
    action.mutate(
      { action: a, ids: [inv.id] },
      {
        onSuccess: (r) =>
          r.failed.length ? toast.error(`${r.failed[0]!.message}`) : toast.success(done),
        onError: (e) => toast.error(messageFor(e)),
      },
    );

  const st = EINVOICE_STATUS[inv.status];
  const blocking = inv.issues.filter((i) => EINVOICE_ISSUE[i]?.block);
  const warnings = inv.issues.filter((i) => !EINVOICE_ISSUE[i]?.block);

  return (
    <>
      <PageHeader
        title={
          inv.status === 'ISSUED' && inv.invNo
            ? `Hóa đơn số ${inv.invNo}`
            : `Hóa đơn của đơn ${inv.orderDocNumber}`
        }
        breadcrumb={[
          { label: 'Tài chính', href: '/fin/invoices' },
          { label: 'Hóa đơn điện tử', href: '/fin/einvoices' },
          { label: inv.orderDocNumber },
        ]}
        status={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
        description={
          <>
            Giao thành công {formatDateTime(inv.deliveredAt)} ·{' '}
            {CARRIER_NAME[inv.carrierCode ?? ''] ?? inv.carrierCode ?? 'Không rõ hãng'}
            {inv.trackingNo ? (
              <>
                {' '}
                <Copyable value={inv.trackingNo} label="Chép mã vận đơn">
                  <span className="font-mono">{inv.trackingNo}</span>
                </Copyable>
              </>
            ) : null}{' '}
            · Đơn{' '}
            <Link
              href={`/crm/orders/${inv.salesOrderId}`}
              className="font-mono text-primary underline"
            >
              {inv.orderDocNumber}
            </Link>
          </>
        }
        actions={
          editable ? (
            <>
              <Button
                variant="ghost"
                loading={rebuild.isPending}
                onClick={() =>
                  rebuild.mutate(undefined, {
                    onSuccess: () => toast.success('Đã dựng lại từ đơn'),
                    onError: (e) => toast.error(messageFor(e)),
                  })
                }
              >
                <RotateCcw aria-hidden /> Dựng lại từ đơn
              </Button>
              <Button
                variant="outline"
                disabled={!dirty || invalid}
                loading={update.isPending}
                onClick={save}
                shortcut="Ctrl S"
              >
                Lưu thay đổi
              </Button>
              <Button
                disabled={dirty || blocking.length > 0}
                loading={action.isPending}
                onClick={() => run('approve', 'Đã duyệt hóa đơn')}
              >
                Duyệt
              </Button>
            </>
          ) : (
            <StepActions inv={inv} run={run} pending={action.isPending} />
          )
        }
      />

      {blocking.length || warnings.length || inv.status === 'FAILED' ? (
        <div className="mb-3 space-y-1.5">
          {inv.status === 'FAILED' ? (
            <Banner tone="err" label="Lỗi">
              MISA từ chối: {inv.errorMessage ?? inv.errorCode ?? 'không rõ lý do'}. Bỏ duyệt để sửa
              rồi duyệt và đẩy lại.
            </Banner>
          ) : null}
          {blocking.map((i) => (
            <Banner key={i} tone="err" label="Chặn">
              {issueLabel(i)}
              {i === 'MISSING_TAX_RATE' ? (
                <>
                  {' — '}
                  <Link href="/catalog/products?taxRate=none" className="text-primary underline">
                    Gán thuế suất cho sản phẩm
                  </Link>{' '}
                  rồi bấm Dựng lại từ đơn.
                </>
              ) : i === 'PARTIAL_DELIVERY' ? (
                <>
                  {' '}
                  — hãng thu {formatMoney(inv.collectedAmount)} / đơn{' '}
                  {formatMoney(inv.expectedAmount)}. Sửa số lượng và tiền các dòng khách đã nhận rồi
                  Lưu thay đổi.
                </>
              ) : null}
            </Banner>
          ))}
          {warnings.map((i) => (
            <Banner key={i} tone="warn" label="Cảnh báo">
              {issueLabel(i)}
            </Banner>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-[999_1_40rem] flex-col gap-3">
          <section className="rounded-lg border bg-card">
            <h2 className="flex min-h-11 items-center border-b px-3.5 text-sm font-bold">
              Người mua
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {inv.buyer.customerCode ? `Khách ${inv.buyer.customerCode} · ` : ''}lấy từ khách +
                địa chỉ giao của đơn
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-3.5 md:grid-cols-2">
              {BUYER_FIELDS.map((f) => {
                const value = buyer[f.key] ?? inv.buyer[f.key] ?? '';
                return (
                  <div key={f.key} className={cn('space-y-1', f.span && 'md:col-span-2')}>
                    <Label htmlFor={`buyer-${f.key}`}>
                      {f.label}
                      {f.hint ? (
                        <span className="font-normal text-muted-foreground"> · {f.hint}</span>
                      ) : null}
                    </Label>
                    {editable ? (
                      <Input
                        id={`buyer-${f.key}`}
                        value={value}
                        onChange={(e) => setBuyer((b) => ({ ...b, [f.key]: e.target.value }))}
                      />
                    ) : (
                      <p id={`buyer-${f.key}`} className="min-h-control py-1.5 text-sm">
                        {value || <span className="text-muted-foreground">—</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <h2 className="flex min-h-11 items-center border-b px-3.5 text-sm font-bold">
              Hàng hóa trên hóa đơn
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Tiền khách trả đã gồm thuế → tách ngược, làm tròn từng dòng
              </span>
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-10 px-2.5 text-xs">STT</TableHead>
                    <TableHead className="px-2.5 text-xs">Tên trên hóa đơn</TableHead>
                    <TableHead className="w-16 px-2.5 text-xs">ĐVT</TableHead>
                    <TableHead className="w-28 px-2.5 text-right text-xs">SL</TableHead>
                    <TableHead className="w-32 px-2.5 text-right text-xs">Khách trả</TableHead>
                    <TableHead className="w-20 px-2.5 text-xs">Thuế suất</TableHead>
                    <TableHead className="w-28 px-2.5 text-right text-xs">
                      Đơn giá trước thuế
                    </TableHead>
                    <TableHead className="w-28 px-2.5 text-right text-xs">
                      Thành tiền trước thuế
                    </TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Tiền thuế</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.lines.map((l, i) => {
                    const e = edits[l.key] ?? { quantity: l.quantity, amount: l.amount };
                    const changed = e.quantity !== l.quantity || e.amount !== l.amount;
                    return (
                      <TableRow key={l.key} className={cn(changed && 'bg-warning-weak')}>
                        <TableCell className="px-2.5 py-1.5 text-subtle-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          <div>
                            {l.name}
                            {l.itemType === 2 ? (
                              <StatusBadge tone="neutral" className="ml-2">
                                Khuyến mại
                              </StatusBadge>
                            ) : null}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{l.skuCode}</div>
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">{l.unitName}</TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          {editable ? (
                            <Input
                              aria-label={`Số lượng dòng ${i + 1}`}
                              inputMode="decimal"
                              className="h-button-sm text-right"
                              value={e.quantity}
                              aria-invalid={!QTY.test(e.quantity)}
                              onChange={(ev) =>
                                setEdits((m) => ({
                                  ...m,
                                  [l.key]: { ...e, quantity: ev.target.value.trim() },
                                }))
                              }
                            />
                          ) : (
                            formatQuantity(l.quantity)
                          )}
                          {l.quantity !== l.orderQuantity ||
                          (editable && e.quantity !== l.orderQuantity) ? (
                            <div className="text-xs text-muted-foreground">
                              đơn {formatQuantity(l.orderQuantity)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          {editable ? (
                            <Input
                              aria-label={`Khách trả dòng ${i + 1}`}
                              inputMode="numeric"
                              className="h-button-sm text-right"
                              value={e.amount}
                              aria-invalid={!VND.test(e.amount)}
                              onChange={(ev) =>
                                setEdits((m) => ({
                                  ...m,
                                  [l.key]: { ...e, amount: ev.target.value.replace(/[.\s]/g, '') },
                                }))
                              }
                            />
                          ) : (
                            formatMoney(l.amount, { unit: '' })
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {l.ratePercent === null ? (
                            <StatusBadge tone="err">Chưa gán</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">
                              {l.taxKind === 'TAXABLE' ? `${l.ratePercent}%` : l.taxCode}
                            </StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          {changed ? '…' : formatMoney(l.unitPrice, { unit: '', dp: 2 })}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          {changed ? '…' : formatMoney(l.netAmount, { unit: '' })}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          {changed ? '…' : formatMoney(l.vatAmount, { unit: '' })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-1 bg-background px-3.5 py-2.5 text-sm text-muted-foreground">
              <p>
                Phí giao hàng không đưa lên hóa đơn. Giảm giá cấp đơn đã trừ vào tiền từng dòng.
              </p>
              {editable && dirtyLines.length ? (
                <p className={cn(!draftTotal.equals(target) && 'text-destructive')}>
                  Tổng khách trả đang sửa {formatMoney(draftTotal.toFixed(0))} — tiền phải xuất{' '}
                  {formatMoney(inv.targetAmount)}. Lưu thay đổi để tính lại thuế.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_22rem] flex-col gap-3 lg:max-w-md">
          <section className="rounded-lg border bg-card">
            <h2 className="flex min-h-11 items-center border-b px-3.5 text-sm font-bold">
              Hóa đơn
            </h2>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-2.5 gap-y-2 px-3.5 py-3 text-sm">
              <dt className="text-muted-foreground">Ký hiệu</dt>
              <dd className="font-mono text-xs">{inv.invSeries ?? 'Theo cài đặt khi đẩy'}</dd>
              {inv.invNo ? (
                <>
                  <dt className="text-muted-foreground">Số hóa đơn</dt>
                  <dd className="font-bold">{inv.invNo}</dd>
                  <dt className="text-muted-foreground">Ngày hóa đơn</dt>
                  <dd>{formatDateTime(inv.invDate)}</dd>
                </>
              ) : null}
              {inv.transactionId ? (
                <>
                  <dt className="text-muted-foreground">Mã tra cứu</dt>
                  <dd>
                    <Copyable value={inv.transactionId} label="Chép mã tra cứu">
                      <span className="font-mono text-xs">{inv.transactionId}</span>
                    </Copyable>
                  </dd>
                </>
              ) : null}
              {inv.invCode ? (
                <>
                  <dt className="text-muted-foreground">Mã CQT</dt>
                  <dd className="break-all font-mono text-xs">{inv.invCode}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Mã tham chiếu</dt>
              <dd>
                <Copyable value={inv.id} label="Chép mã tham chiếu MISA">
                  <span className="font-mono text-xs">{inv.id.slice(0, 8)}…</span>
                </Copyable>
              </dd>
              <dt className="text-muted-foreground">Duyệt</dt>
              <dd>
                {inv.reviewedByName
                  ? `${inv.reviewedByName} · ${formatDateTime(inv.reviewedAt)}`
                  : '—'}
              </dd>
              <dt className="text-muted-foreground">Đẩy MISA</dt>
              <dd>
                {inv.pushedByName ? `${inv.pushedByName} · ${formatDateTime(inv.pushedAt)}` : '—'}
              </dd>
            </dl>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-2.5 text-xs">Thuế suất</TableHead>
                  <TableHead className="px-2.5 text-right text-xs">Trước thuế</TableHead>
                  <TableHead className="px-2.5 text-right text-xs">Thuế</TableHead>
                  <TableHead className="px-2.5 text-right text-xs">Cộng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byRate.map(([rate, v]) => (
                  <TableRow key={rate}>
                    <TableCell className="px-2.5 py-1.5">
                      {rate === '?' ? 'Chưa gán' : `${rate}%`}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right">
                      {formatMoney(v.net.toFixed(0), { unit: '' })}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right">
                      {formatMoney(v.vat.toFixed(0), { unit: '' })}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right">
                      {formatMoney(v.net.plus(v.vat).toFixed(0), { unit: '' })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="px-2.5 py-1.5 font-bold">Tổng cộng</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-bold">
                    {formatMoney(inv.subtotal, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-bold">
                    {formatMoney(inv.vatAmount, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-bold">
                    {formatMoney(inv.total, { unit: '' })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="space-y-1 px-3.5 py-3">
              <p className="text-xs text-muted-foreground">Tổng thanh toán</p>
              <p className="text-kpi font-bold">{formatMoney(inv.total)}</p>
              <p className="text-sm text-muted-foreground">
                Hãng thu{' '}
                {inv.collectedAmount === null ? 'chưa đối soát' : formatMoney(inv.collectedAmount)}{' '}
                · thu hộ của đơn {formatMoney(inv.expectedAmount)} · tiền phải xuất{' '}
                {formatMoney(inv.targetAmount)}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function StepActions({
  inv,
  run,
  pending,
}: {
  inv: EInvoiceDetail;
  run: (a: EInvoiceAction, done: string) => void;
  pending: boolean;
}) {
  const ability = useAbility();
  const review = ability.can('review', 'Einvoice');
  const issue = ability.can('issue', 'Einvoice');
  if (inv.status === 'APPROVED' || inv.status === 'FAILED') {
    return (
      <>
        {review ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run('unapprove', 'Đã bỏ duyệt')}
          >
            Bỏ duyệt
          </Button>
        ) : null}
        {issue ? (
          <Button loading={pending} onClick={() => run('push', 'Đã đẩy nháp lên MISA')}>
            {inv.status === 'FAILED' ? 'Đẩy lại lên MISA' : 'Đẩy nháp lên MISA'}
          </Button>
        ) : null}
      </>
    );
  }
  if (inv.status === 'PUSHED' && issue) {
    return (
      <Button
        variant="outline"
        loading={pending}
        onClick={() => run('withdraw', 'Đã rút nháp khỏi MISA')}
      >
        Rút nháp khỏi MISA
      </Button>
    );
  }
  if (inv.status === 'SKIPPED' && review) {
    return (
      <Button loading={pending} onClick={() => run('unskip', 'Đã mở lại để xuất')}>
        Mở lại để xuất
      </Button>
    );
  }
  return null;
}

function Banner({
  tone,
  label,
  children,
}: {
  tone: 'err' | 'warn';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2 text-sm',
        tone === 'err'
          ? 'border-destructive-line bg-destructive-weak'
          : 'border-warning-line bg-warning-weak',
      )}
    >
      <b className={tone === 'err' ? 'text-destructive' : 'text-warning'}>{label}</b>
      <span>{children}</span>
    </div>
  );
}
