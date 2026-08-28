'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
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
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { useDepartments } from '../api/use-departments';
import { useRoles } from '../api/use-roles';
import { useCreateUser } from '../api/use-users';
import { createUserSchema, type CreateUserValues } from '../schema';

const NO_DEPT = '__none__';

/** I-02 Thêm nhân viên — POST /users. Sau khi tạo, phân quyền chi tiết ở màn chi tiết. */
export function UserCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateUser();
  const departments = useDepartments();
  const roles = useRoles();

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      code: '',
      fullName: '',
      email: '',
      password: '',
      departmentId: '',
      roleCodes: [],
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    create.mutate(
      {
        code: v.code,
        fullName: v.fullName,
        email: v.email,
        password: v.password,
        departmentId: v.departmentId || undefined,
        roleCodes: v.roleCodes.length ? v.roleCodes : undefined,
      },
      {
        onSuccess: (u) => {
          toast.success('Đã tạo nhân viên', { description: `${u.code} · ${u.fullName}` });
          form.reset();
          onOpenChange(false);
        },
        onError: (err) => {
          applyServerErrors(form, err as ApiError, {
            knownFields: ['code', 'fullName', 'email', 'password', 'departmentId', 'roleCodes'],
          });
        },
      },
    );
  });

  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm nhân viên</DialogTitle>
          <DialogDescription>
            Tài khoản mới đăng nhập bằng mã nhân viên và mật khẩu bên dưới.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Mã nhân viên</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus placeholder="vd: sale.hn.3" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Họ tên</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Mật khẩu ban đầu</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
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
                    value={field.value || NO_DEPT}
                    onValueChange={(v) => field.onChange(v === NO_DEPT ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="— Không thuộc phòng ban —" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_DEPT}>— Không thuộc phòng ban —</SelectItem>
                      {(departments.data ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
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
              name="roleCodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vai trò</FormLabel>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(roles.data ?? []).map((r) => {
                      const checked = field.value.includes(r.code);
                      return (
                        <label key={r.code} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              field.onChange(
                                v === true
                                  ? [...field.value, r.code]
                                  : field.value.filter((c) => c !== r.code),
                              )
                            }
                            aria-label={r.name}
                          />
                          {r.name}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Đang tạo…' : 'Tạo nhân viên'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
