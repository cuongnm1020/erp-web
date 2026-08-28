'use client';

import { Fragment, useMemo, useState } from 'react';
import { QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cn } from '@/lib/cn';
import {
  useUpdateUserPermissions,
  useUserPermissions,
  type UserPermissionEntry,
} from '../api/use-users';
import { actionLabel, moduleLabel } from '../labels';

type Override = 'ALLOW' | 'DENY' | null;

/**
 * Trạng thái một ô sau khi áp draft:
 * - inherited: role cấp, không override → hiệu lực
 * - allow: override ALLOW (cấp riêng ngoài role)
 * - deny: override DENY (chặn, kể cả role có cấp)
 * - none: không role, không override → không hiệu lực
 */
function cellState(entry: UserPermissionEntry, override: Override) {
  if (override === 'DENY') return 'deny' as const;
  if (override === 'ALLOW') return 'allow' as const;
  return entry.fromRoles.length > 0 ? ('inherited' as const) : ('none' as const);
}

/** Nhấn ô: có hiệu lực → chặn/thu hồi; không hiệu lực → cấp riêng; đang override → về theo vai trò. */
function nextOverride(entry: UserPermissionEntry, current: Override): Override {
  if (current !== null) return null;
  return entry.fromRoles.length > 0 ? 'DENY' : 'ALLOW';
}

const CELL_LABEL: Record<ReturnType<typeof cellState>, string> = {
  inherited: 'Theo vai trò',
  allow: 'Cấp riêng',
  deny: 'Đã chặn',
  none: '—',
};

const CELL_CLASS: Record<ReturnType<typeof cellState>, string> = {
  inherited: 'bg-secondary text-foreground',
  allow: 'bg-primary text-primary-foreground',
  deny: 'bg-destructive/10 text-destructive line-through',
  none: 'border text-muted-foreground',
};

/**
 * I-05 Ma trận quyền theo user — GET/PUT /users/:id/permissions.
 * effective = (quyền vai trò ∪ Cấp riêng) − Đã chặn. Lưu là MỘT lần cho toàn ma trận (PUT thay hết).
 */
export function UserPermissionMatrix({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const query = useUserPermissions(userId);
  const save = useUpdateUserPermissions(userId);
  const [draft, setDraft] = useState<Record<string, Override>>({});

  const dirtyCount = useMemo(() => {
    const entries = query.data?.entries ?? [];
    return entries.filter((e) => draft[e.code] !== undefined && draft[e.code] !== e.override)
      .length;
  }, [draft, query.data]);

  const onSave = () => {
    const entries = query.data?.entries ?? [];
    const allow: string[] = [];
    const deny: string[] = [];
    for (const e of entries) {
      const o = draft[e.code] !== undefined ? draft[e.code] : e.override;
      if (o === 'ALLOW') allow.push(e.code);
      if (o === 'DENY') deny.push(e.code);
    }
    save.mutate(
      { allow, deny },
      {
        onSuccess: () => {
          setDraft({});
          toast.success('Đã lưu thay đổi', { description: 'Quyền có hiệu lực ngay lập tức.' });
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  return (
    <QueryState
      query={query}
      skeleton={<Skeleton className="h-64 w-full" />}
      isEmpty={(d) => d.entries.length === 0}
      empty={<p className="p-4 text-sm text-muted-foreground">Chưa có catalog quyền.</p>}
    >
      {(data) => {
        const groups = new Map<string, UserPermissionEntry[]>();
        for (const e of data.entries) {
          groups.set(e.module, [...(groups.get(e.module) ?? []), e]);
        }
        const editable = canEdit && !data.isSuperAdmin;
        return (
          <div>
            {data.isSuperAdmin ? (
              <p className="mb-2 rounded-md bg-secondary px-3 py-2 text-sm">
                Tài khoản <span className="font-semibold">superadmin — toàn quyền</span>. Ma trận
                chỉ để xem; override không có tác dụng.
              </p>
            ) : null}
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Nhấn ô để đổi: quyền đang có → chặn · quyền chưa có → cấp riêng · đang override → về
                theo vai trò.
              </p>
              {editable ? (
                <span className="flex items-center gap-2">
                  {dirtyCount > 0 ? (
                    <StatusBadge tone="warn">{dirtyCount} thay đổi chưa lưu</StatusBadge>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={dirtyCount === 0 || save.isPending}
                    onClick={() => setDraft({})}
                  >
                    Hoàn tác
                  </Button>
                  <Button size="sm" disabled={dirtyCount === 0 || save.isPending} onClick={onSave}>
                    {save.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </Button>
                </span>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-md border bg-card">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="min-w-56 px-2.5">Quyền</TableHead>
                    <TableHead className="px-2.5">Từ vai trò</TableHead>
                    <TableHead className="w-36 px-2.5">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...groups.entries()].map(([module, entries]) => (
                    <Fragment key={module}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={3} className="px-2.5 py-1 text-xs font-semibold">
                          {moduleLabel(module)}
                        </TableCell>
                      </TableRow>
                      {entries.map((e) => {
                        const override = draft[e.code] ?? e.override;
                        const state = cellState(e, override);
                        const dirty = draft[e.code] !== undefined && draft[e.code] !== e.override;
                        return (
                          <TableRow key={e.code} className={cn(dirty && 'bg-warning/10')}>
                            <TableCell className="px-2.5 py-1.5">
                              {actionLabel(e.action)}{' '}
                              <span className="font-mono text-xs text-muted-foreground">
                                {e.code}
                              </span>
                            </TableCell>
                            <TableCell className="px-2.5 py-1.5 text-xs text-muted-foreground">
                              {e.fromRoles.length ? e.fromRoles.join(', ') : '—'}
                            </TableCell>
                            <TableCell className="px-2.5 py-1.5">
                              <button
                                type="button"
                                disabled={!editable}
                                aria-label={`${moduleLabel(e.module)} · ${actionLabel(e.action)}: ${CELL_LABEL[state]}`}
                                onClick={() =>
                                  setDraft((d) => ({ ...d, [e.code]: nextOverride(e, override) }))
                                }
                                className={cn(
                                  'inline-flex h-6 min-w-24 items-center justify-center rounded-md px-2 text-xs font-medium',
                                  CELL_CLASS[state],
                                  editable && 'cursor-pointer',
                                )}
                              >
                                {CELL_LABEL[state]}
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      }}
    </QueryState>
  );
}
