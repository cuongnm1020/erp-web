'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { isApiError } from '@/lib/api/errors';
import {
  useRegisterPdaDevice,
  useUpdatePdaDevice,
  type AdminWarehouse,
  type PdaDevice,
} from '../api/use-pda-devices';
import { pdaDeviceFormSchema, type PdaDeviceFormValues } from '../schema';
import { DEVICE_STATUS } from './pda-device-status';

const NONE = '__none__';

/** 409 UNIQUE_VIOLATION: Prisma trả `details.target` = cột bị trùng → báo đúng ô. */
function duplicateField(err: unknown): 'code' | 'serialNumber' | null {
  if (!isApiError(err) || err.code !== 'UNIQUE_VIOLATION') return null;
  const target = (err.details as { target?: unknown } | null)?.target;
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  if (text.includes('serialNumber')) return 'serialNumber';
  if (text.includes('code')) return 'code';
  return null;
}

/**
 * Đăng ký / sửa thiết bị PDA — POST /devices, PATCH /devices/{id}.
 * Mã máy = mã nhân viên kho nhập ở màn đăng nhập PDA; serial phải khớp máy thật
 * (máy báo serial trong thông báo "chưa được đăng ký").
 */
export function PdaDeviceDialog({
  open,
  onOpenChange,
  device,
  warehouses,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Có = sửa; không = đăng ký mới. */
  device?: PdaDevice;
  warehouses: AdminWarehouse[];
  /** Nhân viên đang hoạt động — chọn để khóa máy. */
  users: Array<{ id: string; code: string; fullName: string }>;
}) {
  const editing = device !== undefined;
  const create = useRegisterPdaDevice();
  const update = useUpdatePdaDevice(device?.id ?? '');
  const pending = create.isPending || update.isPending;

  const form = useForm<PdaDeviceFormValues>({
    resolver: zodResolver(pdaDeviceFormSchema),
    defaultValues: {
      code: device?.code ?? '',
      serialNumber: device?.serialNumber ?? '',
      model: device?.model ?? '',
      warehouseId: device?.warehouseId ?? '',
      boundUserId: device?.boundUserId ?? '',
      status: device?.status ?? 'ACTIVE',
    },
  });

  // Nhân viên đang khóa vào máy có thể đã nghỉ (không còn trong danh sách đang hoạt động).
  const userOptions =
    device?.boundUser && !users.some((u) => u.id === device.boundUserId)
      ? [...users, device.boundUser]
      : users;

  const onSubmit = form.handleSubmit((v) => {
    const onError = (err: unknown) => {
      const dup = duplicateField(err);
      if (dup) {
        form.setError(dup, {
          type: 'server',
          message: dup === 'code' ? 'Mã máy đã được dùng' : 'Serial này đã đăng ký cho máy khác',
        });
        form.setFocus(dup);
        return;
      }
      applyServerErrors(form, err, {
        knownFields: ['code', 'serialNumber', 'model', 'warehouseId', 'boundUserId', 'status'],
      });
    };
    if (editing) {
      update.mutate(
        {
          code: v.code,
          serialNumber: v.serialNumber,
          model: v.model || null,
          warehouseId: v.warehouseId || null,
          boundUserId: v.boundUserId || null,
          status: v.status,
        },
        {
          onSuccess: () => {
            toast.success('Đã lưu thay đổi', { description: `Thiết bị ${v.code}` });
            onOpenChange(false);
          },
          onError,
        },
      );
      return;
    }
    create.mutate(
      {
        code: v.code,
        serialNumber: v.serialNumber,
        status: v.status,
        ...(v.model ? { model: v.model } : {}),
        ...(v.warehouseId ? { warehouseId: v.warehouseId } : {}),
        ...(v.boundUserId ? { boundUserId: v.boundUserId } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Đã đăng ký thiết bị', {
            description: `Nhập mã ${v.code} ở màn đăng nhập PDA`,
          });
          form.reset();
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
          <DialogTitle>{editing ? `Sửa thiết bị ${device.code}` : 'Đăng ký thiết bị'}</DialogTitle>
          <DialogDescription>
            Máy chỉ đăng nhập được khi mã máy, serial khớp và trạng thái là Đang dùng.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Mã máy</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus placeholder="vd: PM84-01" className="font-mono" />
                    </FormControl>
                    <FormDescription>Nhân viên nhập mã này khi đăng nhập PDA</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Serial</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="vd: 26023A0102" className="font-mono" />
                    </FormControl>
                    <FormDescription>
                      Xem trên máy: thông báo &quot;chưa được đăng ký&quot;
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên / model</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="vd: PM84" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kho</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Kho">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>— Mọi kho —</SelectItem>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} · {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Máy gán kho chỉ nhận việc của kho đó</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="boundUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Khóa cho nhân viên</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Khóa cho nhân viên">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>— Ai cũng đăng nhập được —</SelectItem>
                      {userOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.fullName} · {u.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Trạng thái</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Trạng thái">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(DEVICE_STATUS) as Array<keyof typeof DEVICE_STATUS>).map(
                        (s) => (
                          <SelectItem key={s} value={s}>
                            {DEVICE_STATUS[s].label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={pending}>
                {editing ? 'Lưu thay đổi' : 'Đăng ký thiết bị'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
