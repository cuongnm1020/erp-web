'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data/states';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { newIdempotencyKey } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatMoney, formatPhone, toDecimal } from '@/lib/format';
import {
  useDuplicateCompare,
  useMergeCustomers,
  type CompareCustomer,
  type MergeField,
  type MergeFieldChoices,
  type MergeResult,
} from '../api/use-customer-merge';
import { customerTypeLabel } from '../labels';
import { CONSENT_CHANNEL_LABEL, MERGE_FIELD_LABEL, nonZero, sourceLabel } from '../merge-labels';
import { formatAddress } from './customer-address-section';
import { TagChip } from './tag-chip';

type Choice = 'survivor' | 'merged';

interface FieldDef {
  key: MergeField;
  /** Giá trị chuẩn để so "giống nhau" — null = trống. */
  raw: (c: CompareCustomer) => string | null;
  show: (c: CompareCustomer) => ReactNode;
}

const FIELDS: FieldDef[] = [
  { key: 'name', raw: (c) => c.name.trim() || null, show: (c) => c.name },
  {
    key: 'phone',
    raw: (c) => c.normalizedPhone ?? c.phone,
    show: (c) => <span className="font-mono text-xs">{formatPhone(c.phone)}</span>,
  },
  { key: 'email', raw: (c) => c.email, show: (c) => c.email },
  {
    key: 'taxCode',
    raw: (c) => c.taxCode,
    show: (c) => <span className="font-mono text-xs">{c.taxCode}</span>,
  },
  { key: 'type', raw: (c) => c.type, show: (c) => customerTypeLabel(c.type) },
  { key: 'groupId', raw: (c) => c.groupId, show: (c) => c.group?.name ?? null },
  { key: 'tierId', raw: (c) => c.tierId, show: (c) => c.tier?.name ?? null },
  {
    key: 'priceListId',
    raw: (c) => c.priceListId,
    show: (c) => (c.priceListId ? 'Có bảng giá riêng' : null),
  },
  {
    key: 'creditLimit',
    raw: (c) => toDecimal(c.creditLimit)?.toString() ?? null,
    show: (c) => <span className="tabular-nums">{formatMoney(c.creditLimit)}</span>,
  },
  {
    key: 'paymentTerm',
    raw: (c) => (c.paymentTerm === null ? null : String(c.paymentTerm)),
    show: (c) => (c.paymentTerm === null ? null : `${c.paymentTerm} ngày`),
  },
];

/** Mặc định giữ giá trị bản GIỮ; bản giữ trống mà bản bị gộp có → lấy của bản bị gộp. */
function defaultChoices(s: CompareCustomer, m: CompareCustomer): Record<MergeField, Choice> {
  const out = {} as Record<MergeField, Choice>;
  for (const f of FIELDS)
    out[f.key] = f.raw(s) === null && f.raw(m) !== null ? 'merged' : 'survivor';
  return out;
}

/** Chỉ gửi trường lấy từ bản bị gộp, và chỉ khi hai bên khác nhau. */
function toFieldChoices(
  s: CompareCustomer,
  m: CompareCustomer,
  choices: Record<MergeField, Choice>,
): MergeFieldChoices | undefined {
  const out: MergeFieldChoices = {};
  for (const f of FIELDS) {
    if (choices[f.key] === 'merged' && f.raw(s) !== f.raw(m)) out[f.key] = 'merged';
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function Empty() {
  return <span className="text-muted-foreground">(trống)</span>;
}

export interface MergedSummary {
  result: MergeResult;
  survivor: { id: string; code: string; name: string };
  merged: { id: string; code: string; name: string };
}

/**
 * Khung so sánh 2 hồ sơ (GET /customers/duplicates/compare). Bản giữ mặc định = `suggestedId`
 * (gợi ý của API) → `keepId` trên URL thắng nếu thuộc cặp đang chọn.
 */
export function MergeComparePanel({
  ids,
  suggestedId,
  keepId,
  onKeepChange,
  onClear,
  onMerged,
}: {
  ids: readonly string[];
  suggestedId?: string;
  keepId?: string;
  onKeepChange: (id: string) => void;
  onClear: () => void;
  onMerged: (summary: MergedSummary) => void;
}) {
  const query = useDuplicateCompare(ids);

  if (query.isPending) {
    return (
      <div className="rounded-md border bg-card p-3">
        <ListSkeleton rows={12} columns={3} />
      </div>
    );
  }
  if (query.error || !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  if (data.customers.length !== 2) {
    return (
      <EmptyState
        title="Chọn đúng 2 hồ sơ để so sánh"
        description="Gộp đi theo từng cặp: một hồ sơ giữ lại, một hồ sơ gộp vào."
        action={
          <Button variant="outline" onClick={onClear}>
            Bỏ chọn
          </Button>
        }
      />
    );
  }

  const pick = (id: string | undefined) => data.customers.find((c) => c.id === id);
  const busiest = [...data.customers].sort((a, b) => b.orders.total - a.orders.total)[0]!;
  const survivor = pick(keepId) ?? pick(suggestedId) ?? busiest;
  const merged = data.customers.find((c) => c.id !== survivor.id)!;

  return (
    <CompareBody
      key={`${survivor.id}:${merged.id}`}
      customers={data.customers}
      survivor={survivor}
      merged={merged}
      samePhone={data.samePhone}
      onKeepChange={onKeepChange}
      onClear={onClear}
      onMerged={onMerged}
    />
  );
}

function CompareBody({
  customers,
  survivor,
  merged,
  samePhone,
  onKeepChange,
  onClear,
  onMerged,
}: {
  customers: CompareCustomer[];
  survivor: CompareCustomer;
  merged: CompareCustomer;
  samePhone: boolean;
  onKeepChange: (id: string) => void;
  onClear: () => void;
  onMerged: (summary: MergedSummary) => void;
}) {
  const [choices, setChoices] = useState(() => defaultChoices(survivor, merged));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const roleOf = (c: CompareCustomer): Choice => (c.id === survivor.id ? 'survivor' : 'merged');

  const infoRow = (label: string, render: (c: CompareCustomer) => ReactNode) => (
    <TableRow key={label}>
      <TableCell className="px-2.5 py-1.5 align-top text-muted-foreground">{label}</TableCell>
      {customers.map((c) => (
        <TableCell key={c.id} className="px-2.5 py-1.5 align-top">
          {render(c)}
        </TableCell>
      ))}
    </TableRow>
  );

  return (
    <div className="rounded-md border bg-card">
      <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
        <span className="font-semibold">
          So sánh cặp{' '}
          <span className="font-mono text-xs font-normal">{formatPhone(survivor.phone)}</span>
        </span>
        <span className="text-xs text-muted-foreground">chọn giá trị giữ lại cho từng trường</span>
      </header>
      {!samePhone ? (
        <p
          role="note"
          className="flex items-center gap-2 border-b bg-warning/10 px-3 py-2 text-sm text-warning"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Hai hồ sơ khác số điện thoại chuẩn hoá — gộp sẽ cần xác nhận thêm một lần.
        </p>
      ) : null}
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className="w-36 px-2.5 text-xs">Trường</TableHead>
            {customers.map((c) => (
              <TableHead key={c.id} className="px-2.5 text-xs">
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="merge-survivor"
                    className="accent-primary"
                    checked={c.id === survivor.id}
                    onChange={() => onKeepChange(c.id)}
                    aria-label={`Giữ lại ${c.code}`}
                  />
                  <StatusBadge tone={c.id === survivor.id ? 'ok' : 'neutral'}>
                    {c.id === survivor.id ? 'Giữ lại' : 'Gộp vào'}
                  </StatusBadge>
                  <span
                    className={cn('font-mono', c.id === survivor.id && 'text-primary')}
                    title={c.name}
                  >
                    {c.code}
                  </span>
                </label>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {FIELDS.map((f) => {
            const a = f.raw(survivor);
            const same = a === f.raw(merged);
            const label = MERGE_FIELD_LABEL[f.key];
            if (same) {
              return (
                <TableRow key={f.key}>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{label}</TableCell>
                  <TableCell className="px-2.5 py-1.5" colSpan={customers.length}>
                    {a === null ? <Empty /> : f.show(survivor)}{' '}
                    <span className="text-muted-foreground">· giống nhau</span>
                  </TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow key={f.key}>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">{label}</TableCell>
                {customers.map((c) => {
                  const on = choices[f.key] === roleOf(c);
                  return (
                    <TableCell key={c.id} className="px-2.5 py-1.5">
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          type="radio"
                          name={`merge-field-${f.key}`}
                          className="accent-primary"
                          checked={on}
                          onChange={() => setChoices((p) => ({ ...p, [f.key]: roleOf(c) }))}
                          aria-label={`${label}: lấy của ${c.code}`}
                        />
                        <span className={on ? 'font-semibold' : undefined}>
                          {f.raw(c) === null ? <Empty /> : f.show(c)}
                        </span>
                      </label>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
          {infoRow('Địa chỉ giao', (c) =>
            c.addresses.length === 0 ? (
              <Empty />
            ) : (
              <span>
                {formatAddress(c.addresses.find((a) => a.isDefault) ?? c.addresses[0]!)}
                {c.addresses.length > 1 ? (
                  <span className="text-muted-foreground">
                    {' '}
                    (+{c.addresses.length - 1} địa chỉ)
                  </span>
                ) : null}
              </span>
            ),
          )}
          {infoRow('Tag', (c) =>
            c.tags.length === 0 ? (
              <Empty />
            ) : (
              <span className="flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <TagChip key={t.id} name={t.name} color={t.color} />
                ))}
              </span>
            ),
          )}
          {infoRow('Nhân viên phụ trách', (c) =>
            c.owners.length === 0 ? <Empty /> : c.owners.map((o) => o.name).join(', '),
          )}
          {infoRow('Team', (c) =>
            c.teams.length === 0 ? <Empty /> : c.teams.map((t) => t.name).join(', '),
          )}
          {infoRow('Nguồn', (c) => (
            <span className="flex flex-col gap-0.5">
              <span>{sourceLabel(c.source)}</span>
              {c.pancake ? (
                <span className="text-xs text-muted-foreground">
                  shop <span className="font-mono">{c.pancake.shopId}</span> · mã{' '}
                  <span className="font-mono">{c.pancake.externalId}</span>
                  {c.pancake.conversationLink ? (
                    <>
                      {' · '}
                      <a
                        href={c.pancake.conversationLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
                      >
                        Mở hội thoại Pancake
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    </>
                  ) : null}
                </span>
              ) : null}
            </span>
          ))}
          {infoRow('Đồng ý marketing', (c) =>
            c.consents.length === 0 ? (
              <span className="text-muted-foreground">Chưa ghi nhận</span>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {c.consents.map((k) => (
                  <li key={k.channel}>
                    {CONSENT_CHANNEL_LABEL[k.channel]} {k.granted ? 'đồng ý' : 'từ chối'}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({k.source}, {formatDate(k.recordedAt)})
                    </span>
                  </li>
                ))}
              </ul>
            ),
          )}
          {infoRow('Đơn hàng', (c) => (
            <span className="flex flex-col gap-0.5 tabular-nums">
              <span>
                {c.orders.total} đơn · {c.orders.posted} đã chốt · {c.orders.open} đang mở
              </span>
              <span className="text-xs text-muted-foreground">
                tổng đơn {formatMoney(c.orders.revenue)}
                {c.orders.lastOrderAt ? ` · gần nhất ${formatDate(c.orders.lastOrderAt)}` : ''}
              </span>
            </span>
          ))}
          {infoRow('Công nợ', (c) =>
            c.openInvoices === 0 ? (
              <span className="text-muted-foreground">Không có hoá đơn còn mở</span>
            ) : (
              <span className="tabular-nums">{c.openInvoices} hoá đơn còn mở</span>
            ),
          )}
          {infoRow('Dữ liệu liên kết', (c) => {
            const refs = nonZero(c.references);
            return refs.length === 0 ? (
              <Empty />
            ) : (
              <ul className="flex flex-col gap-0.5 text-xs">
                {refs.map((r) => (
                  <li key={r.key}>
                    {r.label}: <span className="tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3 border-t px-3 py-2.5">
        <p className="text-sm text-muted-foreground">
          Sau khi gộp: đơn đang mở, địa chỉ, tag và liên kết của{' '}
          <span className="font-mono text-xs">{merged.code}</span> dồn về{' '}
          <span className="font-mono text-xs">{survivor.code}</span>.{' '}
          <span className="font-semibold text-foreground">
            {merged.orders.posted} đơn đã chốt vẫn nằm ở hồ sơ cũ
          </span>
          , hồ sơ cũ ngừng hoạt động và trỏ sang khách giữ.
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClear}>
            Bỏ chọn
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            Gộp và giữ {survivor.code}
          </Button>
        </div>
      </div>
      <MergeConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        survivor={survivor}
        merged={merged}
        fieldChoices={toFieldChoices(survivor, merged, choices)}
        onMerged={onMerged}
      />
    </div>
  );
}

function MergeConfirmDialog({
  open,
  onOpenChange,
  survivor,
  merged,
  fieldChoices,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survivor: CompareCustomer;
  merged: CompareCustomer;
  fieldChoices: MergeFieldChoices | undefined;
  onMerged: (summary: MergedSummary) => void;
}) {
  const merge = useMergeCustomers();
  const [phoneMismatch, setPhoneMismatch] = useState<{
    survivorPhone: string | null;
    mergedPhone: string | null;
  } | null>(null);
  // Key sinh LÚC BẤM (luật 4); bấm lại sau lỗi mạng dùng lại đúng key. Lần gộp có `force` là
  // yêu cầu khác (body khác) nên dùng key riêng.
  const [keys, setKeys] = useState<{ plain?: string; force?: string }>({});

  const changeOpen = (o: boolean) => {
    if (merge.isPending) return;
    if (!o) {
      setPhoneMismatch(null);
      setKeys({});
    }
    onOpenChange(o);
  };

  const submit = (force: boolean) => {
    const key = (force ? keys.force : keys.plain) ?? newIdempotencyKey();
    setKeys((k) => (force ? { ...k, force: key } : { ...k, plain: key }));
    merge.mutate(
      {
        survivorId: survivor.id,
        mergedId: merged.id,
        fieldChoices,
        force: force || undefined,
        idempotencyKey: key,
      },
      {
        onSuccess: (result) => {
          toast.success('Đã gộp khách', {
            description: `${merged.code} đã gộp vào ${survivor.code}.`,
          });
          setPhoneMismatch(null);
          setKeys({});
          onOpenChange(false);
          onMerged({
            result,
            survivor: { id: survivor.id, code: survivor.code, name: survivor.name },
            merged: { id: merged.id, code: merged.code, name: merged.name },
          });
        },
        onError: (err) => {
          if (isApiError(err) && err.code === 'PHONE_MISMATCH' && !force) {
            const d = (err.details ?? {}) as { survivorPhone?: unknown; mergedPhone?: unknown };
            setPhoneMismatch({
              survivorPhone: typeof d.survivorPhone === 'string' ? d.survivorPhone : survivor.phone,
              mergedPhone: typeof d.mergedPhone === 'string' ? d.mergedPhone : merged.phone,
            });
            return;
          }
          toast.error(messageFor(err));
        },
      },
    );
  };

  const changed = Object.keys(fieldChoices ?? {}) as MergeField[];
  const movedRefs = nonZero(merged.references);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-lg">
        {phoneMismatch ? (
          <>
            <DialogHeader>
              <DialogTitle>Hai khách khác số điện thoại</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{survivor.code}</span>{' '}
                {formatPhone(phoneMismatch.survivorPhone)} và{' '}
                <span className="font-mono">{merged.code}</span>{' '}
                {formatPhone(phoneMismatch.mergedPhone)}. Chỉ gộp khi chắc chắn đây là cùng một
                người — lần gộp được ghi là “gộp thủ công”.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={merge.isPending}
                onClick={() => changeOpen(false)}
              >
                Hủy
              </Button>
              <Button variant="destructive" disabled={merge.isPending} onClick={() => submit(true)}>
                Vẫn gộp
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Gộp {merged.code} vào {survivor.code}?
              </DialogTitle>
              <DialogDescription>
                Giữ lại <span className="font-semibold">{survivor.name}</span> ({survivor.code}). Hồ
                sơ {merged.name} ({merged.code}) ngừng hoạt động và trỏ sang khách giữ.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-sm">
              <section>
                <h3 className="font-medium">Lấy từ hồ sơ {merged.code}</h3>
                {changed.length === 0 ? (
                  <p className="text-muted-foreground">
                    Không trường nào — giữ nguyên thông tin của {survivor.code}.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    {changed.map((f) => MERGE_FIELD_LABEL[f]).join(', ')}
                  </p>
                )}
              </section>
              <section>
                <h3 className="font-medium">Chuyển sang {survivor.code}</h3>
                <p className="text-muted-foreground">
                  {merged.orders.open} đơn đang mở · {merged.addresses.length} địa chỉ giao · tag,
                  người phụ trách, đồng ý marketing và các liên kết khác chưa chốt.
                </p>
                {movedRefs.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Đang gắn với {merged.code}:{' '}
                    {movedRefs.map((r) => `${r.label} ${r.count}`).join(' · ')}
                  </p>
                ) : null}
              </section>
              <section
                role="note"
                className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2"
              >
                <h3 className="font-medium text-warning">Ở lại hồ sơ cũ {merged.code}</h3>
                <p>
                  <span className="font-semibold">
                    {merged.orders.posted} đơn đã chốt vẫn nằm ở hồ sơ cũ, hồ sơ cũ trỏ sang khách
                    giữ.
                  </span>{' '}
                  Hoá đơn đã tất toán, phiếu thu và chứng từ thuộc kỳ đã khoá cũng không chuyển —
                  chứng từ đã chốt không được sửa.
                </p>
              </section>
              <p className="text-xs text-muted-foreground">
                Có thể hoàn tác ngay sau khi gộp hoặc ở tab Lịch sử gộp.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={merge.isPending}
                onClick={() => changeOpen(false)}
              >
                Hủy
              </Button>
              <Button disabled={merge.isPending} onClick={() => submit(false)}>
                Gộp khách
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
