'use client';

import { useState } from 'react';

/**
 * Hộp thoại hàng loạt mở theo hai cách: nút riêng của nó (tự giữ state), hoặc mục trong menu
 * "Khác" của thanh chọn nhiều — khi đó màn gọi truyền `open` / `onOpenChange` và hộp thoại KHÔNG
 * vẽ nút (menu thả đóng là gỡ nội dung của nó, nên hộp thoại phải sống ngoài menu).
 */
export function useControlledOpen(open?: boolean, onOpenChange?: (open: boolean) => void) {
  const [inner, setInner] = useState(false);
  const controlled = open !== undefined;
  return {
    controlled,
    open: controlled ? open : inner,
    setOpen: (o: boolean) => (controlled ? onOpenChange?.(o) : setInner(o)),
  };
}
