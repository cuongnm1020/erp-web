'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import type { SortState } from '@/lib/url-state';
import { ariaSort, ColumnHeader } from './column-header';
import { DataTablePagination } from './pagination';

export const VIRTUALIZE_THRESHOLD = 200;
const ROW_HEIGHT = 40;

export interface DataTableColumnMeta {
  /** Tiêu đề hiển thị; mặc định header string */
  title?: string;
  /** Cột sort được (server-side). id cột = field gửi lên API. */
  sortable?: boolean;
  align?: 'left' | 'right';
  /** Chiều rộng cố định (px) — cần cho sticky. */
  width?: number;
  className?: string;
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface ColumnMeta<TData, TValue> extends DataTableColumnMeta {}
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Tổng số dòng phía server (phân trang). */
  total: number;
  page: number;
  size: number;
  sort: SortState | null;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  onSortChange: (sort: SortState | null) => void;
  /** Bật chọn nhiều dòng (controlled). */
  selection?: { selected: RowSelectionState; onChange: (s: RowSelectionState) => void };
  /** Cột đầu tiên dính trái khi cuộn ngang. */
  stickyFirstColumn?: boolean;
  onRowClick?: (row: T) => void;
  /** Thanh hành động hàng loạt, hiện khi có dòng chọn. */
  bulkActions?: (selectedIds: string[]) => ReactNode;
  /** Chiều cao vùng cuộn khi virtualize. */
  maxHeight?: string;
  className?: string;
}

/**
 * Bảng chuẩn (luật 8): dữ liệu đã phân trang/sort ở server, component chỉ hiển thị và
 * phát sự kiện. > VIRTUALIZE_THRESHOLD dòng → virtualize thân bảng.
 */
export function DataTable<T>({
  columns: userColumns,
  rows,
  getRowId,
  total,
  page,
  size,
  sort,
  onPageChange,
  onSizeChange,
  onSortChange,
  selection,
  stickyFirstColumn = true,
  onRowClick,
  bulkActions,
  maxHeight = '70vh',
  className,
}: DataTableProps<T>) {
  const columns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selection) return userColumns;
    const selectCol: ColumnDef<T, unknown> = {
      id: '__select',
      meta: { width: 36 },
      header: ({ table }) => (
        <Checkbox
          aria-label="Chọn tất cả dòng trong trang"
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? 'indeterminate'
                : false
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Chọn dòng"
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    };
    return [selectCol, ...userColumns];
  }, [userColumns, selection]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: !!selection,
    state: { rowSelection: selection?.selected ?? {} },
    onRowSelectionChange: (updater) => {
      if (!selection) return;
      const next = typeof updater === 'function' ? updater(selection.selected) : updater;
      selection.onChange(next);
    },
  });

  const virtualize = rows.length > VIRTUALIZE_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: virtualize ? tableRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    initialRect: { width: 1200, height: 600 },
  });

  const selectedIds = Object.keys(selection?.selected ?? {}).filter((k) => selection?.selected[k]);
  const stickyIdx = selection ? 1 : 0;

  const renderRow = (row: Row<T>, style?: React.CSSProperties) => (
    <TableRow
      key={row.id}
      data-state={row.getIsSelected() ? 'selected' : undefined}
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
      className={cn(onRowClick && 'cursor-pointer')}
      style={style}
    >
      {row.getVisibleCells().map((cell, i) => {
        const m = cell.column.columnDef.meta;
        return (
          <TableCell
            key={cell.id}
            style={m?.width ? { width: m.width, minWidth: m.width } : undefined}
            className={cn(
              m?.align === 'right' && 'text-right tabular-nums',
              stickyFirstColumn && i === stickyIdx && 'sticky left-0 z-10 bg-background',
              m?.className,
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );

  return (
    <div className={cn('space-y-2', className)}>
      {selection && selectedIds.length > 0 && bulkActions ? (
        <div
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
          role="toolbar"
          aria-label="Hành động hàng loạt"
        >
          <span className="mr-2 font-medium">Đã chọn {selectedIds.length}</span>
          {bulkActions(selectedIds)}
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className="relative overflow-auto rounded-md border"
        style={virtualize ? { maxHeight } : undefined}
      >
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h, i) => {
                  const m = h.column.columnDef.meta;
                  const title =
                    m?.title ??
                    (typeof h.column.columnDef.header === 'string'
                      ? h.column.columnDef.header
                      : '');
                  return (
                    <TableHead
                      key={h.id}
                      aria-sort={m?.sortable ? ariaSort(h.column.id, sort) : undefined}
                      style={m?.width ? { width: m.width, minWidth: m.width } : undefined}
                      className={cn(
                        stickyFirstColumn && i === stickyIdx && 'sticky left-0 z-30 bg-background',
                        m?.className,
                      )}
                    >
                      {h.isPlaceholder ? null : typeof h.column.columnDef.header === 'function' ? (
                        flexRender(h.column.columnDef.header, h.getContext())
                      ) : (
                        <ColumnHeader
                          id={h.column.id}
                          title={title}
                          sortable={m?.sortable}
                          sort={sort}
                          onSort={onSortChange}
                          align={m?.align}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            style={
              virtualize
                ? { height: virtualizer.getTotalSize(), position: 'relative', display: 'block' }
                : undefined
            }
          >
            {tableRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Không có dòng nào
                </TableCell>
              </TableRow>
            ) : virtualize ? (
              virtualizer.getVirtualItems().map((vi) => {
                const row = tableRows[vi.index]!;
                return renderRow(row, {
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${vi.start}px)`,
                  height: vi.size,
                  width: '100%',
                  display: 'table',
                  tableLayout: 'fixed',
                });
              })
            ) : (
              tableRows.map((row) => renderRow(row))
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        page={page}
        size={size}
        total={total}
        selectedCount={selectedIds.length}
        onPageChange={onPageChange}
        onSizeChange={onSizeChange}
      />
    </div>
  );
}
