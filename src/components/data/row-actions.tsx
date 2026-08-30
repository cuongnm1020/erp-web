'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ConfirmDialog } from './confirm-dialog';

export interface RowActionsProps {
  /** Link tới màn sửa — dùng khi sửa là một route riêng. */
  editHref?: string;
  /** Handler sửa — dùng khi sửa mở dialog/drawer tại chỗ. */
  onEdit?: () => void;
  editLabel?: string;
  /** Có onDelete mới hiện nút xóa; luôn đi qua hộp xác nhận. Trả Promise thì chờ xong mới đóng. */
  onDelete?: () => unknown;
  deleteLabel?: string;
  /** Tên bản ghi hiện trong hộp xác nhận, ví dụ "khách hàng KH-0001". */
  itemName?: string;
  /** Mô tả thêm trong hộp xác nhận (mặc định: không hoàn tác được). */
  deleteDescription?: string;
  className?: string;
}

/**
 * Cụm nút thao tác trên từng dòng danh sách (cột "Thao tác").
 * Ẩn/hiện theo quyền là việc của màn hình gọi (bọc <Can> hoặc không truyền prop);
 * component này không biết gì về ability.
 */
export function RowActions({
  editHref,
  onEdit,
  editLabel = 'Sửa',
  onDelete,
  deleteLabel = 'Xóa',
  itemName,
  deleteDescription = 'Hành động này không hoàn tác được.',
  className,
}: RowActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const hasEdit = Boolean(editHref || onEdit);
  if (!hasEdit && !onDelete) return null;

  return (
    // stopPropagation: đừng kích hoạt onRowClick của bảng khi bấm nút thao tác
    <div className={cn('flex justify-end gap-1', className)} onClick={(e) => e.stopPropagation()}>
      {editHref ? (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title={editLabel}>
          <Link href={editHref} aria-label={editLabel}>
            <Pencil aria-hidden />
          </Link>
        </Button>
      ) : onEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={editLabel}
          aria-label={editLabel}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
      ) : null}
      {onDelete ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title={deleteLabel}
            aria-label={deleteLabel}
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden />
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={itemName ? `${deleteLabel} ${itemName}?` : `${deleteLabel}?`}
            description={deleteDescription}
            confirmLabel={deleteLabel}
            onConfirm={onDelete}
          />
        </>
      ) : null}
    </div>
  );
}
