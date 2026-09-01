'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { codeSchema } from '@/lib/shared';
import {
  useCreateLocation,
  useDeleteLocation,
  useLocationTree,
  useUpdateLocation,
  type LocationNode,
  type LocationType,
} from '../api/use-locations';
import type { Warehouse } from '../api/use-warehouses';

/** Nhãn tiếng Việt cho LocationType — giữ đúng thứ tự từ khu lớn xuống ô nhỏ. */
const TYPE_LABEL: Record<LocationType, string> = {
  ZONE: 'Khu',
  AISLE: 'Dãy',
  RACK: 'Kệ',
  BIN: 'Ô kệ',
  STAGING: 'Tập kết',
  DOCK: 'Cửa kho',
};
const TYPE_OPTIONS = Object.keys(TYPE_LABEL) as LocationType[];

/** Khớp CreateLocationDto / UpdateLocationDto (luật 11). pickSequence nhập dạng chuỗi số. */
const locationSchema = z.object({
  code: codeSchema,
  type: z.enum(['ZONE', 'AISLE', 'RACK', 'BIN', 'STAGING', 'DOCK']),
  barcode: z.string().trim().max(64, 'Tối đa 64 ký tự'),
  pickSequence: z.string().trim().regex(/^\d*$/, 'Nhập số nguyên không âm'),
  isPickable: z.boolean(),
  isActive: z.boolean(),
});
type LocationValues = z.infer<typeof locationSchema>;

type DialogState =
  { mode: 'create'; parent: LocationNode | null } | { mode: 'edit'; location: LocationNode };

function LocationFormDialog({
  warehouse,
  state,
  onClose,
}: {
  warehouse: Warehouse;
  state: DialogState;
  onClose: () => void;
}) {
  const editing = state.mode === 'edit';
  const location = editing ? state.location : undefined;
  const parent = state.mode === 'create' ? state.parent : undefined;
  const create = useCreateLocation(warehouse.id);
  const update = useUpdateLocation(warehouse.id);
  const isPending = create.isPending || update.isPending;
  const form = useForm<LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      code: location?.code ?? '',
      type: location?.type ?? (parent ? 'BIN' : 'ZONE'),
      barcode: location?.barcode ?? '',
      pickSequence: location?.pickSequence != null ? String(location.pickSequence) : '',
      isPickable: location?.isPickable ?? true,
      isActive: location?.isActive ?? true,
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    const done = (msg: string) => {
      toast.success(msg);
      onClose();
    };
    const fail = (err: unknown) =>
      applyServerErrors(form, err as ApiError, {
        knownFields: ['code', 'type', 'barcode', 'pickSequence'],
      });
    const pickSequence = v.pickSequence === '' ? undefined : Number(v.pickSequence);
    if (editing && location) {
      update.mutate(
        {
          id: location.id,
          input: {
            ...(v.barcode ? { barcode: v.barcode } : {}),
            ...(pickSequence !== undefined ? { pickSequence } : {}),
            isPickable: v.isPickable,
            isActive: v.isActive,
          },
        },
        { onSuccess: () => done('Đã lưu thay đổi'), onError: fail },
      );
    } else {
      create.mutate(
        {
          code: v.code,
          type: v.type,
          ...(parent ? { parentId: parent.id } : {}),
          ...(v.barcode ? { barcode: v.barcode } : {}),
          ...(pickSequence !== undefined ? { pickSequence } : {}),
          isPickable: v.isPickable,
        },
        { onSuccess: () => done('Đã thêm vị trí'), onError: fail },
      );
    }
  });

  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open onOpenChange={(o) => !isPending && !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Sửa vị trí ${location?.code}` : 'Thêm vị trí'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Mã và loại vị trí không đổi được sau khi tạo.'
              : parent
                ? `Vị trí con của ${TYPE_LABEL[parent.type].toLowerCase()} ${parent.code} — kho ${warehouse.code}.`
                : `Vị trí gốc trong kho ${warehouse.code}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã vị trí</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="A01-05"
                        className="font-mono"
                        disabled={editing}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={editing}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="LOC-A01-05" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pickSequence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thứ tự pick</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="isPickable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Cho phép pick hàng từ vị trí này</FormLabel>
                </FormItem>
              )}
            />
            {editing ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Đang dùng</FormLabel>
                  </FormItem>
                )}
              />
            ) : null}
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm vị trí'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Duỗi cây theo trạng thái đóng/mở — node sâu mặc định đóng để bảng không phình. */
function flatten(
  nodes: LocationNode[],
  expanded: Record<string, boolean>,
  depth = 0,
): Array<{ node: LocationNode; depth: number }> {
  const out: Array<{ node: LocationNode; depth: number }> = [];
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children.length > 0 && (expanded[node.id] ?? depth === 0)) {
      out.push(...flatten(node.children, expanded, depth + 1));
    }
  }
  return out;
}

function countNodes(nodes: LocationNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

/**
 * Cây vị trí (zone/aisle/rack/bin) của một kho — GET /warehouses/:id/locations/tree.
 * Thêm/sửa cần stock.adjust; xóa = soft delete (DELETE /warehouses/locations/:id),
 * server trả 422 khi còn vị trí con đang dùng.
 */
export function LocationsPanel({
  warehouse,
  canAdjust,
}: {
  warehouse: Warehouse;
  canAdjust: boolean;
}) {
  const query = useLocationTree(warehouse.id);
  const del = useDeleteLocation(warehouse.id);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const total = useMemo(() => (query.data ? countNodes(query.data) : 0), [query.data]);

  const toggle = (node: LocationNode, depth: number) =>
    setExpanded((e) => ({ ...e, [node.id]: !(e[node.id] ?? depth === 0) }));

  return (
    <section className="mt-3 overflow-hidden rounded-md border bg-card">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">
          Vị trí kho {warehouse.code}
          {query.data ? (
            <span className="ml-1.5 font-normal text-muted-foreground">{total} vị trí</span>
          ) : null}
        </h2>
        {canAdjust ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialog({ mode: 'create', parent: null })}
          >
            <Plus aria-hidden />
            Thêm vị trí
          </Button>
        ) : null}
      </header>

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={4} columns={5} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="Kho chưa có vị trí nào"
            description="Thêm khu (zone) trước, rồi thêm dãy / kệ / ô kệ bên trong để nhập hàng."
            action={
              canAdjust ? (
                <Button onClick={() => setDialog({ mode: 'create', parent: null })}>
                  <Plus aria-hidden />
                  Thêm vị trí
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(tree) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-2.5 text-xs">Mã vị trí</TableHead>
                  <TableHead className="w-24 px-2.5 text-xs">Loại</TableHead>
                  <TableHead className="w-36 px-2.5 text-xs">Barcode</TableHead>
                  <TableHead className="w-24 px-2.5 text-xs">Thứ tự pick</TableHead>
                  <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
                  <TableHead className="w-28 px-2.5 text-xs">
                    <span className="sr-only">Thao tác</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flatten(tree, expanded).map(({ node, depth }) => (
                  <TableRow key={node.id}>
                    <TableCell className="px-2.5 py-1.5">
                      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
                        {node.children.length > 0 ? (
                          <button
                            type="button"
                            className="rounded-sm text-muted-foreground hover:text-foreground"
                            onClick={() => toggle(node, depth)}
                            aria-label={
                              (expanded[node.id] ?? depth === 0)
                                ? `Thu gọn ${node.code}`
                                : `Mở rộng ${node.code}`
                            }
                          >
                            {(expanded[node.id] ?? depth === 0) ? (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5" aria-hidden />
                        )}
                        <span className="font-mono text-xs font-semibold">{node.code}</span>
                        {node.children.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            ({node.children.length})
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {TYPE_LABEL[node.type]}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                      {node.barcode ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {node.pickSequence ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {!node.isActive ? (
                        <StatusBadge tone="neutral">Ngừng dùng</StatusBadge>
                      ) : node.isPickable ? (
                        <StatusBadge tone="ok">Đang dùng</StatusBadge>
                      ) : (
                        <StatusBadge tone="warn">Không pick</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {canAdjust ? (
                        <div className="flex items-center justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Thêm vị trí con"
                            aria-label={`Thêm vị trí con trong ${node.code}`}
                            onClick={() => setDialog({ mode: 'create', parent: node })}
                          >
                            <Plus aria-hidden />
                          </Button>
                          <RowActions
                            onEdit={() => setDialog({ mode: 'edit', location: node })}
                            onDelete={() =>
                              del
                                .mutateAsync(node.id)
                                .then(() => toast.success(`Đã ngừng dùng vị trí ${node.code}`))
                                .catch((err) => toast.error(messageFor(err)))
                            }
                            itemName={`vị trí ${node.code}`}
                            deleteDescription="Vị trí chuyển Ngừng dùng — tồn kho và chứng từ giữ nguyên. Vị trí còn con đang dùng sẽ bị chặn."
                          />
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>

      {dialog ? (
        <LocationFormDialog
          key={dialog.mode === 'edit' ? dialog.location.id : `new-${dialog.parent?.id ?? 'root'}`}
          warehouse={warehouse}
          state={dialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
