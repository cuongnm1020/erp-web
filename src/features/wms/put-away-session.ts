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
  useResolveCode,
  type PdaCompleteResult,
  type PdaTask,
  type PdaTaskLine,
} from './api/use-pda';
import type { ScanFeedback, ScanPhase } from './scan-session';

const CLOSED = new Set(['COMPLETED', 'CANCELLED', 'EXCEPTION']);

/** Dòng còn làm được — EXCEPTION (không tìm được ô kệ trống) do điều phối xử, máy quét bỏ qua. */
export const isOpenLine = (l: PdaTaskLine): boolean => !CLOSED.has(l.status);

/** Đã quét đủ số lượng — chỉ còn bước xác nhận ô kệ. */
export function isFullyScanned(l: PdaTaskLine): boolean {
  const done = toDecimal(l.qtyDone);
  const planned = toDecimal(l.qtyPlanned);
  return done !== null && planned !== null && planned.gt(0) && done.gte(planned);
}

/** Dòng đang đứng: dòng đã quét đủ đang chờ ô kệ, không có thì dòng mở đầu tiên theo lối đi. */
export function currentPutAwayLine(task: PdaTask | null): PdaTaskLine | null {
  if (!task) return null;
  const open = task.lines.filter(isOpenLine);
  return open.find(isFullyScanned) ?? open[0] ?? null;
}

const sameCode = (a: string, b: string | null): boolean =>
  b !== null && a.trim().toUpperCase() === b.trim().toUpperCase();

/** Mã quét ở bước xác nhận mà không phải SKU của việc, cũng không phải ô kệ nào. */
const notBinText = (code: string, docNumber: string, cur: PdaTaskLine): string =>
  `Mã ${code} không phải sản phẩm trong ${docNumber} hay ô kệ ${cur.toLocationCode ?? '—'}. Quét tem trên ô kệ đích.`;

/**
 * Phiên cất hàng trên máy quét (task PUT_AWAY sinh khi post phiếu nhập — P1-08 gợi ý ô kệ đích).
 * Khác PICK ở bước cuối: quét đủ số lượng CHƯA đóng dòng — người cất phải quét mã ô kệ đích
 * (hoặc bấm "Đã cất vào …") thì mới `POST /pda/complete`; server mới chuyển tồn DOCK → bin
 * (2 movement PUT_AWAY, bất biến 1). Không biết gì về giao diện.
 *
 *  1. `open(code)` / `openTask(id)`: mã việc PUT… → `GET /pda/resolve` → `POST /pda/tasks/:id/claim`
 *     (hàng đợi cất hàng: ai quét là nhận, không cần điều phối gán).
 *  2. `scan(code, qty)`: mã SKU → `POST /pda/scan` (server đối chiếu); mã KHÔNG phải SKU trong
 *     việc mà dòng đang đứng đã quét đủ → hiểu là mã ô kệ: khớp `toLocationCode` hoặc
 *     resolve ra đúng `toLocationId` → `POST /pda/complete`; ô kệ khác → báo sai chỗ.
 *  3. `confirm(taskLineId)`: xác nhận không cần quét ô kệ (tem ô kệ mờ / chưa in).
 *
 * `idempotencyKey` sinh lúc quét (luật 4). Dòng cập nhật từ RESPONSE, không optimistic (luật 5).
 */
export function usePutAwaySession() {
  const resolve = useResolveCode();
  const claim = useClaimTask();
  const scanMut = usePdaScan();
  const completeMut = usePdaComplete();

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [task, setTask] = useState<PdaTask | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [completion, setCompletion] = useState<PdaCompleteResult | null>(null);
  const [offline, setOffline] = useState(false);

  const fail = useCallback((err: unknown) => {
    if (isApiError(err) && err.status === 0) setOffline(true);
    beep('error');
    setFeedback({ kind: 'error', text: messageFor(err) });
  }, []);

  const info = useCallback((text: string) => {
    setPhase('idle');
    beep('error');
    setFeedback({ kind: 'info', text });
  }, []);

  const clear = useCallback(() => {
    setPhase('idle');
    setTask(null);
    setFeedback(null);
    setCompletion(null);
  }, []);

  const openTask = useCallback(
    async (taskId: string) => {
      setPhase('opening');
      setFeedback(null);
      setCompletion(null);
      try {
        const t = await claim.mutateAsync(taskId);
        setOffline(false);
        setTask(t);
        setPhase('ready');
        beep('ok');
        setFeedback({
          kind: 'ok',
          text: `Đã nhận ${t.docNumber}. Quét sản phẩm, rồi quét ô kệ để xác nhận cất.`,
        });
      } catch (err) {
        setPhase('idle');
        fail(err);
      }
    },
    [claim, fail],
  );

  const open = useCallback(
    async (code: string) => {
      setPhase('opening');
      setFeedback(null);
      setCompletion(null);
      try {
        const r = await resolve.mutateAsync(code);
        setOffline(false);
        if (r.kind === 'task' && r.task) {
          if (r.task.type !== 'PUT_AWAY' || CLOSED.has(r.task.status)) {
            info(`${r.task.docNumber} không phải việc cất hàng đang mở.`);
            return;
          }
          await openTask(r.task.id);
          return;
        }
        if (r.kind === 'sku') {
          info(
            'Đây là mã sản phẩm — quét mã phiếu cất hàng (PUT…) hoặc chạm một việc trong hàng đợi trước.',
          );
          return;
        }
        if (r.kind === 'location') {
          info('Đây là mã vị trí — mở việc cất hàng trước, quét ô kệ ở bước xác nhận.');
          return;
        }
        info(`Mã ${code} không mở được việc cất hàng nào.`);
      } catch (err) {
        setPhase('idle');
        fail(err);
      }
    },
    [resolve, openTask, info, fail],
  );

  /** Ghi kết quả complete vào task; dòng cuối → phiên xong. */
  const applyComplete = useCallback((done: PdaCompleteResult, line: PdaTaskLine) => {
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
    beep('ok');
    setFeedback({
      kind: 'ok',
      text: `Đã cất ${line.skuCode} vào ${line.toLocationCode ?? '—'}.`,
    });
    if (done.taskCompleted) {
      setCompletion(done);
      setPhase('done');
    }
  }, []);

  const completeLine = useCallback(
    async (line: PdaTaskLine) => {
      try {
        const done = await completeMut.mutateAsync({
          taskLineId: line.taskLineId,
          idempotencyKey: newIdempotencyKey(),
        });
        setOffline(false);
        applyComplete(done, line);
      } catch (err) {
        fail(err);
      }
    },
    [completeMut, applyComplete, fail],
  );

  /** Xác nhận đã cất dòng (nút bấm, không quét ô kệ) — chỉ khi đã quét đủ số lượng. */
  const confirm = useCallback(
    async (taskLineId: string) => {
      if (!task) return;
      const line = task.lines.find((l) => l.taskLineId === taskLineId);
      if (!line || !isOpenLine(line)) return;
      if (!isFullyScanned(line)) {
        beep('error');
        setFeedback({
          kind: 'error',
          text: `${line.skuCode} mới quét ${line.qtyDone}/${line.qtyPlanned} — quét đủ rồi mới xác nhận cất.`,
        });
        return;
      }
      await completeLine(line);
    },
    [task, completeLine],
  );

  const scan = useCallback(
    async (code: string, qty: string) => {
      if (!task) return;
      const bySku = task.lines.filter((l) => l.barcodes.includes(code));
      if (bySku.length) {
        const line = bySku.find((l) => isOpenLine(l) && !isFullyScanned(l)) ?? null;
        if (!line) {
          const full = bySku.find(isOpenLine);
          beep('error');
          setFeedback({
            kind: 'error',
            text: full
              ? `${full.skuCode} đã quét đủ — quét ô kệ ${full.toLocationCode ?? '—'} để xác nhận cất.`
              : `Sản phẩm ${bySku[0]!.skuCode} đã cất xong — không cộng thêm.`,
          });
          return;
        }
        try {
          const r = await scanMut.mutateAsync({
            taskLineId: line.taskLineId,
            barcode: code,
            qty,
            idempotencyKey: newIdempotencyKey(),
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
            kind: r.complete ? 'info' : 'ok',
            text: r.complete
              ? `${r.skuCode} đủ ${r.qtyDone}/${r.qtyPlanned} — quét ô kệ ${line.toLocationCode ?? '—'} để xác nhận cất.`
              : `${r.skuCode}: ${r.qtyDone}/${r.qtyPlanned}`,
          });
        } catch (err) {
          fail(err);
        }
        return;
      }

      // Không phải SKU trong việc: là mã ô kệ nếu dòng đang đứng đã quét đủ.
      const cur = currentPutAwayLine(task);
      if (!cur || !isFullyScanned(cur)) {
        beep('error');
        setFeedback({
          kind: 'error',
          text: `Mã ${code} không thuộc ${task.docNumber}. Kiểm tra lại hàng.`,
        });
        return;
      }
      if (sameCode(code, cur.toLocationCode)) {
        await completeLine(cur);
        return;
      }
      try {
        const r = await resolve.mutateAsync(code);
        setOffline(false);
        if (r.kind === 'location' && r.location) {
          if (r.location.id === cur.toLocationId) {
            await completeLine(cur);
            return;
          }
          beep('error');
          setFeedback({
            kind: 'error',
            text: `Sai ô kệ: đang ở ${r.location.code}, cần cất ${cur.skuCode} vào ${cur.toLocationCode ?? '—'}.`,
          });
          return;
        }
        beep('error');
        setFeedback({ kind: 'error', text: notBinText(code, task.docNumber, cur) });
      } catch (err) {
        // Resolve không biết mã này (404) — với máy quét, câu "Không tìm thấy dữ liệu" chung
        // không nói được phải làm gì; nói thẳng: không phải hàng trong việc, không phải ô kệ đích.
        if (isApiError(err) && err.status === 404) {
          beep('error');
          setFeedback({ kind: 'error', text: notBinText(code, task.docNumber, cur) });
          return;
        }
        fail(err);
      }
    },
    [task, scanMut, resolve, completeLine, fail],
  );

  return {
    phase,
    task,
    feedback,
    completion,
    offline,
    busy: resolve.isPending || claim.isPending || scanMut.isPending || completeMut.isPending,
    open,
    openTask,
    scan,
    confirm,
    clear,
  };
}
