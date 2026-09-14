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
import { Textarea } from '@/components/ui/textarea';

/**
 * Xác nhận báo THIẾU HÀNG (PLAN-gdn-transfer: dòng EXCEPTION, supervisor xử lý). Nói rõ hệ
 * quả: phần thiếu không sang đóng gói, điều phối nhận cảnh báo. Lý do tuỳ chọn.
 */
export function ShortPickDialog({
  open,
  onOpenChange,
  what,
  remaining,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "SKU-X · Nước rửa chén tại A-01-03" */
  what: string;
  remaining: string;
  onConfirm: (note: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Báo thiếu hàng</DialogTitle>
          <DialogDescription>
            {what}: còn thiếu {remaining}. Phần thiếu sẽ không sang đóng gói, điều phối nhận cảnh
            báo để bù hàng hoặc sửa đơn.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Lý do (kệ trống, hàng hỏng…) — không bắt buộc"
          aria-label="Lý do thiếu hàng"
          rows={3}
          className="text-base"
        />
        <DialogFooter>
          <Button
            variant="outline"
            className="h-12"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Quay lại lấy tiếp
          </Button>
          <Button
            variant="destructive"
            className="h-12"
            disabled={busy}
            onClick={() =>
              void onConfirm(note).then(() => {
                setNote('');
                onOpenChange(false);
              })
            }
          >
            {busy ? 'Đang báo…' : 'Báo thiếu hàng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
