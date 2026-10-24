'use client';

import {
  AlertTriangle,
  Building2,
  Check,
  ClipboardCheck,
  MessageSquare,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StaffSelect } from '@/components/data/form';
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
import { newIdempotencyKey } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatMoney, formatPhone, toLocalDateKey } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useHotkey } from '@/lib/use-hotkey';
import { shiftDay } from '@/components/data/date-range-picker';
import type { CreateWorkItemBody, WorkChannel, WorkKind, WorkPriority } from '../api/types';
import {
  useCreateWork,
  useWorkAssignees,
  useWorkCategories,
  useWorkConfig,
  useWorkCustomer,
  useWorkCustomerLookup,
  useWorkCustomerOrders,
  useWorkItem,
} from '../api/use-work';
import {
  CHANNEL_LABEL,
  CUSTOMER_CHANNELS,
  formatDuration,
  KIND_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
} from '../labels';
import { fromLocalInput, toLocalInput } from './work-dialogs';
import { Card } from './work-ui';

/**
 * Tạo việc (A3 giao việc, C3 yêu cầu khách + yêu cầu nội bộ — docs/screens/FE-WORK-1-work-module.md
 * §5). Trang riêng (mẫu Form chứng từ). URL: ?kind=TASK|INTERNAL|CUSTOMER · ?parentId= (Nhờ phòng
 * khác) · ?customerId= · ?orderId= · ?assignee=. Gửi kèm Idempotency-Key sinh lúc bấm (luật 4).
 */
type Recurrence = 'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

function Field({
  id,
  label,
  required,
  help,
  error,
  children,
  className,
}: {
  id?: string;
  label: string;
  required?: boolean;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          variant={value === o.value ? 'default' : 'outline'}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function dueAt(dayOffset: number): string {
  const today = toLocalDateKey(new Date()) ?? '';
  return toLocalInput(new Date(`${shiftDay(today, dayOffset)}T17:30:00+07:00`).toISOString());
}

export function WorkCreateScreen() {
  const ability = useAbility();
  const sp = useSearchParams();
  const canCustomer = ability.can('create_customer', 'Work');
  const kindParam = sp.get('kind') as WorkKind | null;
  const initialKind: WorkKind =
    kindParam === 'CUSTOMER' && canCustomer
      ? 'CUSTOMER'
      : kindParam === 'INTERNAL'
        ? 'INTERNAL'
        : 'TASK';
  const [kind, setKind] = useState<WorkKind>(initialKind);
  const parentId = sp.get('parentId') ?? undefined;

  const kinds: { kind: WorkKind; icon: typeof ClipboardCheck; title: string; text: string }[] = [
    {
      kind: 'TASK',
      icon: ClipboardCheck,
      title: 'Giao việc',
      text: 'Cho người trong phòng mình phụ trách hoặc tự giao cho mình. Có hạn chót, checklist, duyệt kết quả.',
    },
    {
      kind: 'INTERNAL',
      icon: Building2,
      title: 'Yêu cầu nội bộ',
      text: 'Nhờ phòng khác: Kho, Kế toán, Mua hàng, Quản trị. Vào hàng chờ của phòng đó, tính SLA.',
    },
    ...(canCustomer
      ? [
          {
            kind: 'CUSTOMER' as const,
            icon: MessageSquare,
            title: 'Yêu cầu của khách',
            text: 'Khiếu nại, hỗ trợ sau bán. Gắn khách + đơn, vào hàng chờ CSKH, tính SLA.',
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Tạo việc"
        description="Chọn loại trước — mỗi loại một bộ trường riêng"
        breadcrumb={[{ label: 'Công việc', href: '/work' }, { label: 'Tạo việc' }]}
      />
      {!parentId ? (
        <div role="radiogroup" aria-label="Loại việc" className="mb-3 grid gap-3 md:grid-cols-3">
          {kinds.map((k) => {
            const on = k.kind === kind;
            return (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(k.kind)}
                className={cn(
                  'flex items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left text-sm',
                  on ? 'border-primary bg-secondary' : 'border-input-soft hover:bg-muted',
                )}
              >
                <k.icon
                  aria-hidden
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    on ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <span>
                  <b className="block text-sm">{k.title}</b>
                  <span className="text-muted-foreground">{k.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {kind === 'TASK' ? <TaskForm /> : <RequestForm kind={kind} parentId={parentId} />}
    </>
  );
}

// ── Giao việc ───────────────────────────────────────────────────────────

function TaskForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const people = useWorkAssignees();
  const create = useCreateWork();
  const [key, setKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [split, setSplit] = useState(true);
  const [due, setDue] = useState(dueAt(1));
  const [priority, setPriority] = useState<WorkPriority>('NORMAL');
  const [remind, setRemind] = useState('120');
  const [checklist, setChecklist] = useState('');
  const [approval, setApproval] = useState(false);
  const [watchers, setWatchers] = useState<string[]>([]);
  const [rec, setRec] = useState<Recurrence>('none');
  const [recDay, setRecDay] = useState('1');
  const [recDue, setRecDue] = useState('4');
  const [recUntil, setRecUntil] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pick, setPick] = useState('');

  const me = people.data?.find((p) => p.isSelf);
  useEffect(() => {
    const a = sp.get('assignee');
    if (a && !assignees.length) setAssignees([a]);
  }, [sp, assignees.length]);

  const lines = checklist
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const chosen = (people.data ?? []).filter((p) => assignees.includes(p.id));
  const others = (people.data ?? []).filter((p) => !assignees.includes(p.id));
  const effective = assignees.length ? assignees : me ? [me.id] : [];
  const selfOnly = effective.length === 1 && effective[0] === me?.id;
  const busy = chosen.filter((p) => p.overdue > 0);
  const relaxed = (people.data ?? [])
    .filter((p) => !p.isSelf && !assignees.includes(p.id) && p.overdue === 0)
    .sort((a, b) => a.open - b.open)[0];
  const count = shared || effective.length <= 1 ? 1 : effective.length;

  const submit = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Nhập việc cần làm.';
    const dueIso = fromLocalInput(due);
    if (rec === 'none' && due && !dueIso) e.due = 'Hạn chót không hợp lệ.';
    if (dueIso && new Date(dueIso).getTime() < Date.now()) e.due = 'Hạn chót phải ở tương lai.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const k = key ?? newIdempotencyKey();
    setKey(k);
    const body: CreateWorkItemBody = {
      kind: 'TASK',
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(assignees.length ? { assigneeIds: assignees } : {}),
      ...(assignees.length > 1 ? { shared, splitChecklist: !shared && split } : {}),
      ...(rec === 'none' && dueIso ? { dueAt: dueIso } : {}),
      priority,
      ...(remind ? { remindBeforeMins: Number(remind) } : {}),
      needsApproval: approval && !selfOnly,
      ...(watchers.length ? { watcherIds: watchers } : {}),
      ...(lines.length ? { checklist: lines.map((t) => ({ title: t })) } : {}),
      ...(sp.get('customerId') ? { customerId: sp.get('customerId')! } : {}),
      ...(rec !== 'none'
        ? {
            recurrence: {
              freq: rec,
              ...(rec === 'WEEKLY' ? { dayOfWeek: Number(recDay) } : {}),
              ...(rec === 'MONTHLY' ? { dayOfMonth: Number(recDay) } : {}),
              dueAfterWorkdays: Math.max(1, Number(recDue) || 1),
              ...(recUntil ? { until: recUntil } : {}),
            },
          }
        : {}),
    };
    create.mutate(
      { body, key: k },
      {
        onSuccess: (r) => {
          toast.success(
            r.items.length > 1
              ? `Đã giao ${r.items.length} việc`
              : `Đã giao ${r.items[0]?.docNumber ?? 'việc'}`,
          );
          router.push(r.items.length === 1 ? `/work/${r.items[0]!.id}` : '/work/team');
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };
  useHotkey('Ctrl+S', submit);

  return (
    <form
      className="grid items-start gap-3 xl:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex min-w-0 flex-col gap-3 xl:col-span-3">
        <Card title="1. Việc cần làm">
          <div className="flex flex-col gap-3 p-3.5">
            <Field id="tTitle" label="Tiêu đề" required error={errors.title}>
              <Input
                id="tTitle"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </Field>
            <Field id="tDesc" label="Mô tả">
              <Textarea
                id="tDesc"
                rows={3}
                maxLength={5000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card title="2. Người làm & hạn">
          <div className="flex flex-col gap-3.5 p-3.5">
            <Field
              label="Người làm"
              help={
                assignees.length
                  ? 'Chỉ hiện người trong phòng bạn phụ trách. Người ở phòng khác → dùng Yêu cầu nội bộ.'
                  : 'Để trống = tự giao cho mình.'
              }
            >
              <div className="flex min-h-control flex-wrap items-center gap-1.5 rounded-md border border-input px-1.5 py-1">
                {chosen.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-chip bg-muted py-0.5 pl-2 pr-1 text-sm"
                  >
                    {p.fullName}
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={`Bỏ ${p.fullName}`}
                      onClick={() => setAssignees(assignees.filter((x) => x !== p.id))}
                    >
                      <X aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                <StaffSelect
                  value={pick}
                  onChange={(v) => {
                    setAssignees([...assignees, v]);
                    setPick('');
                  }}
                  className="h-7 w-52 border-transparent"
                  aria-label="Thêm người làm"
                  placeholder="Thêm người…"
                  staff={others.map((p) => ({
                    id: p.id,
                    fullName: p.isSelf ? `${p.fullName} (bạn)` : p.fullName,
                    hint: `${p.open} việc${p.overdue ? ` · ${p.overdue} quá hạn` : ''}`,
                  }))}
                />
              </div>
            </Field>
            {assignees.length > 1 ? (
              <Field label="Giao cho nhiều người">
                <Seg
                  label="Cách giao"
                  value={shared ? 'shared' : 'each'}
                  onChange={(v) => setShared(v === 'shared')}
                  options={[
                    { value: 'each', label: `Mỗi người một việc · ${assignees.length} việc` },
                    { value: 'shared', label: 'Một việc làm chung' },
                  ]}
                />
                {!shared && lines.length ? (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={split}
                      onChange={(e) => setSplit(e.target.checked)}
                    />
                    Chia đều checklist cho từng người ({Math.ceil(lines.length / assignees.length)}{' '}
                    mục / người)
                  </label>
                ) : null}
              </Field>
            ) : null}
            {rec === 'none' ? (
              <Field id="tDue" label="Hạn chót" error={errors.due} help="Bỏ trống = không có hạn">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={due === dueAt(0) ? 'default' : 'outline'}
                    onClick={() => setDue(dueAt(0))}
                  >
                    Hôm nay 17:30
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={due === dueAt(1) ? 'default' : 'outline'}
                    onClick={() => setDue(dueAt(1))}
                  >
                    Ngày mai 17:30
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={due === dueAt(7) ? 'default' : 'outline'}
                    onClick={() => setDue(dueAt(7))}
                  >
                    +1 tuần
                  </Button>
                  <Input
                    id="tDue"
                    type="datetime-local"
                    className="w-56"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </div>
              </Field>
            ) : null}
            <div className="flex flex-wrap gap-5">
              <Field label="Ưu tiên">
                <Seg
                  label="Ưu tiên"
                  value={priority}
                  onChange={setPriority}
                  options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
                />
              </Field>
              <Field id="tRemind" label="Nhắc người làm trước hạn">
                <Select value={remind} onValueChange={setRemind}>
                  <SelectTrigger id="tRemind" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 phút</SelectItem>
                    <SelectItem value="60">1 giờ</SelectItem>
                    <SelectItem value="120">2 giờ</SelectItem>
                    <SelectItem value="1440">1 ngày</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </Card>

        <Card title="3. Checklist">
          <div className="p-3.5">
            <Field
              id="tCheck"
              label="Mỗi dòng một mục"
              help={
                lines.length
                  ? `${lines.length} mục`
                  : 'Dán danh sách (vd. khách cần gọi) — mỗi dòng thành một mục.'
              }
            >
              <Textarea
                id="tCheck"
                rows={5}
                value={checklist}
                onChange={(e) => setChecklist(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card title="4. Theo dõi, duyệt & lặp lại">
          <div className="flex flex-col gap-3.5 p-3.5">
            <label
              className={cn('flex items-center gap-2 text-sm', selfOnly && 'text-muted-foreground')}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={approval && !selfOnly}
                disabled={selfOnly}
                onChange={(e) => setApproval(e.target.checked)}
              />
              <span>
                <b>Tôi duyệt kết quả</b> trước khi việc được tính là xong
                {selfOnly ? ' (việc tự giao không cần duyệt)' : ''}
              </span>
            </label>
            <Field
              label="Người theo dõi"
              help="Nhận thông báo khi quá hạn, báo xong, xin gia hạn. Không sửa được việc."
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {watchers.map((id) => {
                  const p = people.data?.find((x) => x.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-chip bg-muted py-0.5 pl-2 pr-1 text-sm"
                    >
                      {p?.fullName ?? id}
                      <button
                        type="button"
                        aria-label={`Bỏ ${p?.fullName ?? ''}`}
                        className="rounded-full p-0.5 text-muted-foreground"
                        onClick={() => setWatchers(watchers.filter((x) => x !== id))}
                      >
                        <X aria-hidden className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  );
                })}
                <StaffSelect
                  value=""
                  onChange={(v) => setWatchers([...watchers, v])}
                  className="w-52"
                  aria-label="Thêm người theo dõi"
                  placeholder="Thêm người…"
                  staff={(people.data ?? []).filter((p) => !p.isSelf && !watchers.includes(p.id))}
                />
              </div>
            </Field>
            <Field label="Lặp lại">
              <Seg
                label="Lặp lại"
                value={rec}
                onChange={setRec}
                options={[
                  { value: 'none', label: 'Không' },
                  { value: 'DAILY', label: 'Hằng ngày' },
                  { value: 'WEEKLY', label: 'Hằng tuần' },
                  { value: 'MONTHLY', label: 'Hằng tháng' },
                ]}
              />
              {rec !== 'none' ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {rec === 'WEEKLY' ? (
                    <>
                      <span>Tạo việc mới vào</span>
                      <Select value={recDay} onValueChange={setRecDay}>
                        <SelectTrigger className="w-32" aria-label="Thứ">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            'Thứ Hai',
                            'Thứ Ba',
                            'Thứ Tư',
                            'Thứ Năm',
                            'Thứ Sáu',
                            'Thứ Bảy',
                            'Chủ nhật',
                          ].map((d, i) => (
                            <SelectItem key={d} value={String(i + 1)}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : rec === 'MONTHLY' ? (
                    <>
                      <span>Tạo việc mới ngày</span>
                      <Input
                        aria-label="Ngày trong tháng"
                        type="number"
                        min={1}
                        max={28}
                        className="w-20"
                        value={recDay}
                        onChange={(e) => setRecDay(e.target.value)}
                      />
                    </>
                  ) : (
                    <span>Tạo việc mới mỗi ngày làm việc</span>
                  )}
                  <span>lúc 08:00, hạn sau</span>
                  <Input
                    aria-label="Số ngày làm việc tới hạn"
                    type="number"
                    min={1}
                    max={60}
                    className="w-20"
                    value={recDue}
                    onChange={(e) => setRecDue(e.target.value)}
                  />
                  <span>ngày làm việc · đến hết</span>
                  <Input
                    aria-label="Lặp đến ngày"
                    type="date"
                    className="w-40"
                    value={recUntil}
                    onChange={(e) => setRecUntil(e.target.value)}
                  />
                </div>
              ) : null}
            </Field>
          </div>
        </Card>
      </div>

      <aside
        className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-sticky-page-header"
        aria-label="Xem trước"
      >
        <Card title="Khối lượng người làm">
          {chosen.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-xs text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-semibold">Người</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Đang làm</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Quá hạn</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Hạn mai</th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-1.5">{p.fullName}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.open}</td>
                    <td
                      className={cn(
                        'px-2 py-1.5 text-right tabular-nums',
                        p.overdue && 'font-semibold text-destructive',
                      )}
                    >
                      {p.overdue}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.dueTomorrow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3.5 text-sm text-muted-foreground">
              Chưa chọn người làm — việc sẽ giao cho chính bạn.
            </p>
          )}
          {busy.length ? (
            <div className="m-3 flex items-start gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                {busy.map((b) => b.fullName).join(', ')} đang có việc quá hạn.
                {relaxed
                  ? ` Có thể giao cho ${relaxed.fullName} (${relaxed.open} việc, 0 quá hạn).`
                  : ''}
              </span>
            </div>
          ) : null}
        </Card>
        <Card title="Sẽ tạo">
          <div className="flex flex-col gap-1.5 p-3.5 text-sm">
            <b>
              {count} việc
              {rec === 'none'
                ? fromLocalInput(due)
                  ? ` · hạn ${due.replace('T', ' ')}`
                  : ' · không có hạn'
                : ` · lặp ${rec === 'DAILY' ? 'hằng ngày' : rec === 'WEEKLY' ? 'hằng tuần' : 'hằng tháng'}`}
            </b>
            {lines.length ? (
              <span className="text-muted-foreground">
                {count > 1 && split
                  ? `Chia ${lines.length} mục checklist cho ${count} người`
                  : `${lines.length} mục checklist`}
              </span>
            ) : null}
            <span className="text-muted-foreground">
              {approval && !selfOnly ? 'Bạn duyệt kết quả' : 'Không cần duyệt'}
              {watchers.length ? ` · ${watchers.length} người theo dõi` : ''}
            </span>
          </div>
          <div className="flex justify-end gap-2 border-t p-3">
            <Button type="button" variant="ghost" asChild>
              <Link href="/work">Hủy</Link>
            </Button>
            <Button type="submit" shortcut="Ctrl S" loading={create.isPending}>
              <Check aria-hidden /> {count > 1 ? `Giao ${count} việc` : 'Giao việc'}
            </Button>
          </div>
        </Card>
      </aside>
    </form>
  );
}

// ── Yêu cầu nội bộ / yêu cầu của khách ─────────────────────────────────

function RequestForm({ kind, parentId }: { kind: Exclude<WorkKind, 'TASK'>; parentId?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const customerKind = kind === 'CUSTOMER';
  const parent = useWorkItem(parentId ?? '');
  const cats = useWorkCategories(kind);
  const config = useWorkConfig();
  const create = useCreateWork();
  const [key, setKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<WorkPriority | ''>('');
  const [channel, setChannel] = useState<WorkChannel>('PHONE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerDeptId, setOwnerDeptId] = useState('');
  const [phone, setPhone] = useState('');
  const [orderId, setOrderId] = useState(sp.get('orderId') ?? '');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [claim, setClaim] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const prefillCustomer = useWorkCustomer(
    parentId ? undefined : (sp.get('customerId') ?? undefined),
  );
  const lookup = useWorkCustomerLookup(phone);
  const customer = parentId
    ? null
    : (lookup.data?.customer ??
      (prefillCustomer.data && !phone
        ? {
            id: prefillCustomer.data.id,
            code: prefillCustomer.data.code,
            name: prefillCustomer.data.name,
            phone: prefillCustomer.data.phone ?? null,
          }
        : null));
  const orders = useWorkCustomerOrders(customer?.id);
  const category = (cats.data ?? []).find((c) => c.id === categoryId);
  const policy =
    category?.policies.find((p) => p.priority === (priority || category.defaultPriority)) ??
    category?.policies.find((p) => p.priority === null);

  useEffect(() => {
    if (category && !priority) setPriority(category.defaultPriority);
  }, [category, priority]);
  useEffect(() => {
    if (category?.ownerDeptId) setOwnerDeptId(category.ownerDeptId);
  }, [category?.ownerDeptId]);

  const depts = useMemo(() => config.data?.departments ?? [], [config.data]);

  const submit = () => {
    const e: Record<string, string> = {};
    if (!categoryId) e.category = 'Chọn loại yêu cầu.';
    if (!title.trim()) e.title = 'Nhập tiêu đề.';
    if (customerKind && !customer && !parentId) e.customer = 'Tra SĐT để chọn khách.';
    if (kind === 'INTERNAL' && !ownerDeptId && !category?.ownerDeptId) e.dept = 'Chọn phòng nhận.';
    if (category?.requiresOrder && !orderId && !parent.data?.orderId)
      e.order = `Loại "${category.name}" bắt buộc chọn đơn liên quan.`;
    setErrors(e);
    if (Object.keys(e).length) return;
    const k = key ?? newIdempotencyKey();
    setKey(k);
    const body: CreateWorkItemBody = {
      kind,
      title: title.trim(),
      categoryId,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(priority ? { priority } : {}),
      ...(customerKind ? { channel } : {}),
      ...(customer ? { customerId: customer.id } : {}),
      ...(orderId ? { orderId } : {}),
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      ...(ownerDeptId ? { ownerDeptId } : {}),
      ...(parentId ? { parentId } : {}),
      ...(claim ? { claim: true } : {}),
    };
    create.mutate(
      { body, key: k },
      {
        onSuccess: (r) => {
          toast.success(`Đã tạo ${r.items[0]?.docNumber ?? 'yêu cầu'}`);
          router.push(parentId ? `/work/${parentId}` : `/work/${r.items[0]!.id}`);
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };
  useHotkey('Ctrl+S', submit);

  return (
    <form
      className="grid items-start gap-3 xl:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex min-w-0 flex-col gap-3 xl:col-span-3">
        {parentId ? (
          <Card title="Nhờ phòng khác cho yêu cầu">
            <div className="p-3.5 text-sm">
              {parent.data ? (
                <>
                  <span className="font-mono text-xs">{parent.data.docNumber}</span> ·{' '}
                  {parent.data.title}
                  <p className="text-xs text-muted-foreground">
                    Yêu cầu nội bộ sẽ kế thừa khách, đơn và liên hệ của yêu cầu gốc. SLA của yêu cầu
                    gốc vẫn chạy.
                  </p>
                </>
              ) : (
                <span className="text-muted-foreground">Đang tải yêu cầu gốc…</span>
              )}
            </div>
          </Card>
        ) : null}

        {customerKind && !parentId ? (
          <Card title="1. Khách hàng">
            <div className="flex flex-col gap-3 p-3.5">
              <div className="grid gap-3 md:grid-cols-3">
                <Field
                  id="rPhone"
                  label="Số điện thoại"
                  required
                  help="Tìm trên toàn hệ thống, kể cả khách team khác"
                  error={errors.customer}
                >
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                      id="rPhone"
                      inputMode="tel"
                      className="pl-8"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoFocus
                    />
                  </div>
                </Field>
                <Field id="rCName" label="Người liên hệ">
                  <Input
                    id="rCName"
                    placeholder="Để trống nếu là chính khách"
                    maxLength={120}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </Field>
                <Field id="rCPhone" label="SĐT liên hệ">
                  <Input
                    id="rCPhone"
                    placeholder="Nếu khác SĐT khách"
                    maxLength={30}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </Field>
              </div>
              {customer ? (
                <div className="flex items-start gap-2 rounded-md border border-success-line bg-success-weak px-3 py-2 text-sm">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    <b>{customer.name}</b> ·{' '}
                    <span className="font-mono text-xs">{customer.code}</span> ·{' '}
                    {formatPhone(customer.phone)}
                    {lookup.data?.careTeam === 'OTHER' ? ' · khách của team CSKH khác' : ''}
                  </span>
                </div>
              ) : phone.replace(/\D/g, '').length >= 9 && lookup.data && !lookup.data.customer ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có khách với SĐT này. Tạo khách ở màn Khách hàng trước.
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}

        {customer && !parentId ? (
          <Card
            title={`${customerKind ? '2' : 'Đơn'}. Đơn liên quan`}
            action={
              category?.requiresOrder ? (
                <span className="text-xs font-normal text-muted-foreground">
                  Bắt buộc với loại “{category.name}”
                </span>
              ) : null
            }
          >
            <div
              className="flex flex-col gap-1.5 p-3.5"
              role="radiogroup"
              aria-label="Đơn liên quan"
            >
              {(orders.data?.items ?? []).map((o) => (
                <label
                  key={o.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm',
                    orderId === o.id ? 'border-primary bg-secondary' : 'border-input-soft',
                  )}
                >
                  <input
                    type="radio"
                    name="order"
                    checked={orderId === o.id}
                    onChange={() => setOrderId(o.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <b className="font-mono text-xs">{o.docNumber}</b> · {formatDate(o.orderDate)}
                  </span>
                  <span className="tabular-nums">{formatMoney(o.total)}</span>
                </label>
              ))}
              {orders.isLoading ? (
                <p className="text-sm text-muted-foreground">Đang tải đơn…</p>
              ) : null}
              {!orders.isLoading && !(orders.data?.items ?? []).length ? (
                <p className="text-sm text-muted-foreground">
                  Khách chưa có đơn trong phạm vi của bạn.
                </p>
              ) : null}
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="order"
                  checked={orderId === ''}
                  onChange={() => setOrderId('')}
                />
                Không liên quan đơn nào
              </label>
              {errors.order ? (
                <p className="text-xs text-destructive" role="alert">
                  {errors.order}
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}

        <Card title={customerKind ? '3. Nội dung' : 'Nội dung'}>
          <div className="flex flex-col gap-3.5 p-3.5">
            {kind === 'INTERNAL' ? (
              <Field
                id="rDept"
                label="Phòng nhận"
                required
                error={errors.dept}
                help={category?.ownerDeptId ? 'Theo loại yêu cầu' : 'Phòng sẽ xử lý yêu cầu này'}
              >
                <Select value={ownerDeptId} onValueChange={setOwnerDeptId}>
                  <SelectTrigger id="rDept" className="w-full md:w-80">
                    <SelectValue placeholder="Chọn phòng…" />
                  </SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-semibold">
                Loại yêu cầu <span className="text-destructive">*</span>
              </legend>
              <div
                className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4"
                role="radiogroup"
                aria-label="Loại yêu cầu"
              >
                {(cats.data ?? []).map((c) => {
                  const p = c.policies.find((x) => x.priority === null);
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm',
                        categoryId === c.id ? 'border-primary bg-secondary' : 'border-input-soft',
                      )}
                    >
                      <input
                        type="radio"
                        name="cat"
                        className="mt-0.5"
                        checked={categoryId === c.id}
                        onChange={() => {
                          setCategoryId(c.id);
                          setPriority('');
                        }}
                      />
                      <span>
                        {c.name}
                        {p ? (
                          <span className="block text-xs text-muted-foreground">
                            Phản hồi {formatDuration(p.firstResponseMins, 570)} · xử lý{' '}
                            {formatDuration(p.resolveMins, 570)}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
                {cats.isLoading ? (
                  <p className="text-sm text-muted-foreground">Đang tải loại yêu cầu…</p>
                ) : null}
              </div>
              {errors.category ? (
                <p className="text-xs text-destructive" role="alert">
                  {errors.category}
                </p>
              ) : null}
            </fieldset>
            <div className="flex flex-wrap gap-5">
              <Field
                label="Ưu tiên"
                help={
                  category
                    ? `Mặc định của loại: ${PRIORITY_LABEL[category.defaultPriority]}`
                    : undefined
                }
              >
                <Seg
                  label="Ưu tiên"
                  value={(priority || 'NORMAL') as WorkPriority}
                  onChange={setPriority}
                  options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
                />
              </Field>
              {customerKind ? (
                <Field label="Kênh tiếp nhận">
                  <Seg
                    label="Kênh tiếp nhận"
                    value={channel}
                    onChange={setChannel}
                    options={CUSTOMER_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                  />
                </Field>
              ) : null}
            </div>
            <Field
              id="rTitle"
              label="Tiêu đề"
              required
              error={errors.title}
              help="Một câu, khách / bạn cần gì. Tối đa 200 ký tự."
            >
              <Input
                id="rTitle"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field id="rDesc" label="Mô tả">
              <Textarea
                id="rDesc"
                rows={4}
                maxLength={5000}
                placeholder="Chi tiết, đã kiểm tra gì, muốn xử lý thế nào"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={claim}
                onChange={(e) => setClaim(e.target.checked)}
              />
              Tôi tự nhận yêu cầu này (khi thuộc phòng nhận)
            </label>
          </div>
        </Card>
      </div>

      <aside
        className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-sticky-page-header"
        aria-label="Xem trước"
      >
        <Card title="SLA dự kiến">
          <div className="flex flex-col gap-2 p-3.5 text-sm">
            {policy ? (
              <>
                <span>
                  Phản hồi đầu trong <b>{formatDuration(policy.firstResponseMins, 570)}</b> giờ làm
                  việc
                </span>
                <span>
                  Xử lý xong trong <b>{formatDuration(policy.resolveMins, 570)}</b> giờ làm việc
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Chọn loại yêu cầu để xem hạn.</span>
            )}
            <span className="text-xs text-muted-foreground">
              Tính theo giờ làm việc, trừ ngày lễ. Tạo ngoài giờ thì đồng hồ bắt đầu lúc đầu giờ làm
              việc kế tiếp.
            </span>
          </div>
          <div className="flex justify-end gap-2 border-t p-3">
            <Button type="button" variant="ghost" asChild>
              <Link href={parentId ? `/work/${parentId}` : '/work'}>Hủy</Link>
            </Button>
            <Button type="submit" shortcut="Ctrl S" loading={create.isPending}>
              <Check aria-hidden /> Tạo yêu cầu
            </Button>
          </div>
        </Card>
        {kind === 'CUSTOMER' ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusBadge tone="draft">{KIND_LABEL.CUSTOMER}</StatusBadge> vào hàng chờ CSKH của bạn.
          </p>
        ) : null}
      </aside>
    </form>
  );
}
