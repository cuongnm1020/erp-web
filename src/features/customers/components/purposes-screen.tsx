'use client';

import { Merge, Plus, Sprout } from 'lucide-react';
import { useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { SearchableSelect } from '@/components/data/searchable-select';
import { EmptyState, ForbiddenState, ListSkeleton, QueryState } from '@/components/data/states';
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
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { groupVi } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import {
  useCreatePurpose,
  useDeletePurpose,
  useMergePurpose,
  usePurposes,
  useUpdatePurpose,
  type Purpose,
} from '../api/use-care';

type Editing = { kind: 'create' } | { kind: 'rename'; purpose: Purpose } | null;

/** Thêm / đổi tên — một ô tên. */
function NameDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const create = useCreatePurpose();
  const update = useUpdatePurpose();
  const [name, setName] = useState(editing?.kind === 'rename' ? editing.purpose.name : '');
  const pending = create.isPending || update.isPending;
  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !editing) return;
    try {
      if (editing.kind === 'create') {
        const r = await create.mutateAsync(trimmed);
        toast.success(r.created ? 'Đã thêm mục đích' : `Đã có “${r.purpose.name}”, không tạo thêm`);
      } else {
        await update.mutateAsync({ id: editing.purpose.id, name: trimmed });
        toast.success('Đã lưu thay đổi');
      }
      onClose();
    } catch (e) {
      toast.error(messageFor(e));
    }
  };
  return (
    <Dialog open={!!editing} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing?.kind === 'rename' ? `Đổi tên ${editing.purpose.name}` : 'Thêm mục đích'}
          </DialogTitle>
          <DialogDescription>
            Tên cây trồng / mục đích khách dùng sản phẩm, ví dụ “Sầu riêng”. Trùng tên không dấu với
            mục đích đã có thì không tạo thêm.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Label htmlFor="purpose-name">Tên mục đích</Label>
          <Input
            id="purpose-name"
            value={name}
            maxLength={60}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <DialogFooter className="mt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={!name.trim()} loading={pending}>
              {editing?.kind === 'rename' ? 'Lưu thay đổi' : 'Thêm mục đích'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Gộp mục đích trùng / gõ sai vào mục đích giữ lại. */
function MergeDialog({
  source,
  all,
  onClose,
}: {
  source: Purpose | null;
  all: readonly Purpose[];
  onClose: () => void;
}) {
  const merge = useMergePurpose();
  const [intoId, setIntoId] = useState<string | undefined>();
  const into = all.find((p) => p.id === intoId);
  return (
    <Dialog open={!!source} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gộp “{source?.name}” vào mục đích khác</DialogTitle>
          <DialogDescription>
            {groupVi(String(source?.customerCount ?? 0))} khách đang gắn “{source?.name}” chuyển
            sang mục đích được chọn (giữ người gắn, ngày gắn). “{source?.name}” bị xóa khỏi danh mục
            — không hoàn tác được.
          </DialogDescription>
        </DialogHeader>
        <SearchableSelect
          label="Gộp vào"
          value={intoId}
          options={all
            .filter((p) => p.id !== source?.id)
            .map((p) => ({ value: p.id, label: p.name }))}
          onChange={setIntoId}
          className="w-full"
        />
        <DialogFooter className="mt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            disabled={!into}
            loading={merge.isPending}
            onClick={() =>
              source &&
              into &&
              merge.mutate(
                { id: source.id, intoId: into.id },
                {
                  onSuccess: () => {
                    toast.success(`Đã gộp vào “${into.name}”`);
                    onClose();
                  },
                  onError: (e) => toast.error(messageFor(e)),
                },
              )
            }
          >
            Gộp mục đích
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Danh mục mục đích sử dụng (biên bản CSKH 2026-10-26) — Admin + Trưởng phòng CSKH
 * (`customer.purpose_manage`) đổi tên, gộp mục đích trùng / gõ sai, xóa. Nhân viên tạo + gắn mục
 * đích ở màn Tạo đơn / hồ sơ khách. Danh mục nhỏ → một trang, không phân trang.
 */
export function PurposesScreen() {
  const canManage = useAbility().can('purpose_manage', 'Customer');
  const query = usePurposes();
  const del = useDeletePurpose();
  const [editing, setEditing] = useState<Editing>(null);
  const [merging, setMerging] = useState<Purpose | null>(null);

  const columns: ColumnDef<Purpose, unknown>[] = [
    {
      id: 'name',
      header: 'Mục đích',
      cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
    },
    {
      id: 'customerCount',
      header: 'Số khách',
      meta: { width: 120, align: 'right' },
      cell: ({ row }) => (
        <span className="tabular-nums">{groupVi(String(row.original.customerCount))}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      meta: { width: 96, align: 'right' },
      cell: ({ row }) => (
        <RowActions
          onEdit={() => setEditing({ kind: 'rename', purpose: row.original })}
          editLabel="Đổi tên"
          items={[
            {
              label: 'Gộp vào mục đích khác',
              icon: <Merge aria-hidden />,
              onSelect: () => setMerging(row.original),
            },
          ]}
          itemName={row.original.name}
          deleteLabel="Xóa mục đích"
          deleteDescription={`${groupVi(String(row.original.customerCount))} khách sẽ bị gỡ mục đích này. Không hoàn tác được — muốn giữ khách thì gộp vào mục đích khác.`}
          onDelete={() =>
            del
              .mutateAsync(row.original.id)
              .then(() => toast.success('Đã xóa mục đích'))
              .catch((e: unknown) => toast.error(messageFor(e)))
          }
        />
      ),
    },
  ];

  // Ẩn là UX (luật 7) — API vẫn chặn đổi tên / gộp / xóa với người không có quyền.
  if (!canManage) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Mục đích sử dụng"
        description="Khách dùng sản phẩm cho cây gì — nhân viên gắn khi lên đơn, CSKH lọc khách theo mục đích ở màn Khách của team."
        breadcrumb={[{ label: 'Chăm sóc khách hàng' }, { label: 'Mục đích sử dụng' }]}
        actions={
          <Button onClick={() => setEditing({ kind: 'create' })}>
            <Plus aria-hidden />
            Thêm mục đích
          </Button>
        }
      />
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={3} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={Sprout}
            title="Chưa có mục đích nào"
            description="Thêm mục đích đầu tiên, hoặc để nhân viên tạo ngay khi lên đơn."
            action={<Button onClick={() => setEditing({ kind: 'create' })}>Thêm mục đích</Button>}
          />
        }
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data}
            getRowId={(r) => r.id}
            total={data.length}
            page={1}
            size={Math.max(data.length, 1)}
            sort={null}
            onPageChange={() => undefined}
            onSizeChange={() => undefined}
            onSortChange={() => undefined}
          />
        )}
      </QueryState>
      {editing ? (
        <NameDialog
          key={editing.kind === 'rename' ? editing.purpose.id : 'new'}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <MergeDialog
        key={merging?.id ?? 'none'}
        source={merging}
        all={query.data ?? []}
        onClose={() => setMerging(null)}
      />
    </>
  );
}
