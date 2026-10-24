'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, FormSkeleton, QueryState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  useCareGrants,
  useSetCareGrants,
  type CareGrants,
  type CareStaff,
} from '../api/use-org-tree';

/**
 * Quyền của trưởng nhóm CSKH (2026-10-24) — trưởng phòng tick từng quyền, chỉ thấy các quyền chính
 * mình đang có (server lọc + kiểm lại). Quyền sẵn có của nhân viên CSKH không cần cấp.
 * GET / PUT /org/care-staff/{id}/grants.
 */
export function CareGrantDialog({ lead, onClose }: { lead: CareStaff; onClose: () => void }) {
  const grants = useCareGrants(lead.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quyền của trưởng nhóm {lead.fullName}</DialogTitle>
          <DialogDescription>
            {lead.groupSize > 0
              ? `Nhóm ${lead.groupSize} nhân viên. `
              : 'Nhóm chưa có nhân viên — phụ trách cả phòng. '}
            Chỉ hiện quyền bạn đang có; quyền nhân viên CSKH có sẵn không cần cấp.
          </DialogDescription>
        </DialogHeader>
        <QueryState
          query={grants}
          skeleton={<FormSkeleton fields={5} />}
          isEmpty={(d) => d.grantable.length === 0}
          empty={
            <EmptyState
              title="Bạn chưa có quyền nào để cấp"
              description="Trưởng nhóm chỉ nhận được quyền bạn đang có. Nhờ quản trị cấp thêm quyền cho bạn."
            />
          }
        >
          {(d) => <GrantForm key={d.granted.join()} lead={lead} data={d} onClose={onClose} />}
        </QueryState>
      </DialogContent>
    </Dialog>
  );
}

function GrantForm({
  lead,
  data,
  onClose,
}: {
  lead: CareStaff;
  data: CareGrants;
  onClose: () => void;
}) {
  const save = useSetCareGrants(lead.id);
  const [picked, setPicked] = useState(() => new Set(data.granted));
  const groups = [...new Set(data.grantable.map((g) => g.group))];
  const toggle = (code: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });

  const submit = async () => {
    try {
      // Giữ thứ tự danh mục; quyền cũ người khác cấp mà bạn không có thì server đã ẩn khỏi danh mục.
      await save.mutateAsync(data.grantable.map((g) => g.code).filter((c) => picked.has(c)));
      toast.success('Đã lưu quyền', { description: `${lead.code} · ${lead.fullName}` });
      onClose();
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  return (
    <>
      <div className="space-y-3">
        {groups.map((group) => (
          <fieldset key={group} className="space-y-0.5 border-t pt-2.5 first:border-t-0 first:pt-0">
            <legend className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              {group}
            </legend>
            {data.grantable
              .filter((g) => g.group === group)
              .map((g) => (
                <label key={g.code} className="flex cursor-pointer items-start gap-2 py-1 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={picked.has(g.code)}
                    onCheckedChange={(v) => toggle(g.code, v === true)}
                    disabled={save.isPending}
                  />
                  <span>
                    <span className="font-semibold">{g.label}</span>
                    {g.hint ? (
                      <span className="block text-xs text-muted-foreground">{g.hint}</span>
                    ) : null}
                  </span>
                </label>
              ))}
          </fieldset>
        ))}
        <p className="flex gap-2 rounded-md bg-info-weak px-2.5 py-2 text-xs text-info">
          <Info className="mt-px h-4 w-4 shrink-0" aria-hidden />
          Trưởng nhóm không cấp lại quyền cho người khác và không đụng được trưởng phòng, trưởng
          nhóm khác.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={save.isPending} onClick={onClose}>
          Hủy bỏ
        </Button>
        <Button loading={save.isPending} onClick={() => void submit()}>
          Lưu quyền
        </Button>
      </DialogFooter>
    </>
  );
}
