'use client';

import { Link2, Users, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EntityPicker } from '@/components/data/form';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatQuantity } from '@/lib/format';

/** Số đếm (đơn, khách) → chuỗi có dấu chấm nghìn (luật 10: qua util tập trung). */
export const count = (n: number) => formatQuantity(String(n));
import { Can } from '@/lib/permission';
import {
  usePancakeStaff,
  useRelinkPancakeStaff,
  useStaffCandidateSearch,
  type PancakeStaff,
  type RelinkStaffResult,
} from '../api/use-pancake-staff';

export const ROLE_LABEL: Record<string, string> = {
  seller: 'Chốt đơn',
  creator: 'Tạo đơn',
  care: 'Chăm sóc',
  marketer: 'Marketer',
};

export const staffDisplayName = (s: PancakeStaff) => s.observedName ?? `fb ${s.fbId}`;

/** Thông báo sau khi gắn: số POS + những gì đã chuyển từ tài khoản tự tạo. */
export function relinkSummary(name: string, r: RelinkStaffResult): string {
  const moved = r.absorbed
    .map((a) => `${a.code}: ${count(a.orders)} đơn, ${count(a.customers)} khách đã chuyển`)
    .join('; ');
  return `${name} → ${r.userCode} ở ${r.shops} POS${moved ? ` — ${moved}` : ' — đơn liên quan đang cập nhật người phụ trách'}`;
}

/**
 * Bảng nhân viên Pancake ↔ tài khoản ERP — dùng chung cho màn /crm/pancake-staff (trưởng nhóm) và
 * khối trong Kết nối Pancake (quản trị). `pending` = chỉ người chưa có tài khoản thật.
 *
 * Mỗi dòng: tên / SĐT / email / fb_id Pancake, vai trò đã thấy trên đơn, POS, số đơn + khách đang
 * đứng tên tài khoản tự tạo, tài khoản ERP đang gắn (Tự tạo / Chưa gắn), gợi ý tài khoản thật trùng
 * email (gắn một chạm). Nút gắn chỉ hiện khi có `sync.staff_map` (luật 7).
 */
export function PancakeStaffTable({ pending }: { pending: boolean }) {
  const query = usePancakeStaff(pending);
  const [linking, setLinking] = useState<{ staff: PancakeStaff; userId?: string } | null>(null);

  return (
    <>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={3} columns={6} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={Users}
            title={pending ? 'Không còn ai chờ gắn tài khoản' : 'Chưa có nhân viên Pancake nào'}
            description={
              pending
                ? 'Mọi người chốt đơn Pancake đã có tài khoản thật trong ERP.'
                : 'Nhân viên xuất hiện ở đây khi đơn đầu tiên của họ được đồng bộ về.'
            }
          />
        }
      >
        {(rows) => (
          <div className="overflow-x-auto rounded-md border bg-card">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Nhân viên Pancake</TableHead>
                  <TableHead>Vai trò trên đơn</TableHead>
                  <TableHead>POS</TableHead>
                  <TableHead className="text-right">Đơn / khách</TableHead>
                  <TableHead>Tài khoản ERP</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={`${s.fbId}:${s.user?.id ?? ''}`}>
                    <TableCell>
                      <div className="text-sm font-medium">{s.observedName ?? '—'}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {[s.observedPhone, s.observedEmail, `fb ${s.fbId}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.seenRoles.length
                        ? s.seenRoles.map((r) => ROLE_LABEL[r] ?? r).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.shopIds.join(', ')}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {s.autoCreated ? `${count(s.orderCount)} / ${count(s.customerCount)}` : '—'}
                    </TableCell>
                    <TableCell>
                      {s.user ? (
                        <span className="flex flex-wrap items-center gap-1.5 text-sm">
                          <Can I="read" a="User" passThrough>
                            {(allowed) =>
                              allowed ? (
                                <Link
                                  href={`/admin/users/${s.user!.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {s.user!.fullName}
                                </Link>
                              ) : (
                                <span>{s.user!.fullName}</span>
                              )
                            }
                          </Can>
                          <span className="font-mono text-xs text-muted-foreground">
                            {s.user.code}
                          </span>
                          {s.autoCreated ? <StatusBadge tone="warn">Tự tạo</StatusBadge> : null}
                          {!s.user.isActive ? (
                            <StatusBadge tone="neutral">Ngừng hoạt động</StatusBadge>
                          ) : null}
                        </span>
                      ) : (
                        <StatusBadge tone="err">Chưa gắn</StatusBadge>
                      )}
                      {s.suggestedUser ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Trùng email với{' '}
                          <span className="font-medium text-foreground">
                            {s.suggestedUser.fullName}
                          </span>{' '}
                          <span className="font-mono">{s.suggestedUser.code}</span>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Can I="staff_map" a="Sync">
                        <div className="flex justify-end gap-1.5">
                          {s.suggestedUser ? (
                            <Button
                              size="sm"
                              onClick={() => setLinking({ staff: s, userId: s.suggestedUser!.id })}
                              aria-label={`Gắn ${staffDisplayName(s)} vào ${s.suggestedUser.fullName}`}
                            >
                              <Wand2 aria-hidden />
                              Gắn theo gợi ý
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLinking({ staff: s })}
                            aria-label={`Gắn tài khoản cho ${staffDisplayName(s)}`}
                          >
                            <Link2 aria-hidden />
                            Gắn tài khoản
                          </Button>
                        </div>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      {linking ? (
        <RelinkDialog
          key={`${linking.staff.fbId}:${linking.staff.user?.id ?? ''}:${linking.userId ?? ''}`}
          staff={linking.staff}
          initialUserId={linking.userId}
          onClose={() => setLinking(null)}
        />
      ) : null}
    </>
  );
}

function RelinkDialog({
  staff,
  initialUserId,
  onClose,
}: {
  staff: PancakeStaff;
  initialUserId?: string;
  onClose: () => void;
}) {
  const relink = useRelinkPancakeStaff();
  const [userId, setUserId] = useState(initialUserId ?? '');
  const name = staffDisplayName(staff);
  const suggested = staff.suggestedUser && staff.suggestedUser.id === initialUserId;

  const submit = () => {
    if (!userId || relink.isPending) return;
    relink.mutate(
      { fbId: staff.fbId, userId },
      {
        onSuccess: (r) => {
          toast.success('Đã gắn tài khoản', { description: relinkSummary(name, r) });
          onClose();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !relink.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gắn tài khoản ERP cho {name}</DialogTitle>
          <DialogDescription>
            Mọi POS thấy nhân viên này đều dùng tài khoản được chọn.
            {staff.autoCreated && staff.user
              ? ` ${count(staff.orderCount)} đơn và ${count(staff.customerCount)} khách đang đứng tên tài khoản tự tạo ${staff.user.code} chuyển sang ngay; tài khoản tự tạo đó bị xoá.`
              : ' Đơn của họ được cập nhật người phụ trách ở lượt đồng bộ kế tiếp.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="relink-user">Tài khoản ERP</Label>
          <EntityPicker
            id="relink-user"
            value={userId}
            onChange={(id) => setUserId(id)}
            useSearch={useStaffCandidateSearch}
            selectedLabel={suggested ? staff.suggestedUser!.fullName : undefined}
            placeholder="Tìm theo tên, mã nhân viên, email…"
          />
          {suggested ? (
            <p className="text-xs text-muted-foreground">
              Gợi ý vì email Pancake {staff.observedEmail} trùng email tài khoản này.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={relink.isPending} onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button disabled={!userId || relink.isPending} onClick={submit}>
            {relink.isPending ? 'Đang gắn…' : 'Gắn tài khoản'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
