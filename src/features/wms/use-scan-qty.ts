'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { toDecimal } from '@/lib/format';
import { sameCode } from './scan-session';

/** Dòng / nhóm còn mở của việc đang làm — đủ để phân loại mã vừa quét. */
export interface ScanQtyLine {
  barcodes: string[];
  containerBarcode: string | null;
}

/**
 * Quét mã → nhập số lượng → Enter (2026-09-22): quét MỘT lần rồi gõ "30" + Enter = đã lấy 30,
 * thay cho bấm +/− trước khi quét. Dùng chung cho màn pick (PDA) và trạm đóng gói:
 *
 *  - mã THÙNG đã xếp cho dòng → gửi ngay, không hỏi số lượng (server lấy trọn thùng);
 *  - mã SKU thuộc việc → giữ làm `pending`, chuyển focus sang ô số lượng (chọn sẵn để gõ đè);
 *    Enter → gửi `(pending, qty)`; Esc → bỏ mã đang chờ;
 *  - mã lạ → gửi ngay với qty 1 để phiên quét báo đúng lỗi "không thuộc đơn".
 *
 * Máy quét có thể bắn mã vào ô số lượng (người quét mã kế tiếp thay vì gõ số): Enter với giá
 * trị trùng một barcode của việc → coi là lần quét mới, không phải số lượng.
 * Gõ số trước rồi mới quét vẫn được: số đang ở ô được giữ nguyên khi mã về.
 */
export function useScanQty({
  lines,
  send,
}: {
  lines: ReadonlyArray<ScanQtyLine>;
  /** Gửi (mã, số lượng chuỗi decimal — luật 10) sang phiên quét. */
  send: (code: string, qty: string) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isContainer = useCallback(
    (code: string) => lines.some((l) => sameCode(l.containerBarcode, code)),
    [lines],
  );
  const isSku = useCallback(
    (code: string) => lines.some((l) => l.barcodes.includes(code)),
    [lines],
  );

  const focusQty = () => {
    // Sau khi React vẽ ô số lượng ở trạng thái pending.
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const onScan = useCallback(
    (code: string) => {
      setError(null);
      if (isContainer(code) || !isSku(code)) {
        send(code, '1');
        return;
      }
      setPending(code);
      focusQty();
    },
    [isContainer, isSku, send],
  );

  const reset = useCallback(() => {
    setPending(null);
    setQty('1');
    setError(null);
  }, []);

  const submit = useCallback(() => {
    if (pending === null) return;
    const d = toDecimal(qty.trim().replace(',', '.'));
    if (d === null || !d.isFinite() || d.lte(0)) {
      setError('Nhập số lượng lớn hơn 0');
      focusQty();
      return;
    }
    send(pending, d.toString());
    setPending(null);
    setQty('1');
    setError(null);
  }, [pending, qty, send]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = qty.trim();
        // Máy quét bắn mã vào ô số lượng → là lần quét mới.
        if (v && (isSku(v) || isContainer(v))) {
          setQty('1');
          onScan(v);
          return;
        }
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        reset();
      }
    },
    [qty, isSku, isContainer, onScan, submit, reset],
  );

  return { pending, qty, setQty, error, inputRef, onScan, submit, reset, onKeyDown };
}

export type ScanQtyControl = ReturnType<typeof useScanQty>;
