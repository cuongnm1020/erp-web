'use client';

import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Plus, Search, Undo2 } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import { useHotkey } from '@/lib/use-hotkey';
import { usePermissions, type Permission } from '../api/use-permissions';
import { useRoles, useUpdateRole, type Role } from '../api/use-roles';
import { moduleLabel, permissionLabel } from '../labels';
import { CreateRoleDialog, RoleMenu } from './role-dialogs';

/** key ô = `${roleCode}:${permissionCode}` */
const cellKey = (role: string, perm: string) => `${role}:${perm}`;

type Pair = readonly [Role, Permission];
type Scope = 'all' | 'changed';

/** Trạng thái gộp của một nhóm ô (cả nhóm / mọi vai trò / tất cả quyền của vai trò). */
interface Box {
  state: boolean | 'indeterminate';
  dirty: boolean;
}

/** Ô tick dùng chung cho mọi cấp — vòng vàng khi có thay đổi chưa lưu. */
function Tick({
  box,
  label,
  disabled,
  onToggle,
}: {
  box: Box;
  label: string;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Checkbox
      checked={box.state}
      disabled={disabled}
      onCheckedChange={onToggle}
      aria-label={label}
      className={cn(box.dirty && 'ring-2 ring-warning ring-offset-2 ring-offset-card')}
    />
  );
}

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Tất cả quyền' },
  { value: 'changed', label: 'Chỉ chỗ đã đổi' },
];

/**
 * I-03 Vai trò & quyền (mockup "Cấu hình phân quyền" claude.ai/artifact/UphyusTMG5PLSWiZegwTME,
 * design system MatrixSelect) — GET /roles + GET /permissions, lưu PUT /roles/:code (thay toàn bộ
 * danh sách quyền của từng vai trò có thay đổi; vai trò lỗi giữ lại trong nháp).
 * Nhóm quyền thu gọn / mở rộng, ô "cả nhóm" + "mọi vai trò" + "tất cả quyền" (một phần = gạch),
 * lọc theo tên / nhóm / mã, xem riêng chỗ đã đổi. Không hiện số thống kê (số người, n/tổng).
 */
export function RolesScreen() {
  const roles = useRoles();
  const permissions = usePermissions();
  const update = useUpdateRole();
  const ability = useAbility();
  const canEdit = ability.can('update', 'Role');

  const [draft, setDraft] = useState<Record<string, boolean>>({});
  // Nhóm đang mở — mặc định đóng hết, chỉ thấy tên nhóm + ô "cả nhóm".
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [create, setCreate] = useState<{ from: Role | null } | null>(null);
  const [saving, setSaving] = useState(false);

  const roleList = useMemo(() => roles.data ?? [], [roles.data]);
  const perms = useMemo(() => permissions.data ?? [], [permissions.data]);
  const serverSets = useMemo(
    () => new Map(roleList.map((r) => [r.code, new Set(r.permissions)])),
    [roleList],
  );

  const dirtyKeys = Object.keys(draft);
  const hasDirty = dirtyKeys.length > 0;
  const isDirty = (r: Role, p: Permission) => draft[cellKey(r.code, p.code)] !== undefined;
  const server = (r: Role, p: Permission) => serverSets.get(r.code)?.has(p.code) ?? false;
  const value = (r: Role, p: Permission) => draft[cellKey(r.code, p.code)] ?? server(r, p);
  const roleDirty = (r: Role) => dirtyKeys.some((k) => k.startsWith(`${r.code}:`));

  // Rời trang (đóng tab / F5) khi còn thay đổi chưa lưu thì trình duyệt hỏi lại.
  useEffect(() => {
    if (!hasDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasDirty]);

  const box = (pairs: Pair[]): Box => {
    let on = 0;
    let dirty = false;
    for (const [r, p] of pairs) {
      if (value(r, p)) on++;
      if (isDirty(r, p)) dirty = true;
    }
    const state = on === 0 ? false : on === pairs.length ? true : 'indeterminate';
    return { state, dirty };
  };

  /** Đặt cùng một giá trị cho nhiều ô; ô trở về đúng giá trị server thì bỏ khỏi bản nháp. */
  const setMany = (pairs: Pair[], v: boolean) =>
    setDraft((d) => {
      const next = { ...d };
      for (const [r, p] of pairs) {
        const k = cellKey(r.code, p.code);
        if (server(r, p) === v) delete next[k];
        else next[k] = v;
      }
      return next;
    });
  const toggleBox = (pairs: Pair[]) => setMany(pairs, box(pairs).state !== true);

  /** Lưu từng vai trò một: vai trò lỗi giữ nguyên trong nháp, báo tên vai trò lỗi. */
  const onSave = async () => {
    const changed = roleList.filter(roleDirty);
    const failed: Role[] = [];
    let firstError: unknown = null;
    setSaving(true);
    for (const r of changed) {
      const list = perms.filter((p) => value(r, p)).map((p) => p.code);
      try {
        await update.mutateAsync({ code: r.code, permissions: list });
        setDraft((d) =>
          Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith(`${r.code}:`))),
        );
      } catch (err) {
        failed.push(r);
        firstError ??= err;
      }
    }
    setSaving(false);
    if (failed.length === 0) {
      setScope('all');
      toast.success('Đã lưu thay đổi', {
        description: 'Quyền có hiệu lực ở thao tác kế tiếp của nhân viên.',
      });
    } else {
      toast.error(`Chưa lưu được: ${failed.map((r) => r.name).join(', ')}`, {
        description: messageFor(firstError),
      });
    }
  };

  useHotkey('Ctrl+S', () => void onSave(), { enabled: canEdit && hasDirty && !saving });

  const modules = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of perms) groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
    return [...groups.entries()];
  }, [perms]);

  const needle = q.trim().toLowerCase();
  const filtering = needle !== '' || scope === 'changed';
  const visible = modules
    .map(([module, all]) => {
      const rows = all.filter((p) => {
        if (scope === 'changed' && !roleList.some((r) => isDirty(r, p))) return false;
        if (!needle) return true;
        return `${permissionLabel(p)} ${moduleLabel(module)} ${p.code}`
          .toLowerCase()
          .includes(needle);
      });
      return { module, all, rows };
    })
    .filter((g) => g.rows.length > 0);

  const touchedRoles = roleList.filter(roleDirty);

  return (
    <>
      <PageHeader
        title="Vai trò & quyền"
        description="Bật / tắt quyền của từng vai trò · lưu một lần cho cả bảng"
        status={
          hasDirty ? (
            <span title={`Vai trò bị đổi: ${touchedRoles.map((r) => r.name).join(', ')}`}>
              <StatusBadge tone="warn">Có thay đổi chưa lưu</StatusBadge>
            </span>
          ) : null
        }
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Vai trò & quyền' }]}
        actions={
          <Can I="update" a="Role">
            <Button variant="outline" onClick={() => setCreate({ from: null })}>
              <Plus aria-hidden />
              Thêm vai trò
            </Button>
            <Button variant="outline" disabled={!hasDirty || saving} onClick={() => setDraft({})}>
              <Undo2 aria-hidden />
              Hoàn tác
            </Button>
            <Button
              disabled={!hasDirty}
              loading={saving}
              loadingText="Đang lưu…"
              shortcut="Ctrl S"
              onClick={() => void onSave()}
            >
              Lưu thay đổi
            </Button>
          </Can>
        }
      />

      <QueryState
        query={roles}
        skeleton={<Skeleton className="h-96 w-full" />}
        isEmpty={(d) => d.length === 0}
        empty={
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center">
            <p className="text-sm font-semibold">Chưa có vai trò nào</p>
            <Can I="update" a="Role">
              <Button variant="outline" onClick={() => setCreate({ from: null })}>
                <Plus aria-hidden />
                Thêm vai trò
              </Button>
            </Can>
          </div>
        }
      >
        {() => (
          <section aria-label="Ma trận phân quyền" className="rounded-lg border bg-card">
            <div className="flex min-h-card-header flex-wrap items-center gap-2 border-b px-3.5 py-2">
              <div className="relative w-64 max-w-full">
                <Search
                  className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-subtle-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  aria-label="Lọc quyền"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Lọc quyền: tên, nhóm, mã…"
                  className="pl-8"
                />
              </div>
              <div
                role="radiogroup"
                aria-label="Hiện quyền"
                className="inline-flex overflow-hidden rounded-md border border-input bg-card"
              >
                {SCOPES.map((o, i) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={scope === o.value}
                    onClick={() => setScope(o.value)}
                    className={cn(
                      'h-button px-2.5 text-sm',
                      i > 0 && 'border-l',
                      scope === o.value
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => setExpanded(new Set(modules.map(([m]) => m)))}
              >
                <ChevronsUpDown aria-hidden />
                Mở rộng tất cả
              </Button>
              <Button variant="outline" onClick={() => setExpanded(new Set())}>
                <ChevronsDownUp aria-hidden />
                Thu gọn tất cả
              </Button>
              <ul className="ml-auto flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <Checkbox checked tabIndex={-1} aria-hidden className="pointer-events-none" />
                  Có quyền
                </li>
                <li className="flex items-center gap-1.5">
                  <Checkbox
                    checked="indeterminate"
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none"
                  />
                  Một phần nhóm
                </li>
                <li className="flex items-center gap-1.5">
                  <Checkbox
                    checked={false}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none"
                  />
                  Không có
                </li>
                <li className="flex items-center gap-1.5">
                  <Checkbox
                    checked={false}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none ring-2 ring-warning ring-offset-2 ring-offset-card"
                  />
                  Đã đổi, chưa lưu
                </li>
              </ul>
            </div>

            <div className="max-h-matrix overflow-auto rounded-b-lg">
              <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-30 w-72 min-w-72 border-b border-r bg-muted px-3.5 py-2 text-left align-bottom"
                    >
                      <span className="block text-xs font-semibold text-muted-foreground">
                        Quyền
                      </span>
                      <span className="block text-xs font-normal text-subtle-foreground">
                        Bấm tên nhóm để mở / gọn · ô cuối dòng = mọi vai trò
                      </span>
                    </th>
                    {roleList.map((r) => {
                      const pairs = perms.map((p) => [r, p] as const);
                      const all = box(pairs);
                      return (
                        <th
                          key={r.code}
                          scope="col"
                          className="sticky top-0 z-20 w-28 min-w-28 border-b border-r bg-muted px-1 pb-1 pt-2 align-top font-normal"
                        >
                          <div className="flex flex-col items-center gap-0.5 text-center">
                            <div className="flex min-h-8 items-start gap-0.5">
                              <span className="text-sm font-semibold leading-4">{r.name}</span>
                              {all.dirty ? (
                                <span
                                  title="Có thay đổi chưa lưu"
                                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                                />
                              ) : null}
                              <Can I="update" a="Role">
                                <RoleMenu role={r} onClone={(from) => setCreate({ from })} />
                              </Can>
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.code}
                            </span>
                            <div className="flex h-8 items-center">
                              <Tick
                                box={all}
                                label={`${r.name} · tất cả quyền`}
                                disabled={!canEdit}
                                onToggle={() => toggleBox(pairs)}
                              />
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ module, all, rows }) => {
                    const open = filtering || expanded.has(module);
                    const label = moduleLabel(module);
                    return (
                      <Fragment key={module}>
                        <tr className="bg-background">
                          <th
                            scope="rowgroup"
                            className="sticky left-0 z-10 border-b border-r bg-background p-0 text-left"
                          >
                            <button
                              type="button"
                              aria-expanded={open}
                              onClick={() =>
                                setExpanded((c) => {
                                  const next = new Set(c);
                                  if (open) next.delete(module);
                                  else next.add(module);
                                  return next;
                                })
                              }
                              className="flex min-h-10 w-full items-center gap-2 px-3.5 text-left text-sm font-semibold hover:text-primary"
                            >
                              <ChevronRight
                                aria-hidden
                                className={cn(
                                  'h-3.5 w-3.5 text-muted-foreground transition-transform motion-reduce:transition-none',
                                  open && 'rotate-90',
                                )}
                              />
                              {label}
                            </button>
                          </th>
                          {roleList.map((r) => {
                            const pairs = all.map((p) => [r, p] as const);
                            return (
                              <td key={r.code} className="border-b border-r text-center">
                                <Tick
                                  box={box(pairs)}
                                  label={`${r.name} · cả nhóm ${label}`}
                                  disabled={!canEdit}
                                  onToggle={() => toggleBox(pairs)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                        {open
                          ? rows.map((p) => {
                              const changed = roleList.some((r) => isDirty(r, p));
                              const rowPairs = roleList.map((r) => [r, p] as const);
                              const name = permissionLabel(p);
                              return (
                                <tr
                                  key={p.code}
                                  className={cn(
                                    'group',
                                    changed ? 'bg-warning-weak' : 'bg-card hover:bg-background',
                                  )}
                                >
                                  <th
                                    scope="row"
                                    className={cn(
                                      'sticky left-0 z-10 border-b border-r py-1 pl-9 pr-1 text-left font-normal',
                                      changed
                                        ? 'bg-warning-weak'
                                        : 'bg-card group-hover:bg-background',
                                    )}
                                  >
                                    <div className="flex items-center gap-1">
                                      <span className="flex min-w-0 grow flex-col">
                                        <span className="text-sm">{name}</span>
                                        <span className="font-mono text-xs text-muted-foreground">
                                          {p.code}
                                        </span>
                                      </span>
                                      <span className="flex h-8 w-10 items-center justify-center border-l border-dashed border-input">
                                        <Tick
                                          box={box(rowPairs)}
                                          label={`${label}: ${name} · mọi vai trò`}
                                          disabled={!canEdit}
                                          onToggle={() => toggleBox(rowPairs)}
                                        />
                                      </span>
                                    </div>
                                  </th>
                                  {roleList.map((r) => (
                                    <td key={r.code} className="h-11 border-b border-r text-center">
                                      <Tick
                                        box={box([[r, p]])}
                                        label={`${r.name} · ${label}: ${name}`}
                                        disabled={!canEdit}
                                        onToggle={() => toggleBox([[r, p]])}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              );
                            })
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {visible.length === 0 ? (
                <div className="sticky left-0 flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <p className="text-sm font-semibold">Không có quyền khớp</p>
                  <p className="text-sm text-muted-foreground">
                    Đổi từ khóa hoặc chuyển về “Tất cả quyền”.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQ('');
                      setScope('all');
                    }}
                  >
                    Xóa lọc
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </QueryState>

      <CreateRoleDialog
        open={create !== null}
        onOpenChange={(o) => !o && setCreate(null)}
        roles={roleList}
        from={create?.from ?? null}
      />
    </>
  );
}
