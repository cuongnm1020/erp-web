'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { messageFor } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { WorkItemDetail, WorkPriority } from '../api/types';
import {
  useReassignWork,
  useUpdateWork,
  useWorkAction,
  useWorkAssignees,
  type WorkActionPath,
} from '../api/use-work';
import { OUTCOME_LABEL, OUTCOMES, PRIORITIES, PRIORITY_LABEL } from '../labels';

/** `<input type="datetime-local">` ↔ ISO. Ô nhập theo giờ máy người dùng (VN). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function Field({
  id,
  label,
  required,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
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

/** Khung chung: tiêu đề + mô tả + nội dung + chân Hủy / nút chính. Đóng chỉ khi không đang gửi. */
function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel,
  submitVariant = 'default',
  pending,
  onSubmit,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  submitLabel: string;
  submitVariant?: 'default' | 'destructive';
  pending: boolean;
  onSubmit: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent wide={wide}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children ? <div className="flex flex-col gap-3.5">{children}</div> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant={submitVariant} loading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface BaseProps {
  w: WorkItemDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** Chạy một thao tác, toast thành công / lỗi đã dịch (luật 6), đóng hộp khi xong. */
function useRun(w: WorkItemDetail, onDone: () => void) {
  const action = useWorkAction(w.id);
  const run = (path: WorkActionPath, body: Record<string, unknown>, ok: string) =>
    action.mutate(
      { action: path, body: { version: w.version, ...body } },
      {
        onSuccess: () => {
          toast.success(ok);
          onDone();
        },
        onError: (e) => toast.error(messageFor(e)),
      },
    );
  return { run, pending: action.isPending };
}

// ── Yêu cầu ─────────────────────────────────────────────────────────────

export function ResolveDialog({ w, open, onOpenChange }: BaseProps) {
  const [outcome, setOutcome] = useState<string>('');
  const [resolution, setResolution] = useState('');
  const [ref, setRef] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { run, pending } = useRun(w, () => onOpenChange(false));
  useEffect(() => {
    if (open) {
      setOutcome('');
      setResolution('');
      setRef('');
      setErr(null);
    }
  }, [open]);
  const late = w.deadline.state === 'OVERDUE';
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Đánh dấu đã xử lý"
      description={`${w.docNumber} · ${w.title}`}
      submitLabel="Đã xử lý"
      pending={pending}
      onSubmit={() => {
        if (!resolution.trim()) return setErr('Ghi kết quả xử lý để người sau đọc là hiểu.');
        run(
          'resolve',
          {
            resolution: resolution.trim(),
            ...(outcome ? { outcome } : {}),
            ...(ref.trim() ? { resolutionRef: ref.trim() } : {}),
          },
          `Đã xử lý ${w.docNumber}`,
        );
      }}
    >
      <p
        className={cn(
          'rounded-md border px-3 py-2 text-sm',
          late
            ? 'border-destructive-line bg-destructive-weak'
            : 'border-success-line bg-success-weak',
        )}
      >
        {late ? 'Xử lý sau hạn SLA — báo cáo ghi trễ hạn.' : 'Trong hạn SLA.'}
      </p>
      {w.kind === 'CUSTOMER' ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">Hướng xử lý</legend>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hướng xử lý">
            {OUTCOMES.map((o) => (
              <Button
                key={o}
                type="button"
                size="sm"
                variant={outcome === o ? 'default' : 'outline'}
                aria-pressed={outcome === o}
                onClick={() => setOutcome(outcome === o ? '' : o)}
              >
                {OUTCOME_LABEL[o]}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Field id="resolution" label="Kết quả xử lý" required error={err}>
        <Textarea
          id="resolution"
          rows={4}
          maxLength={5000}
          value={resolution}
          onChange={(e) => {
            setResolution(e.target.value);
            setErr(null);
          }}
        />
      </Field>
      <Field
        id="resolutionRef"
        label="Chứng từ liên quan"
        help="Đơn gửi bù, phiếu hoàn… — gắn vào lịch sử"
      >
        <Input
          id="resolutionRef"
          className="font-mono"
          maxLength={60}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        {w.kind === 'INTERNAL'
          ? 'Người yêu cầu xác nhận xong; không xác nhận thì tự đóng sau 3 ngày.'
          : 'Tự đóng sau 3 ngày. Khách báo lại trong 3 ngày thì bấm Mở lại.'}
        {w.openChildren > 0 ? ` Còn ${w.openChildren} yêu cầu nội bộ liên quan chưa xong.` : ''}
      </p>
    </ActionDialog>
  );
}

/** Lý do bắt buộc: hủy / mở lại / chưa xong. */
export function ReasonDialog({
  w,
  open,
  onOpenChange,
  action,
}: BaseProps & { action: 'cancel' | 'reopen' }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { run, pending } = useRun(w, () => onOpenChange(false));
  useEffect(() => {
    if (open) {
      setReason('');
      setErr(null);
    }
  }, [open]);
  const cancel = action === 'cancel';
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={cancel ? `Hủy ${w.docNumber}?` : `Mở lại ${w.docNumber}`}
      description={
        cancel
          ? 'Việc đã hủy không mở lại được và không tính vào báo cáo hạn. Chỉ hủy khi không còn cần làm.'
          : 'Việc quay lại Đang xử lý; số lần mở lại được ghi vào báo cáo.'
      }
      submitLabel={cancel ? 'Hủy việc' : 'Mở lại'}
      submitVariant={cancel ? 'destructive' : 'default'}
      pending={pending}
      onSubmit={() => {
        if (!reason.trim()) return setErr(cancel ? 'Ghi lý do hủy.' : 'Ghi lý do mở lại.');
        run(
          action,
          { reason: reason.trim() },
          cancel ? `Đã hủy ${w.docNumber}` : `Đã mở lại ${w.docNumber}`,
        );
      }}
    >
      <Field id="reason" label="Lý do" required error={err}>
        <Textarea
          id="reason"
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setErr(null);
          }}
        />
      </Field>
    </ActionDialog>
  );
}

/** Trưởng phòng nhận giao yêu cầu cho người trong phòng (số việc đang làm / quá hạn kèm theo). */
export function AssignDialog({ w, open, onOpenChange }: BaseProps) {
  const people = useWorkAssignees(w.ownerDeptId ?? undefined, open && !!w.ownerDeptId);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [note, setNote] = useState('');
  const { run, pending } = useRun(w, () => onOpenChange(false));
  useEffect(() => {
    if (open) {
      setAssigneeId(w.assignee?.id ?? '');
      setNote('');
    }
  }, [open, w.assignee?.id]);
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Giao ${w.docNumber}`}
      description={`Hàng chờ ${w.ownerDeptName ?? ''}`}
      submitLabel={assigneeId ? 'Giao việc' : 'Trả về hàng chờ'}
      pending={pending}
      onSubmit={() =>
        run(
          'assign',
          { assigneeId: assigneeId || null, ...(note.trim() ? { note: note.trim() } : {}) },
          assigneeId ? `Đã giao ${w.docNumber}` : `Đã trả ${w.docNumber} về hàng chờ`,
        )
      }
    >
      <PeoplePicker
        loading={people.isLoading}
        people={people.data ?? []}
        value={assigneeId}
        onChange={setAssigneeId}
        allowEmpty="Để trống — trả về hàng chờ"
      />
      <Field id="assignNote" label="Ghi chú giao việc" help="Không bắt buộc — ghi vào lịch sử">
        <Textarea
          id="assignNote"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </ActionDialog>
  );
}

export function PeoplePicker({
  people,
  value,
  onChange,
  loading,
  allowEmpty,
}: {
  people: {
    id: string;
    fullName: string;
    departmentName: string | null;
    isSelf: boolean;
    open: number;
    overdue: number;
  }[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  allowEmpty?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-semibold">Người xử lý</legend>
      <div
        className="max-h-64 overflow-y-auto rounded-md border"
        role="radiogroup"
        aria-label="Người xử lý"
      >
        <div className="flex justify-between border-b bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
          <span>Nhân viên</span>
          <span>Đang làm · quá hạn</span>
        </div>
        {allowEmpty ? (
          <label className="flex cursor-pointer items-center gap-2.5 border-b px-2.5 py-1.5 text-sm">
            <input
              type="radio"
              name="assignee"
              checked={value === ''}
              onChange={() => onChange('')}
            />
            <span className="text-muted-foreground">{allowEmpty}</span>
          </label>
        ) : null}
        {loading ? (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">Đang tải nhân sự…</p>
        ) : null}
        {people.map((p) => (
          <label
            key={p.id}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 border-b px-2.5 py-1.5 text-sm last:border-b-0',
              value === p.id && 'bg-secondary',
            )}
          >
            <input
              type="radio"
              name="assignee"
              checked={value === p.id}
              onChange={() => onChange(p.id)}
            />
            <span className="min-w-0 flex-1">
              {p.fullName}
              {p.isSelf ? <span className="text-muted-foreground"> (bạn)</span> : null}
              {p.departmentName ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {p.departmentName}
                </span>
              ) : null}
            </span>
            <span className="tabular-nums">
              {p.open} · <b className={p.overdue ? 'text-destructive' : undefined}>{p.overdue}</b>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ── Giao việc ───────────────────────────────────────────────────────────

export function ExtensionDialog({ w, open, onOpenChange }: BaseProps) {
  const [due, setDue] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { run, pending } = useRun(w, () => onOpenChange(false));
  useEffect(() => {
    if (open) {
      setDue('');
      setReason('');
      setErr(null);
    }
  }, [open]);
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Xin gia hạn"
      description={`${w.docNumber} · hạn hiện tại ${w.dueAt ? formatDateTime(w.dueAt) : '—'}`}
      submitLabel="Gửi đề nghị"
      pending={pending}
      onSubmit={() => {
        const iso = fromLocalInput(due);
        if (!iso) return setErr('Chọn hạn mới.');
        if (w.dueAt && iso <= w.dueAt) return setErr('Hạn mới phải sau hạn hiện tại.');
        if (!reason.trim()) return setErr('Ghi lý do để người giao biết.');
        run('extension', { dueAt: iso, reason: reason.trim() }, 'Đã gửi đề nghị gia hạn');
      }}
    >
      <Field id="extDue" label="Hạn mới đề nghị" required>
        <Input
          id="extDue"
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </Field>
      <Field id="extReason" label="Lý do" required error={err}>
        <Textarea
          id="extReason"
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Gửi tới {w.assigner?.fullName ?? 'người giao'}. Trong lúc chờ, việc vẫn tính theo hạn cũ.
      </p>
    </ActionDialog>
  );
}

/** Người giao: đồng ý / từ chối xin gia hạn. */
export function ExtensionDecisionDialog({
  w,
  open,
  onOpenChange,
  approve,
}: BaseProps & { approve: boolean }) {
  const [comment, setComment] = useState('');
  const { run, pending } = useRun(w, () => onOpenChange(false));
  useEffect(() => {
    if (open) setComment('');
  }, [open]);
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={approve ? 'Đồng ý gia hạn' : 'Từ chối gia hạn'}
      description={`${w.docNumber}: ${w.dueAt ? formatDateTime(w.dueAt) : '—'} → ${w.pendingDueAt ? formatDateTime(w.pendingDueAt) : '—'}${w.pendingDueReason ? ` · "${w.pendingDueReason}"` : ''}`}
      submitLabel={approve ? 'Đồng ý' : 'Từ chối'}
      submitVariant={approve ? 'default' : 'destructive'}
      pending={pending}
      onSubmit={() =>
        run(
          'extension/decision',
          { approve, ...(comment.trim() ? { comment: comment.trim() } : {}) },
          approve ? `Đã đồng ý gia hạn ${w.docNumber}` : `Đã từ chối gia hạn ${w.docNumber}`,
        )
      }
    >
      <Field id="decComment" label="Nhận xét" help="Không bắt buộc">
        <Textarea
          id="decComment"
          rows={2}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Field>
    </ActionDialog>
  );
}

/** Người giao: duyệt kết quả hoặc yêu cầu làm lại. */
export function ReviewDialog({
  w,
  open,
  onOpenChange,
  mode,
}: BaseProps & { mode: 'approve' | 'rework' }) {
  const [comment, setComment] = useState('');
  const [due, setDue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { run, pending } = useRun(w, () => onOpenChange(false));
  useEffect(() => {
    if (open) {
      setComment('');
      setDue('');
      setErr(null);
    }
  }, [open]);
  const rework = mode === 'rework';
  const lastSubmit = w.events.find((e) => e.type === 'SUBMITTED');
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={rework ? 'Yêu cầu làm lại' : 'Duyệt kết quả'}
      description={`${w.docNumber} · ${w.assignee?.fullName ?? ''} báo xong ${w.submittedAt ? formatDateTime(w.submittedAt) : ''} · ${w.checklistDone}/${w.checklistTotal} mục`}
      submitLabel={rework ? 'Gửi yêu cầu làm lại' : 'Duyệt'}
      pending={pending}
      onSubmit={() => {
        if (rework && !comment.trim()) return setErr('Ghi rõ cần làm lại gì.');
        const dueIso = fromLocalInput(due);
        run(
          rework ? 'rework' : 'approve',
          rework
            ? { comment: comment.trim(), ...(dueIso ? { dueAt: dueIso } : {}) }
            : comment.trim()
              ? { comment: comment.trim() }
              : {},
          rework ? `Đã yêu cầu làm lại ${w.docNumber}` : `Đã duyệt ${w.docNumber}`,
        );
      }}
    >
      {lastSubmit?.body ? (
        <blockquote className="rounded-md border bg-background px-3 py-2 text-sm">
          {lastSubmit.body}
        </blockquote>
      ) : null}
      <Field
        id="revComment"
        label={rework ? 'Cần làm lại gì' : 'Nhận xét'}
        required={rework}
        error={err}
      >
        <Textarea
          id="revComment"
          rows={3}
          maxLength={5000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Field>
      {rework ? (
        <Field id="revDue" label="Hạn làm lại" help="Bỏ trống = giữ hạn hiện tại">
          <Input
            id="revDue"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
      ) : null}
    </ActionDialog>
  );
}

/** Chuyển một / nhiều việc được giao sang người khác trong nhánh. */
export function ReassignDialog({
  ids,
  title,
  open,
  onOpenChange,
  onDone,
}: {
  ids: string[];
  title: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}) {
  const people = useWorkAssignees(undefined, open);
  const reassign = useReassignWork();
  const [assigneeId, setAssigneeId] = useState('');
  const [reason, setReason] = useState('');
  const [extend, setExtend] = useState(0);
  const [keep, setKeep] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setAssigneeId('');
      setReason('');
      setExtend(0);
      setKeep(true);
      setErr(null);
    }
  }, [open]);
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      submitLabel={`Chuyển ${ids.length} việc`}
      pending={reassign.isPending}
      onSubmit={() => {
        if (!assigneeId) return setErr('Chọn người nhận.');
        if (!reason.trim()) return setErr('Ghi lý do chuyển.');
        reassign.mutate(
          {
            ids,
            assigneeId,
            reason: reason.trim(),
            extendWorkdays: extend,
            keepPreviousAsWatcher: keep,
          },
          {
            onSuccess: (r) => {
              if (r.failed.length) {
                toast.error(
                  `Đã chuyển ${r.updated} việc; ${r.failed.length} việc không chuyển được (${r.failed
                    .map((f) => f.docNumber ?? f.id)
                    .join(', ')}).`,
                );
              } else toast.success(`Đã chuyển ${r.updated} việc`);
              onOpenChange(false);
              onDone?.();
            },
            onError: (e) => toast.error(messageFor(e)),
          },
        );
      }}
    >
      <PeoplePicker
        loading={people.isLoading}
        people={(people.data ?? []).filter((p) => !p.isSelf)}
        value={assigneeId}
        onChange={setAssigneeId}
      />
      <Field id="reExtend" label="Hạn chót">
        <Select value={String(extend)} onValueChange={(v) => setExtend(Number(v))}>
          <SelectTrigger id="reExtend">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Giữ hạn cũ</SelectItem>
            <SelectItem value="1">Cộng thêm 1 ngày làm việc</SelectItem>
            <SelectItem value="2">Cộng thêm 2 ngày làm việc</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field id="reReason" label="Lý do" required error={err}>
        <Input
          id="reReason"
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={keep} onCheckedChange={(v) => setKeep(v === true)} />
        Giữ người làm cũ làm người theo dõi
      </label>
    </ActionDialog>
  );
}

/** Sửa tiêu đề / mô tả / ưu tiên / hạn chót (giao việc) — PATCH kèm version. */
export function EditWorkDialog({ w, open, onOpenChange }: BaseProps) {
  const update = useUpdateWork(w.id);
  const [title, setTitle] = useState(w.title);
  const [description, setDescription] = useState(w.description ?? '');
  const [priority, setPriority] = useState<WorkPriority>(w.priority);
  const [due, setDue] = useState(toLocalInput(w.dueAt));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setTitle(w.title);
      setDescription(w.description ?? '');
      setPriority(w.priority);
      setDue(toLocalInput(w.dueAt));
      setErr(null);
    }
  }, [open, w]);
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Sửa ${w.docNumber}`}
      submitLabel="Lưu thay đổi"
      pending={update.isPending}
      onSubmit={() => {
        if (!title.trim()) return setErr('Nhập tiêu đề.');
        const dueAt = w.kind === 'TASK' ? fromLocalInput(due) : undefined;
        update.mutate(
          {
            version: w.version,
            title: title.trim(),
            description: description.trim() || null,
            priority,
            ...(w.kind === 'TASK' ? { dueAt } : {}),
          },
          {
            onSuccess: () => {
              toast.success('Đã lưu thay đổi');
              onOpenChange(false);
            },
            onError: (e) => toast.error(messageFor(e)),
          },
        );
      }}
    >
      <Field id="edTitle" label="Tiêu đề" required error={err}>
        <Input
          id="edTitle"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field id="edDesc" label="Mô tả">
        <Textarea
          id="edDesc"
          rows={4}
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field
        id="edPriority"
        label="Ưu tiên"
        help={w.kind !== 'TASK' ? 'Đổi ưu tiên tính lại hạn SLA từ lúc tạo.' : undefined}
      >
        <Select value={priority} onValueChange={(v) => setPriority(v as WorkPriority)}>
          <SelectTrigger id="edPriority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {w.kind === 'TASK' ? (
        <Field id="edDue" label="Hạn chót" help="Bỏ trống = không có hạn">
          <Input
            id="edDue"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
      ) : null}
    </ActionDialog>
  );
}
