'use client';

import { useCallback, useState } from 'react';
import { newIdempotencyKey } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';
import { beep } from '@/lib/beep';
import { messageFor } from '@/lib/error-messages';
import { toDecimal } from '@/lib/format';
import {
  useClaimWave,
  useWaveScan,
  useWaveShort,
  type PdaWave,
  type PdaWaveScanResult,
} from './api/use-pda';
import type { ScanFeedback, Shortage } from './scan-session';

export type WavePhase = 'idle' | 'opening' | 'ready' | 'done';
type Group = PdaWave['lines'][number];

/**
 * Phiên quét một LƯỢT pick gộp (PLAN-barcode-pick-pack E3, quyết định 4): quét mã WAVE →
 * nhận cả lượt → nhóm theo lối đi (sku + vị trí + lô) → quét SKU ở nhóm đang đứng → server
 * chia số lượng xuống từng đơn và tự đóng dòng / task / lượt. Không có bước "xong đơn" thủ
 * công. Nhóm hết hàng → `short()` báo thiếu cả nhóm.
 */
export function useWaveSession() {
  const claim = useClaimWave();
  const scanMut = useWaveScan();
  const shortMut = useWaveShort();

  const [phase, setPhase] = useState<WavePhase>('idle');
  const [wave, setWave] = useState<PdaWave | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [lastScan, setLastScan] = useState<PdaWaveScanResult | null>(null);
  const [offline, setOffline] = useState(false);

  const fail = useCallback((err: unknown) => {
    if (isApiError(err) && err.status === 0) setOffline(true);
    beep('error');
    setFeedback({ kind: 'error', text: messageFor(err) });
  }, []);

  const clear = useCallback(() => {
    setPhase('idle');
    setWave(null);
    setFeedback(null);
    setShortages([]);
    setLastScan(null);
  }, []);

  const open = useCallback(
    async (waveId: string) => {
      setPhase('opening');
      setFeedback(null);
      setShortages([]);
      setLastScan(null);
      try {
        const w = await claim.mutateAsync(waveId);
        setOffline(false);
        setWave(w);
        setPhase(w.status === 'COMPLETED' ? 'done' : 'ready');
        beep('ok');
        setFeedback({
          kind: 'ok',
          text: `Đã nhận lượt ${w.docNumber} — ${w.taskCount} đơn, ${w.lines.length} nhóm hàng.`,
        });
      } catch (err) {
        setPhase('idle');
        fail(err);
      }
    },
    [claim, fail],
  );

  /** Nhóm đang đứng = nhóm đầu tiên theo lối đi còn thiếu. */
  const current: Group | null =
    wave?.lines.find((g) => !g.complete && (toDecimal(g.qtyRemaining)?.gt(0) ?? false)) ?? null;

  /** Áp kết quả quét/báo thiếu vào nhóm và shares (từ response, không optimistic). */
  const applyShares = (
    groupKey: string,
    shares: Array<{
      taskLineId: string;
      qtyDone?: string;
      lineStatus?: string;
      taskCompleted: boolean;
      taskId: string;
    }>,
    groupRemaining: string | null,
    waveStatus: PdaWave['status'],
  ) => {
    setWave((cur) => {
      if (!cur) return cur;
      const byLine = new Map(shares.map((s) => [s.taskLineId, s]));
      const doneTasks = new Set(shares.filter((s) => s.taskCompleted).map((s) => s.taskId));
      const lines = cur.lines.map((g) => {
        if (g.key !== groupKey) return g;
        const next = g.shares.map((sh) => {
          const u = byLine.get(sh.taskLineId);
          return u
            ? {
                ...sh,
                qtyDone: u.qtyDone ?? sh.qtyDone,
                lineStatus: (u.lineStatus ?? sh.lineStatus) as typeof sh.lineStatus,
              }
            : sh;
        });
        const done = next.reduce((s, x) => s.add(toDecimal(x.qtyDone) ?? 0), toDecimal('0')!);
        const remaining = groupRemaining ?? toDecimal(g.qtyPlanned)!.minus(done).toFixed(6);
        return {
          ...g,
          shares: next,
          qtyDone: done.toFixed(6),
          qtyRemaining: remaining,
          complete: next.every(
            (x) =>
              x.lineStatus === 'COMPLETED' ||
              x.lineStatus === 'EXCEPTION' ||
              x.lineStatus === 'CANCELLED',
          ),
        };
      });
      const tasks = cur.tasks.map((t) =>
        doneTasks.has(t.id) ? { ...t, status: 'COMPLETED' as const } : t,
      );
      return {
        ...cur,
        lines,
        tasks,
        status: waveStatus,
        taskDoneCount: tasks.filter((t) => t.status === 'COMPLETED').length,
      };
    });
  };

  const scan = useCallback(
    async (code: string, qty: string) => {
      if (!wave || !current) return;
      // Nhóm đang đứng phải chứa mã này — quét nhầm nhóm khác thì báo ngay, không gửi.
      if (!current.barcodes.includes(code)) {
        const other = wave.lines.find((g) => g.barcodes.includes(code) && !g.complete);
        beep('error');
        setFeedback({
          kind: 'error',
          text: other
            ? `Mã này là ${other.skuCode} ở ${other.locationCode ?? '—'} — đang lấy ${current.skuCode} ở ${current.locationCode ?? '—'}.`
            : `Mã ${code} không có trong lượt ${wave.docNumber}.`,
        });
        return;
      }
      try {
        const r = await scanMut.mutateAsync({
          waveId: wave.id,
          barcode: code,
          qty,
          ...(current.locationId ? { locationId: current.locationId } : {}),
          ...(current.lotId ? { lotId: current.lotId } : {}),
          idempotencyKey: newIdempotencyKey(),
        });
        setOffline(false);
        setLastScan(r);
        applyShares(
          r.groupKey,
          r.shares.map((s) => ({
            taskLineId: s.taskLineId,
            qtyDone: s.qtyDone,
            lineStatus: s.lineCompleted ? 'COMPLETED' : 'IN_PROGRESS',
            taskCompleted: s.taskCompleted,
            taskId: s.taskId,
          })),
          r.groupRemaining,
          r.waveStatus,
        );
        beep('ok');
        const doneOrders = r.shares
          .filter((s) => s.taskCompleted)
          .map((s) => s.refDocNumber ?? s.taskDocNumber);
        setFeedback({
          kind: 'ok',
          text:
            `${r.skuCode}: chia cho ${r.shares.length} đơn, nhóm còn ${r.groupRemaining}` +
            (doneOrders.length ? ` · xong đơn ${doneOrders.join(', ')}` : ''),
        });
        if (r.waveCompleted) setPhase('done');
      } catch (err) {
        fail(err);
      }
    },
    [wave, current, scanMut, fail],
  );

  /** Báo thiếu cả nhóm đang đứng: các dòng con còn mở → EXCEPTION; đơn/lượt đóng theo. */
  const short = useCallback(
    async (note?: string) => {
      if (!wave || !current) return;
      try {
        const r = await shortMut.mutateAsync({
          waveId: wave.id,
          skuId: current.skuId,
          ...(current.locationId ? { locationId: current.locationId } : {}),
          ...(current.lotId ? { lotId: current.lotId } : {}),
          ...(note?.trim() ? { note: note.trim() } : {}),
          idempotencyKey: newIdempotencyKey(),
        });
        setOffline(false);
        applyShares(
          current.key,
          r.lines.map((l) => ({
            taskLineId: l.taskLineId,
            lineStatus: 'EXCEPTION',
            taskCompleted: l.taskCompleted,
            taskId: l.taskId,
          })),
          '0.000000',
          r.waveStatus,
        );
        const total = r.lines.reduce(
          (s, l) => s.add(toDecimal(l.shortageQty) ?? 0),
          toDecimal('0')!,
        );
        setShortages((cur) => [
          ...cur,
          {
            taskLineId: current.key,
            skuCode: current.skuCode,
            skuName: current.skuName,
            shortageQty: total.toFixed(6),
            note: r.lines[0]?.exceptionNote ?? 'Thiếu hàng',
          },
        ]);
        beep('error');
        setFeedback({
          kind: 'warn',
          text: `Đã báo thiếu ${total.toFixed(6)} ${current.skuCode} cho ${r.lines.length} đơn — điều phối sẽ xử lý.`,
        });
        if (r.waveCompleted) setPhase('done');
      } catch (err) {
        fail(err);
      }
    },
    [wave, current, shortMut, fail],
  );

  return {
    phase,
    wave,
    current,
    feedback,
    shortages,
    lastScan,
    offline,
    busy: claim.isPending || scanMut.isPending || shortMut.isPending,
    open,
    scan,
    short,
    clear,
  };
}
