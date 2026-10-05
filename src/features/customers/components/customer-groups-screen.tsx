'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Pencil, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MoneyInput,
} from '@/components/data/form';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { formatMoney } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import {
  useCreateCustomerGroup,
  useCreateCustomerTag,
  useCreateCustomerTier,
  useCustomerGroups,
  useCustomerTags,
  useCustomerTiers,
  useDeleteCustomerGroup,
  useDeleteCustomerTag,
  useDeleteCustomerTier,
  useUpdateCustomerGroup,
  useUpdateCustomerTag,
  useUpdateCustomerTier,
  type CustomerGroup,
  type CustomerTag,
  type CustomerTier,
} from '../api/use-segments';
import {
  groupFormSchema,
  rateToPercent,
  tagFormSchema,
  tierFormSchema,
  toTierBody,
  toUpdateTierBody,
  type GroupFormValues,
  type TagFormValues,
  type TierFormValues,
} from '../schema';
import { TagChip } from './tag-chip';
import { TierPromotionDialog } from './tier-promotion-dialog';

/**
 * B-05 Nhóm khách hàng · cấp độ · tag — /crm/segments (CRM-02).
 * Bố cục giữ theo design canvas (3 cột); dữ liệu thật từ /customer-groups, /customer-tiers,
 * /customer-tags. Những phần canvas có mà API chưa có thì BỎ, không để nút chết:
 * - cột "Số KH" của nhóm/cấp/tag: API không đếm (đếm đúng đòi đọc vượt scope) → thay bằng link
 *   "Xem khách" mở danh sách khách đã lọc (GET /customers?groupId… — đếm theo scope người xem);
 * - "Lịch sử thay đổi", "Gộp vào tag khác", hoàn tác 10 giây: chưa có endpoint.
 * Quyền: thêm = customer.create, sửa = customer.update, xóa = customer.delete,
 * chạy nâng hạng = customer.assign (khớp @RequirePermission của controller).
 */

function Card({
  title,
  action,
  children,
  footer,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm font-semibold">
        <span>{title}</span>
        {action}
      </header>
      {children}
      {footer}
    </section>
  );
}

function HeaderButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs font-normal"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** Dialog nằm trong portal; submit không được nổi lên form ngoài (nếu có). */
function stop(submit: (e: FormEvent<HTMLFormElement>) => Promise<void>) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.stopPropagation();
    void submit(e);
  };
}

function DialogActions({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
        Hủy bỏ
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang lưu…' : label}
      </Button>
    </DialogFooter>
  );
}

// ───────────────────────────── Nhóm ─────────────────────────────

const GROUP_FIELDS = ['code', 'name', 'description'] as const;

function GroupDialog({
  group,
  open,
  onOpenChange,
}: {
  group?: CustomerGroup;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const editing = group !== undefined;
  const create = useCreateCustomerGroup();
  const update = useUpdateCustomerGroup();
  const pending = create.isPending || update.isPending;
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      code: group?.code ?? '',
      name: group?.name ?? '',
      description: group?.description ?? '',
    },
  });
  const submit = form.handleSubmit((v) => {
    const onError = (err: unknown) =>
      applyServerErrors(form, err as ApiError, { knownFields: GROUP_FIELDS });
    if (editing) {
      update.mutate(
        { id: group.id, body: { name: v.name, description: v.description } },
        {
          onSuccess: () => {
            toast.success('Đã lưu nhóm');
            onOpenChange(false);
          },
          onError,
        },
      );
      return;
    }
    create.mutate(
      { code: v.code, name: v.name, ...(v.description ? { description: v.description } : {}) },
      {
        onSuccess: (g) => {
          toast.success(`Đã thêm nhóm ${g.name}`);
          onOpenChange(false);
        },
        onError,
      },
    );
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Sửa nhóm ${group.name}` : 'Thêm nhóm khách hàng'}</DialogTitle>
          <DialogDescription>Một khách thuộc đúng một nhóm.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={stop(submit)} className="flex flex-col gap-3" noValidate>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required={!editing}>Mã nhóm</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={editing}
                        className="font-mono"
                        placeholder="DAILY"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Tên nhóm</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus placeholder="Đại lý" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="Ghi chú về nhóm (không bắt buộc)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogActions
              pending={pending}
              onCancel={() => onOpenChange(false)}
              label={editing ? 'Lưu nhóm' : 'Thêm nhóm'}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function GroupRowActions({ group, onEdit }: { group: CustomerGroup; onEdit: () => void }) {
  const ability = useAbility();
  const update = useUpdateCustomerGroup();
  const del = useDeleteCustomerGroup();
  const [confirm, setConfirm] = useState<'deactivate' | 'hard' | null>(null);
  const canUpdate = ability.can('update', 'Customer');
  const canDelete = ability.can('delete', 'Customer');

  const run = (hard: boolean) =>
    del.mutateAsync({ id: group.id, hard }).then(
      () => toast.success(hard ? `Đã xóa nhóm ${group.name}` : `Đã ngừng dùng nhóm ${group.name}`),
      (err) => toast.error(messageFor(err)),
    );

  return (
    <div className="flex justify-end gap-0.5">
      <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Xem khách trong nhóm">
        <Link href={`/crm/customers?group=${group.id}`} aria-label={`Xem khách nhóm ${group.name}`}>
          <Users aria-hidden />
        </Link>
      </Button>
      {canUpdate ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Sửa"
          aria-label={`Sửa nhóm ${group.name}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
      ) : null}
      {canUpdate && !group.isActive ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Dùng lại"
          aria-label={`Dùng lại nhóm ${group.name}`}
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { id: group.id, body: { isActive: true } },
              {
                onSuccess: () => toast.success(`Đã dùng lại nhóm ${group.name}`),
                onError: (err) => toast.error(messageFor(err)),
              },
            )
          }
        >
          <RotateCcw aria-hidden />
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title={group.isActive ? 'Ngừng dùng' : 'Xóa hẳn'}
          aria-label={
            group.isActive ? `Ngừng dùng nhóm ${group.name}` : `Xóa hẳn nhóm ${group.name}`
          }
          onClick={() => setConfirm(group.isActive ? 'deactivate' : 'hard')}
        >
          <Trash2 aria-hidden />
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm === 'deactivate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Ngừng dùng nhóm ${group.name}?`}
        description="Khách đang trong nhóm giữ nguyên; nhóm không còn để chọn cho khách mới. Có thể dùng lại sau."
        confirmLabel="Ngừng dùng"
        onConfirm={() => run(false)}
      />
      <ConfirmDialog
        open={confirm === 'hard'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Xóa hẳn nhóm ${group.name}?`}
        description="Chỉ xóa được nhóm không còn khách nào. Không hoàn tác được."
        confirmLabel="Xóa hẳn"
        onConfirm={() => run(true)}
      />
    </div>
  );
}

function GroupsCard() {
  const query = useCustomerGroups({ includeInactive: true });
  const [dialog, setDialog] = useState<{ group?: CustomerGroup } | null>(null);
  const openCreate = () => setDialog({});

  return (
    <Card
      title={`Nhóm khách hàng${query.data ? ` (${query.data.length})` : ''}`}
      action={
        <Can I="create" a="Customer">
          <HeaderButton onClick={openCreate}>
            <Plus aria-hidden />
            Thêm nhóm
          </HeaderButton>
        </Can>
      }
      footer={
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Một KH thuộc đúng một nhóm. Xóa = ngừng dùng; chỉ nhóm đã ngừng và không còn khách mới xóa
          hẳn được.
        </p>
      }
    >
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={5} columns={2} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="Chưa có nhóm khách hàng"
            description="Tạo nhóm để phân loại khách (đại lý, trang trại, bán lẻ…)."
            action={
              <Can I="create" a="Customer">
                <Button size="sm" onClick={openCreate}>
                  <Plus aria-hidden />
                  Thêm nhóm
                </Button>
              </Can>
            }
          />
        }
      >
        {(groups) => (
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="px-2.5 text-xs">Nhóm</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          g.isActive ? 'font-semibold' : 'font-semibold text-muted-foreground'
                        }
                      >
                        {g.name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{g.code}</span>
                      {g.isActive ? null : <StatusBadge tone="neutral">Ngừng dùng</StatusBadge>}
                    </div>
                    {g.description ? (
                      <div className="text-xs text-muted-foreground">{g.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <GroupRowActions group={g} onEdit={() => setDialog({ group: g })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryState>
      {dialog ? (
        <GroupDialog
          key={dialog.group?.id ?? 'new'}
          group={dialog.group}
          open
          onOpenChange={(o) => !o && setDialog(null)}
        />
      ) : null}
    </Card>
  );
}

// ──────────────────────────── Cấp độ ────────────────────────────

const TIER_FIELDS = ['code', 'name', 'minRevenue', 'discountPercent', 'sortOrder'] as const;

function TierDialog({
  tier,
  nextSortOrder,
  open,
  onOpenChange,
}: {
  tier?: CustomerTier;
  nextSortOrder: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const editing = tier !== undefined;
  const create = useCreateCustomerTier();
  const update = useUpdateCustomerTier();
  const pending = create.isPending || update.isPending;
  const form = useForm<TierFormValues>({
    resolver: zodResolver(tierFormSchema),
    defaultValues: {
      code: tier?.code ?? '',
      name: tier?.name ?? '',
      minRevenue: tier?.minRevenue ?? '0',
      discountPercent: rateToPercent(tier?.discountRate ?? null),
      sortOrder: String(tier?.sortOrder ?? nextSortOrder),
    },
  });
  const submit = form.handleSubmit((v) => {
    const onError = (err: unknown) =>
      applyServerErrors(form, err as ApiError, {
        knownFields: [...TIER_FIELDS, 'discountRate'],
      });
    if (editing) {
      update.mutate(
        { id: tier.id, body: toUpdateTierBody(v) },
        {
          onSuccess: () => {
            toast.success('Đã lưu cấp độ');
            onOpenChange(false);
          },
          onError,
        },
      );
      return;
    }
    create.mutate(toTierBody(v), {
      onSuccess: (t) => {
        toast.success(`Đã thêm cấp độ ${t.name}`);
        onOpenChange(false);
      },
      onError,
    });
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Sửa cấp độ ${tier.name}` : 'Thêm cấp độ'}</DialogTitle>
          <DialogDescription>
            Khách đạt ngưỡng doanh số kỳ thì được nâng lên cấp này khi chạy nâng hạng.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={stop(submit)} className="flex flex-col gap-3" noValidate>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required={!editing}>Mã cấp</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={editing}
                        className="font-mono"
                        placeholder="GOLD"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Tên cấp</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus placeholder="Vàng" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="minRevenue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Ngưỡng doanh số kỳ</FormLabel>
                  <FormControl>
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>Doanh số tối thiểu trong kỳ để đạt cấp này</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="discountPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chiết khấu ưu đãi (%)</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" placeholder="vd: 2" />
                    </FormControl>
                    <FormDescription>Chưa tự áp vào giá bán</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Thứ hạng</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" />
                    </FormControl>
                    <FormDescription>Số lớn hơn = cấp cao hơn</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogActions
              pending={pending}
              onCancel={() => onOpenChange(false)}
              label={editing ? 'Lưu cấp độ' : 'Thêm cấp độ'}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function tierTone(index: number): StatusTone {
  if (index === 0) return 'brand';
  if (index === 1) return 'warn';
  return 'neutral';
}

function TiersCard() {
  const query = useCustomerTiers();
  const ability = useAbility();
  const del = useDeleteCustomerTier();
  const [dialog, setDialog] = useState<{ tier?: CustomerTier } | null>(null);
  const [deleting, setDeleting] = useState<CustomerTier | null>(null);
  const [promoting, setPromoting] = useState(false);
  const canUpdate = ability.can('update', 'Customer');
  const canDelete = ability.can('delete', 'Customer');
  // Danh mục nhỏ (vài cấp) — sắp cao → thấp để đọc như bậc thang; không phải lọc dữ liệu.
  const tiers = [...(query.data ?? [])].sort((a, b) => b.sortOrder - a.sortOrder);
  const nextSortOrder = tiers.length > 0 ? Math.min(1000, tiers[0]!.sortOrder + 10) : 10;
  const openCreate = () => setDialog({});

  return (
    <Card
      title="Cấp độ — quy tắc nâng hạng"
      action={
        <div className="flex items-center gap-1.5">
          <Can I="assign" a="Customer">
            <HeaderButton onClick={() => setPromoting(true)}>Chạy nâng hạng</HeaderButton>
          </Can>
          <Can I="create" a="Customer">
            <HeaderButton onClick={openCreate}>
              <Plus aria-hidden />
              Thêm cấp
            </HeaderButton>
          </Can>
        </div>
      }
      footer={
        <div className="border-t px-3 py-2.5">
          <div className="flex items-start gap-2.5 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Hệ thống tự tính lại cấp mỗi đêm theo doanh số 12 tháng gần nhất và chỉ nâng, không
              hạ. Muốn chạy ngay, đổi số tháng hoặc cho phép hạ cấp: bấm “Chạy nâng hạng” — luôn xem
              trước rồi mới ghi. Chiết khấu ưu đãi của cấp hiện chưa tự áp vào giá bán.
            </p>
          </div>
        </div>
      }
    >
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={4} columns={4} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="Chưa có cấp độ nào"
            description="Thêm cấp (ví dụ Bạc, Vàng, Kim cương) kèm ngưỡng doanh số để tự nâng hạng khách."
            action={
              <Can I="create" a="Customer">
                <Button size="sm" onClick={openCreate}>
                  <Plus aria-hidden />
                  Thêm cấp
                </Button>
              </Can>
            }
          />
        }
      >
        {() => (
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="px-2.5 text-xs">Cấp độ</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Ngưỡng doanh số kỳ</TableHead>
                <TableHead className="w-24 px-2.5 text-right text-xs">Chiết khấu</TableHead>
                <TableHead className="w-24 px-2.5 text-xs">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((t, i) => (
                <TableRow key={t.id}>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge tone={tierTone(i)}>{t.name}</StatusBadge>
                      <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    ≥ {formatMoney(t.minRevenue, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {t.discountRate === null ? '—' : `${rateToPercent(t.discountRate)}%`}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Xem khách cấp này"
                      >
                        <Link
                          href={`/crm/customers?tier=${t.id}`}
                          aria-label={`Xem khách cấp ${t.name}`}
                        >
                          <Users aria-hidden />
                        </Link>
                      </Button>
                      {canUpdate ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Sửa"
                          aria-label={`Sửa cấp ${t.name}`}
                          onClick={() => setDialog({ tier: t })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Xóa"
                          aria-label={`Xóa cấp ${t.name}`}
                          onClick={() => setDeleting(t)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryState>
      {dialog ? (
        <TierDialog
          key={dialog.tier?.id ?? 'new'}
          tier={dialog.tier}
          nextSortOrder={nextSortOrder}
          open
          onOpenChange={(o) => !o && setDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Xóa cấp độ ${deleting?.name ?? ''}?`}
        description="Chỉ xóa được cấp không còn khách nào mang. Không hoàn tác được."
        onConfirm={() => {
          const t = deleting;
          if (!t) return;
          return del.mutateAsync(t.id).then(
            () => toast.success(`Đã xóa cấp độ ${t.name}`),
            (err) => toast.error(messageFor(err)),
          );
        }}
      />
      {promoting ? (
        <TierPromotionDialog
          tiersConfigured={tiers.length}
          open
          onOpenChange={(o) => !o && setPromoting(false)}
        />
      ) : null}
    </Card>
  );
}

// ───────────────────────────── Tag ─────────────────────────────

const TAG_FIELDS = ['code', 'name', 'color'] as const;
/** Màu gợi ý mặc định cho tag mới — là giá trị dữ liệu gửi lên API, không phải màu giao diện. */
const DEFAULT_TAG_COLOR = '#2563eb';

function TagDialog({
  tag,
  open,
  onOpenChange,
}: {
  tag?: CustomerTag;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const editing = tag !== undefined;
  const create = useCreateCustomerTag();
  const update = useUpdateCustomerTag();
  const pending = create.isPending || update.isPending;
  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      code: tag?.code ?? '',
      name: tag?.name ?? '',
      color: tag?.color ?? DEFAULT_TAG_COLOR,
    },
  });
  const submit = form.handleSubmit((v) => {
    const onError = (err: unknown) =>
      applyServerErrors(form, err as ApiError, { knownFields: TAG_FIELDS });
    if (editing) {
      update.mutate(
        { id: tag.id, body: { name: v.name, color: v.color } },
        {
          onSuccess: () => {
            toast.success('Đã lưu tag');
            onOpenChange(false);
          },
          onError,
        },
      );
      return;
    }
    create.mutate(
      { code: v.code, name: v.name, color: v.color },
      {
        onSuccess: (t) => {
          toast.success(`Đã thêm tag ${t.name}`);
          onOpenChange(false);
        },
        onError,
      },
    );
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Sửa tag ${tag.name}` : 'Thêm tag'}</DialogTitle>
          <DialogDescription>Tag gắn tự do, một khách mang được nhiều tag.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={stop(submit)} className="flex flex-col gap-3" noValidate>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required={!editing}>Mã tag</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={editing}
                        className="font-mono"
                        placeholder="vu-dong-xuan"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Tên tag</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus placeholder="Vụ Đông Xuân" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Màu</FormLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      aria-label="Chọn màu tag"
                      className="h-9 w-12 cursor-pointer rounded-md border border-input bg-card p-1"
                    />
                    <FormControl>
                      <Input {...field} className="w-32 font-mono" placeholder="#2563eb" />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogActions
              pending={pending}
              onCancel={() => onOpenChange(false)}
              label={editing ? 'Lưu tag' : 'Thêm tag'}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TagsCard() {
  const query = useCustomerTags();
  const del = useDeleteCustomerTag();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ tag?: CustomerTag } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const selected = query.data?.find((t) => t.id === selectedId) ?? null;
  const openCreate = () => setDialog({});

  return (
    <Card
      title={`Tag${query.data ? ` (${query.data.length})` : ''}`}
      action={
        <Can I="create" a="Customer">
          <HeaderButton onClick={openCreate}>
            <Plus aria-hidden />
            Thêm tag
          </HeaderButton>
        </Can>
      }
    >
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={3} columns={3} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="Chưa có tag nào"
            description="Tạo tag để gắn nhãn và lọc khách tự do (vùng, mùa vụ, cây trồng…)."
            action={
              <Can I="create" a="Customer">
                <Button size="sm" onClick={openCreate}>
                  <Plus aria-hidden />
                  Thêm tag
                </Button>
              </Can>
            }
          />
        }
      >
        {(tags) => (
          <>
            <div className="flex flex-wrap gap-1.5 px-3 py-2.5" role="listbox" aria-label="Tag">
              {tags.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelectedId(active ? null : t.id)}
                    className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TagChip
                      name={t.name}
                      color={t.color}
                      className={
                        active
                          ? 'h-7 border-primary bg-secondary font-semibold text-primary'
                          : 'h-7'
                      }
                    />
                  </button>
                );
              })}
            </div>
            <div className="border-t px-3 py-2.5">
              {selected ? (
                <>
                  <p className="mb-1.5 text-sm font-semibold">
                    Tag đang chọn: {selected.name}{' '}
                    <span className="font-mono text-xs font-normal text-muted-foreground">
                      {selected.code}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                      <Link href={`/crm/customers?tags=${selected.id}`}>Xem khách mang tag</Link>
                    </Button>
                    <Can I="update" a="Customer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDialog({ tag: selected })}
                      >
                        Sửa tag
                      </Button>
                    </Can>
                    <Can I="delete" a="Customer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 border-destructive px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleting(true)}
                      >
                        Xóa tag
                      </Button>
                    </Can>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Xóa tag chỉ gỡ nhãn khỏi các khách đang mang, không xóa khách.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Chọn một tag để xem khách, sửa tên/màu hoặc xóa.
                </p>
              )}
            </div>
          </>
        )}
      </QueryState>
      {dialog ? (
        <TagDialog
          key={dialog.tag?.id ?? 'new'}
          tag={dialog.tag}
          open
          onOpenChange={(o) => !o && setDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting && selected !== null}
        onOpenChange={setDeleting}
        title={`Xóa tag ${selected?.name ?? ''}?`}
        description="Tag bị gỡ khỏi mọi khách đang mang (khách giữ nguyên). Không hoàn tác được."
        onConfirm={() => {
          const t = selected;
          if (!t) return;
          return del.mutateAsync(t.id).then(
            (res) => {
              toast.success(`Đã xóa tag ${t.name}`, {
                description: `Đã gỡ khỏi ${res.unassigned} khách`,
              });
              setSelectedId(null);
            },
            (err) => toast.error(messageFor(err)),
          );
        }}
      />
    </Card>
  );
}

export function CustomerGroupsScreen() {
  return (
    <>
      <PageHeader
        title="Nhóm khách hàng · cấp độ · tag"
        description="Nhóm để phân loại khách · cấp độ tự tính theo doanh số · tag để lọc tự do"
        breadcrumb={[
          { label: 'Khách hàng', href: '/crm/customers' },
          { label: 'Nhóm · cấp độ · tag' },
        ]}
      />

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_1.3fr_1fr]">
        <GroupsCard />
        <TiersCard />
        <TagsCard />
      </div>

      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Tách 3 khái niệm — nhóm (một-một), cấp độ (tự tính theo doanh số), tag (nhiều-nhiều, lọc tự
        do). Gán cho từng khách ở màn Sửa khách hàng hoặc hồ sơ khách.
      </p>
    </>
  );
}
