'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
  type FilterDef,
  type RowSelectionState,
} from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import {
  useAdminWarehouses,
  useBulkDeletePdaDevices,
  useDeletePdaDevice,
  usePdaDevices,
  type PdaDevice,
  type PdaDeviceStatus,
} from '../api/use-pda-devices';
import { useUsers } from '../api/use-users';
import { PdaDeviceDialog } from './pda-device-dialog';
import { DEVICE_STATUS } from './pda-device-status';

const FILTER_KEYS = ['status', 'warehouse'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const DEFAULTS = { size: 50, filterKeys: FILTER_KEYS };

function parseStatus(v: string | undefined): PdaDeviceStatus | undefined {
  return v && v in DEVICE_STATUS ? (v as PdaDeviceStatus) : undefined;
}

const DELETE_NOTE =
  'Xóa hẳn kèm lịch sử đăng nhập; máy đang đăng nhập sẽ bị đăng xuất ở thao tác kế tiếp. Muốn giữ lịch sử thì chuyển trạng thái Ngừng dùng.';

/**
 * I-xx Thiết bị PDA — GET /devices (lọc + phân trang server, state trên URL — luật 8).
 * Đăng ký / sửa qua dialog (mã máy, serial, model, kho, khóa nhân viên, trạng thái);
 * xóa từng dòng hoặc chọn nhiều rồi "Xóa" (POST /devices/bulk-delete).
 * Khác mockup vì API chưa có: online realtime, cấu hình chung, bộ lọc đã lưu.
 */
export function PdaDevicesScreen() {
  const { state, set: setUrl, skipTake } = useListState<FilterKey>(DEFAULTS);
  const [selected, setSelected] = useState<RowSelectionState>({});
  // Đổi trang / lọc là bỏ chọn — không để id ngoài tầm mắt lọt vào lệnh xóa.
  const set: typeof setUrl = (patch) => {
    setSelected({});
    setUrl(patch);
  };
  const [dialog, setDialog] = useState<{ device?: PdaDevice } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const status = parseStatus(state.filters.status);
  const params = useMemo(
    () => ({ q: state.q, status, warehouseId: state.filters.warehouse || undefined, ...skipTake }),
    [state.q, status, state.filters.warehouse, skipTake],
  );
  const query = usePdaDevices(params);
  const warehouses = useAdminWarehouses();
  const users = useUsers({
    isActive: true,
    sortBy: 'fullName',
    sortDir: 'asc',
    take: 200,
    skip: 0,
  });
  const del = useDeletePdaDevice();
  const bulkDel = useBulkDeletePdaDevices();

  const whById = useMemo(
    () => new Map((warehouses.data ?? []).map((w) => [w.id, w])),
    [warehouses.data],
  );

  const columns = useMemo<ColumnDef<PdaDevice, unknown>[]>(
    () => [
      {
        id: 'code',
        accessorKey: 'code',
        header: 'Mã máy',
        meta: { width: 140 },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-primary">{getValue() as string}</span>
        ),
      },
      {
        id: 'model',
        accessorKey: 'model',
        header: 'Tên / model',
        meta: { width: 150 },
        cell: ({ getValue }) => (getValue() as string | null) ?? '—',
      },
      {
        id: 'serialNumber',
        accessorKey: 'serialNumber',
        header: 'Serial',
        meta: { width: 150 },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        id: 'warehouse',
        header: 'Kho',
        meta: { width: 150 },
        cell: ({ row }) => {
          const id = row.original.warehouseId;
          if (!id) return <span className="text-muted-foreground">Mọi kho</span>;
          const w = whById.get(id);
          return w ? `${w.code} · ${w.name}` : 'Kho khác';
        },
      },
      {
        id: 'boundUser',
        header: 'Khóa cho nhân viên',
        meta: { width: 180 },
        cell: ({ row }) => {
          const u = row.original.boundUser;
          return u ? (
            <span>
              {u.fullName} <span className="font-mono text-xs text-muted-foreground">{u.code}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Ai cũng được</span>
          );
        },
      },
      {
        id: 'lastSeenAt',
        accessorKey: 'lastSeenAt',
        header: 'Đăng nhập cuối',
        meta: { width: 140, align: 'right' },
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return (
            <span className="tabular-nums text-muted-foreground">
              {v ? formatDateTime(v) : '—'}
            </span>
          );
        },
      },
      {
        id: 'appVersion',
        accessorKey: 'appVersion',
        header: 'App',
        meta: { width: 80, align: 'right' },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{(getValue() as string | null) ?? '—'}</span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Trạng thái',
        meta: { width: 110 },
        cell: ({ getValue }) => {
          const s = DEVICE_STATUS[getValue() as PdaDeviceStatus];
          return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
        },
      },
      {
        id: 'actions',
        header: '',
        meta: { title: 'Thao tác', width: 80, align: 'right' },
        cell: ({ row }) => (
          <Can I="update" a="User">
            <RowActions
              onEdit={() => setDialog({ device: row.original })}
              itemName={`thiết bị ${row.original.code}`}
              deleteDescription={DELETE_NOTE}
              onDelete={async () => {
                try {
                  await del.mutateAsync(row.original.id);
                  toast.success(`Đã xóa thiết bị ${row.original.code}`);
                  setSelected((s) => ({ ...s, [row.original.id]: false }));
                } catch (err) {
                  toast.error(messageFor(err));
                }
              }}
            />
          </Can>
        ),
      },
    ],
    [whById, del],
  );

  const filters: FilterDef<FilterKey>[] = [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: (Object.keys(DEVICE_STATUS) as PdaDeviceStatus[]).map((s) => ({
        value: s,
        label: DEVICE_STATUS[s].label,
      })),
    },
    {
      key: 'warehouse',
      label: 'Kho',
      type: 'select',
      options: (warehouses.data ?? []).map((w) => ({
        value: w.id,
        label: `${w.code} · ${w.name}`,
      })),
    },
  ];

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const hasFilter = state.q !== '' || Object.values(state.filters).some(Boolean);
  const openCreate = () => setDialog({});

  return (
    <>
      <PageHeader
        title="Thiết bị PDA"
        description={query.data ? `${query.data.total} thiết bị` : 'Đang đếm…'}
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Hệ thống' }, { label: 'Thiết bị PDA' }]}
        actions={
          <Can I="update" a="User">
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden />
              Đăng ký thiết bị
            </Button>
          </Can>
        }
      />

      <FilterBar
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={filters}
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        searchPlaceholder="Tìm mã máy, serial, model…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={9} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={hasFilter ? 'Không có thiết bị khớp' : 'Chưa đăng ký thiết bị nào'}
            description={
              hasFilter
                ? 'Thử từ khóa hoặc bộ lọc khác.'
                : 'Đăng ký máy PDA bằng mã máy và serial để nhân viên kho đăng nhập được.'
            }
            action={
              hasFilter ? (
                <Button variant="outline" onClick={() => set({ q: '', filters: {} })}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="update" a="User">
                  <Button onClick={openCreate}>
                    <Plus aria-hidden />
                    Đăng ký thiết bị
                  </Button>
                </Can>
              )
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
            page={state.page}
            size={state.size}
            sort={null}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={() => undefined}
            selection={{ selected, onChange: setSelected }}
            bulkActions={(ids) => (
              <Can I="update" a="User">
                <Button size="sm" variant="outline" onClick={() => setConfirmBulk(true)}>
                  <Trash2 aria-hidden />
                  Xóa ({ids.length})
                </Button>
              </Can>
            )}
          />
        )}
      </QueryState>

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Xóa ${selectedIds.length} thiết bị?`}
        description={DELETE_NOTE}
        confirmLabel="Xóa"
        onConfirm={async () => {
          try {
            const r = await bulkDel.mutateAsync(selectedIds);
            toast.success(
              `Đã xóa ${r.deleted.length} thiết bị` +
                (r.skipped.length ? ` · bỏ qua ${r.skipped.length} đã xóa trước đó` : ''),
            );
            setSelected({});
          } catch (err) {
            toast.error(messageFor(err));
          }
        }}
      />

      {dialog ? (
        <PdaDeviceDialog
          key={dialog.device?.id ?? 'new'}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          device={dialog.device}
          warehouses={warehouses.data ?? []}
          users={users.data?.items ?? []}
        />
      ) : null}
    </>
  );
}
