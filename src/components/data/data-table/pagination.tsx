'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { groupVi } from '@/lib/format';

const SIZES = [20, 50, 100, 200];

/** Phân trang server (offset). Có số dòng chọn được, nhảy đầu/cuối, đếm tổng. */
export function DataTablePagination({
  page,
  size,
  total,
  selectedCount,
  onPageChange,
  onSizeChange,
}: {
  page: number;
  size: number;
  total: number;
  selectedCount?: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <div className="text-muted-foreground">
        {selectedCount ? (
          <span className="mr-3">Đã chọn {groupVi(String(selectedCount))}</span>
        ) : null}
        {total === 0
          ? 'Không có dòng nào'
          : `${groupVi(String(from))}–${groupVi(String(to))} / ${groupVi(String(total))} dòng`}
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Mỗi trang</span>
          <Select value={String(size)} onValueChange={(v) => onSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[72px]" aria-label="Số dòng mỗi trang">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <span className="tabular-nums">
          Trang {page} / {pages}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Trang đầu"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Trang trước"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Trang sau"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Trang cuối"
            disabled={page >= pages}
            onClick={() => onPageChange(pages)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
