'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Nói rõ chuyện gì xảy ra — hành động không hoàn tác được phải ghi rõ. */
  description?: string;
  /** Nhãn nút xác nhận, trùng tên hành động đã bấm (mặc định "Xóa"). */
  confirmLabel?: string;
  destructive?: boolean;
  /** Trả Promise thì dialog chờ xong mới đóng (nút bị khóa trong lúc chờ). */
  onConfirm: () => unknown;
}

/** Hộp xác nhận cho hành động không hoàn tác được (xóa, hủy chứng từ…). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Xóa',
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
