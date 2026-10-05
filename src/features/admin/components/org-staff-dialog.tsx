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
import type { ApiError } from '@/lib/api/errors';
import type { OrgEmployee } from '../api/use-org-tree';
import { useUpdateUser } from '../api/use-users';
import { editStaffSchema, type EditStaffValues } from '../schema';

const NONE = '__none__';

/**
 * Sửa nhân sự ngay trên Sơ đồ nhân sự — PATCH /users/{id} (họ tên, email, phòng ban, đặt lại
 * mật khẩu). Chỉ mở với nhân sự `canManage` (người tạo / superadmin); server vẫn kiểm.
 * `departments`: các phòng ban người xem được chuyển tới (canAddMembers trên cây).
 */
export function OrgStaffDialog({
  employee,
  departments,
  allowUnassign,
  onOpenChange,
}: {
  employee: OrgEmployee;
  departments: { id: string; name: string; path: string }[];
  /** Có user.update → được bỏ khỏi phòng ban. */
  allowUnassign: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateUser(employee.id);
  const form = useForm<EditStaffValues>({
    resolver: zodResolver(editStaffSchema),
    defaultValues: {
      fullName: employee.fullName,
      email: employee.email,
      departmentId: employee.departmentId ?? '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    update.mutate(
      {
        fullName: v.fullName,
        email: v.email,
        ...(v.departmentId !== (employee.departmentId ?? '')
          ? { departmentId: v.departmentId || null }
          : {}),
        ...(v.password ? { password: v.password } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Đã lưu thay đổi', { description: `${employee.code} · ${v.fullName}` });
          onOpenChange(false);
        },
        // 403 STAFF_NOT_OWNED / DEPARTMENT_NOT_MANAGED → lỗi gốc của form (bộ dịch lỗi luật 6)
        onError: (err) =>
          applyServerErrors(form, err as ApiError, {
            knownFields: ['fullName', 'email', 'departmentId', 'password'],
          }),
      },
    );
  });
  const rootError = form.formState.errors.root?.server?.message;
  // Phòng ban hiện tại có thể nằm ngoài phạm vi chuyển tới — vẫn hiện để không "mất" giá trị.
  const current = employee.departmentId;
  const options =
    current && !departments.some((d) => d.id === current)
      ? [{ id: current, name: 'Phòng ban hiện tại', path: '' }, ...departments]
      : departments;

  return (
    <Dialog open onOpenChange={(o) => !update.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sửa nhân sự {employee.code}</DialogTitle>
          <DialogDescription>
            Mã nhân viên không đổi được. Để trống mật khẩu nếu không đặt lại.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Họ tên</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phòng ban</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Phòng ban">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allowUnassign || !current ? (
                        <SelectItem value={NONE}>— Không thuộc phòng ban —</SelectItem>
                      ) : null}
                      {options.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.path ? `${d.path} › ${d.name}` : d.name}
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mật khẩu mới</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <FormDescription>Tối thiểu 8 ký tự; để trống = giữ nguyên</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={update.isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={update.isPending}>
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
