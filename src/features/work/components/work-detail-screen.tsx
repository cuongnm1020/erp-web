'use client';

import {
  AlertTriangle,
  Check,
  Clock,
  Lock,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { Copyable } from '@/components/data/copy-button';
import { DetailSkeleton } from '@/components/data/states';
import { ErrorState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { NotFoundCard } from '@/components/layout/not-found-screen';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatPhone } from '@/lib/format';
import { useHotkey } from '@/lib/use-hotkey';
import type { WorkChannel, WorkEvent, WorkItemDetail } from '../api/types';
import {
  useAddChecklist,
  useRemoveChecklistItem,
  useUpdateChecklistItem,
  useUploadWorkAttachment,
  useWorkAction,
  useWorkItem,
} from '../api/use-work';
import {
  CHANNEL_LABEL,
  CUSTOMER_CHANNELS,
  deadlineText,
  EVENT_LABEL,
  formatDeadlineAt,
  formatDuration,
  KIND_LABEL,
  OUTCOME_LABEL,
  PRIORITY_LABEL,
  statusLabel,
} from '../labels';
import {
  AssignDialog,
  EditWorkDialog,
  ExtensionDecisionDialog,
  ExtensionDialog,
  ReasonDialog,
  ReassignDialog,
  ResolveDialog,
  ReviewDialog,
} from './work-dialogs';
import {
  Card,
  ChecklistProgress,
  DeadlineCell,
  MainAside,
  PriorityText,
  WorkStatusBadge,
} from './work-ui';

/**
 * Chi tiết việc (A2 giao việc, C2 yêu cầu — docs/screens/FE-WORK-1-work-module.md §4). Nút thao tác
 * theo `can` API trả (work-rules.ts) — không tự suy quyền ở UI. 404 ngoài phạm vi → NotFoundCard.
 */
type DialogKey =
  | 'resolve'
  | 'cancel'
  | 'reopen'
  | 'assign'
  | 'extension'
  | 'extApprove'
  | 'extReject'
  | 'approve'
  | 'rework'
  | 'reassign'
  | 'edit'
  | null;

export function WorkDetailScreen({ id }: { id: string }) {
  const query = useWorkItem(id);
  if (query.isPending) return <DetailSkeleton fields={10} />;
  if (query.error) {
    if (isApiError(query.error) && query.error.isNotFound) {
      return (
        <NotFoundCard
          title="Không có việc này"
          path={`/work/${id}`}
          description="Việc không tồn tại hoặc nằm ngoài phạm vi của bạn (không phải người làm, người giao, người theo dõi hay hàng chờ phòng bạn)."
          backHref="/work"
          backLabel="Về Việc của tôi"
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <WorkDetail w={query.data} />;
}

function WorkDetail({ w }: { w: WorkItemDetail }) {
  const [dialog, setDialog] = useState<DialogKey>(null);
  const action = useWorkAction(w.id);
  const can = w.can;
  const final = ['CLOSED', 'DONE', 'CANCELLED'].includes(w.status);
  const task = w.kind === 'TASK';

  const quick = (path: Parameters<typeof action.mutate>[0]['action'], ok: string, body = {}) =>
    action.mutate(
      { action: path, body: { version: w.version, ...body } },
      { onSuccess: () => toast.success(ok), onError: (e) => toast.error(messageFor(e)) },
    );

  const primary: ReactNode = can.approve ? (
    <Button onClick={() => setDialog('approve')}>
      <Check aria-hidden /> Duyệt
    </Button>
  ) : can.submit ? (
    <Button
      shortcut="Ctrl Enter"
      loading={action.isPending}
      onClick={() => quick('submit', `Đã báo xong ${w.docNumber}`)}
    >
      <Check aria-hidden /> Báo xong
    </Button>
  ) : can.confirm ? (
    <Button
      loading={action.isPending}
      onClick={() => quick('confirm', `Đã xác nhận xong ${w.docNumber}`)}
    >
      <Check aria-hidden /> Xác nhận xong
    </Button>
  ) : can.resolve ? (
    <Button shortcut="Ctrl Enter" onClick={() => setDialog('resolve')}>
      <Check aria-hidden /> Đã xử lý
    </Button>
  ) : can.claim ? (
    <Button loading={action.isPending} onClick={() => quick('claim', `Đã nhận ${w.docNumber}`)}>
      Nhận
    </Button>
  ) : null;

  useHotkey(
    'Ctrl+Enter',
    () => (can.submit ? quick('submit', `Đã báo xong ${w.docNumber}`) : setDialog('resolve')),
    { enabled: (can.submit || can.resolve) && !dialog },
  );

  const secondary: { label: string; onClick: () => void; show: boolean }[] = [
    { label: 'Yêu cầu làm lại', onClick: () => setDialog('rework'), show: can.rework },
    { label: 'Xin gia hạn', onClick: () => setDialog('extension'), show: can.requestExtension },
    {
      label: 'Bắt đầu',
      onClick: () => quick('start', `Đã bắt đầu ${w.docNumber}`),
      show: can.start,
    },
    {
      label: 'Chờ khách',
      onClick: () => quick('wait', `Đã chuyển ${w.docNumber} sang Chờ khách`),
      show: can.wait,
    },
    {
      label: 'Khách đã phản hồi',
      onClick: () => quick('resume', `Đồng hồ xử lý ${w.docNumber} chạy lại`),
      show: can.resume,
    },
    { label: 'Chưa xong', onClick: () => setDialog('reopen'), show: can.confirm && can.reopen },
    { label: 'Giao lại', onClick: () => setDialog('assign'), show: can.assign },
  ].filter((x) => x.show);
  const visible = secondary.slice(0, 2);
  const overflow = secondary.slice(2);
  const menu: { label: string; onClick: () => void; danger?: boolean }[] = [
    ...overflow,
    ...(can.edit ? [{ label: 'Sửa thông tin', onClick: () => setDialog('edit') }] : []),
    ...(can.reassign
      ? [{ label: 'Chuyển việc cho người khác', onClick: () => setDialog('reassign') }]
      : []),
    ...(can.close
      ? [{ label: 'Đóng yêu cầu', onClick: () => quick('close', `Đã đóng ${w.docNumber}`) }]
      : []),
    ...(can.reopen && !can.confirm
      ? [{ label: 'Mở lại', onClick: () => setDialog('reopen') }]
      : []),
    ...(can.cancel
      ? [{ label: 'Hủy việc', onClick: () => setDialog('cancel'), danger: true }]
      : []),
  ];

  const meta = [
    w.docNumber,
    KIND_LABEL[w.kind],
    w.categoryName,
    `ưu tiên ${PRIORITY_LABEL[w.priority]}`,
    task
      ? w.assigner && w.assigner.id !== w.assignee?.id
        ? `giao bởi ${w.assigner.fullName} lúc ${formatDateTime(w.createdAt)}`
        : `tự tạo ${formatDateTime(w.createdAt)}`
      : `tạo ${formatDateTime(w.createdAt)} bởi ${w.requester.fullName}${w.channel ? ` qua ${CHANNEL_LABEL[w.channel].toLowerCase()}` : ''}`,
    task && w.needsApproval ? 'cần duyệt kết quả' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <PageHeader
        title={w.title}
        status={<WorkStatusBadge w={w} />}
        description={meta}
        breadcrumb={[
          { label: 'Công việc', href: '/work' },
          task
            ? { label: 'Việc của tôi', href: '/work' }
            : { label: 'Hàng chờ yêu cầu', href: '/work/queue' },
          { label: w.docNumber },
        ]}
        actions={
          <>
            {visible.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                onClick={s.onClick}
                disabled={action.isPending}
              >
                {s.label}
              </Button>
            ))}
            {menu.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Thêm thao tác">
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menu
                    .filter((m) => !m.danger)
                    .map((m) => (
                      <DropdownMenuItem key={m.label} onSelect={m.onClick}>
                        {m.label}
                      </DropdownMenuItem>
                    ))}
                  {menu.some((m) => m.danger) ? <DropdownMenuSeparator /> : null}
                  {menu
                    .filter((m) => m.danger)
                    .map((m) => (
                      <DropdownMenuItem key={m.label} danger onSelect={m.onClick}>
                        {m.label}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {primary}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        {final ? (
          <div className="flex items-start gap-2 rounded-md border border-info-line bg-info-weak px-3 py-2 text-sm">
            <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <span>
              {statusLabel(w.kind, w.status)}
              {w.closedAt ? ` ${formatDateTime(w.closedAt)}` : ''} — chỉ xem, không ghi thêm.
              {w.cancelReason ? ` Lý do hủy: ${w.cancelReason}` : ''}
            </span>
          </div>
        ) : null}
        <DeadlineStrip w={w} />
        {w.pendingDueAt ? (
          <ExtensionBanner
            w={w}
            onApprove={() => setDialog('extApprove')}
            onReject={() => setDialog('extReject')}
          />
        ) : null}
        {w.deadline.state === 'OVERDUE' && !final ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive-line bg-destructive-weak px-3 py-2 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>
              Đã quá hạn {formatDuration(w.deadline.minutesLeft ?? 0, task ? 1440 : 570)}.
              {task
                ? ' Cần thêm thời gian thì bấm Xin gia hạn để người giao biết hạn mới.'
                : ' Trưởng phòng nhận đã thấy cảnh báo trên chuông.'}
            </span>
          </div>
        ) : null}

        <MainAside
          asideLabel="Thông tin liên quan"
          main={
            <>
              <Card
                title="Mô tả"
                action={
                  can.edit ? (
                    <Button variant="ghost" size="sm" onClick={() => setDialog('edit')}>
                      Sửa
                    </Button>
                  ) : null
                }
              >
                <div className="flex flex-col gap-2 p-3.5 text-sm">
                  <p className="whitespace-pre-line">
                    {w.description || (
                      <span className="text-muted-foreground">Không có mô tả.</span>
                    )}
                  </p>
                  {w.resolution ? (
                    <div className="rounded-md border border-success-line bg-success-weak px-3 py-2">
                      <b>
                        Kết quả xử lý
                        {w.outcome ? ` · ${OUTCOME_LABEL[w.outcome] ?? w.outcome}` : ''}:
                      </b>{' '}
                      {w.resolution}
                      {w.resolutionRef ? (
                        <span className="font-mono"> · {w.resolutionRef}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Card>
              {w.checklistTotal > 0 || can.checklist ? <ChecklistCard w={w} /> : null}
              <ActivityCard w={w} />
            </>
          }
          aside={<DetailAside w={w} />}
        />
      </div>

      <ResolveDialog
        w={w}
        open={dialog === 'resolve'}
        onOpenChange={(o) => setDialog(o ? 'resolve' : null)}
      />
      <ReasonDialog
        w={w}
        action="cancel"
        open={dialog === 'cancel'}
        onOpenChange={(o) => setDialog(o ? 'cancel' : null)}
      />
      <ReasonDialog
        w={w}
        action="reopen"
        open={dialog === 'reopen'}
        onOpenChange={(o) => setDialog(o ? 'reopen' : null)}
      />
      <AssignDialog
        w={w}
        open={dialog === 'assign'}
        onOpenChange={(o) => setDialog(o ? 'assign' : null)}
      />
      <ExtensionDialog
        w={w}
        open={dialog === 'extension'}
        onOpenChange={(o) => setDialog(o ? 'extension' : null)}
      />
      <ExtensionDecisionDialog
        w={w}
        approve
        open={dialog === 'extApprove'}
        onOpenChange={(o) => setDialog(o ? 'extApprove' : null)}
      />
      <ExtensionDecisionDialog
        w={w}
        approve={false}
        open={dialog === 'extReject'}
        onOpenChange={(o) => setDialog(o ? 'extReject' : null)}
      />
      <ReviewDialog
        w={w}
        mode="approve"
        open={dialog === 'approve'}
        onOpenChange={(o) => setDialog(o ? 'approve' : null)}
      />
      <ReviewDialog
        w={w}
        mode="rework"
        open={dialog === 'rework'}
        onOpenChange={(o) => setDialog(o ? 'rework' : null)}
      />
      <ReassignDialog
        ids={[w.id]}
        title={`Chuyển ${w.docNumber}`}
        open={dialog === 'reassign'}
        onOpenChange={(o) => setDialog(o ? 'reassign' : null)}
      />
      <EditWorkDialog
        w={w}
        open={dialog === 'edit'}
        onOpenChange={(o) => setDialog(o ? 'edit' : null)}
      />
    </>
  );
}

function StripCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-b px-3.5 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function DeadlineStrip({ w }: { w: WorkItemDetail }) {
  const task = w.kind === 'TASK';
  const t = deadlineText(w);
  const used = Math.min(100, Math.max(0, w.deadline.usedPercent ?? 0));
  return (
    <section className="grid rounded-lg border bg-card md:grid-cols-3" aria-label="Hạn">
      {task ? (
        <StripCell label="Hạn chót">
          <DeadlineCell w={w} />
          <span className="text-xs text-muted-foreground">
            {w.dueAt ? `Hạn ${formatDateTime(w.dueAt)}` : 'Không có hạn'}
            {w.extensionCount
              ? ` · đã gia hạn ${w.extensionCount} lần (hạn gốc ${formatDateTime(w.originalDueAt)})`
              : ''}
          </span>
        </StripCell>
      ) : (
        <StripCell label="Phản hồi đầu">
          {w.firstReplyAt ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-sm font-semibold',
                w.firstResponseBreachedAt ? 'text-destructive' : 'text-success',
              )}
            >
              {w.firstResponseBreachedAt ? (
                <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
              ) : (
                <Check aria-hidden className="h-3.5 w-3.5" />
              )}
              {w.firstResponseBreachedAt ? 'Trễ hạn' : 'Đúng hạn'}
            </span>
          ) : w.firstResponseDueAt ? (
            <DeadlineCell w={{ kind: w.kind, deadline: w.deadline }} sub={false} />
          ) : (
            <span className="text-sm text-muted-foreground">Không tính SLA</span>
          )}
          <span className="text-xs text-muted-foreground">
            {w.firstReplyAt ? `Phản hồi lúc ${formatDateTime(w.firstReplyAt)} · ` : ''}
            {w.firstResponseDueAt ? `hạn ${formatDeadlineAt(w.firstResponseDueAt)}` : ''}
          </span>
        </StripCell>
      )}
      <StripCell label={task ? 'Tiến độ' : 'Xử lý xong'}>
        {task ? (
          <>
            <span className="text-base font-semibold">
              {w.checklistTotal
                ? `${w.checklistDone} / ${w.checklistTotal} mục`
                : 'Chưa có checklist'}
            </span>
            {w.checklistTotal ? (
              <ChecklistProgress done={w.checklistDone} total={w.checklistTotal} />
            ) : null}
          </>
        ) : w.resolveDueAt ? (
          <>
            <span className="text-base font-semibold">{t.label}</span>
            {w.deadline.usedPercent !== null && !['MET', 'MISSED'].includes(w.deadline.state) ? (
              <span
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`Đã dùng ${used}% thời gian xử lý`}
              >
                <span
                  className={cn(
                    'block h-full rounded-full',
                    used >= 80 ? 'bg-warning' : 'bg-primary',
                    w.deadline.state === 'OVERDUE' && 'bg-destructive',
                  )}
                  style={{ width: `${used}%` }}
                />
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Hạn {formatDateTime(w.resolveDueAt)} · giờ làm việc
              {w.pausedMins ? ` · đã dừng ${formatDuration(w.pausedMins, 570)} khi chờ khách` : ''}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Không tính SLA</span>
        )}
      </StripCell>
      <StripCell label={task ? 'Sau khi báo xong' : 'Chính sách áp dụng'}>
        {task ? (
          <span className="text-sm">
            {w.needsApproval
              ? `Chuyển sang Chờ duyệt — ${w.assigner?.fullName ?? 'người giao'} duyệt hoặc yêu cầu làm lại`
              : 'Xong ngay, không cần duyệt'}
          </span>
        ) : w.slaPolicy ? (
          <span className="text-sm">
            <b>
              {w.categoryName} · {PRIORITY_LABEL[w.priority]}
            </b>
            <br />
            Phản hồi trong {formatDuration(w.slaPolicy.firstResponseMins, 570)} · xử lý trong{' '}
            {formatDuration(w.slaPolicy.resolveMins, 570)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Loại này chưa đặt SLA</span>
        )}
        {!task ? (
          <span className="text-xs text-muted-foreground">
            Chốt lúc tạo; sửa cấu hình sau đó không đổi hạn của yêu cầu này.
          </span>
        ) : null}
      </StripCell>
    </section>
  );
}

function ExtensionBanner({
  w,
  onApprove,
  onReject,
}: {
  w: WorkItemDetail;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm">
      <Clock aria-hidden className="h-4 w-4 shrink-0 text-warning" />
      <span className="min-w-0 flex-1">
        <b>{w.assignee?.fullName ?? 'Người làm'}</b> xin dời hạn {formatDateTime(w.dueAt)} →{' '}
        <b>{formatDateTime(w.pendingDueAt)}</b>
        {w.pendingDueReason ? ` — “${w.pendingDueReason}”` : ''}
      </span>
      {w.can.decideExtension ? (
        <>
          <Button size="sm" variant="outline" onClick={onReject}>
            Từ chối
          </Button>
          <Button size="sm" onClick={onApprove}>
            Đồng ý
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Đang chờ người giao duyệt</span>
      )}
    </div>
  );
}

function ChecklistCard({ w }: { w: WorkItemDetail }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>(w.checklistDone ? 'open' : 'all');
  const [title, setTitle] = useState('');
  const update = useUpdateChecklistItem(w.id);
  const remove = useRemoveChecklistItem(w.id);
  const add = useAddChecklist(w.id);
  const items = w.checklist.filter((c) =>
    filter === 'all' ? true : filter === 'done' ? !!c.doneAt : !c.doneAt,
  );
  const canEdit = w.can.checklist;
  const err = (e: unknown) => toast.error(messageFor(e));
  return (
    <Card
      title={`Checklist · ${w.checklistDone}/${w.checklistTotal}`}
      label="Checklist"
      action={
        <div className="flex gap-1" role="group" aria-label="Lọc checklist">
          {(
            [
              ['all', 'Tất cả'],
              ['open', `Chưa xong · ${w.checklistTotal - w.checklistDone}`],
              ['done', `Xong · ${w.checklistDone}`],
            ] as const
          ).map(([k, l]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? 'default' : 'outline'}
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
            >
              {l}
            </Button>
          ))}
        </div>
      }
    >
      <ul>
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-start gap-2.5 border-b px-3.5 py-2 text-sm last:border-b-0"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={!!c.doneAt}
              disabled={!canEdit || update.isPending}
              aria-label={`${c.doneAt ? 'Bỏ đánh dấu' : 'Đánh dấu xong'}: ${c.title}`}
              onChange={(e) =>
                update.mutate({ itemId: c.id, body: { done: e.target.checked } }, { onError: err })
              }
            />
            <div className={cn('min-w-0 flex-1', c.doneAt && 'text-muted-foreground')}>
              <span>{c.title}</span>
              {c.note ? (
                <span className="block text-xs text-muted-foreground">{c.note}</span>
              ) : null}
              {c.doneAt ? (
                <span className="block text-xs text-muted-foreground">
                  Xong {formatDateTime(c.doneAt)}
                  {c.doneBy ? ` · ${c.doneBy.fullName}` : ''}
                </span>
              ) : null}
            </div>
            {c.refType === 'customer' && c.refId ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/work/new?kind=CUSTOMER&customerId=${c.refId}`}>
                  Tạo yêu cầu khách
                </Link>
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Xóa mục ${c.title}`}
                onClick={() => remove.mutate(c.id, { onError: err })}
              >
                <Trash2 aria-hidden />
              </Button>
            ) : null}
          </li>
        ))}
        {!items.length ? (
          <li className="px-3.5 py-3 text-sm text-muted-foreground">Không có mục nào.</li>
        ) : null}
      </ul>
      {canEdit ? (
        <form
          className="flex items-center gap-2 border-t px-3.5 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            const lines = title
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean);
            if (!lines.length) return;
            add.mutate(
              lines.map((t) => ({ title: t })),
              { onSuccess: () => setTitle(''), onError: err },
            );
          }}
        >
          <Plus aria-hidden className="h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Thêm mục checklist"
            placeholder="Thêm mục checklist — Enter"
            className="flex-1 border-transparent shadow-none focus-visible:border-input"
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
          />
        </form>
      ) : null}
    </Card>
  );
}

type Mode = 'reply' | 'note';

function ActivityCard({ w }: { w: WorkItemDetail }) {
  const customer = w.kind === 'CUSTOMER';
  const [mode, setMode] = useState<Mode>(customer && w.can.reply ? 'reply' : 'note');
  const [channel, setChannel] = useState<WorkChannel>('ZALO');
  const [body, setBody] = useState('');
  const [waitAfter, setWaitAfter] = useState(false);
  const [filter, setFilter] = useState<'all' | 'talk' | 'system'>('all');
  const action = useWorkAction(w.id);
  const upload = useUploadWorkAttachment(w.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const canWrite = w.can.note || w.can.reply;
  const talk = (e: WorkEvent) => e.type === 'REPLY' || e.type === 'NOTE';
  const events = w.events.filter((e) =>
    filter === 'all' ? true : filter === 'talk' ? talk(e) : !talk(e),
  );

  const send = () => {
    const text = body.trim();
    if (!text) return;
    const isReply = mode === 'reply' && w.can.reply;
    action.mutate(
      {
        action: isReply ? 'reply' : 'note',
        body: isReply ? { body: text, channel, waitCustomer: waitAfter } : { body: text },
      },
      {
        onSuccess: () => {
          toast.success(isReply ? 'Đã lưu phản hồi' : 'Đã lưu ghi chú');
          setBody('');
          setWaitAfter(false);
        },
        onError: (e) => toast.error(messageFor(e)),
      },
    );
  };

  return (
    <Card
      title="Trao đổi & lịch sử"
      label="Trao đổi và lịch sử"
      action={
        <div className="flex gap-1" role="group" aria-label="Lọc lịch sử">
          {(
            [
              ['all', `Tất cả · ${w.events.length}`],
              ['talk', 'Trao đổi'],
              ['system', 'Thay đổi'],
            ] as const
          ).map(([k, l]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? 'default' : 'outline'}
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
            >
              {l}
            </Button>
          ))}
        </div>
      }
    >
      {canWrite ? (
        <div className="flex flex-col gap-2 border-b bg-background px-3.5 py-3">
          {customer && w.can.reply ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" role="group" aria-label="Loại ghi nhận">
                <Button
                  size="sm"
                  variant={mode === 'reply' ? 'default' : 'outline'}
                  aria-pressed={mode === 'reply'}
                  onClick={() => setMode('reply')}
                >
                  Phản hồi khách
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'note' ? 'default' : 'outline'}
                  aria-pressed={mode === 'note'}
                  onClick={() => setMode('note')}
                >
                  Ghi chú nội bộ
                </Button>
              </div>
              {mode === 'reply' ? (
                <Select value={channel} onValueChange={(v) => setChannel(v as WorkChannel)}>
                  <SelectTrigger className="w-40" aria-label="Kênh">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        Kênh: {CHANNEL_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ) : null}
          <Textarea
            aria-label={mode === 'reply' ? 'Nội dung phản hồi khách' : 'Bình luận'}
            rows={3}
            maxLength={5000}
            placeholder={
              mode === 'reply'
                ? 'Ghi lại nội dung đã trả lời khách (qua Zalo, điện thoại…) — lần đầu tính là phản hồi đầu'
                : 'Viết bình luận / ghi chú nội bộ — khách không thấy'
            }
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                send();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              aria-label="Chọn tệp đính kèm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                upload.mutate(f, {
                  onSuccess: () => toast.success(`Đã đính kèm ${f.name}`),
                  onError: (err) => toast.error(messageFor(err)),
                });
                e.target.value = '';
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              loading={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip aria-hidden /> Đính kèm
            </Button>
            {mode === 'reply' && w.can.wait ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={waitAfter}
                  onChange={(e) => setWaitAfter(e.target.checked)}
                />
                Chuyển sang Chờ khách sau khi lưu
              </label>
            ) : null}
            <span className="flex-1" />
            <Button size="sm" onClick={send} loading={action.isPending} disabled={!body.trim()}>
              {mode === 'reply' ? 'Lưu phản hồi' : 'Gửi bình luận'}
            </Button>
          </div>
        </div>
      ) : null}
      {w.attachments.length ? (
        <div className="flex flex-wrap gap-2 border-b px-3.5 py-2.5">
          {w.attachments.map((a) =>
            a.url ? (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border px-2 py-1 text-xs text-primary hover:underline"
              >
                {a.fileName}
              </a>
            ) : (
              <span
                key={a.id}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
              >
                {a.fileName}
              </span>
            ),
          )}
        </div>
      ) : null}
      <ol>
        {events.map((e) => (
          <EventRow key={e.id} e={e} kind={w.kind} />
        ))}
      </ol>
    </Card>
  );
}

function eventDiff(e: WorkEvent, kind: WorkItemDetail['kind']): string | null {
  const to = e.toValue as Record<string, unknown> | string | null;
  const from = e.fromValue as unknown;
  switch (e.type) {
    case 'STATUS_CHANGED':
      return typeof from === 'string' && typeof to === 'string'
        ? `${statusLabel(kind, from as never)} → ${statusLabel(kind, to as never)}`
        : null;
    case 'PRIORITY_CHANGED':
      return `${PRIORITY_LABEL[from as never] ?? ''} → ${PRIORITY_LABEL[to as never] ?? ''}`;
    case 'DUE_CHANGED':
    case 'EXTENSION_APPROVED':
    case 'EXTENSION_REQUESTED':
      return typeof to === 'string'
        ? `${typeof from === 'string' ? formatDateTime(from) : '—'} → ${formatDateTime(to)}`
        : null;
    case 'CHILD_CREATED':
    case 'CHILD_RESOLVED':
      return to && typeof to === 'object' && typeof to.docNumber === 'string'
        ? String(to.docNumber)
        : null;
    case 'CHECKLIST':
      if (to && typeof to === 'object') {
        if (typeof to.title === 'string') return `${to.done ? 'Xong' : 'Bỏ xong'}: ${to.title}`;
        if (typeof to.added === 'number') return `Thêm ${to.added} mục`;
        if (typeof to.removed === 'string') return `Xóa: ${to.removed}`;
      }
      return null;
    default:
      return null;
  }
}

function EventRow({ e, kind }: { e: WorkEvent; kind: WorkItemDetail['kind'] }) {
  const talk = e.type === 'REPLY' || e.type === 'NOTE';
  const bad = e.type === 'SLA_BREACHED' || e.type === 'OVERDUE';
  const diff = eventDiff(e, kind);
  return (
    <li className="flex gap-2.5 border-t px-3.5 py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <b>{e.actor?.fullName ?? 'Hệ thống'}</b>
          <span
            className={cn(
              'text-xs',
              bad ? 'font-semibold text-destructive' : 'text-muted-foreground',
            )}
          >
            {EVENT_LABEL[e.type] ?? e.type}
            {e.type === 'REPLY' && e.channel ? ` qua ${CHANNEL_LABEL[e.channel]}` : ''}
          </span>
          {e.type === 'REPLY' && (e.toValue as { first?: boolean } | null)?.first ? (
            <StatusBadge tone="ok">Phản hồi đầu</StatusBadge>
          ) : null}
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(e.createdAt)}
          </span>
        </div>
        {diff ? <p className="text-sm text-muted-foreground">{diff}</p> : null}
        {e.body ? (
          <p
            className={cn(
              'mt-1 whitespace-pre-line rounded-md border px-2.5 py-1.5 text-sm',
              talk && e.type === 'NOTE' ? 'border-info-line bg-info-weak' : 'bg-card',
              !talk && 'border-transparent bg-transparent px-0 py-0 text-muted-foreground',
            )}
          >
            {e.body}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Dl({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-detail gap-x-3 gap-y-2 p-3.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailAside({ w }: { w: WorkItemDetail }) {
  const task = w.kind === 'TASK';
  return (
    <>
      {w.customer || w.customerHidden ? (
        <Card
          title="Khách hàng"
          action={
            w.customer ? (
              <Link
                href={`/crm/customers/${w.customer.id}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Mở hồ sơ
              </Link>
            ) : null
          }
        >
          {w.customer ? (
            <Dl
              rows={[
                ['Tên', <b key="n">{w.customer.name}</b>],
                [
                  'Mã',
                  <span key="c" className="font-mono text-xs">
                    {w.customer.code}
                  </span>,
                ],
                [
                  'SĐT',
                  w.customer.phone ? (
                    <Copyable key="p" value={w.customer.phone} label="SĐT">
                      {formatPhone(w.customer.phone)}
                    </Copyable>
                  ) : (
                    '—'
                  ),
                ],
              ]}
            />
          ) : (
            <div className="p-3.5 text-sm">
              <p className="text-muted-foreground">
                Khách ngoài phạm vi của bạn — chỉ hiện liên hệ người tạo ghi.
              </p>
            </div>
          )}
        </Card>
      ) : null}
      {w.contactName || w.contactPhone ? (
        <Card title="Liên hệ">
          <Dl
            rows={[
              ['Người liên hệ', w.contactName ?? '—'],
              [
                'SĐT',
                w.contactPhone ? (
                  <Copyable key="p" value={w.contactPhone} label="SĐT">
                    {formatPhone(w.contactPhone)}
                  </Copyable>
                ) : (
                  '—'
                ),
              ],
            ]}
          />
        </Card>
      ) : null}
      {w.orderId ? (
        <Card
          title="Đơn liên quan"
          action={
            w.orderDocNumber ? (
              <Link
                href={`/crm/orders/${w.orderId}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Mở đơn
              </Link>
            ) : null
          }
        >
          <div className="p-3.5 text-sm">
            {w.orderDocNumber ? (
              <Copyable value={w.orderDocNumber} label="mã đơn">
                <span className="font-mono">{w.orderDocNumber}</span>
              </Copyable>
            ) : (
              <span className="text-muted-foreground">Đơn ngoài phạm vi của bạn.</span>
            )}
          </div>
        </Card>
      ) : null}
      {w.kind === 'CUSTOMER' ? (
        <Card
          title="Nhờ phòng khác"
          action={
            w.can.createChild ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/work/new?kind=INTERNAL&parentId=${w.id}`}>
                  <Plus aria-hidden /> Tạo yêu cầu nội bộ
                </Link>
              </Button>
            ) : null
          }
        >
          <ul className="flex flex-col gap-2.5 p-3.5 text-sm">
            {w.children.map((c) => (
              <li key={c.id}>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/work/${c.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {c.docNumber}
                  </Link>
                  <WorkStatusBadge w={c} />
                </div>
                <div>
                  {c.ownerDeptName ? `${c.ownerDeptName} · ` : ''}
                  {c.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.assignee ? c.assignee.fullName : 'Chưa ai nhận'} · <DeadlineInline w={c} />
                </div>
              </li>
            ))}
            {!w.children.length ? (
              <li className="text-muted-foreground">
                Cần kho / kế toán xử lý giúp thì tạo yêu cầu nội bộ — điền sẵn khách và đơn. SLA của
                yêu cầu này vẫn chạy.
              </li>
            ) : null}
          </ul>
        </Card>
      ) : null}
      {w.parent ? (
        <Card title="Yêu cầu gốc">
          <div className="flex flex-col gap-1 p-3.5 text-sm">
            <Link
              href={`/work/${w.parent.id}`}
              className="font-mono text-xs text-primary hover:underline"
            >
              {w.parent.docNumber}
            </Link>
            <span>{w.parent.title}</span>
          </div>
        </Card>
      ) : null}
      <Card title="Thông tin">
        <Dl
          rows={[
            ['Loại', `${KIND_LABEL[w.kind]}${w.categoryName ? ` · ${w.categoryName}` : ''}`],
            ['Ưu tiên', <PriorityText key="p" p={w.priority} />],
            ...(!task
              ? ([
                  ['Kênh', w.channel ? CHANNEL_LABEL[w.channel] : '—'],
                  ['Phòng nhận', w.ownerDeptName ?? '—'],
                ] as [string, ReactNode][])
              : []),
            [
              task ? 'Người làm' : 'Người xử lý',
              w.assignee?.fullName ?? (
                <span key="a" className="text-muted-foreground">
                  Chưa ai nhận
                </span>
              ),
            ],
            ...(task
              ? ([['Người giao', w.assigner?.fullName ?? '—']] as [string, ReactNode][])
              : ([['Người tạo', w.requester.fullName]] as [string, ReactNode][])),
            ['Theo dõi', w.watchers.length ? w.watchers.map((x) => x.fullName).join(', ') : '—'],
            ...(task
              ? ([
                  ['Hạn chót', w.dueAt ? formatDateTime(w.dueAt) : 'Không có'],
                  [
                    'Duyệt kết quả',
                    w.needsApproval ? `Có — ${w.assigner?.fullName ?? ''}` : 'Không',
                  ],
                  ['Lặp lại', w.recurrence ? recurrenceLabel(w.recurrence) : 'Không'],
                ] as [string, ReactNode][])
              : ([['Mở lại', `${w.reopenCount} lần`]] as [string, ReactNode][])),
            [
              'Mã',
              <Copyable key="d" value={w.docNumber} label="mã việc">
                <span className="font-mono text-xs">{w.docNumber}</span>
              </Copyable>,
            ],
          ]}
        />
      </Card>
    </>
  );
}

function DeadlineInline({ w }: { w: WorkItemDetail['children'][number] }) {
  const t = deadlineText(w);
  return <span>{t.label}</span>;
}

const WEEKDAYS = ['', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy', 'Chủ nhật'];

function recurrenceLabel(r: NonNullable<WorkItemDetail['recurrence']>): string {
  const base =
    r.freq === 'DAILY'
      ? 'Mỗi ngày làm việc'
      : r.freq === 'WEEKLY'
        ? `Mỗi ${WEEKDAYS[r.dayOfWeek ?? 1]}`
        : `Ngày ${r.dayOfMonth ?? 1} hằng tháng`;
  return `${base}${r.until ? ` đến ${r.until.split('-').reverse().join('/')}` : ''}${r.isActive ? '' : ' (đã dừng)'}`;
}
