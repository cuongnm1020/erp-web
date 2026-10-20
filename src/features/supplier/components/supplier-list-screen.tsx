'use client';

import { Ban, FileSpreadsheet, Info, Plus, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { useAbility } from '@/lib/permission';
import { toSkipTake, useListState } from '@/lib/url-state';
import {
  useDeactivateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type Supplier,
} from '../api/use-suppliers';
import { SupplierFormDialog } from './supplier-form-dialog';
import { SupplierImportDialog } from './supplier-import-dialog';

/**
 * F2 (PLAN-master-data-lot-uom) — Nhà cung cấp nối API thật: GET /suppliers
 * (q + lọc trạng thái + sort + phân trang server, luật 8), tạo/sửa qua dialog,
 * Ngừng hợp tác = PATCH isActive=false (vẫn hiện, bật lại được), Xóa = DELETE xóa mềm (ẩn khỏi
 * danh sách, giữ lịch sử PO/công nợ), Nhập Excel = POST /suppliers/import (ghi đè theo mã).
 * Không data scope (bất biến 8).
 *
 * Khác design canvas (backend chưa có số liệu): cột "PO đang mở" / "Phải trả" và
 * "Xuất CSV" chờ endpoint — ghi ở thẻ PENDING_API, không hiển thị số bịa.
 */
const PENDING_API: Array<{ title: string; need: string }> = [
  // { title: 'PO đang mở / tổng phải trả theo NCC', need: 'chưa có endpoint tổng hợp mua hàng' },
  // { title: 'Xuất CSV', need: 'chưa có endpoint export' },
];

const DEFAULTS = { size: 40, filterKeys: ['status'] as const };
type SupplierFilter = (typeof DEFAULTS.filterKeys)[number];

/** paymentTerm số ngày → chữ người dùng quen ("Net 30" / "Trả ngay"). */
export function termLabel(days: number | null): string {
  return days ? `Net ${days}` : 'Trả ngay';
}

export function SupplierListScreen() {
  const { state, set } = useListState<SupplierFilter>(DEFAULTS);
  const ability = useAbility();
  const canCreate = ability.can('create', 'Supplier');
  const canUpdate = ability.can('update', 'Supplier');
  const canDelete = ability.can('delete', 'Supplier');
  const deactivate = useDeactivateSupplier();
  const remove = useDeleteSupplier();
  const update = useUpdateSupplier();
  const [dialog, setDialog] = useState<{ open: boolean; supplier?: Supplier }>({ open: false });
  const [importOpen, setImportOpen] = useState(false);

  const params = useMemo(
    () => ({
      ...toSkipTake(state),
      ...(state.q ? { q: state.q } : {}),
      ...(state.filters.status ? { isActive: state.filters.status === 'active' } : {}),
      ...(state.sort
        ? {
            sortBy: state.sort.id as 'name' | 'code' | 'createdAt' | 'updatedAt',
            sortDir: state.sort.desc ? ('desc' as const) : ('asc' as const),
          }
        : {}),
    }),
    [state],
  );
  const query = useSuppliers(params);

  const columns = useMemo<ColumnDef<Supplier, unknown>[]>(
    () => [
      {
        id: 'code',
        header: 'Mã',
        meta: { width: 110, sortable: true },
        cell: ({ row }) => (
          <Link
            href={`/catalog/suppliers/${row.original.id}`}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        id: 'name',
        header: 'Tên nhà cung cấp',
        meta: { sortable: true },
        cell: ({ row }) => (
          <span className="font-semibold" title={row.original.name}>
            {row.original.name}
          </span>
        ),
      },
      {
        id: 'address',
        header: 'Địa chỉ',
        meta: { width: 240 },
        cell: ({ row }) => (
          <span
            className="block max-w-60 truncate text-muted-foreground"
            title={row.original.address ?? undefined}
          >
            {row.original.address ?? '—'}
          </span>
        ),
      },
      {
        id: 'taxCode',
        header: 'MST',
        meta: { width: 120 },
        cell: ({ row }) =>
          row.original.taxCode ? (
            <span className="font-mono text-xs">{row.original.taxCode}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'phone',
        header: 'SĐT',
        meta: { width: 130 },
        cell: ({ row }) => row.original.phone ?? '—',
      },
      {
        id: 'email',
        header: 'Email',
        meta: { width: 180 },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email ?? '—'}</span>
        ),
      },
      {
        id: 'paymentTerm',
        header: 'Điều khoản TT',
        meta: { width: 110 },
        cell: ({ row }) => termLabel(row.original.paymentTerm),
      },
      {
        id: 'leadTimeDays',
        header: 'Lead time',
        meta: { align: 'right', width: 90 },
        cell: ({ row }) =>
          row.original.leadTimeDays == null ? '—' : `${row.original.leadTimeDays} ngày`,
      },
      {
        id: 'status',
        header: 'Trạng thái',
        meta: { width: 110 },
        cell: ({ row }) =>
          row.original.isActive ? (
            <StatusBadge tone="ok">Hoạt động</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Ngừng hợp tác</StatusBadge>
          ),
      },
      {
        id: 'actions',
        header: '',
        meta: { width: 110 },
        // Sửa · Ngừng hợp tác / Bật lại hợp tác (nút icon) · Xóa (qua hộp xác nhận — xóa mềm,
        // ẩn khỏi danh sách; lịch sử PO / công nợ giữ nguyên).
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {canUpdate ? (
                s.isActive ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Ngừng hợp tác"
                    aria-label="Ngừng hợp tác"
                    disabled={deactivate.isPending}
                    onClick={() =>
                      void deactivate
                        .mutateAsync(s.id)
                        .then(() => toast.success(`Đã ngừng hợp tác với ${s.code}`))
                        .catch((err: unknown) => toast.error(messageFor(err)))
                    }
                  >
                    <Ban aria-hidden />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Bật lại hợp tác"
                    aria-label="Bật lại hợp tác"
                    disabled={update.isPending}
                    onClick={() =>
                      void update
                        .mutateAsync({ id: s.id, body: { isActive: true } })
                        .then(() => toast.success(`Đã bật lại hợp tác với ${s.code}`))
                        .catch((err: unknown) => toast.error(messageFor(err)))
                    }
                  >
                    <RotateCcw aria-hidden />
                  </Button>
                )
              ) : null}
              <RowActions
                onEdit={canUpdate ? () => setDialog({ open: true, supplier: s }) : undefined}
                onDelete={
                  canDelete
                    ? () =>
                        remove
                          .mutateAsync(s.id)
                          .then(() => toast.success(`Đã xóa nhà cung cấp ${s.code}`))
                          .catch((err) => toast.error(messageFor(err)))
                    : undefined
                }
                deleteLabel="Xóa"
                itemName={`nhà cung cấp ${s.code}`}
                deleteDescription="Nhà cung cấp bị ẩn khỏi danh sách và không chọn được nữa; lịch sử PO, phiếu nhập, công nợ giữ nguyên. Tạo lại cùng mã hoặc nhập Excel trúng mã sẽ khôi phục."
              />
            </div>
          );
        },
      },
    ],
    [canUpdate, canDelete, deactivate, remove, update],
  );

  return (
    <>
      <PageHeader
        title="Nhà cung cấp"
        description={query.data ? `${query.data.total} NCC theo bộ lọc hiện tại` : 'Đang tải…'}
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Nhà cung cấp' }]}
        actions={
          canCreate ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet aria-hidden /> Nhập Excel
              </Button>
              <Button size="sm" onClick={() => setDialog({ open: true })}>
                <Plus aria-hidden /> Thêm nhà cung cấp
              </Button>
            </>
          ) : undefined
        }
      />

      <FilterBar<SupplierFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        searchPlaceholder="Tìm theo mã, tên…"
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        filters={[
          {
            key: 'status',
            label: 'Trạng thái',
            type: 'select',
            options: [
              { value: 'active', label: 'Hoạt động' },
              { value: 'inactive', label: 'Ngừng hợp tác' },
            ],
          },
        ]}
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={10} />}
        isEmpty={(d) => d.total === 0}
        empty={
          <EmptyState
            title="Chưa có nhà cung cấp nào theo bộ lọc"
            description="Thêm nhà cung cấp để nhập hàng theo PO và theo dõi công nợ."
            action={
              canCreate ? (
                <Button onClick={() => setDialog({ open: true })}>
                  <Plus aria-hidden />
                  Thêm nhà cung cấp
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
            page={state.page}
            size={state.size}
            sort={state.sort}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={(sort) => set({ sort })}
          />
        )}
      </QueryState>

      <section className="mt-3 rounded-md border bg-card">
        <header className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-semibold">
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          Bổ sung khi API sẵn sàng
        </header>
        <ul className="flex flex-col gap-1.5 px-3 py-2 text-sm">
          {PENDING_API.map((m) => (
            <li key={m.title}>
              <span className="font-medium">{m.title}</span>{' '}
              <span className="text-xs text-muted-foreground">— {m.need}</span>
            </li>
          ))}
        </ul>
      </section>

      {dialog.open ? (
        <SupplierFormDialog
          key={dialog.supplier?.id ?? 'new'}
          supplier={dialog.supplier}
          open={dialog.open}
          onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        />
      ) : null}
      {importOpen ? <SupplierImportDialog open={importOpen} onOpenChange={setImportOpen} /> : null}
    </>
  );
}
