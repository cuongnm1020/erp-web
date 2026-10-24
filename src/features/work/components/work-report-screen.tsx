'use client';

import { useMemo } from 'react';
import { DateRangePicker, normalizeRange, shiftDay } from '@/components/data/date-range-picker';
import { ErrorState, ListSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { toLocalDateKey } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import type { WorkRequestReport, WorkTaskReport } from '../api/types';
import { useWorkConfig, useWorkRequestReport, useWorkTaskReport } from '../api/use-work';
import { formatDuration, OUTCOME_LABEL } from '../labels';
import { Card, WorkTabs } from './work-ui';

/**
 * Báo cáo công việc & SLA (E1 — docs/screens/FE-WORK-1-work-module.md §8). Quyền `work Report`;
 * API chỉ trả nhánh phòng ban người xem phụ trách (toàn quyền: mọi phòng). URL: ?tab=requests|tasks
 * · ?from= · ?to= · ?dept=
 */
const FILTER_KEYS = ['tab', 'from', 'to', 'dept'] as const;
type RFilter = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };
const TARGET = 90;

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`;
}

function Delta({
  now,
  prev,
  invert = false,
  unit = '',
}: {
  now: number | null;
  prev: number | null;
  invert?: boolean;
  unit?: string;
}) {
  if (now === null || prev === null || prev === undefined) return null;
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return <span className="text-muted-foreground">= kỳ trước</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={cn('font-semibold', good ? 'text-success' : 'text-destructive')}>
      {d > 0 ? '▲' : '▼'} {String(Math.abs(d)).replace('.', ',')}
      {unit}
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: 'warn';
}) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border bg-card px-3.5 py-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span
        className={cn('text-2xl font-semibold tabular-nums', tone === 'warn' && 'text-warning')}
      >
        {value}
      </span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </section>
  );
}

function below(v: number | null): boolean {
  return v !== null && v < TARGET;
}

function PctCell({ v }: { v: number | null }) {
  return (
    <td
      className={cn('px-3 py-2 text-right tabular-nums', below(v) && 'font-semibold text-warning')}
    >
      {below(v) ? '↓ ' : ''}
      {pct(v)}
    </td>
  );
}

const TH = 'px-3 py-2 font-semibold';

export function WorkReportScreen() {
  const { state, set } = useListState<RFilter>(DEFAULTS);
  const today = toLocalDateKey(new Date()) ?? '';
  const tab = state.filters.tab === 'tasks' ? 'tasks' : 'requests';
  const range = useMemo(
    () =>
      normalizeRange(
        { from: state.filters.from, to: state.filters.to },
        { from: shiftDay(today, -29), to: today },
        366,
      ),
    [state.filters.from, state.filters.to, today],
  );
  const params = {
    from: range.from,
    to: range.to,
    ...(state.filters.dept ? { deptId: state.filters.dept } : {}),
  };
  const config = useWorkConfig();
  const requests = useWorkRequestReport(params, tab === 'requests');
  const tasks = useWorkTaskReport(params, tab === 'tasks');

  return (
    <>
      <PageHeader
        title="Báo cáo công việc & SLA"
        description={`Mục tiêu đúng hạn ${TARGET}% · so với kỳ trước cùng độ dài · số liệu nhánh phòng ban bạn phụ trách`}
        breadcrumb={[{ label: 'Báo cáo' }, { label: 'Công việc & SLA' }]}
        actions={
          <>
            <DateRangePicker
              label="Khoảng"
              value={range}
              today={today}
              maxDays={366}
              presets={[
                { label: '7 ngày', from: shiftDay(today, -6), to: today },
                { label: '30 ngày', from: shiftDay(today, -29), to: today },
                { label: '90 ngày', from: shiftDay(today, -89), to: today },
              ]}
              onChange={(r) => set({ filters: { ...state.filters, from: r.from, to: r.to } })}
            />
            <Select
              value={state.filters.dept ?? 'all'}
              onValueChange={(v) =>
                set({ filters: { ...state.filters, dept: v === 'all' ? undefined : v } })
              }
            >
              <SelectTrigger className="w-56" aria-label="Phòng">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Phòng: cả nhánh phụ trách</SelectItem>
                {(config.data?.departments ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Phòng: {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <div className="mb-3 rounded-lg border bg-card">
        <WorkTabs
          label="Báo cáo"
          value={tab}
          onChange={(k) =>
            set({ filters: { ...state.filters, tab: k === 'requests' ? undefined : k } })
          }
          tabs={[
            { key: 'requests', label: 'Yêu cầu (khách + nội bộ)' },
            { key: 'tasks', label: 'Giao việc' },
          ]}
        />
      </div>
      {tab === 'requests' ? (
        requests.isPending ? (
          <ListSkeleton rows={8} columns={9} />
        ) : requests.error ? (
          <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
        ) : (
          <RequestsReport r={requests.data} />
        )
      ) : tasks.isPending ? (
        <ListSkeleton rows={8} columns={8} />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : (
        <TasksReport r={tasks.data} />
      )}
    </>
  );
}

function RequestsReport({ r }: { r: WorkRequestReport }) {
  const k = r.kpis;
  const p = r.previous;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Yêu cầu mới"
          value={String(k.created)}
          sub={
            <>
              <Delta now={k.created} prev={p.created} invert /> (kỳ trước {p.created})
            </>
          }
        />
        <Kpi
          label="Đã xử lý"
          value={String(k.resolved)}
          sub={`${k.open} đang mở · ${k.overdueOpen} quá hạn`}
        />
        <Kpi
          label="Đúng SLA phản hồi đầu"
          value={pct(k.firstResponseOnTimePct)}
          tone={below(k.firstResponseOnTimePct) ? 'warn' : undefined}
          sub={
            <>
              <Delta now={k.firstResponseOnTimePct} prev={p.firstResponseOnTimePct} unit=" điểm" />{' '}
              · mục tiêu {TARGET}%
            </>
          }
        />
        <Kpi
          label="Đúng SLA xử lý"
          value={pct(k.resolveOnTimePct)}
          tone={below(k.resolveOnTimePct) ? 'warn' : undefined}
          sub={
            <>
              <Delta now={k.resolveOnTimePct} prev={p.resolveOnTimePct} unit=" điểm" /> · mục tiêu{' '}
              {TARGET}%
            </>
          }
        />
        <Kpi
          label="Phản hồi đầu trung bình"
          value={
            k.avgFirstResponseMins === null ? '—' : formatDuration(k.avgFirstResponseMins, 570)
          }
          sub="giờ làm việc"
        />
        <Kpi
          label="Xử lý trung bình"
          value={k.avgResolveMins === null ? '—' : formatDuration(k.avgResolveMins, 570)}
          sub="giờ làm việc, trừ lúc chờ khách"
        />
      </div>

      <Card
        title="Theo loại yêu cầu"
        action={
          <span className="text-xs font-normal text-muted-foreground">
            ↓ = dưới mục tiêu {TARGET}%
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-xs text-muted-foreground">
                <th className={cn(TH, 'text-left')}>Loại</th>
                <th className={cn(TH, 'text-right')}>Mới</th>
                <th className={cn(TH, 'text-right')}>Đã xử lý</th>
                <th className={cn(TH, 'text-right')}>Đang mở</th>
                <th className={cn(TH, 'text-right')}>Quá hạn đang mở</th>
                <th className={cn(TH, 'text-right')}>Đúng SLA phản hồi</th>
                <th className={cn(TH, 'text-right')}>Đúng SLA xử lý</th>
                <th className={cn(TH, 'text-right')}>Xử lý TB</th>
                <th className={cn(TH, 'text-right')}>Mở lại</th>
              </tr>
            </thead>
            <tbody>
              {r.byCategory.map((c) => (
                <tr key={c.categoryId ?? 'none'} className="border-t">
                  <td className="px-3 py-2">{c.categoryName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.created}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.resolved}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.open}</td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right tabular-nums',
                      c.overdueOpen > 0 && 'font-semibold text-destructive',
                    )}
                  >
                    {c.overdueOpen}
                  </td>
                  <PctCell v={c.firstResponseOnTimePct} />
                  <PctCell v={c.resolveOnTimePct} />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.avgResolveMins === null ? '—' : formatDuration(c.avgResolveMins, 570)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.reopened}</td>
                </tr>
              ))}
              {!r.byCategory.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                    Chưa có yêu cầu nào trong khoảng này.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {r.byCategory.length ? (
              <tfoot>
                <tr className="border-t bg-muted font-semibold">
                  <td className="px-3 py-2">Tổng</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.created}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.resolved}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.open}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.overdueOpen}</td>
                  <PctCell v={k.firstResponseOnTimePct} />
                  <PctCell v={k.resolveOnTimePct} />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {k.avgResolveMins === null ? '—' : formatDuration(k.avgResolveMins, 570)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.reopened}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Card>

      <div className="grid items-start gap-3 xl:grid-cols-3">
        <Card title="Theo người xử lý" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-xs text-muted-foreground">
                  <th className={cn(TH, 'text-left')}>Nhân viên</th>
                  <th className={cn(TH, 'text-right')}>Nhận</th>
                  <th className={cn(TH, 'text-right')}>Đã xử lý</th>
                  <th className={cn(TH, 'text-right')}>Đang mở</th>
                  <th className={cn(TH, 'text-right')}>Quá hạn</th>
                  <th className={cn(TH, 'text-right')}>Đúng SLA phản hồi</th>
                  <th className={cn(TH, 'text-right')}>Đúng SLA xử lý</th>
                  <th className={cn(TH, 'text-right')}>Phản hồi TB</th>
                </tr>
              </thead>
              <tbody>
                {r.byAssignee.map((a) => (
                  <tr key={a.user.id} className="border-t">
                    <td className="px-3 py-2">{a.user.fullName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.handled}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.resolved}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.open}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        a.overdueOpen > 0 && 'font-semibold text-destructive',
                      )}
                    >
                      {a.overdueOpen}
                    </td>
                    <PctCell v={a.firstResponseOnTimePct} />
                    <PctCell v={a.resolveOnTimePct} />
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.avgFirstResponseMins === null
                        ? '—'
                        : formatDuration(a.avgFirstResponseMins, 570)}
                    </td>
                  </tr>
                ))}
                {!r.byAssignee.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                      Chưa có người xử lý trong khoảng này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Hướng xử lý">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-xs text-muted-foreground">
                <th className={cn(TH, 'text-left')}>Hướng</th>
                <th className={cn(TH, 'text-right')}>Số yêu cầu</th>
                <th className={cn(TH, 'text-right')}>Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              {r.byOutcome.map((o) => (
                <tr key={o.outcome ?? 'none'} className="border-t">
                  <td className="px-3 py-2">
                    {o.outcome ? (OUTCOME_LABEL[o.outcome] ?? o.outcome) : 'Không ghi hướng'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{o.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(o.pct)}</td>
                </tr>
              ))}
              {!r.byOutcome.length ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                    Chưa có yêu cầu đã xử lý.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function TasksReport({ r }: { r: WorkTaskReport }) {
  const k = r.kpis;
  const p = r.previous;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Việc được giao" value={String(k.assigned)} sub={<>kỳ trước {p.assigned}</>} />
        <Kpi label="Đã xong" value={String(k.done)} sub={`${k.overdueOpen} đang quá hạn`} />
        <Kpi
          label="Xong đúng hạn"
          value={pct(k.onTimePct)}
          tone={below(k.onTimePct) ? 'warn' : undefined}
          sub={
            <>
              <Delta now={k.onTimePct} prev={p.onTimePct} unit=" điểm" /> · theo hạn đã duyệt
            </>
          }
        />
        <Kpi label="Đúng hạn gốc" value={pct(k.onTimeOriginalPct)} sub="trước khi gia hạn" />
        <Kpi
          label="Gia hạn"
          value={String(k.extensions)}
          sub={`${k.extended} việc có gia hạn · ${k.reworked} việc làm lại`}
        />
        <Kpi
          label="Thời gian tới báo xong"
          value={
            k.avgHoursToSubmit === null
              ? '—'
              : `${String(k.avgHoursToSubmit).replace('.', ',')} giờ`
          }
          sub="trung bình, giờ thực"
        />
      </div>
      <Card
        title="Theo người làm"
        action={
          <span className="text-xs font-normal text-muted-foreground">
            ↓ = dưới mục tiêu {TARGET}%
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-xs text-muted-foreground">
                <th className={cn(TH, 'text-left')}>Nhân viên</th>
                <th className={cn(TH, 'text-left')}>Phòng</th>
                <th className={cn(TH, 'text-right')}>Được giao</th>
                <th className={cn(TH, 'text-right')}>Đã xong</th>
                <th className={cn(TH, 'text-right')}>Đang mở</th>
                <th className={cn(TH, 'text-right')}>Quá hạn</th>
                <th className={cn(TH, 'text-right')}>Xong đúng hạn</th>
                <th className={cn(TH, 'text-right')}>Gia hạn</th>
                <th className={cn(TH, 'text-right')}>Làm lại</th>
              </tr>
            </thead>
            <tbody>
              {r.byAssignee.map((a) => (
                <tr key={a.user.id} className="border-t">
                  <td className="px-3 py-2">{a.user.fullName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.departmentName ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.assigned}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.done}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.open}</td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right tabular-nums',
                      a.overdueOpen > 0 && 'font-semibold text-destructive',
                    )}
                  >
                    {a.overdueOpen}
                  </td>
                  <PctCell v={a.onTimePct} />
                  <td className="px-3 py-2 text-right tabular-nums">{a.extensions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.reworked}</td>
                </tr>
              ))}
              {!r.byAssignee.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                    Chưa có việc được giao trong khoảng này.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
