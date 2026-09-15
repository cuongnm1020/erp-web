'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { phoneSchema } from '@/lib/shared';
import {
  useAddCustomerAddress,
  useDeleteCustomerAddress,
  useUpdateCustomerAddress,
  type AddressInput,
  type CustomerAddress,
  type UpdateAddressInput,
} from '../api/use-customers';

/**
 * Địa chỉ giao hàng của khách trên màn Sửa khách hàng — bảng + thêm / sửa / đặt mặc định / xóa.
 *
 * - Mỗi thao tác là một mutation riêng (POST / PATCH / DELETE `/customers/{id}/addresses…`),
 *   không đi qua form chính: địa chỉ lưu ngay, không chờ "Lưu thay đổi".
 * - Dialog thêm/sửa có <form> riêng. Section này nằm TRONG <form> của màn sửa khách, và React
 *   cho sự kiện nổi qua portal → submit của dialog phải `stopPropagation()` kẻo kích hoạt
 *   handleSubmit của form khách (luật: mọi nút trong section là `type="button"`).
 * - Xóa: API trả 409 `ADDRESS_IN_USE` khi còn đơn chưa hoàn tất trỏ vào địa chỉ — hộp xác nhận
 *   giữ mở và nói rõ, không nuốt lỗi thành "đã xóa".
 * - Mặc định do server chọn (`isDefault: true` hạ các địa chỉ khác) → không optimistic (luật 5).
 */

const addressSchema = z.object({
  label: z.string().trim().max(50, 'Tối đa 50 ký tự'),
  recipient: z.string().trim().min(1, 'Nhập người nhận').max(200),
  phone: phoneSchema,
  line1: z.string().trim().min(1, 'Nhập địa chỉ').max(300),
  // Địa chỉ 2 cấp: thôn/xóm → phường/xã → tỉnh/thành (không còn quận/huyện).
  hamlet: z.string().trim().max(100),
  ward: z.string().trim().max(100),
  province: z.string().trim().min(1, 'Nhập tỉnh/thành').max(100),
  isDefault: z.boolean(),
});
type AddressValues = z.infer<typeof addressSchema>;

const ADDRESS_FIELDS = [
  'label',
  'recipient',
  'phone',
  'line1',
  'hamlet',
  'ward',
  'province',
  'isDefault',
] as const;

function toValues(a?: CustomerAddress): AddressValues {
  return {
    label: a?.label ?? '',
    recipient: a?.recipient ?? '',
    phone: a?.phone ?? '',
    line1: a?.line1 ?? '',
    hamlet: a?.hamlet ?? '',
    ward: a?.ward ?? '',
    province: a?.province ?? '',
    isDefault: a?.isDefault ?? false,
  };
}

/** POST: field tùy chọn để trống thì BỎ, không gửi chuỗi rỗng. */
export function toAddAddressBody(v: AddressValues): AddressInput {
  return {
    ...(v.label ? { label: v.label } : {}),
    recipient: v.recipient,
    phone: v.phone,
    line1: v.line1,
    ...(v.hamlet ? { hamlet: v.hamlet } : {}),
    ...(v.ward ? { ward: v.ward } : {}),
    province: v.province,
    isDefault: v.isDefault,
  };
}

/** PATCH: chỉ field đã đổi (chuỗi rỗng gửi nguyên — người dùng cố ý xóa nhãn/thôn/phường). */
export function toUpdateAddressBody(
  v: AddressValues,
  dirty: Partial<Record<keyof AddressValues, unknown>>,
): UpdateAddressInput {
  const body: UpdateAddressInput = {};
  for (const k of ADDRESS_FIELDS) {
    if (!dirty[k]) continue;
    if (k === 'isDefault') body.isDefault = v.isDefault;
    else body[k] = v[k];
  }
  return body;
}

export function formatAddress(a: Pick<CustomerAddress, 'line1' | 'hamlet' | 'ward' | 'province'>) {
  return [a.line1, a.hamlet, a.ward, a.province].filter(Boolean).join(', ');
}

/** 409 CONFLICT với `details.code = ADDRESS_IN_USE` → số đơn chưa hoàn tất đang giữ địa chỉ; khác → null. */
export function addressInUse(err: unknown): number | null {
  if (!(err instanceof ApiError) || !err.isConflict) return null;
  const d = err.details as { code?: unknown; openOrders?: unknown } | null | undefined;
  if (d?.code !== 'ADDRESS_IN_USE') return null;
  return typeof d.openOrders === 'number' ? d.openOrders : 1;
}

function AddressDialog({
  customerId,
  address,
  open,
  onOpenChange,
}: {
  customerId: string;
  /** Có → sửa; không → thêm. */
  address?: CustomerAddress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = address !== undefined;
  const add = useAddCustomerAddress(customerId);
  const update = useUpdateCustomerAddress(customerId);
  const isPending = add.isPending || update.isPending;
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: toValues(address),
  });

  const submit = form.handleSubmit((v) => {
    const onError = (err: unknown) =>
      applyServerErrors(form, err as ApiError, { knownFields: [...ADDRESS_FIELDS] });
    if (!editing) {
      add.mutate(toAddAddressBody(v), {
        onSuccess: () => {
          toast.success('Đã thêm địa chỉ');
          onOpenChange(false);
        },
        onError,
      });
      return;
    }
    const body = toUpdateAddressBody(v, form.formState.dirtyFields);
    if (Object.keys(body).length === 0) {
      toast.info('Chưa có thay đổi nào để lưu');
      return;
    }
    update.mutate(
      { addressId: address.id, body },
      {
        onSuccess: () => {
          toast.success('Đã lưu địa chỉ');
          onOpenChange(false);
        },
        onError,
      },
    );
  });
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Section nằm trong <form> của màn Sửa khách hàng — không để submit nổi lên đó.
    e.stopPropagation();
    void submit(e);
  };
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</DialogTitle>
          <DialogDescription>
            Địa chỉ giao hàng của khách — dùng khi lên đơn và cấp vận đơn.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhãn</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhà riêng / Cửa hàng" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Người nhận</FormLabel>
                    <FormControl>
                      <Input placeholder="Nguyễn Thị Thu Hà" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>SĐT người nhận</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="tel"
                      className="font-mono"
                      placeholder="0903112233"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Địa chỉ</FormLabel>
                  <FormControl>
                    <Input placeholder="Số nhà, đường" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Địa chỉ 2 cấp: thôn/xóm → phường/xã → tỉnh/thành. */}
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="hamlet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thôn / xóm</FormLabel>
                    <FormControl>
                      <Input placeholder="Khu phố 3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ward"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phường / xã</FormLabel>
                    <FormControl>
                      <Input placeholder="Phường Hai Bà Trưng" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Tỉnh / thành</FormLabel>
                    <FormControl>
                      <Input placeholder="Hà Nội" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Đặt làm địa chỉ mặc định</FormLabel>
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
                {isPending ? 'Đang lưu…' : editing ? 'Lưu địa chỉ' : 'Thêm địa chỉ'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAddressDialog({
  customerId,
  address,
  onOpenChange,
}: {
  customerId: string;
  address: CustomerAddress;
  onOpenChange: (open: boolean) => void;
}) {
  const del = useDeleteCustomerAddress(customerId);
  const [error, setError] = useState<string | null>(null);
  const confirm = () => {
    setError(null);
    del.mutate(address.id, {
      onSuccess: () => {
        toast.success('Đã xóa địa chỉ');
        onOpenChange(false);
      },
      onError: (err) => {
        // 409 ADDRESS_IN_USE (details.openOrders) → câu riêng dựng ở client (luật 6: không render
        // serverMessage); lỗi khác → messageFor().
        const inUse = addressInUse(err);
        setError(
          inUse !== null
            ? `Địa chỉ đang dùng trên ${inUse} đơn chưa hoàn tất — đổi địa chỉ giao trên đơn hoặc sửa địa chỉ này thay vì xóa.`
            : messageFor(err),
        );
      },
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !del.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Xóa địa chỉ này?</DialogTitle>
          <DialogDescription>
            {formatAddress(address)} — xóa hẳn, không hoàn tác. Đơn chưa hoàn tất đang giao tới địa
            chỉ này sẽ chặn thao tác.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={del.isPending}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button type="button" variant="destructive" disabled={del.isPending} onClick={confirm}>
            {del.isPending ? 'Đang xóa…' : 'Xóa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerAddressSection({
  customerId,
  addresses,
  canUpdate,
}: {
  customerId: string;
  addresses: CustomerAddress[];
  canUpdate: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const setDefault = useUpdateCustomerAddress(customerId);

  const editing = addresses.find((a) => a.id === editingId);
  const deleting = addresses.find((a) => a.id === deletingId);

  const makeDefault = (a: CustomerAddress) =>
    setDefault.mutate(
      { addressId: a.id, body: { isDefault: true } },
      {
        onSuccess: () => toast.success('Đã đặt địa chỉ mặc định'),
        onError: (err) => toast.error(messageFor(err)),
      },
    );

  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Địa chỉ giao hàng</span>
        {canUpdate ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Thêm địa chỉ
          </Button>
        ) : null}
      </header>
      {addresses.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          Chưa có địa chỉ nào — thêm địa chỉ giao hàng để lên đơn và cấp vận đơn nhanh hơn.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-24 px-2.5 text-xs">Nhãn</TableHead>
              <TableHead className="w-36 px-2.5 text-xs">Người nhận</TableHead>
              <TableHead className="px-2.5 text-xs">Địa chỉ</TableHead>
              <TableHead className="w-44 px-2.5 text-xs">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {addresses.map((a) => (
              <TableRow key={a.id} data-testid={`address-${a.id}`}>
                <TableCell className="px-2.5 py-1.5 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span>{a.label ?? '—'}</span>
                    {a.isDefault ? <StatusBadge tone="brand">Mặc định</StatusBadge> : null}
                  </div>
                </TableCell>
                <TableCell className="px-2.5 py-1.5 align-top">
                  <div className="flex flex-col">
                    <span>{a.recipient}</span>
                    <span className="font-mono text-xs text-muted-foreground">{a.phone}</span>
                  </div>
                </TableCell>
                <TableCell className="px-2.5 py-1.5 align-top text-muted-foreground">
                  {formatAddress(a)}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 align-top">
                  {canUpdate ? (
                    <div className="flex justify-end gap-1">
                      {!a.isDefault ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={setDefault.isPending}
                          onClick={() => makeDefault(a)}
                          aria-label={`Đặt mặc định ${a.recipient}`}
                        >
                          <Star aria-hidden /> Mặc định
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(a.id)}
                        aria-label={`Sửa địa chỉ ${a.recipient}`}
                      >
                        <Pencil aria-hidden /> Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeletingId(a.id)}
                        aria-label={`Xóa địa chỉ ${a.recipient}`}
                      >
                        <Trash2 aria-hidden /> Xóa
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {adding ? (
        <AddressDialog customerId={customerId} open={adding} onOpenChange={setAdding} />
      ) : null}
      {editing ? (
        <AddressDialog
          key={editing.id}
          customerId={customerId}
          address={editing}
          open
          onOpenChange={(o) => !o && setEditingId(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteAddressDialog
          customerId={customerId}
          address={deleting}
          onOpenChange={(o) => !o && setDeletingId(null)}
        />
      ) : null}
    </section>
  );
}
