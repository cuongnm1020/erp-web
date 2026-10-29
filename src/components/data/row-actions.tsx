'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { ConfirmDialog } from './confirm-dialog';

/** Một mục trong menu "⋯" của dòng. */
export interface RowActionItem {
  label: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
  /** Lý do tạm không làm được — mục hiện mờ kèm lý do thay vì ẩn ("Đơn đã đóng gói"). */
  disabledReason?: string;
  /** Hủy / Khóa: chữ đỏ, tự xếp xuống cuối menu sau vạch chia. Màn gọi tự mở hộp xác nhận. */
  danger?: boolean;
}

export interface RowActionsProps {
  /** Link tới màn sửa — dùng khi sửa là một route riêng. Thành nút icon trực tiếp trên dòng. */
  editHref?: string;
  /** Handler sửa — dùng khi sửa mở dialog/drawer tại chỗ. */
  onEdit?: () => void;
  editLabel?: string;
  /**
   * Nút icon trực tiếp thay cho Sửa (Xem nhanh, In…) — chỉ việc an toàn, hay làm.
   * Có `primary` thì Sửa (nếu có) chuyển vào menu.
   */
  primary?: { label: string; icon: ReactNode; href?: string; onClick?: () => void };
  /** Các mục khác trong menu "⋯". */
  items?: RowActionItem[];
  /** Có onDelete mới có mục Xóa (cuối menu); luôn đi qua hộp xác nhận. Trả Promise thì chờ xong mới đóng. */
  onDelete?: () => unknown;
  deleteLabel?: string;
  /** Tên bản ghi hiện trong tooltip + hộp xác nhận, ví dụ "khách hàng KH-0001". */
  itemName?: string;
  /** Mô tả thêm trong hộp xác nhận (mặc định: không hoàn tác được). */
  deleteDescription?: string;
  /**
   * Mọi mục (trừ Xóa / Hủy) thành nút icon ngay trên dòng, không có "⋯" — cho bảng chỉ có vài việc
   * an toàn hay làm (danh sách đơn: Xem nhanh · Sửa · Nhân bản, user yêu cầu 2026-10-29). Mục cần
   * `icon`; mục nguy hiểm vẫn vào menu.
   */
  inline?: boolean;
  className?: string;
}

/**
 * Cụm thao tác cột cuối dòng (design system RowActions): tối đa MỘT nút icon cho việc hay làm nhất
 * + "⋯" mở menu phần còn lại; Xóa / Hủy luôn nằm cuối menu, chữ đỏ, qua hộp xác nhận.
 * Ẩn/hiện theo quyền là việc của màn hình gọi (không truyền prop); component không biết ability.
 */
export function RowActions({
  editHref,
  onEdit,
  editLabel = 'Sửa',
  primary,
  items = [],
  onDelete,
  deleteLabel = 'Xóa',
  itemName,
  deleteDescription = 'Hành động này không hoàn tác được.',
  inline = false,
  className,
}: RowActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const hasEdit = Boolean(editHref || onEdit);

  const direct =
    primary ??
    (hasEdit
      ? { label: editLabel, icon: <Pencil aria-hidden />, href: editHref, onClick: onEdit }
      : undefined);
  const menu: RowActionItem[] = [
    ...(primary && hasEdit
      ? [{ label: editLabel, icon: <Pencil aria-hidden />, href: editHref, onSelect: onEdit }]
      : []),
    ...items.filter((i) => !i.danger),
  ];
  const dangerItems: RowActionItem[] = [
    ...items.filter((i) => i.danger),
    ...(onDelete
      ? [
          {
            label: deleteLabel,
            icon: <Trash2 aria-hidden />,
            danger: true,
            onSelect: () => setConfirming(true),
          },
        ]
      : []),
  ];
  if (!direct && menu.length === 0 && dangerItems.length === 0) return null;

  const tip = (label: string) => (itemName ? `${label} ${itemName}` : label);
  const iconButton = (it: RowActionItem) =>
    it.href && !it.disabledReason ? (
      <Button
        key={it.label}
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
        asChild
        title={tip(it.label)}
      >
        <Link href={it.href} aria-label={it.label}>
          {it.icon}
        </Link>
      </Button>
    ) : (
      <Button
        key={it.label}
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
        title={it.disabledReason ? `${it.label} — ${it.disabledReason}` : tip(it.label)}
        aria-label={it.label}
        disabled={Boolean(it.disabledReason)}
        onClick={it.onSelect}
      >
        {it.icon}
      </Button>
    );
  const shownMenu = inline ? [] : menu;
  const renderItem = (it: RowActionItem) => (
    <DropdownMenuItem
      key={it.label}
      danger={it.danger}
      disabled={Boolean(it.disabledReason)}
      hint={it.disabledReason}
      asChild={Boolean(it.href) && !it.disabledReason}
      onSelect={it.onSelect}
    >
      {it.href && !it.disabledReason ? (
        <Link href={it.href}>
          {it.icon}
          {it.label}
        </Link>
      ) : (
        <>
          {it.icon}
          {it.label}
        </>
      )}
    </DropdownMenuItem>
  );

  return (
    // stopPropagation: đừng kích hoạt onRowClick của bảng khi bấm nút thao tác
    <div className={cn('flex justify-end gap-0.5', className)} onClick={(e) => e.stopPropagation()}>
      {direct ? (
        direct.href ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            asChild
            title={tip(direct.label)}
          >
            <Link href={direct.href} aria-label={direct.label}>
              {direct.icon}
            </Link>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            title={tip(direct.label)}
            aria-label={direct.label}
            onClick={direct.onClick}
          >
            {direct.icon}
          </Button>
        )
      ) : null}
      {inline ? menu.map(iconButton) : null}
      {shownMenu.length > 0 || dangerItems.length > 0 ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              title="Thao tác khác"
              aria-label={itemName ? `Thao tác khác cho ${itemName}` : 'Thao tác khác'}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {shownMenu.map(renderItem)}
            {shownMenu.length > 0 && dangerItems.length > 0 ? <DropdownMenuSeparator /> : null}
            {dangerItems.map(renderItem)}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {onDelete ? (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={itemName ? `${deleteLabel} ${itemName}?` : `${deleteLabel}?`}
          description={deleteDescription}
          confirmLabel={deleteLabel}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  );
}
