'use client';

import Decimal from 'decimal.js';
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { toDecimal } from '@/lib/format';
import { sameCode } from './scan-session';

/** Dòng / nhóm còn mở của việc đang làm — đủ để phân loại mã vừa quét. */
export interface ScanQtyLine {
  barcodes: string[];
  containerBarcode: string | null;
}

const parseQty = (s: string): Decimal | null => {
  const d = toDecimal(s.trim().replace(',', '.'));
  return d !== null && d.isFinite() && d.gt(0) ? d : null;
};

/**
 * Quét mã → số lượng (2026-09-22, đổi 2026-10-12). Dùng chung cho màn pick (web) và trạm đóng gói:
 *
 *  - mỗi lần quét mã SKU thuộc việc → GỬI NGAY +1 (quét từng món là đếm, tiến độ dòng tăng liền);
 *    ô số lượng hiện tổng đã gửi cho mã đó trong lượt quét liên tiếp (`pending` = mã đang đếm);
 *  - gõ số N rồi Enter → gửi phần chênh để tổng thành N (quét 1 lần + gõ 10 = đã đóng 10).
 *    Số nhỏ hơn tổng đã gửi → báo lỗi, không trừ được (server chỉ cộng);
 *  - chưa quét mà gõ số trước rồi quét → gửi đúng số đã gõ (đóng 30 một lần);
 *  - mã THÙNG đã xếp cho dòng → gửi không hỏi số lượng (server lấy trọn thùng);
 *  - mã lạ → gửi qty 1 để phiên quét báo đúng lỗi "không thuộc đơn". Esc → thôi đếm mã hiện tại.
 *
 * Máy quét thường bắn mã vào ô số lượng (đang focus): Enter với giá trị là một barcode của việc
 * (hoặc "số + barcode" khi ô chưa được chọn) → coi là lần quét, không phải số lượng.
 */
export function useScanQty({
  lines,
  send,
}: {
  lines: ReadonlyArray<ScanQtyLine>;
  /** Gửi (mã, số lượng chuỗi decimal — luật 10) sang phiên quét. */
  send: (code: string, qty: string) => void;
}) {
  const [pending, setPendingState] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref song song state: máy quét bắn liên tục nhanh hơn một lần render.
  const pendingRef = useRef<string | null>(null);
  /** Tổng đã gửi cho `pending` (không phải ký tự máy quét đang gõ dở vào ô). */
  const countRef = useRef(new Decimal(0));

  const setPending = useCallback((code: string | null, count: Decimal) => {
    pendingRef.current = code;
    countRef.current = count;
    setPendingState(code);
    setQty(code === null ? '1' : count.toString());
  }, []);

  const isContainer = useCallback(
    (code: string) => lines.some((l) => sameCode(l.containerBarcode, code)),
    [lines],
  );
  const isSku = useCallback(
    (code: string) => lines.some((l) => l.barcodes.includes(code)),
    [lines],
  );

  const focusQty = () => {
    // Sau khi React vẽ ô số lượng — chọn sẵn để lần quét / gõ kế tiếp ghi đè.
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  /** Một lần quét; `typed` = số người dùng gõ sẵn trên ô trước khi quét (nếu có). */
  const accept = useCallback(
    (code: string, typed: string | null) => {
      setError(null);
      if (isContainer(code) || !isSku(code)) {
        setPending(null, new Decimal(0));
        send(code, '1');
        return;
      }
      if (pendingRef.current === code) {
        send(code, '1');
        setPending(code, countRef.current.plus(1));
      } else {
        // Mã mới: số gõ sẵn (chưa có mã nào đang đếm) = đóng đúng số đó một lần; không thì 1.
        const first =
          (pendingRef.current === null && typed ? parseQty(typed) : null) ?? new Decimal(1);
        send(code, first.toString());
        setPending(code, first);
      }
      focusQty();
    },
    [isContainer, isSku, send, setPending],
  );

  const onScan = useCallback((code: string) => accept(code, qty), [accept, qty]);

  const reset = useCallback(() => {
    setPending(null, new Decimal(0));
    setError(null);
  }, [setPending]);

  /** Enter / nút "Đóng": đưa tổng của mã đang đếm lên đúng số trên ô. */
  const submit = useCallback(() => {
    const p = pendingRef.current;
    if (p === null) return;
    const target = parseQty(qty);
    if (target === null) {
      setError('Nhập số lượng lớn hơn 0');
      focusQty();
      return;
    }
    const diff = target.minus(countRef.current);
    if (diff.lt(0)) {
      setError(`Đã ghi nhận ${countRef.current.toString()} — chỉ nhập được số lớn hơn`);
      focusQty();
      return;
    }
    if (diff.gt(0)) send(p, diff.toString());
    setPending(null, new Decimal(0));
    setError(null);
  }, [qty, send, setPending]);

  /** Giá trị ô là một lần quét? Trả mã + phần số đứng trước (ô chưa được chọn khi máy gõ). */
  const scannedIn = useCallback(
    (v: string): { code: string; prefix: string } | null => {
      const codes = lines.flatMap((l) =>
        l.containerBarcode ? [...l.barcodes, l.containerBarcode] : l.barcodes,
      );
      // Mã dài trước: "SP-01730" không bị nhận nhầm là "…0" + "SP-0173".
      for (const c of [...codes].sort((a, b) => b.length - a.length)) {
        if (sameCode(c, v)) return { code: c, prefix: '' };
        if (v.length > c.length && v.toUpperCase().endsWith(c.toUpperCase())) {
          const prefix = v.slice(0, v.length - c.length);
          if (parseQty(prefix)) return { code: c, prefix };
        }
      }
      return null;
    },
    [lines],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const hit = scannedIn(qty.trim());
        if (hit) {
          accept(hit.code, hit.prefix || null);
          return;
        }
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        reset();
      }
    },
    [qty, scannedIn, accept, submit, reset],
  );

  return { pending, qty, setQty, error, inputRef, onScan, submit, reset, onKeyDown };
}

export type ScanQtyControl = ReturnType<typeof useScanQty>;
