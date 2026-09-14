'use client';

import { useCallback, useState } from 'react';
import { newIdempotencyKey } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';
import { beep } from '@/lib/beep';
import { messageFor } from '@/lib/error-messages';
import { toDecimal } from '@/lib/format';
import {
  useClaimTask,
  usePdaComplete,
  usePdaScan,
  usePdaShort,
  useResolveCode,
  type PdaCompleteResult,
  type PdaResolveResult,
  type PdaShortResult,
  type PdaTask,
  type PdaTaskRef,
} from './api/use-pda';

export type ScanPhase = 'idle' | 'opening' | 'ready' | 'done';

export interface ScanOrder {
  id: string | null;
  docNumber: string | null;
  customerName: string | null;
}

export interface ScanFeedback {
  kind: 'ok' | 'error' | 'info' | 'warn';
  text: string;
}

/** Một dòng đã báo thiếu trong phiên — hiện cảnh báo tới khi đổi việc. */
export interface Shortage {
  taskLineId: string;
  skuCode: string;
  skuName: string;
  shortageQty: string;
  note: string;
}

const CLOSED = new Set(['COMPLETED', 'CANCELLED']);

/**
 * Phiên quét một việc (PICK trên PDA, PACK ở trạm đóng gói) — dùng chung cho hai màn
 * (PLAN-barcode-pick-pack D1/D2). Không biết gì về giao diện:
 *
 *  1. `open(code)`: mã đơn / mã việc / vận đơn → `GET /pda/resolve` → chọn task đúng `kind`
 *     còn mở → `POST /pda/tasks/:id/claim` (nhận việc bằng máy quét, B2) → `task`.
 *  2. `scan(code, qty)`: tìm dòng còn thiếu có barcode đó → `POST /pda/scan` (server đối chiếu
 *     lại, không tin client) → cập nhật dòng từ RESPONSE (luật 5: không optimistic) → dòng đủ
 *     → `POST /pda/complete` → task đóng → `phase = 'done'`, `completion` mang `waybill`.
 *
 * `idempotencyKey` sinh lúc quét (luật 4). Sai SKU / quá số lượng → bíp lỗi + câu từ bộ dịch.
 */
export function useScanSession(kind: 'PICK' | 'PACK') {
  const resolve = useResolveCode();
  const claim = useClaimTask();
  const scanMut = usePdaScan();
  const completeMut = usePdaComplete();
  const shortMut = usePdaShort();

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [task, setTask] = useState<PdaTask | null>(null);
  const [order, setOrder] = useState<ScanOrder>({ id: null, docNumber: null, customerName: null });
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [completion, setCompletion] = useState<PdaCompleteResult | null>(null);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [offline, setOffline] = useState(false);

  const fail = useCallback((err: unknown) => {
    if (isApiError(err) && err.status === 0) setOffline(true);
    beep('error');
    setFeedback({ kind: 'error', text: messageFor(err) });
  }, []);

  const clear = useCallback(() => {
    setPhase('idle');
    setTask(null);
    setOrder({ id: null, docNumber: null, customerName: null });
    setFeedback(null);
    setCompletion(null);
    setShortages([]);
  }, []);

  const pickTask = useCallback(
    (refs: PdaTaskRef[]): PdaTaskRef | null =>
      refs.find((t) => t.type === kind && !CLOSED.has(t.status)) ?? null,
    [kind],
  );

  /** Mở việc từ kết quả resolve đã có (màn pick tự resolve để rẽ sang lượt gộp). */
  const openResolved = useCallback(
    async (r: PdaResolveResult, code: string) => {
      setPhase('opening');
      setFeedback(null);
      setCompletion(null);
      setShortages([]);
      try {
        let ref: PdaTaskRef | null = null;
        let nextOrder: ScanOrder = { id: null, docNumber: null, customerName: null };
        if (r.kind === 'order' && r.order) {
          nextOrder = {
            id: r.order.id,
            docNumber: r.order.docNumber,
            customerName: r.order.customer?.name ?? null,
          };
          ref = pickTask(r.order.tasks);
          if (!ref) {
            const pickOpen = r.order.tasks.find((t) => t.type === 'PICK' && !CLOSED.has(t.status));
            const packDone = r.order.tasks.find(
              (t) => t.type === 'PACK' && t.status === 'COMPLETED',
            );
            setPhase('idle');
            setFeedback({
              kind: 'info',
              text:
                kind === 'PACK' && pickOpen
                  ? `Đơn ${r.order.docNumber} chưa lấy hàng xong — chưa đóng gói được.`
                  : packDone && kind === 'PACK'
                    ? `Đơn ${r.order.docNumber} đã đóng gói xong.`
                    : `Đơn ${r.order.docNumber} chưa có việc ${kind === 'PICK' ? 'lấy hàng' : 'đóng gói'} nào đang mở.`,
            });
            beep('error');
            return;
          }
        } else if (r.kind === 'task' && r.task) {
          ref = r.task.type === kind && !CLOSED.has(r.task.status) ? r.task : null;
          if (!ref) {
            setPhase('idle');
            setFeedback({
              kind: 'info',
              text: `${r.task.docNumber} không phải việc ${kind === 'PICK' ? 'lấy hàng' : 'đóng gói'} đang mở.`,
            });
            beep('error');
            return;
          }
        } else if (r.kind === 'shipment' && r.shipment) {
          nextOrder = { id: r.shipment.orderId, docNumber: null, customerName: null };
          ref = pickTask(r.shipment.tasks);
        } else if (r.kind === 'sku') {
          setPhase('idle');
          setFeedback({ kind: 'info', text: 'Đây là mã sản phẩm — quét mã đơn hàng trước.' });
          beep('error');
          return;
        }
        if (!ref) {
          setPhase('idle');
          setFeedback({ kind: 'info', text: `Mã ${code} không mở được việc nào.` });
          beep('error');
          return;
        }
        const t = await claim.mutateAsync(ref.id);
        setTask(t);
        setOrder(() => ({
          ...nextOrder,
          docNumber: nextOrder.docNumber ?? t.refDocNumber,
          id: nextOrder.id ?? t.refId,
        }));
        setPhase('ready');
        beep('ok');
        setFeedback({ kind: 'ok', text: `Đã nhận ${t.docNumber}. Quét từng sản phẩm.` });
      } catch (err) {
        setPhase('idle');
        fail(err);
      }
    },
    [claim, kind, fail, pickTask],
  );

  const open = useCallback(
    async (code: string) => {
      setPhase('opening');
      setFeedback(null);
      setCompletion(null);
      setShortages([]);
      let r: PdaResolveResult;
      try {
        r = await resolve.mutateAsync(code);
        setOffline(false);
      } catch (err) {
        setPhase('idle');
        fail(err);
        return;
      }
      await openResolved(r, code);
    },
    [resolve, openResolved, fail],
  );

  /**
   * Báo THIẾU HÀNG dòng đang lấy (chỉ PICK): dòng → EXCEPTION với số đã lấy, phần thiếu
   * không sang đóng gói; cảnh báo giữ trên màn tới khi đổi việc. Task đóng nếu hết dòng mở.
   */
  const short = useCallback(
    async (taskLineId: string, note?: string): Promise<PdaShortResult | null> => {
      if (!task) return null;
      const line = task.lines.find((l) => l.taskLineId === taskLineId);
      if (!line) return null;
      try {
        const r = await shortMut.mutateAsync({
          taskLineId,
          ...(note?.trim() ? { note: note.trim() } : {}),
          idempotencyKey: newIdempotencyKey(),
        });
        setOffline(false);
        setTask((cur) =>
          cur
            ? {
                ...cur,
                status: r.taskStatus,
                lines: cur.lines.map((l) =>
                  l.taskLineId === r.taskLineId ? { ...l, status: r.lineStatus } : l,
                ),
              }
            : cur,
        );
        setShortages((cur) => [
          ...cur,
          {
            taskLineId,
            skuCode: line.skuCode,
            skuName: line.skuName,
            shortageQty: r.shortageQty,
            note: r.exceptionNote,
          },
        ]);
        beep('error');
        setFeedback({
          kind: 'warn',
          text: `Đã báo thiếu ${r.shortageQty} ${line.skuCode} — điều phối sẽ xử lý. Tiếp tục dòng kế.`,
        });
        if (r.taskCompleted) {
          setCompletion(null);
          setPhase('done');
        }
        return r;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [task, shortMut, fail],
  );

  const scan = useCallback(
    async (code: string, qty: string) => {
      if (!task) return;
      const candidates = task.lines.filter((l) => l.barcodes.includes(code));
      const line =
        candidates.find(
          (l) => !CLOSED.has(l.status) && (toDecimal(l.qtyRemaining)?.gt(0) ?? false),
        ) ?? null;
      if (!line) {
        beep('error');
        setFeedback({
          kind: 'error',
          text: candidates.length
            ? `Sản phẩm ${candidates[0]!.skuCode} đã quét đủ — không cộng thêm.`
            : `Mã ${code} không thuộc ${order.docNumber ?? task.docNumber}. Kiểm tra lại hàng.`,
        });
        return;
      }
      const idempotencyKey = newIdempotencyKey();
      try {
        const r = await scanMut.mutateAsync({
          taskLineId: line.taskLineId,
          barcode: code,
          qty,
          idempotencyKey,
        });
        setOffline(false);
        setTask((cur) =>
          cur
            ? {
                ...cur,
                status: r.taskStatus,
                lines: cur.lines.map((l) =>
                  l.taskLineId === r.taskLineId
                    ? {
                        ...l,
                        qtyDone: r.qtyDone,
                        qtyRemaining: r.qtyRemaining,
                        status: r.lineStatus,
                      }
                    : l,
                ),
              }
            : cur,
        );
        beep('ok');
        setFeedback({
          kind: 'ok',
          text: `${r.skuCode}: ${r.qtyDone}/${r.qtyPlanned}${r.complete ? ' — đủ' : ''}`,
        });
        if (r.complete) {
          const done = await completeMut.mutateAsync({
            taskLineId: r.taskLineId,
            idempotencyKey: newIdempotencyKey(),
          });
          setTask((cur) =>
            cur
              ? {
                  ...cur,
                  status: done.taskStatus,
                  lines: cur.lines.map((l) =>
                    l.taskLineId === done.taskLineId ? { ...l, status: done.lineStatus } : l,
                  ),
                }
              : cur,
          );
          if (done.taskCompleted) {
            setCompletion(done);
            setPhase('done');
          }
        }
      } catch (err) {
        fail(err);
      }
    },
    [task, order.docNumber, scanMut, completeMut, fail],
  );

  return {
    phase,
    task,
    order,
    feedback,
    completion,
    shortages,
    offline,
    busy:
      resolve.isPending ||
      claim.isPending ||
      scanMut.isPending ||
      completeMut.isPending ||
      shortMut.isPending,
    open,
    openResolved,
    scan,
    short,
    clear,
  };
}
