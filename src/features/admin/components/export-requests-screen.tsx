'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Download, RotateCw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
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
import { formatDateTime, groupVi } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { exportRejectFormSchema, type ExportRejectFormValues } from '@/lib/shared';
import { useListState } from '@/lib/url-state';
import { openDownload } from '@/lib/xlsx-writer';
import {
  exportRequestFileHref,
  useApproveExportRequest,
  useExcelLogs,
  useExportPendingCount,
  useExportRequests,
  useRejectExportRequest,
  useResendExportRequest,
  type ExcelAction,
  type ExcelLog,
  type ExportRequest,
  type ExportRequestStatus,
} from '../api/use-export-requests';

const FILTER_KEYS = ['tab', 'kind'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, filterKeys: FILTER_KEYS };

export const EXPORT_STATUS: Record<ExportRequestStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Chờ duyệt', tone: 'warn' },
  APPROVED: { label: 'Đang gửi', tone: 'brand' },
  SENT: { label: 'Đã gửi', tone: 'ok' },
  FAILED: { label: 'Gửi lỗi', tone: 'err' },
  REJECTED: { label: 'Từ chối', tone: 'neutral' },
};

export const EXCEL_ACTION_LABEL: Record<ExcelAction, string> = {
  EXPORT: 'Xuất trực tiếp',
  EXPORT_REQUEST: 'Gửi yêu cầu xuất',
  EXPORT_APPROVE: 'Duyệt / gửi lại',
  EXPORT_REJECT: 'Từ chối',
  EXPORT_SENT: 'Đã gửi email',
  EXPORT_FAILED: 'Gửi email lỗi',
  IMPORT: 'Nhập file',
};

type Tab = 'PENDING' | 'SENT' | 'FAILED' | 'REJECTED' | 'all' | 'logs';
const TABS: { key: Tab; label: string }[] = [
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'SENT', label: 'Đã gửi' },
  { key: 'FAILED', label: 'Gửi lỗi' },
  { key: 'REJECTED', label: 'Từ chối' },
  { key: 'all', label: 'Tất cả' },
  { key: 'logs', label: 'Nhật ký xuất / nhập' },
];
const TAB_KEYS = new Set<string>(TABS.map((t) => t.key));

function fileSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function rows(n: number | null): string {
  return n === null ? '' : `${groupVi(String(n))} dòng`;
}

/**
 * Duyệt xuất Excel (2026-11-02, quyền `export.approve`): nhân viên không có `export.direct` xuất Excel
 * = gửi yêu cầu kèm email cá nhân; người duyệt xem trước file, duyệt (hệ thống gửi file qua email) hoặc
 * từ chối kèm lý do. Tab Nhật ký: mọi lần xuất / nhập Excel của nhân viên. `mine` = màn "Yêu cầu xuất
 * của tôi" cho mọi người (chỉ xem trạng thái).
 */
export function ExportRequestsScreen({ mine = false }: { mine?: boolean }) {
  const ability = useAbility();
  const canApprove = !mine && ability.can('approve', 'Export');
  const { state, set, skipTake } = useListState<FilterKey>(DEFAULTS);
  const tab: Tab = mine
    ? 'all'
    : TAB_KEYS.has(state.filters.tab ?? '')
      ? (state.filters.tab as Tab)
      : 'PENDING';
  const pending = useExportPendingCount(canApprove);

  const title = mine ? 'Yêu cầu xuất Excel của tôi' : 'Duyệt xuất Excel';
  return (
    <>
      <PageHeader
        title={title}
        description={
          mine
            ? 'File được gửi tới email bạn nhập sau khi quản trị duyệt.'
            : pending.data
              ? `${pending.data.count} yêu cầu chờ duyệt`
              : 'Đang đếm…'
        }
        breadcrumb={mine ? [{ label: title }] : [{ label: 'Quản trị' }, { label: title }]}
      />

      {canApprove && pending.data && !pending.data.mailConfigured ? (
        <p role="alert" className="mb-3 rounded-md bg-warning-weak px-3 py-2 text-sm">
          Chưa cấu hình gửi email (SMTP) trên máy chủ — duyệt xong yêu cầu sẽ báo Gửi lỗi. Nhờ quản
          trị hệ thống cấu hình rồi bấm Gửi lại.
        </p>
      ) : null}

      {!mine ? (
        <div className="mb-3 flex border-b" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = t.key === 'PENDING' ? pending.data?.count : undefined;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  set({ filters: { tab: t.key === 'PENDING' ? undefined : t.key }, page: 1 })
                }
                className={cn(
                  '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm',
                  active
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {count ? (
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {tab === 'logs' ? (
        <ExcelLogTable
          kind={
            state.filters.kind === 'import' || state.filters.kind === 'export'
              ? state.filters.kind
              : undefined
          }
          onKindChange={(kind) => set({ filters: { ...state.filters, kind } })}
          page={state.page}
          size={state.size}
          skip={skipTake.skip}
          take={skipTake.take}
          onPage={(page) => set({ page })}
          onSize={(size) => set({ size })}
        />
      ) : (
        <RequestTable
          status={tab === 'all' ? undefined : tab}
          mine={mine}
          canApprove={canApprove}
          page={state.page}
          size={state.size}
          skip={skipTake.skip}
          take={skipTake.take}
          onPage={(page) => set({ page })}
          onSize={(size) => set({ size })}
        />
      )}
    </>
  );
}

function RequestTable({
  status,
  mine,
  canApprove,
  page,
  size,
  skip,
  take,
  onPage,
  onSize,
}: {
  status?: ExportRequestStatus;
  mine: boolean;
  canApprove: boolean;
  page: number;
  size: number;
  skip: number;
  take: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  const query = useExportRequests({ status, mine, skip, take });
  const approve = useApproveExportRequest();
  const resend = useResendExportRequest();
  const [rejecting, setRejecting] = useState<ExportRequest | null>(null);

  const columns = useMemo<ColumnDef<ExportRequest, unknown>[]>(() => {
    const cols: ColumnDef<ExportRequest, unknown>[] = [
      {
        id: 'createdAt',
        header: 'Thời gian',
        meta: { width: 140 },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
    ];
    if (!mine) {
      cols.push({
        id: 'requester',
        header: 'Người xuất',
        meta: { width: 170 },
        cell: ({ row }) =>
          row.original.requester ? (
            <span className="flex flex-col">
              <span>{row.original.requester.fullName}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {row.original.requester.code}
              </span>
            </span>
          ) : (
            '—'
          ),
      });
    }
    cols.push(
      {
        id: 'title',
        header: 'Dữ liệu',
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.title}</span>
            <span className="text-xs text-muted-foreground">
              {[row.original.fileName, rows(row.original.rowCount), fileSize(row.original.fileSize)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        ),
      },
      {
        id: 'email',
        header: 'Email nhận',
        meta: { width: 200 },
        cell: ({ row }) => <span className="break-all">{row.original.email}</span>,
      },
      {
        id: 'status',
        header: 'Trạng thái',
        meta: { width: 220 },
        cell: ({ row }) => {
          const r = row.original;
          const s = EXPORT_STATUS[r.status];
          const note =
            r.status === 'REJECTED'
              ? r.rejectReason
              : r.status === 'FAILED'
                ? r.sendError
                : r.status === 'SENT' && r.sentAt
                  ? `Gửi lúc ${formatDateTime(r.sentAt)}`
                  : null;
          return (
            <span className="flex flex-col items-start gap-0.5">
              <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
              {r.reviewer ? (
                <span className="text-xs text-muted-foreground">
                  {r.status === 'REJECTED' ? 'Từ chối' : 'Duyệt'}: {r.reviewer.fullName}
                </span>
              ) : null}
            </span>
          );
        },
      },
    );
    if (canApprove) {
      cols.push({
        id: 'actions',
        header: '',
        meta: { width: 96, align: 'right' },
        cell: ({ row }) => {
          const r = row.original;
          const preview = {
            label: 'Tải xem trước',
            icon: <Download aria-hidden />,
            onSelect: () => openDownload(exportRequestFileHref(r.id)),
          };
          const onError = (err: unknown) => toast.error(messageFor(err));
          if (r.status === 'PENDING') {
            return (
              <RowActions
                itemName={`yêu cầu ${r.title}`}
                primary={{
                  label: 'Duyệt và gửi',
                  icon: <Check aria-hidden />,
                  onClick: () =>
                    approve.mutate(r.id, {
                      onSuccess: () =>
                        toast.success('Đã duyệt yêu cầu xuất', {
                          description: `File đang được gửi tới ${r.email}`,
                        }),
                      onError,
                    }),
                }}
                items={[
                  preview,
                  {
                    label: 'Từ chối',
                    icon: <X aria-hidden />,
                    danger: true,
                    onSelect: () => setRejecting(r),
                  },
                ]}
              />
            );
          }
          if (r.status === 'FAILED' || r.status === 'SENT') {
            return (
              <RowActions
                itemName={`yêu cầu ${r.title}`}
                primary={{
                  label: 'Gửi lại',
                  icon: <RotateCw aria-hidden />,
                  onClick: () =>
                    resend.mutate(r.id, {
                      onSuccess: () =>
                        toast.success('Đã gửi lại', { description: `Gửi tới ${r.email}` }),
                      onError,
                    }),
                }}
                items={[preview]}
              />
            );
          }
          return <RowActions itemName={`yêu cầu ${r.title}`} items={[preview]} />;
        },
      });
    }
    return cols;
  }, [mine, canApprove, approve, resend]);

  return (
    <>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={mine ? 4 : 6} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={
              status === 'PENDING'
                ? 'Không có yêu cầu nào chờ duyệt'
                : mine
                  ? 'Bạn chưa gửi yêu cầu xuất nào'
                  : 'Không có yêu cầu nào'
            }
            description={
              mine
                ? 'Bấm "Xuất Excel" ở một danh sách, nhập email — yêu cầu sẽ hiện ở đây.'
                : 'Yêu cầu mới hiện ở đây khi nhân viên xuất Excel mà chưa có quyền xuất trực tiếp.'
            }
          />
        }
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data.items}
            getRowId={(r) => r.id}
            total={data.total}
            page={page}
            size={size}
            sort={null}
            onPageChange={onPage}
            onSizeChange={onSize}
            onSortChange={() => undefined}
          />
        )}
      </QueryState>
      {rejecting ? <RejectDialog request={rejecting} onClose={() => setRejecting(null)} /> : null}
    </>
  );
}

function RejectDialog({ request, onClose }: { request: ExportRequest; onClose: () => void }) {
  const reject = useRejectExportRequest();
  const form = useForm<ExportRejectFormValues>({
    resolver: zodResolver(exportRejectFormSchema),
    defaultValues: { reason: '' },
  });
  const onSubmit = form.handleSubmit(({ reason }) =>
    reject.mutate(
      { id: request.id, reason },
      {
        onSuccess: () => {
          toast.success('Đã từ chối yêu cầu xuất');
          onClose();
        },
        onError: (err) => applyServerErrors(form, err, { knownFields: ['reason'] }),
      },
    ),
  );
  const rootError = form.formState.errors.root?.server?.message;
  return (
    <Dialog open onOpenChange={(o) => !o && !reject.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Từ chối yêu cầu xuất &quot;{request.title}&quot;?</DialogTitle>
          <DialogDescription>
            {request.requester?.fullName ?? 'Nhân viên'} sẽ không nhận được file. Lý do hiện cho
            người gửi ở màn Yêu cầu xuất của họ.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Lý do từ chối</FormLabel>
                  <FormControl>
                    <Textarea {...field} autoFocus rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={reject.isPending} onClick={onClose}>
                Hủy
              </Button>
              <Button
                type="submit"
                variant="destructive"
                loading={reject.isPending}
                loadingText="Đang từ chối…"
              >
                Từ chối yêu cầu
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ExcelLogTable({
  kind,
  onKindChange,
  page,
  size,
  skip,
  take,
  onPage,
  onSize,
}: {
  kind?: 'export' | 'import';
  onKindChange: (kind: string | undefined) => void;
  page: number;
  size: number;
  skip: number;
  take: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  const query = useExcelLogs({ kind, skip, take });
  const columns = useMemo<ColumnDef<ExcelLog, unknown>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'Thời gian',
        meta: { width: 140 },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'user',
        header: 'Nhân viên',
        meta: { width: 170 },
        cell: ({ row }) =>
          row.original.user ? (
            <span className="flex flex-col">
              <span>{row.original.user.fullName}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {row.original.user.code}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Hệ thống</span>
          ),
      },
      {
        id: 'action',
        header: 'Hành động',
        meta: { width: 150 },
        cell: ({ row }) => {
          const a = row.original.action;
          const failed =
            a === 'EXPORT_FAILED' || (a === 'IMPORT' && row.original.detail.ok === false);
          return (
            <StatusBadge tone={failed ? 'err' : a === 'IMPORT' ? 'brand' : 'neutral'}>
              {EXCEL_ACTION_LABEL[a]}
              {a === 'IMPORT' && row.original.detail.ok === false ? ' (lỗi)' : ''}
            </StatusBadge>
          );
        },
      },
      {
        id: 'title',
        header: 'Dữ liệu',
        cell: ({ row }) => {
          const l = row.original;
          return (
            <span className="flex flex-col">
              <span>{l.title ?? l.resource}</span>
              <span className="text-xs text-muted-foreground">
                {[l.fileName, rows(l.rowCount), fileSize(l.fileSize), l.email]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          );
        },
      },
      {
        id: 'ip',
        header: 'IP',
        meta: { width: 120 },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.ip ?? ''}</span>
        ),
      },
    ],
    [],
  );
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Loại</span>
        <Select
          value={kind ?? 'all'}
          onValueChange={(v) => onKindChange(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-40" aria-label="Loại hành động">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Xuất và nhập</SelectItem>
            <SelectItem value="export">Chỉ xuất</SelectItem>
            <SelectItem value="import">Chỉ nhập</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={5} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title="Chưa có lần xuất / nhập Excel nào"
            description="Mọi lần nhân viên xuất hoặc nhập file Excel sẽ được ghi lại ở đây."
            action={
              kind ? (
                <Button variant="outline" onClick={() => onKindChange(undefined)}>
                  Xóa lọc
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data.items}
            getRowId={(r) => r.id}
            total={data.total}
            page={page}
            size={size}
            sort={null}
            onPageChange={onPage}
            onSizeChange={onSize}
            onSortChange={() => undefined}
          />
        )}
      </QueryState>
    </>
  );
}
