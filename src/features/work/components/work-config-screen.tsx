'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ErrorState, FormSkeleton } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
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
import { messageFor } from '@/lib/error-messages';
import { useListState } from '@/lib/url-state';
import type { WorkCategory, WorkConfig, WorkPriority, WorkSlaRow } from '../api/types';
import {
  useAddWorkHoliday,
  useCreateWorkCategory,
  useDeleteWorkCategory,
  useRemoveWorkHoliday,
  useUpdateWorkCalendar,
  useUpdateWorkCategory,
  useUpdateWorkSla,
  useWorkConfig,
} from '../api/use-work';
import {
  formatDuration,
  hhmmToMinute,
  minuteToHHmm,
  PRIORITIES,
  PRIORITY_LABEL,
  WEEKDAY_LABEL,
} from '../labels';
import { Card, WorkTabs } from './work-ui';

/**
 * Cấu hình công việc (D2 SLA & giờ làm việc, D3 loại yêu cầu — docs/screens/FE-WORK-1-work-module.md
 * §7). Quyền `config Work` (work.config — quản trị). URL: ?tab=categories|sla. Sửa cấu hình KHÔNG đổi
 * hạn của yêu cầu đã tạo (API chốt SLA lúc tạo).
 */
const FILTER_KEYS = ['tab'] as const;
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };

/** "30p" / "2h" / "1.5 giờ" / "1 ngày" / "90" (phút) → phút làm việc; 1 ngày = độ dài ngày làm việc. */
export function parseDuration(raw: string, workday: number): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, '.');
  if (!s) return null;
  const re = /(\d+(?:\.\d+)?)\s*(ngày|ngay|n|d|giờ|gio|g|h|phút|phut|ph|p|min|m)?/gy;
  let total = 0;
  let pos = 0;
  let parts = 0;
  while (pos < s.length) {
    while (s[pos] === ' ') pos++;
    if (pos >= s.length) break;
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2] ?? (parts === 0 ? 'p' : 'p');
    total += /^(g|giờ|gio|h)$/.test(unit)
      ? n * 60
      : /^(n|ngày|ngay|d)$/.test(unit)
        ? n * workday
        : n;
    pos = re.lastIndex;
    parts++;
  }
  const r = Math.round(total);
  return parts && r >= 1 ? r : null;
}

export function WorkConfigScreen() {
  const { state, set } = useListState<'tab'>(DEFAULTS);
  const tab = state.filters.tab === 'sla' ? 'sla' : 'categories';
  const config = useWorkConfig();
  return (
    <>
      <PageHeader
        title="Cấu hình công việc"
        description="Loại yêu cầu, SLA theo loại × ưu tiên, giờ làm việc, ngày lễ. Thay đổi chỉ áp cho yêu cầu tạo sau khi lưu."
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Cấu hình công việc' }]}
      />
      <div className="mb-3 rounded-lg border bg-card">
        <WorkTabs
          label="Cấu hình"
          value={tab}
          onChange={(k) => set({ filters: { tab: k === 'categories' ? undefined : k } })}
          tabs={[
            { key: 'categories', label: 'Loại yêu cầu', count: config.data?.categories.length },
            { key: 'sla', label: 'SLA & giờ làm việc' },
          ]}
        />
      </div>
      {config.isPending ? (
        <FormSkeleton fields={8} />
      ) : config.error ? (
        <ErrorState error={config.error} onRetry={() => void config.refetch()} />
      ) : tab === 'categories' ? (
        <CategoriesTab cfg={config.data} />
      ) : (
        <SlaTab cfg={config.data} />
      )}
    </>
  );
}

// ── Loại yêu cầu ────────────────────────────────────────────────────────

function CategoriesTab({ cfg }: { cfg: WorkConfig }) {
  const [editing, setEditing] = useState<WorkCategory | 'new' | null>(null);
  const del = useDeleteWorkCategory();
  const workday = cfg.calendar.endMinute - cfg.calendar.startMinute;
  const groups: { kind: 'CUSTOMER' | 'INTERNAL'; label: string }[] = [
    { kind: 'CUSTOMER', label: 'Yêu cầu của khách' },
    { kind: 'INTERNAL', label: 'Yêu cầu nội bộ' },
  ];
  return (
    <div className="grid items-start gap-3 xl:grid-cols-4">
      <Card
        className="xl:col-span-3"
        title="Loại yêu cầu"
        action={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden /> Thêm loại yêu cầu
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">Loại yêu cầu</th>
                <th className="px-3 py-2 text-left font-semibold">Ưu tiên mặc định</th>
                <th className="px-3 py-2 text-left font-semibold">Nơi nhận</th>
                <th className="px-3 py-2 text-left font-semibold">Cần đơn</th>
                <th className="px-3 py-2 text-left font-semibold">SLA mặc định</th>
                <th className="px-3 py-2 text-right font-semibold">Đang mở</th>
                <th className="px-3 py-2 text-left font-semibold">Trạng thái</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const rows = cfg.categories.filter((c) => c.kind === g.kind);
                return [
                  <tr key={g.kind}>
                    <td
                      colSpan={8}
                      className="border-t bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                    >
                      {g.label} · {rows.filter((r) => r.isActive).length} đang dùng
                    </td>
                  </tr>,
                  ...rows.map((c) => {
                    const p = c.policies.find((x) => x.priority === null);
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          'border-t',
                          editing !== 'new' && editing?.id === c.id && 'bg-secondary',
                          !c.isActive && 'text-muted-foreground',
                        )}
                      >
                        <td className="px-3 py-2">
                          <b>{c.name}</b>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {c.code}
                          </span>
                        </td>
                        <td className="px-3 py-2">{PRIORITY_LABEL[c.defaultPriority]}</td>
                        <td className="px-3 py-2">
                          {c.ownerDeptName ??
                            (c.kind === 'CUSTOMER' ? (
                              'Phòng của người tiếp nhận'
                            ) : (
                              <span className="text-destructive">Chưa gán phòng</span>
                            ))}
                        </td>
                        <td className="px-3 py-2">{c.requiresOrder ? 'Bắt buộc' : 'Không'}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {p
                            ? `${formatDuration(p.firstResponseMins, workday)} / ${formatDuration(p.resolveMins, workday)}`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.openCount}</td>
                        <td className="px-3 py-2">
                          <StatusBadge tone={c.isActive ? 'ok' : 'neutral'}>
                            {c.isActive ? 'Đang dùng' : 'Ngừng dùng'}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                              Sửa
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Xóa loại ${c.name}`}
                              onClick={() =>
                                del.mutate(c.id, {
                                  onSuccess: (r) =>
                                    toast.success(
                                      (r as { deleted?: boolean }).deleted
                                        ? `Đã xóa loại ${c.name}`
                                        : `Loại ${c.name} đã có yêu cầu — đã chuyển sang ngừng dùng`,
                                    ),
                                  onError: (e) => toast.error(messageFor(e)),
                                })
                              }
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </span>
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Loại đã có yêu cầu thì chỉ ngừng dùng, không xóa. Giao việc không cần loại.
        </p>
      </Card>
      {editing ? (
        <CategoryForm
          key={editing === 'new' ? 'new' : editing.id}
          cfg={cfg}
          cat={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : (
        <Card title="Sửa loại">
          <p className="p-3.5 text-sm text-muted-foreground">
            Chọn “Sửa” ở một dòng hoặc thêm loại mới.
          </p>
        </Card>
      )}
    </div>
  );
}

function CategoryForm({
  cfg,
  cat,
  onClose,
}: {
  cfg: WorkConfig;
  cat: WorkCategory | null;
  onClose: () => void;
}) {
  const create = useCreateWorkCategory();
  const update = useUpdateWorkCategory();
  const workday = cfg.calendar.endMinute - cfg.calendar.startMinute;
  const [name, setName] = useState(cat?.name ?? '');
  const [code, setCode] = useState(cat?.code ?? '');
  const [description, setDescription] = useState(cat?.description ?? '');
  const [kind, setKind] = useState<'CUSTOMER' | 'INTERNAL'>(cat?.kind ?? 'INTERNAL');
  const [priority, setPriority] = useState<WorkPriority>(cat?.defaultPriority ?? 'NORMAL');
  const [dept, setDept] = useState(cat?.ownerDeptId ?? '');
  const [requiresOrder, setRequiresOrder] = useState(cat?.requiresOrder ?? false);
  const [active, setActive] = useState(cat?.isActive ?? true);
  const [fr, setFr] = useState('2h');
  const [rs, setRs] = useState('1 ngày');
  const [err, setErr] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const used = (cat?.openCount ?? 0) > 0;

  const save = () => {
    if (!name.trim()) return setErr('Nhập tên loại.');
    if (!/^[A-Z0-9_]{2,40}$/.test(code))
      return setErr('Mã chỉ gồm chữ in hoa, số, gạch dưới (2–40 ký tự).');
    if (kind === 'INTERNAL' && !dept) return setErr('Yêu cầu nội bộ phải chọn phòng nhận.');
    const opts = {
      onSuccess: () => {
        toast.success(cat ? 'Đã lưu thay đổi' : `Đã thêm loại ${name.trim()}`);
        onClose();
      },
      onError: (e: unknown) => toast.error(messageFor(e)),
    };
    if (cat) {
      update.mutate(
        {
          id: cat.id,
          body: {
            name: name.trim(),
            ...(code !== cat.code ? { code } : {}),
            description: description.trim() || null,
            ...(kind !== cat.kind ? { kind } : {}),
            defaultPriority: priority,
            ownerDeptId: dept || null,
            requiresOrder,
            isActive: active,
          },
        },
        opts,
      );
    } else {
      const f = parseDuration(fr, workday);
      const r = parseDuration(rs, workday);
      if (!f || !r) return setErr('SLA nhập dạng 30p / 2h / 1 ngày.');
      create.mutate(
        {
          code,
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          kind,
          defaultPriority: priority,
          ...(dept ? { ownerDeptId: dept } : {}),
          requiresOrder,
          sla: { firstResponseMins: f, resolveMins: r },
        },
        opts,
      );
    }
  };

  return (
    <Card
      title={cat ? `Sửa loại: ${cat.name}` : 'Thêm loại yêu cầu'}
      action={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <form
        className="flex flex-col gap-3 p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="cName">Tên</Label>
          <Input
            id="cName"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cCode">Mã</Label>
          <Input
            id="cCode"
            className="font-mono"
            disabled={!!cat && used}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {cat && used ? (
            <p className="text-xs text-muted-foreground">Không đổi được khi đã có yêu cầu</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Nhóm</span>
          <div className="flex gap-1" role="group" aria-label="Nhóm">
            {(['CUSTOMER', 'INTERNAL'] as const).map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                disabled={!!cat && used}
                variant={kind === k ? 'default' : 'outline'}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {k === 'CUSTOMER' ? 'Yêu cầu của khách' : 'Yêu cầu nội bộ'}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cDesc">Mô tả cho người tạo</Label>
          <Textarea
            id="cDesc"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Ưu tiên mặc định</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Ưu tiên mặc định">
            {PRIORITIES.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={priority === p ? 'default' : 'outline'}
                aria-pressed={priority === p}
                onClick={() => setPriority(p)}
              >
                {PRIORITY_LABEL[p]}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cDept">Nơi nhận (hàng chờ)</Label>
          <Select value={dept || 'none'} onValueChange={(v) => setDept(v === 'none' ? '' : v)}>
            <SelectTrigger id="cDept">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kind === 'CUSTOMER' ? (
                <SelectItem value="none">Phòng của người tiếp nhận (CSKH)</SelectItem>
              ) : (
                <SelectItem value="none">Chọn phòng…</SelectItem>
              )}
              {cfg.departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={requiresOrder}
            onChange={(e) => setRequiresOrder(e.target.checked)}
          />
          Bắt buộc chọn đơn liên quan
        </label>
        {cat ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Đang dùng
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="cFr">SLA phản hồi đầu</Label>
              <Input id="cFr" value={fr} onChange={(e) => setFr(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="cRs">SLA xử lý</Label>
              <Input id="cRs" value={rs} onChange={(e) => setRs(e.target.value)} />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Dạng 30p / 2h / 1 ngày (ngày làm việc).
            </p>
          </div>
        )}
        {err ? (
          <p className="text-xs text-destructive" role="alert">
            {err}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={pending}>
            {cat ? 'Lưu thay đổi' : 'Thêm loại'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── SLA + lịch + ngày lễ ───────────────────────────────────────────────

type Cell = { fr: string; rs: string };
type Matrix = Record<string, Record<'default' | WorkPriority, Cell>>;

function toMatrix(cats: WorkCategory[], workday: number): Matrix {
  const out: Matrix = {};
  for (const c of cats) {
    const row = {} as Matrix[string];
    for (const k of ['default', ...PRIORITIES] as const) {
      const p = c.policies.find((x) => (k === 'default' ? x.priority === null : x.priority === k));
      row[k] = p
        ? {
            fr: formatDuration(p.firstResponseMins, workday),
            rs: formatDuration(p.resolveMins, workday),
          }
        : { fr: '', rs: '' };
    }
    out[c.id] = row;
  }
  return out;
}

function SlaTab({ cfg }: { cfg: WorkConfig }) {
  const workday = cfg.calendar.endMinute - cfg.calendar.startMinute;
  const active = useMemo(() => cfg.categories.filter((c) => c.isActive), [cfg.categories]);
  const base = useMemo(() => toMatrix(active, workday), [active, workday]);
  const [m, setM] = useState<Matrix>(base);
  useEffect(() => setM(base), [base]);
  const save = useUpdateWorkSla();
  const changed = active.filter((c) => JSON.stringify(m[c.id]) !== JSON.stringify(base[c.id]));
  const [err, setErr] = useState<string | null>(null);

  const setCell = (id: string, k: 'default' | WorkPriority, field: 'fr' | 'rs', v: string) =>
    setM({ ...m, [id]: { ...m[id]!, [k]: { ...m[id]![k], [field]: v } } });

  const submit = () => {
    const rows: WorkSlaRow[] = [];
    for (const c of changed) {
      const r = m[c.id]!;
      const d = {
        firstResponseMins: parseDuration(r.default.fr, workday),
        resolveMins: parseDuration(r.default.rs, workday),
      };
      if (!d.firstResponseMins || !d.resolveMins)
        return setErr(
          `${c.name}: ô mặc định phải có cả phản hồi và xử lý (dạng 30p / 2h / 1 ngày).`,
        );
      const row: WorkSlaRow = {
        categoryId: c.id,
        default: { firstResponseMins: d.firstResponseMins, resolveMins: d.resolveMins },
      };
      for (const p of PRIORITIES) {
        const cell = r[p];
        if (!cell.fr && !cell.rs) continue;
        const f = parseDuration(cell.fr, workday);
        const s = parseDuration(cell.rs, workday);
        if (!f || !s)
          return setErr(`${c.name} · ${PRIORITY_LABEL[p]}: nhập cả hai ô hoặc để trống cả hai.`);
        row[p] = { firstResponseMins: f, resolveMins: s };
      }
      rows.push(row);
    }
    setErr(null);
    save.mutate(
      { rows },
      {
        onSuccess: () => toast.success('Đã lưu thay đổi'),
        onError: (e) => toast.error(messageFor(e)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="Ma trận SLA · loại × mức ưu tiên"
        action={
          <span className="flex items-center gap-2">
            {changed.length ? (
              <span className="text-xs font-semibold text-primary">
                {changed.length} loại đã sửa · chưa lưu
              </span>
            ) : null}
            <Button size="sm" variant="ghost" disabled={!changed.length} onClick={() => setM(base)}>
              Bỏ thay đổi
            </Button>
            <Button size="sm" disabled={!changed.length} loading={save.isPending} onClick={submit}>
              Lưu thay đổi
            </Button>
          </span>
        }
      >
        <p className="border-b px-3.5 py-2 text-xs text-muted-foreground">
          Áp cho yêu cầu của khách và nội bộ (giao việc không dùng SLA — người giao đặt hạn chót). Ô
          trống = theo cột mặc định. Nhập 30p / 2h / 1 ngày; 1 ngày = {formatDuration(workday)} làm
          việc.
        </p>
        {err ? (
          <p
            className="border-b bg-destructive-weak px-3.5 py-2 text-sm text-destructive"
            role="alert"
          >
            {err}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">Loại yêu cầu</th>
                <th className="border-l px-3 py-2 text-left font-semibold">Mặc định của loại</th>
                {PRIORITIES.map((p) => (
                  <th key={p} className="border-l px-3 py-2 text-left font-semibold">
                    {PRIORITY_LABEL[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['CUSTOMER', 'INTERNAL'] as const).map((kind) => [
                <tr key={kind}>
                  <td
                    colSpan={6}
                    className="border-t bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    {kind === 'CUSTOMER' ? 'Yêu cầu của khách' : 'Yêu cầu nội bộ'}
                  </td>
                </tr>,
                ...active
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2 align-top">
                        <b>{c.name}</b>
                        <span className="block text-xs text-muted-foreground">
                          Ưu tiên mặc định: {PRIORITY_LABEL[c.defaultPriority]}
                        </span>
                      </td>
                      {(['default', ...PRIORITIES] as const).map((k) => {
                        const cell = m[c.id]?.[k] ?? { fr: '', rs: '' };
                        const dirty = JSON.stringify(cell) !== JSON.stringify(base[c.id]?.[k]);
                        return (
                          <td
                            key={k}
                            className={cn(
                              'border-l px-2 py-1.5 align-top',
                              dirty && 'bg-secondary',
                            )}
                          >
                            <div className="grid grid-cols-2 gap-1">
                              <Input
                                aria-label={`${c.name}, ${k === 'default' ? 'mặc định' : PRIORITY_LABEL[k]}, phản hồi đầu`}
                                placeholder={k === 'default' ? '' : 'theo mặc định'}
                                className="h-button-sm px-1.5 text-xs"
                                value={cell.fr}
                                onChange={(e) => setCell(c.id, k, 'fr', e.target.value)}
                              />
                              <Input
                                aria-label={`${c.name}, ${k === 'default' ? 'mặc định' : PRIORITY_LABEL[k]}, xử lý`}
                                placeholder={k === 'default' ? '' : '—'}
                                className="h-button-sm px-1.5 text-xs"
                                value={cell.rs}
                                onChange={(e) => setCell(c.id, k, 'rs', e.target.value)}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )),
              ])}
            </tbody>
          </table>
        </div>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Mỗi ô: phản hồi đầu · xử lý xong.
        </p>
      </Card>
      <div className="grid items-start gap-3 lg:grid-cols-3">
        <CalendarCard cfg={cfg} />
        <HolidaysCard cfg={cfg} />
      </div>
    </div>
  );
}

function CalendarCard({ cfg }: { cfg: WorkConfig }) {
  const c = cfg.calendar;
  const [days, setDays] = useState<number[]>(c.weekdays);
  const [start, setStart] = useState(minuteToHHmm(c.startMinute));
  const [end, setEnd] = useState(minuteToHHmm(c.endMinute));
  const [warn, setWarn] = useState(String(c.warnPercent));
  const [close, setClose] = useState(String(c.autoCloseDays));
  const [err, setErr] = useState<string | null>(null);
  const save = useUpdateWorkCalendar();
  return (
    <Card title="Giờ làm việc & tự đóng" className="lg:col-span-2">
      <form
        className="flex flex-col gap-3.5 p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          const s = hhmmToMinute(start);
          const en = hhmmToMinute(end);
          const w = Number(warn);
          const a = Number(close);
          if (!days.length) return setErr('Chọn ít nhất một ngày làm việc.');
          if (s === null || en === null || s >= en)
            return setErr('Giờ bắt đầu phải trước giờ kết thúc (HH:mm).');
          if (!(w >= 1 && w <= 99)) return setErr('Ngưỡng cảnh báo 1–99%.');
          if (!(a >= 1 && a <= 60)) return setErr('Tự đóng sau 1–60 ngày.');
          setErr(null);
          save.mutate(
            { weekdays: days, startMinute: s, endMinute: en, warnPercent: w, autoCloseDays: a },
            {
              onSuccess: () => toast.success('Đã lưu thay đổi'),
              onError: (e2) => toast.error(messageFor(e2)),
            },
          );
        }}
      >
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">Ngày làm việc</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABEL.map((l, i) => {
              const d = i + 1;
              const on = days.includes(d);
              return (
                <label
                  key={l}
                  className={cn(
                    'flex h-control items-center gap-1.5 rounded-md border px-2.5 text-sm',
                    on ? 'border-primary bg-secondary' : 'border-input',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={on}
                    onChange={() => setDays(on ? days.filter((x) => x !== d) : [...days, d].sort())}
                  />
                  {l}
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="wStart">Bắt đầu</Label>
            <Input
              id="wStart"
              className="w-24"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="wEnd">Kết thúc</Label>
            <Input
              id="wEnd"
              className="w-24"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="wWarn">Báo “Sắp quá hạn” khi đã dùng (%)</Label>
            <Input
              id="wWarn"
              type="number"
              min={1}
              max={99}
              className="w-24"
              value={warn}
              onChange={(e) => setWarn(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="wClose">Tự đóng “Đã xử lý” sau (ngày)</Label>
            <Input
              id="wClose"
              type="number"
              min={1}
              max={60}
              className="w-24"
              value={close}
              onChange={(e) => setClose(e.target.value)}
            />
          </div>
        </div>
        {err ? (
          <p className="text-xs text-destructive" role="alert">
            {err}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}>
            Lưu giờ làm việc
          </Button>
        </div>
      </form>
    </Card>
  );
}

function HolidaysCard({ cfg }: { cfg: WorkConfig }) {
  const add = useAddWorkHoliday();
  const remove = useRemoveWorkHoliday();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  return (
    <Card title="Ngày lễ không tính SLA">
      <form
        className="flex flex-col gap-2 border-b p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!from || !name.trim()) return;
          add.mutate(
            { date: from, ...(to && to !== from ? { toDate: to } : {}), name: name.trim() },
            {
              onSuccess: () => {
                toast.success('Đã thêm ngày lễ');
                setFrom('');
                setTo('');
                setName('');
              },
              onError: (err) => toast.error(messageFor(err)),
            },
          );
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <Input
            aria-label="Từ ngày"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            aria-label="Đến ngày"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Input
            aria-label="Tên ngày lễ"
            placeholder="Tên (vd. Tết Nguyên đán)"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" size="sm" loading={add.isPending} disabled={!from || !name.trim()}>
            Thêm
          </Button>
        </div>
      </form>
      <ul>
        {cfg.holidays.map((h) => (
          <li
            key={h.date}
            className="flex items-center gap-2 border-b px-3.5 py-1.5 text-sm last:border-b-0"
          >
            <span className="w-24 tabular-nums">{h.date.split('-').reverse().join('/')}</span>
            <span className="flex-1">{h.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Xóa ngày ${h.date}`}
              onClick={() =>
                remove.mutate(h.date, { onError: (err) => toast.error(messageFor(err)) })
              }
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
        {!cfg.holidays.length ? (
          <li className="px-3.5 py-3 text-sm text-muted-foreground">Chưa có ngày lễ nào.</li>
        ) : null}
      </ul>
    </Card>
  );
}
