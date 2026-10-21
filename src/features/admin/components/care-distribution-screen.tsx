'use client';

import Decimal from 'decimal.js';
import { History, Info, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
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
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatDateTime, groupVi, toLocalDateKey } from '@/lib/format';
import {
  useCareDistribution,
  useRunCareDistribution,
  useUpdateCareDistribution,
  type CareDistributionConfig,
  type CareDistributionRun,
} from '../api/use-care-distribution';

/**
 * Chia khách cho team CSKH (CSKH-6, 2026-10-21, docs/PLAN-cskh.md §3.6) — quản trị đặt % khách mới
 * chia về từng team CSKH; job 00:05 chia khách tạo hôm trước (chưa thuộc team CSKH nào). Tổng % các
 * team > 0 phải đúng 100 mới lưu được (API kiểm lại, 422). Xem trước "sẽ nhận" dùng đúng phương pháp
 * phần dư lớn nhất như API.
 */
const PERCENT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;
const DAY_LABEL = (day: string) => formatDate(`${day}T00:00:00+07:00`);

/** Lỗi lưu ở lượt chia là chuỗi do server ghi — chỉ hiện câu đã dịch (luật 6). */
export function runErrorText(error: string): string {
  return /Chưa cấu hình/.test(error)
    ? 'Chưa cấu hình % chia khách cho team CSKH nào'
    : 'Lượt chia bị lỗi — báo quản trị hệ thống kiểm tra nhật ký worker';
}

/** Phần dư lớn nhất — xem trước số khách mỗi team nhận (khớp distribution-alloc.ts của API). */
export function previewCounts(total: number, shares: { id: string; percent: string }[]) {
  const exact = shares.map((s, i) => {
    const q = new Decimal(total).mul(PERCENT.test(s.percent) ? s.percent : 0).div(100);
    return { id: s.id, i, base: q.floor().toNumber(), frac: q.minus(q.floor()), pct: s.percent };
  });
  let left = total - exact.reduce((n, e) => n + e.base, 0);
  const out = new Map(exact.map((e) => [e.id, e.base]));
  for (const e of [...exact]
    .filter((x) => PERCENT.test(x.pct) && new Decimal(x.pct).gt(0))
    .sort((a, b) => b.frac.comparedTo(a.frac) || a.i - b.i)) {
    if (left <= 0) break;
    out.set(e.id, out.get(e.id)! + 1);
    left--;
  }
  return out;
}

export function CareDistributionScreen() {
  const query = useCareDistribution();
  return (
    <QueryState
      query={query}
      skeleton={
        <>
          <PageHeader title="Chia khách cho team CSKH" description="Đang tải cấu hình…" />
          <ListSkeleton rows={6} columns={4} />
        </>
      }
      isEmpty={(d) => d.teams.length === 0}
      empty={
        <>
          <PageHeader
            title="Chia khách cho team CSKH"
            breadcrumb={[{ label: 'Quản trị' }, { label: 'Chia khách CSKH' }]}
          />
          <EmptyState
            icon={Shuffle}
            title="Chưa có team CSKH"
            description="Team CSKH là phòng ban loại “Chăm sóc khách hàng”. Tạo phòng ban đó ở Sơ đồ nhân sự rồi quay lại đặt tỷ lệ."
            action={
              <Button variant="outline" asChild>
                <Link href="/admin/org-tree">Mở Sơ đồ nhân sự</Link>
              </Button>
            }
          />
        </>
      }
    >
      {(data) => <DistributionBody key={data.runs[0]?.id ?? 'none'} data={data} />}
    </QueryState>
  );
}

function DistributionBody({ data }: { data: CareDistributionConfig }) {
  const update = useUpdateCareDistribution();
  const [pct, setPct] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.teams.map((t) => [t.teamId, new Decimal(t.percent).toString()])),
  );
  const [sample, setSample] = useState('100');
  const [runOpen, setRunOpen] = useState(false);

  const invalid = data.teams.filter((t) => !PERCENT.test(pct[t.teamId] ?? ''));
  const total = data.teams.reduce(
    (s, t) => (PERCENT.test(pct[t.teamId] ?? '') ? s.plus(pct[t.teamId]!) : s),
    new Decimal(0),
  );
  const ok = invalid.length === 0 && total.eq(100);
  const dirty = data.teams.some(
    (t) => !new Decimal(t.percent).eq(PERCENT.test(pct[t.teamId] ?? '') ? pct[t.teamId]! : -1),
  );
  const n = /^\d{1,6}$/.test(sample) ? Number.parseInt(sample, 10) : 0;
  const gets = previewCounts(
    n,
    data.teams.map((t) => ({ id: t.teamId, percent: pct[t.teamId] ?? '0' })),
  );
  const diff = new Decimal(100).minus(total);
  const staffTotal = data.teams.reduce((s, t) => s + t.memberCount, 0);

  const save = () =>
    update.mutate(
      {
        items: data.teams.map((t) => ({
          teamId: t.teamId,
          percent: new Decimal(pct[t.teamId]!).toString(),
        })),
      },
      {
        onSuccess: () => toast.success('Đã lưu thay đổi'),
        onError: (err) => toast.error(messageFor(err)),
      },
    );

  const last = data.runs[0];

  return (
    <>
      <PageHeader
        title="Chia khách cho team CSKH"
        description={
          data.cron === 'off'
            ? 'Lịch chia tự động đang TẮT — chỉ chia khi bấm “Chạy lại cho ngày…”.'
            : 'Mỗi ngày lúc 00:05 hệ thống chia khách tạo hôm trước (chưa thuộc team CSKH nào) theo tỷ lệ dưới đây. Sale vẫn giữ khách của mình.'
        }
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Chia khách CSKH' }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setRunOpen(true)}>
              <History aria-hidden />
              Chạy lại cho ngày…
            </Button>
            <Button
              onClick={save}
              disabled={!ok || !dirty}
              loading={update.isPending}
              loadingText="Đang lưu…"
            >
              Lưu thay đổi
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <section aria-labelledby="ratio" className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            <h2 id="ratio" className="text-base font-semibold">
              Tỷ lệ theo team
            </h2>
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              Ví dụ cho
              <Input
                aria-label="Số khách ví dụ"
                className="h-7 w-20 text-right tabular-nums"
                inputMode="numeric"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
              />
              khách
            </label>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team CSKH</TableHead>
                <TableHead className="text-right">Nhân viên</TableHead>
                <TableHead className="text-right">Tỷ lệ</TableHead>
                <TableHead className="text-right">Sẽ nhận</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.teams.map((t) => {
                const v = pct[t.teamId] ?? '';
                const bad = !PERCENT.test(v);
                return (
                  <TableRow key={t.teamId}>
                    <TableCell>
                      <span className="font-semibold">{t.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{t.code}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.memberCount}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <Input
                          aria-label={`Tỷ lệ % cho ${t.name}`}
                          aria-invalid={bad}
                          className="h-7 w-20 text-right tabular-nums"
                          inputMode="decimal"
                          value={v}
                          onChange={(e) =>
                            setPct((p) => ({ ...p, [t.teamId]: e.target.value.replace(',', '.') }))
                          }
                        />
                        <span className="text-muted-foreground">%</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ok ? (
                        <>
                          <b className="font-semibold">
                            {groupVi(String(gets.get(t.teamId) ?? 0))}
                          </b>{' '}
                          <span className="text-muted-foreground">khách</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell className="font-semibold">Tổng</TableCell>
                <TableCell className="text-right tabular-nums">{staffTotal}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {total.toString()} %
                </TableCell>
                <TableCell className="text-right">
                  {invalid.length > 0 ? (
                    <StatusBadge tone="warn">Tỷ lệ không hợp lệ</StatusBadge>
                  ) : ok ? (
                    <StatusBadge tone="ok">Đủ 100%</StatusBadge>
                  ) : (
                    <StatusBadge tone="warn">
                      {diff.gt(0)
                        ? `Còn thiếu ${diff.toString()}%`
                        : `Thừa ${diff.negated().toString()}%`}
                    </StatusBadge>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="border-t px-3 py-2 text-sm text-muted-foreground">
            Tổng phải đúng 100% mới lưu được. Team để 0% không nhận khách mới. Số khách lẻ dồn cho
            team có phần dư lớn nhất, khách được rải xen kẽ theo giờ tạo.
          </p>
        </section>

        <section aria-labelledby="last" className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <h2 id="last" className="text-base font-semibold">
              Lượt chia gần nhất
            </h2>
            {last ? <RunStatus run={last} className="ml-auto" /> : null}
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            {last ? (
              <>
                <p>
                  <span className="text-2xl font-semibold tabular-nums">
                    {last.error ? '—' : groupVi(String(last.total))}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    khách tạo ngày {DAY_LABEL(last.day)} · chạy {formatDateTime(last.startedAt)}
                    {last.actorName ? ` · ${last.actorName}` : ''}
                  </span>
                </p>
                {last.perTeam.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {last.perTeam.map((p) => (
                      <li key={p.teamId} className="rounded-md bg-muted px-2.5 py-2">
                        <div className="text-xs text-muted-foreground">{p.teamName}</div>
                        <b className="font-semibold tabular-nums">{groupVi(String(p.count))}</b>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Chưa có lượt chia nào.</p>
            )}
            <p className="flex items-start gap-2 rounded-md border border-info-line bg-info-weak px-2.5 py-2 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
              Khách CSKH tự tạo khi lên đơn đã thuộc team ngay lúc tạo, không vào lượt chia. Lượt
              đêm tự chạy bù những ngày bị lỡ trong 7 ngày gần nhất.
            </p>
          </div>
        </section>
      </div>

      <section aria-labelledby="hist" className="mt-3 overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <h2 id="hist" className="text-base font-semibold">
            Lịch sử chia khách
          </h2>
          <span className="ml-auto text-sm text-muted-foreground">30 lượt gần nhất</span>
        </div>
        {data.runs.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground">Chưa có lượt chia nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khách tạo ngày</TableHead>
                  <TableHead>Lúc chạy</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead>Theo team</TableHead>
                  <TableHead>Người chạy</TableHead>
                  <TableHead>Kết quả</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">{DAY_LABEL(r.day)}</TableCell>
                    <TableCell className="tabular-nums">{formatDateTime(r.startedAt)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {r.error ? '—' : groupVi(String(r.total))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.perTeam.length
                        ? r.perTeam.map((p) => `${p.teamName}: ${p.count}`).join(' · ')
                        : '—'}
                    </TableCell>
                    <TableCell>{r.actorName ?? '—'}</TableCell>
                    <TableCell>
                      <RunStatus run={r} />
                      {r.error ? (
                        <span className="ml-2 text-sm text-muted-foreground">
                          {runErrorText(r.error)}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {runOpen ? <RunDialog onClose={() => setRunOpen(false)} /> : null}
    </>
  );
}

function RunStatus({ run, className }: { run: CareDistributionRun; className?: string }) {
  if (!run.finishedAt)
    return (
      <StatusBadge tone="draft" className={className}>
        Đang chạy
      </StatusBadge>
    );
  return run.error ? (
    <StatusBadge tone="err" className={className}>
      Lỗi
    </StatusBadge>
  ) : (
    <StatusBadge tone="ok" className={className}>
      Thành công
    </StatusBadge>
  );
}

function RunDialog({ onClose }: { onClose: () => void }) {
  const run = useRunCareDistribution();
  const today = toLocalDateKey(new Date()) ?? '';
  const [day, setDay] = useState(() =>
    new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10),
  );
  const submit = () =>
    run.mutate(day, {
      onSuccess: (r) => {
        if (r.error) toast.error(runErrorText(r.error));
        else
          toast.success(`Đã chia ${groupVi(String(r.total))} khách tạo ngày ${DAY_LABEL(r.day)}`);
        onClose();
      },
      onError: (err) => toast.error(messageFor(err)),
    });
  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chạy lại cho ngày</DialogTitle>
          <DialogDescription>
            Chia khách tạo trong ngày đã chọn mà chưa thuộc team CSKH nào, theo tỷ lệ đang lưu. Chạy
            lại nhiều lần không chia trùng.
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted-foreground">
          Khách tạo ngày
          <Input
            type="date"
            value={day}
            max={today}
            onChange={(e) => setDay(e.target.value)}
            aria-label="Khách tạo ngày"
            className="w-48"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={submit}
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(day)}
            loading={run.isPending}
            loadingText="Đang chia…"
          >
            Chạy chia khách
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
