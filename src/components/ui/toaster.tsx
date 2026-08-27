'use client';

import { Toaster as Sonner, toast } from 'sonner';

/**
 * Toast duy nhất của app. Câu chữ theo luật ngôn ngữ: cùng động từ với nút
 * ("Lưu thay đổi" → "Đã lưu thay đổi"). Lỗi: dùng messageFor(err), không message thô.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group border bg-background text-foreground shadow-lg',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          error: 'border-destructive/50',
          success: 'border-success/50',
        },
      }}
    />
  );
}

export { toast };
