'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Plus, Star } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
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
import { useAbility } from '@/lib/permission';
import { codeSchema } from '@/lib/shared';
import {
  isOperationalWarehouse,
  useCreateWarehouse,
  useDeleteWarehouse,
  useSetDefaultWarehouse,
  useUpdateWarehouse,
  useWarehouses,
  type Warehouse,
} from '../api/use-warehouses';
import { LocationsPanel } from './locations-panel';

/**
 * G-02 Kho & vị trí — nối API thật: GET/POST/PATCH/DELETE /warehouses; chọn một kho
 * (searchParam ?wh= — luật 8, F5 giữ nguyên) mở cây vị trí bên dưới (LocationsPanel).
 * Xóa = soft delete (kho chuyển Ngừng dùng — tồn, chứng từ, vị trí giữ nguyên).
 * Kho MẶC ĐỊNH (Warehouse.isDefault, tối đa một): đơn đồng bộ từ Pancake giữ chỗ và nhận
 * kho này lúc tạo. Đặt qua ô trong form hoặc nút "Đặt mặc định" trên dòng; kho mặc định
 * không ngừng dùng được (server 422) → ẩn nút xóa, đổi kho mặc định trước.
 * Quyền: đọc cần stock.read (đã gate ở nav/route); tạo/sửa/xóa cần stock.adjust
 * → Can I="adjust" a="Stock" (backend cũng chặn 403).
 */
const PENDING_API: Array<{ title: string; need: string }> = [
  { title: 'Nhân sự kho, tồn theo ô kệ', need: 'chưa có endpoint tương ứng' },
];

/** Khớp CreateWarehouseDto / UpdateWarehouseDto (luật 11). */
const warehouseSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1, 'Nhập tên kho').max(200, 'Tối đa 200 ký tự'),
  address: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  // Điểm lấy hàng cho hãng vận chuyển — địa chỉ 2 cấp (thôn/xóm → phường/xã → tỉnh/thành),
  // tên tỉnh/xã viết như hãng (GHTK) dùng.
  contactName: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  phone: z.string().trim().max(32, 'Tối đa 32 ký tự'),
  hamlet: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  ward: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  province: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  /** Kho mặc định hệ thống — đơn Pancake tự về kho này. */
  isDefault: z.boolean(),
});
const PICKUP_FIELDS = ['contactName', 'phone', 'hamlet', 'ward', 'province'] as const;
type WarehouseValues = z.infer<typeof warehouseSchema>;

function WarehouseFormDialog({
  warehouse,
  open,
  onOpenChange,
}: {
  /** undefined = tạo mới; có = sửa (mã bị khóa). */
  warehouse?: Warehouse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = warehouse !== undefined;
  const create = useCreateWarehouse();
  const update = useUpdateWarehouse(warehouse?.id ?? '');
  const isPending = create.isPending || update.isPending;
  const form = useForm<WarehouseValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      code: warehouse?.code ?? '',
      name: warehouse?.name ?? '',
      address: warehouse?.address ?? '',
      contactName: warehouse?.contactName ?? '',
      phone: warehouse?.phone ?? '',
      hamlet: warehouse?.hamlet ?? '',
      ward: warehouse?.ward ?? '',
      province: warehouse?.province ?? '',
      isDefault: warehouse?.isDefault ?? false,
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    const done = (msg: string) => {
      toast.success(msg);
      form.reset();
      onOpenChange(false);
    };
    const fail = (err: unknown) =>
      applyServerErrors(form, err as ApiError, {
        knownFields: ['code', 'name', 'address', 'isDefault', ...PICKUP_FIELDS],
      });
    if (editing) {
      // PATCH: chỉ gửi trường điểm lấy ĐÃ ĐỔI; chuỗi rỗng → null để XÓA được trường khai sai.
      const pickup = Object.fromEntries(
        PICKUP_FIELDS.filter((k) => (v[k] || null) !== (warehouse[k] ?? null)).map((k) => [
          k,
          v[k] || null,
        ]),
      );
      update.mutate(
        {
          name: v.name,
          ...(v.address ? { address: v.address } : {}),
          ...pickup,
          // Cờ mặc định chỉ gửi khi ĐỔI — gửi false không đổi gì, gửi true = chuyển cờ từ kho cũ.
          ...(v.isDefault !== warehouse.isDefault ? { isDefault: v.isDefault } : {}),
        },
        { onSuccess: () => done('Đã lưu thay đổi'), onError: fail },
      );
    } else {
      const pickup = Object.fromEntries(PICKUP_FIELDS.filter((k) => v[k]).map((k) => [k, v[k]]));
      create.mutate(
        {
          code: v.code,
          name: v.name,
          ...(v.address ? { address: v.address } : {}),
          ...pickup,
          ...(v.isDefault ? { isDefault: true } : {}),
        },
        { onSuccess: () => done('Đã thêm kho'), onError: fail },
      );
    }
  });

  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Sửa kho ${warehouse.code}` : 'Thêm kho'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Đổi tên / địa chỉ áp dụng ngay sau khi lưu.'
              : 'Tạo kho xong thêm vị trí (zone/aisle/bin) để nhập hàng.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã kho</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="WH-HN-2"
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên kho</FormLabel>
                  <FormControl>
                    <Input autoFocus={editing} placeholder="Kho Hà Nội 2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số nhà, đường</FormLabel>
                  <FormControl>
                    <Input placeholder="Số 5 KCN Quang Minh" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['hamlet', 'Thôn/xóm', 'Khu phố 3'],
                  ['ward', 'Phường/xã', 'Phường Tân Tạo A'],
                  ['province', 'Tỉnh/thành', 'Hồ Chí Minh'],
                ] as const
              ).map(([name, label, placeholder]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Input placeholder={placeholder} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Người liên hệ lấy hàng</FormLabel>
                    <FormControl>
                      <Input placeholder="Anh Nam (thủ kho)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SĐT lấy hàng</FormLabel>
                    <FormControl>
                      <Input inputMode="tel" placeholder="0900000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Điểm lấy hàng gửi hãng vận chuyển (GHTK…): tên tỉnh/thành và phường/xã viết đúng như
              hãng dùng, thôn/xóm nếu có. Thiếu tỉnh/thành hoặc SĐT thì đơn từ kho này dùng điểm lấy
              mặc định của server.
            </p>
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 rounded-md border px-3 py-2">
                  <FormControl className="mt-0.5">
                    <Checkbox
                      checked={field.value}
                      disabled={editing && !isOperationalWarehouse(warehouse)}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="space-y-0.5 leading-none">
                    <FormLabel>Kho mặc định hệ thống</FormLabel>
                    <FormDescription>
                      Đơn đồng bộ từ Pancake giữ hàng và lấy hàng ở kho này. Chỉ một kho là mặc định
                      — bật ở đây sẽ bỏ cờ của kho đang mặc định.
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm kho'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function WarehousesScreen() {
  const query = useWarehouses();
  const del = useDeleteWarehouse();
  const setDefault = useSetDefaultWarehouse();
  const ability = useAbility();
  const canAdjust = ability.can('adjust', 'Stock');
  const [dialog, setDialog] = useState<{ open: boolean; warehouse?: Warehouse }>({ open: false });
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selectedId = search.get('wh');
  const selected = query.data?.find((w) => w.id === selectedId);
  const selectWarehouse = (id: string) => {
    const params = new URLSearchParams(search);
    if (id === selectedId) params.delete('wh');
    else params.set('wh', id);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Kho & vị trí"
        description={query.data ? `${query.data.length} kho` : 'Đang tải…'}
        breadcrumb={[{ label: 'Kho' }, { label: 'Kho & vị trí' }]}
        actions={
          canAdjust ? (
            <Button size="sm" onClick={() => setDialog({ open: true })}>
              <Plus aria-hidden />
              Thêm kho
            </Button>
          ) : undefined
        }
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={4} columns={5} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="Chưa có kho nào"
            description="Tạo kho đầu tiên rồi thêm vị trí để bắt đầu nhập hàng."
            action={
              canAdjust ? (
                <Button onClick={() => setDialog({ open: true })}>
                  <Plus aria-hidden />
                  Thêm kho
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(warehouses) => (
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-32 px-2.5 text-xs">Mã kho</TableHead>
                    <TableHead className="px-2.5 text-xs">Tên kho</TableHead>
                    <TableHead className="px-2.5 text-xs">Địa chỉ</TableHead>
                    <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
                    <TableHead className="w-44 px-2.5 text-xs">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.map((w) => (
                    <TableRow
                      key={w.id}
                      className="cursor-pointer"
                      data-state={w.id === selectedId ? 'selected' : undefined}
                      onClick={() => selectWarehouse(w.id)}
                    >
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{w.code}</TableCell>
                      <TableCell className="px-2.5 py-1.5 font-semibold">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {w.name}
                          {w.isDefault ? (
                            <StatusBadge tone="brand" className="font-medium">
                              <Star className="h-3 w-3" aria-hidden />
                              Mặc định
                            </StatusBadge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                        {[w.address, w.hamlet, w.ward, w.province].filter(Boolean).join(', ') ||
                          '—'}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {w.isActive ? (
                          <StatusBadge tone="ok">Đang dùng</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Ngừng dùng</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {canAdjust ? (
                          <div className="flex items-center justify-end gap-1">
                            {!w.isDefault && isOperationalWarehouse(w) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={setDefault.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDefault
                                    .mutateAsync(w.id)
                                    .then(() => toast.success(`Đã đặt ${w.code} làm kho mặc định`))
                                    .catch((err) => toast.error(messageFor(err)));
                                }}
                              >
                                <Star aria-hidden />
                                Đặt mặc định
                              </Button>
                            ) : null}
                            <RowActions
                              onEdit={() => setDialog({ open: true, warehouse: w })}
                              // Kho mặc định không ngừng dùng được — đặt kho khác làm mặc định trước.
                              onDelete={
                                w.isDefault
                                  ? undefined
                                  : () =>
                                      del
                                        .mutateAsync(w.id)
                                        .then(() => toast.success(`Đã ngừng dùng kho ${w.code}`))
                                        .catch((err) => toast.error(messageFor(err)))
                              }
                              itemName={`kho ${w.code}`}
                              deleteDescription="Kho chuyển Ngừng dùng — tồn kho, vị trí và chứng từ giữ nguyên."
                            />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </QueryState>

      {selected ? (
        <LocationsPanel warehouse={selected} canAdjust={canAdjust} />
      ) : query.data && query.data.length > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Chọn một kho trong bảng để xem và quản lý vị trí (khu / dãy / kệ / ô kệ).
        </p>
      ) : null}

      <section className="mt-3 rounded-md border bg-card">
        <header className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-semibold">
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          Bổ sung khi API sẵn sàng
        </header>
        <ul className="flex flex-col gap-1.5 px-3 py-2 text-sm">
          {PENDING_API.map((m) => (
            <li key={m.title}>
              <span className="font-medium">{m.title}</span>{' '}
              <span className="text-xs text-muted-foreground">— {m.need}</span>
            </li>
          ))}
        </ul>
      </section>

      {dialog.open ? (
        <WarehouseFormDialog
          key={dialog.warehouse?.id ?? 'new'}
          warehouse={dialog.warehouse}
          open={dialog.open}
          onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        />
      ) : null}
    </>
  );
}
