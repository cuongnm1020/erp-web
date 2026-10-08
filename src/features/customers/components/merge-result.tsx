'use client';

import { CheckCircle2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { formatDateTime } from '@/lib/format';
import {
  useUndoMerge,
  type CustomerRefCount,
  type MergeUndoResult,
} from '../api/use-customer-merge';
import { mergeFieldLabel, nonZero, orderRefCount, undoErrorMessage } from '../merge-labels';
import type { MergedSummary } from './merge-compare-panel';

function RefList({ refs, empty }: { refs: CustomerRefCount[]; empty: string }) {
  if (refs.length === 0) return <p className="text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-0.5">
      {refs.map((r) => (
        <li key={r.key} className="flex justify-between gap-3">
          <span>{r.label}</span>
          <span className="tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** Kết quả sau POST /customers/merge: đã chuyển / ở lại, nút Hoàn tác (POST …/undo). */
export function MergeResultView({
  summary,
  onDone,
}: {
  summary: MergedSummary;
  onDone: () => void;
}) {
  const { result, survivor, merged } = summary;
  const undo = useUndoMerge();
  const [undone, setUndone] = useState<MergeUndoResult | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const moved = nonZero(result.moved);
  const kept = nonZero(result.kept);
  const keptOrders = orderRefCount(kept);

  const runUndo = async () => {
    try {
      const r = await undo.mutateAsync(result.logId);
      setUndone(r);
      toast.success('Đã hoàn tác gộp khách', {
        description: `${merged.code} đã tách lại khỏi ${survivor.code}.`,
      });
    } catch (err) {
      toast.error(undoErrorMessage(err));
    }
  };

  if (undone) {
    const restored = nonZero(undone.restored);
    const stuck = nonZero(undone.stuck);
    return (
      <section aria-label="Kết quả hoàn tác" className="rounded-md border bg-card">
        <header className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
          <Undo2 className="h-4 w-4 text-primary" aria-hidden />
          Đã hoàn tác: {merged.code} tách lại khỏi {survivor.code}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {formatDateTime(undone.undoneAt)}
          </span>
        </header>
        <div className="grid gap-4 px-3 py-3 text-sm md:grid-cols-2">
          <div>
            <h3 className="mb-1 font-medium">Đã trả về {merged.code}</h3>
            <RefList refs={restored} empty="Không có dòng nào cần trả lại." />
          </div>
          <div>
            <h3 className="mb-1 font-medium">Không trả lại được — ở lại {survivor.code}</h3>
            <RefList refs={stuck} empty="Không có — mọi dòng đã chuyển đều được trả lại." />
            {stuck.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Các dòng này đã chốt hoặc rơi vào kỳ đã khoá sau khi gộp.
              </p>
            ) : null}
          </div>
        </div>
        {undone.fieldsNotRestored.length > 0 ? (
          <p className="border-t px-3 py-2 text-sm text-muted-foreground">
            Giữ giá trị hiện tại vì đã sửa sau khi gộp:{' '}
            {undone.fieldsNotRestored.map(mergeFieldLabel).join(', ')}.
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t px-3 py-2.5">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/crm/customers/${merged.id}`}>Mở hồ sơ {merged.code}</Link>
          </Button>
          <Button size="sm" onClick={onDone}>
            Xem nhóm trùng khác
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Kết quả gộp" className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
        Đã gộp {merged.code} vào {survivor.code}
        {result.matchedOn === 'manual' ? (
          <span className="text-xs font-normal text-muted-foreground">
            · gộp thủ công (khác SĐT)
          </span>
        ) : null}
      </header>
      <div className="grid gap-4 px-3 py-3 text-sm md:grid-cols-2">
        <div>
          <h3 className="mb-1 font-medium">Đã chuyển sang {survivor.code}</h3>
          <RefList refs={moved} empty="Hồ sơ cũ không có dữ liệu nào cần chuyển." />
        </div>
        <div>
          <h3 className="mb-1 font-medium">Ở lại hồ sơ cũ {merged.code}</h3>
          <RefList refs={kept} empty="Không có — mọi dữ liệu đã chuyển sang khách giữ." />
        </div>
      </div>
      {kept.length > 0 ? (
        <p
          role="note"
          className="mx-3 mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
        >
          <span className="font-semibold">
            {keptOrders} đơn đã chốt vẫn nằm ở hồ sơ cũ, hồ sơ cũ trỏ sang khách giữ.
          </span>{' '}
          Hoá đơn đã tất toán, phiếu thu và chứng từ kỳ đã khoá không được sửa nên không chuyển.
        </p>
      ) : null}
      {result.fieldsChanged.length > 0 ? (
        <p className="border-t px-3 py-2 text-sm text-muted-foreground">
          Trường lấy từ hồ sơ cũ: {result.fieldsChanged.map(mergeFieldLabel).join(', ')}.
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t px-3 py-2.5">
        <Button
          variant="outline"
          size="sm"
          disabled={undo.isPending}
          onClick={() => setConfirmUndo(true)}
        >
          <Undo2 aria-hidden />
          Hoàn tác
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/crm/customers/${survivor.id}`}>Mở hồ sơ {survivor.code}</Link>
        </Button>
        <Button size="sm" onClick={onDone}>
          Xem nhóm trùng khác
        </Button>
      </div>
      <ConfirmDialog
        open={confirmUndo}
        onOpenChange={setConfirmUndo}
        title="Hoàn tác lần gộp này?"
        description={`Dữ liệu đã chuyển sẽ trả về ${merged.code} và hồ sơ này hoạt động lại. Dòng đã chốt sau khi gộp ở lại ${survivor.code}.`}
        confirmLabel="Hoàn tác"
        destructive={false}
        onConfirm={runUndo}
      />
    </section>
  );
}
