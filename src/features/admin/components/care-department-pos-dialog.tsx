'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { PancakeShopSelect, pancakeShopLabel } from '@/components/data/pancake-shop-select';
import { EmptyState, FormSkeleton, QueryState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import {
  useCareDepartmentPos,
  useSetCareDepartmentPos,
  type CareDepartmentPosList,
} from '../api/use-org-tree';

/**
 * POS lên đơn của phòng CSKH (2026-10-29) — nhân viên phòng chưa đặt POS lên đơn riêng (hồ sơ
 * Pancake) thì màn Tạo đơn tự điền POS phòng. Quản trị / leader phòng đặt; trưởng nhóm chỉ xem.
 * GET /care-departments/default-pos, PUT /care-departments/{id}/default-pos.
 */
export function CareDepartmentPosDialog({ onClose }: { onClose: () => void }) {
  const list = useCareDepartmentPos();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>POS lên đơn của phòng</DialogTitle>
          <DialogDescription>
            Nhân viên chưa chọn POS lên đơn riêng sẽ được tự điền POS của phòng khi tạo đơn.
          </DialogDescription>
        </DialogHeader>
        <QueryState
          query={list}
          skeleton={<FormSkeleton fields={2} />}
          isEmpty={(d) => d.departments.length === 0}
          empty={
            <EmptyState
              title="Bạn chưa phụ trách phòng CSKH nào"
              description="Nhờ quản trị gán bạn làm leader phòng CSKH để đặt POS lên đơn cho phòng."
            />
          }
        >
          {(d) => (
            <PosForm
              key={d.departments.map((x) => `${x.id}:${x.defaultPosShopId ?? ''}`).join()}
              data={d}
              onClose={onClose}
            />
          )}
        </QueryState>
      </DialogContent>
    </Dialog>
  );
}

function PosForm({ data, onClose }: { data: CareDepartmentPosList; onClose: () => void }) {
  const save = useSetCareDepartmentPos();
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.departments.map((d) => [d.id, d.defaultPosShopId ?? ''])),
  );
  const editable = data.departments.some((d) => d.canEdit);
  const changed = data.departments.filter(
    (d) => d.canEdit && (picked[d.id] ?? '') !== (d.defaultPosShopId ?? ''),
  );
  const labelOf = new Map(data.shops.map((s) => [s.shopId, pancakeShopLabel(s)]));

  const submit = async () => {
    try {
      for (const d of changed) {
        await save.mutateAsync({ id: d.id, posShopId: picked[d.id] || null });
      }
      toast.success('Đã lưu thay đổi');
      onClose();
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  return (
    <>
      <div className="space-y-3">
        {data.departments.map((d) => (
          <div key={d.id} className="space-y-1">
            <span className="block text-xs text-muted-foreground">{d.name}</span>
            {d.canEdit ? (
              <PancakeShopSelect
                label={`POS ${d.name}`}
                allLabel="— Không tự điền —"
                shops={data.shops}
                value={picked[d.id] || undefined}
                onChange={(v) => setPicked((cur) => ({ ...cur, [d.id]: v ?? '' }))}
                className="w-full"
              />
            ) : (
              <span className="block text-sm">
                {d.defaultPosShopId
                  ? (labelOf.get(d.defaultPosShopId) ?? `POS ${d.defaultPosShopId}`)
                  : 'Chưa đặt'}
              </span>
            )}
          </div>
        ))}
        <p className="flex gap-2 rounded-md bg-info-weak px-2.5 py-2 text-xs text-info">
          <Info className="mt-px h-4 w-4 shrink-0" aria-hidden />
          POS lên đơn riêng của từng nhân viên (Sửa nhân viên → Hồ sơ Pancake) luôn được ưu tiên.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={save.isPending} onClick={onClose}>
          {editable ? 'Hủy bỏ' : 'Đóng'}
        </Button>
        {editable ? (
          <Button
            loading={save.isPending}
            disabled={changed.length === 0}
            onClick={() => void submit()}
          >
            Lưu thay đổi
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
