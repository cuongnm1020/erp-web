'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import type { CustomerTagRef } from '../api/use-customers';
import {
  useAssignCustomerTags,
  useCustomerGroups,
  useCustomerTags,
  useCustomerTiers,
  useSetCustomerSegment,
  useUnassignCustomerTag,
  type CustomerTag,
} from '../api/use-segments';
import { TagChip } from './tag-chip';

const NONE = '__none__';

/**
 * Gắn nhóm / cấp độ / tag cho khách (CRM-04).
 * - `SegmentSelects` / `TagPicker` là phần trình bày, không gọi API ghi.
 * - `CustomerSegmentEditor` / `CustomerTagsEditor` nối thẳng PATCH /customer-segments/:id và
 *   POST/DELETE …/tags — LƯU NGAY như phần địa chỉ (không chờ "Lưu thay đổi"). Không optimistic:
 *   chờ server trả rồi invalidate hồ sơ + danh sách.
 * Mọi nút là `type="button"` vì phần này nằm trong <form> của màn Sửa khách hàng.
 */

export function SegmentSelects({
  groupId,
  tierId,
  onGroupChange,
  onTierChange,
  disabled,
}: {
  groupId: string | null;
  tierId: string | null;
  onGroupChange: (id: string | null) => void;
  onTierChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const groups = useCustomerGroups({ includeInactive: true });
  const tiers = useCustomerTiers();
  // Nhóm đã ngừng dùng không còn để chọn mới, nhưng nhóm khách ĐANG mang vẫn phải hiện tên.
  const groupOptions = (groups.data ?? []).filter((g) => g.isActive || g.id === groupId);
  const tierOptions = [...(tiers.data ?? [])].sort((a, b) => b.sortOrder - a.sortOrder);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Nhóm khách</span>
        <Select
          value={groupId ?? NONE}
          onValueChange={(v) => onGroupChange(v === NONE ? null : v)}
          disabled={disabled || groups.isPending}
        >
          <SelectTrigger aria-label="Nhóm khách">
            <SelectValue placeholder={groups.isPending ? 'Đang tải…' : 'Chọn nhóm'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Chưa xếp nhóm</SelectItem>
            {groupOptions.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.isActive ? g.name : `${g.name} (ngừng dùng)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {groups.isError ? (
          <p className="text-xs text-destructive">{messageFor(groups.error)}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Cấp độ</span>
        <Select
          value={tierId ?? NONE}
          onValueChange={(v) => onTierChange(v === NONE ? null : v)}
          disabled={disabled || tiers.isPending}
        >
          <SelectTrigger aria-label="Cấp độ">
            <SelectValue placeholder={tiers.isPending ? 'Đang tải…' : 'Chọn cấp độ'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Chưa xếp cấp độ</SelectItem>
            {tierOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Job nâng hạng có thể đổi cấp theo doanh số</p>
        {tiers.isError ? (
          <p className="text-xs text-destructive">{messageFor(tiers.error)}</p>
        ) : null}
      </div>
    </>
  );
}

export function TagPicker({
  selected,
  onAdd,
  onRemove,
  disabled,
}: {
  selected: CustomerTagRef[];
  onAdd?: (tag: CustomerTag) => void;
  onRemove?: (tagId: string) => void;
  disabled?: boolean;
}) {
  const tags = useCustomerTags();
  const assigned = new Set(selected.map((t) => t.id));
  const available = (tags.data ?? []).filter((t) => !assigned.has(t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.length === 0 ? (
        <span className="text-sm text-muted-foreground">Chưa gắn tag</span>
      ) : (
        selected.map((t) => (
          <TagChip
            key={t.id}
            name={t.name}
            color={t.color}
            onRemove={onRemove && !disabled ? () => onRemove(t.id) : undefined}
          />
        ))
      )}
      {onAdd ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-1.5 text-xs"
              disabled={disabled}
            >
              <Plus aria-hidden />
              Gắn tag
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
            {tags.isPending ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Đang tải tag…</p>
            ) : tags.isError ? (
              <p className="px-2 py-1.5 text-xs text-destructive">{messageFor(tags.error)}</p>
            ) : available.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {(tags.data ?? []).length === 0
                  ? 'Chưa có tag nào — tạo ở màn Nhóm · cấp độ · tag.'
                  : 'Đã gắn hết các tag.'}
              </p>
            ) : (
              <ul className="max-h-60 overflow-auto" aria-label="Tag có thể gắn">
                {available.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onAdd(t)}
                      className="flex w-full items-center rounded-sm px-2 py-1 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <TagChip
                        name={t.name}
                        color={t.color}
                        className="border-0 bg-transparent px-0"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

/** Nhóm + cấp của một khách đã có — đổi là PATCH /customer-segments/:id ngay. */
export function CustomerSegmentEditor({
  customerId,
  groupId,
  tierId,
  canUpdate,
}: {
  customerId: string;
  groupId: string | null;
  tierId: string | null;
  canUpdate: boolean;
}) {
  const setSegment = useSetCustomerSegment();
  const save = (patch: { groupId?: string | null; tierId?: string | null }, ok: string) =>
    setSegment.mutate(
      { customerId, ...patch },
      {
        onSuccess: () => toast.success(ok),
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  return (
    <SegmentSelects
      groupId={groupId}
      tierId={tierId}
      disabled={!canUpdate || setSegment.isPending}
      onGroupChange={(id) => save({ groupId: id }, 'Đã lưu nhóm khách')}
      onTierChange={(id) => save({ tierId: id }, 'Đã lưu cấp độ')}
    />
  );
}

/** Tag của một khách đã có — gắn / gỡ ngay qua /customer-segments/:id/tags. */
export function CustomerTagsEditor({
  customerId,
  tags,
  canUpdate,
}: {
  customerId: string;
  tags: CustomerTagRef[];
  canUpdate: boolean;
}) {
  const assign = useAssignCustomerTags();
  const unassign = useUnassignCustomerTag();
  const pending = assign.isPending || unassign.isPending;
  return (
    <TagPicker
      selected={tags}
      disabled={pending}
      onAdd={
        canUpdate
          ? (tag) =>
              assign.mutate(
                { customerId, tagIds: [tag.id] },
                {
                  onSuccess: () => toast.success('Đã gắn tag'),
                  onError: (err) => toast.error(messageFor(err)),
                },
              )
          : undefined
      }
      onRemove={
        canUpdate
          ? (tagId) =>
              unassign.mutate(
                { customerId, tagId },
                {
                  onSuccess: () => toast.success('Đã gỡ tag'),
                  onError: (err) => toast.error(messageFor(err)),
                },
              )
          : undefined
      }
    />
  );
}
