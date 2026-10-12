'use client';

import { Link2, Users } from 'lucide-react';
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
import { Can } from '@/lib/permission';
import {
  usePancakeStaff,
  useRelinkPancakeStaff,
  useStaffUserSearch,
  type PancakeStaff,
} from '../api/use-pancake-config';

const ROLE_LABEL: Record<string, string> = {
  seller: 'Chốt đơn',
  creator: 'Tạo đơn',
  care: 'Chăm sóc',
  marketer: 'Marketer',
};

/**
 * Nhân viên Pancake ↔ tài khoản ERP — GET /pancake-sync/mapping/staff, POST …/staff/relink.
 * Nhân viên CHỐT ĐƠN chưa có trong ERP được đồng bộ tự tạo tài khoản sale (mã pc.…, mật khẩu
 * ngẫu nhiên — đặt lại ở màn Người dùng trước khi giao). Tài khoản tự tạo trùng người đã có tài
 * khoản thì "Gắn tài khoản" sang tài khoản đúng: mọi POS đổi theo, đơn liên quan được chiếu lại.
 */
export function PancakeStaffSection() {
  const query = usePancakeStaff();
  const [linking, setLinking] = useState<PancakeStaff | null>(null);

  return (
    <section className="mt-6 space-y-2">
      <div>
        <h2 className="text-base font-semibold">Nhân viên Pancake</h2>
        <p className="text-sm text-muted-foreground">
          Người chốt đơn trên Pancake là người phụ trách đơn trong ERP (dùng để tính hoa hồng).
          Người chưa có tài khoản được tạo tự động; tài khoản tự tạo trùng người đã có thì gắn lại.
        </p>
      </div>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={3} columns={5} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={Users}
            title="Chưa có nhân viên Pancake nào"
            description="Nhân viên xuất hiện ở đây khi đơn đầu tiên của họ được đồng bộ về."
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
                        {s.observedPhone ? `${s.observedPhone} · ` : ''}fb {s.fbId}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.seenRoles.length
                        ? s.seenRoles.map((r) => ROLE_LABEL[r] ?? r).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.shopIds.join(', ')}</TableCell>
                    <TableCell>
                      {s.user ? (
                        <span className="flex flex-wrap items-center gap-1.5 text-sm">
                          <Link
                            href={`/admin/users/${s.user.id}`}
                            className="text-primary hover:underline"
                          >
                            {s.user.fullName}
                          </Link>
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
                    </TableCell>
                    <TableCell>
                      <Can I="map" a="Sync">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLinking(s)}
                          aria-label={`Gắn tài khoản cho ${s.observedName ?? s.fbId}`}
                        >
                          <Link2 aria-hidden />
                          Gắn tài khoản
                        </Button>
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
          key={`${linking.fbId}:${linking.user?.id ?? ''}`}
          staff={linking}
          onClose={() => setLinking(null)}
        />
      ) : null}
    </section>
  );
}

function RelinkDialog({ staff, onClose }: { staff: PancakeStaff; onClose: () => void }) {
  const relink = useRelinkPancakeStaff();
  const [userId, setUserId] = useState('');
  const name = staff.observedName ?? `fb ${staff.fbId}`;

  const submit = () => {
    if (!userId || relink.isPending) return;
    relink.mutate(
      { fbId: staff.fbId, userId },
      {
        onSuccess: (r) => {
          toast.success('Đã gắn tài khoản', {
            description: `${name} → ${r.userCode} ở ${r.shops} POS — đơn liên quan đang cập nhật người phụ trách`,
          });
          onClose();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !relink.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gắn tài khoản ERP cho {name}</DialogTitle>
          <DialogDescription>
            Mọi POS thấy nhân viên này đều dùng tài khoản được chọn; đơn của họ được cập nhật người
            phụ trách ở lượt đồng bộ kế tiếp.
            {staff.autoCreated && staff.user
              ? ` Tài khoản tự tạo ${staff.user.code} vẫn giữ — khoá ở màn Người dùng nếu không dùng nữa.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="relink-user">Tài khoản ERP</Label>
          <EntityPicker
            id="relink-user"
            value={userId}
            onChange={(id) => setUserId(id)}
            useSearch={useStaffUserSearch}
            placeholder="Tìm theo tên, mã nhân viên…"
          />
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
