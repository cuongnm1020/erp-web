'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
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
import { useCreateDepartment, useUpdateDepartment, type Department } from '../api/use-departments';
import type { UserListItem } from '../api/use-users';
import { createDepartmentSchema, departmentFormSchema, type DepartmentFormValues } from '../schema';

const NONE = '__none__';

/** id của mọi phòng ban con (đệ quy) — để không gán cha là chính con của mình (server cũng chặn 422). */
function descendantIds(all: Department[], rootId: string): Set<string> {
  const out = new Set<string>();
  const walk = (id: string) => {
    for (const d of all) {
      if (d.parentId === id && !out.has(d.id)) {
        out.add(d.id);
        walk(d.id);
      }
    }
  };
  walk(rootId);
  return out;
}

/**
 * I-05 Thêm / sửa phòng ban — POST /departments, PATCH /departments/{id}.
 * Mã bất biến sau khi tạo (chỉ nhập ở chế độ tạo). Trưởng phòng chọn trong danh bạ nhân viên.
 */
export function DepartmentDialog({
  open,
  onOpenChange,
  departments,
  users,
  department,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  users: UserListItem[];
  /** Có = sửa; không = tạo mới. */
  department?: Department;
}) {
  const editing = department !== undefined;
  const create = useCreateDepartment();
  const update = useUpdateDepartment(department?.id ?? '');
  const pending = create.isPending || update.isPending;

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(editing ? departmentFormSchema : createDepartmentSchema),
    defaultValues: {
      code: department?.code ?? '',
      name: department?.name ?? '',
      parentId: department?.parentId ?? '',
      managerId: department?.managerId ?? '',
      isActive: department?.isActive ?? true,
    },
  });

  // Không cho chọn chính nó / con cháu làm cha (vòng).
  const parentOptions = useMemo(() => {
    if (!department) return departments;
    const blocked = descendantIds(departments, department.id);
    blocked.add(department.id);
    return departments.filter((d) => !blocked.has(d.id));
  }, [departments, department]);

  const onSubmit = form.handleSubmit((v) => {
    const onError = (err: unknown) =>
      applyServerErrors(form, err as ApiError, {
        knownFields: ['code', 'name', 'parentId', 'managerId', 'isActive'],
      });
    if (editing) {
      update.mutate(
        {
          name: v.name,
          parentId: v.parentId || null,
          managerId: v.managerId || null,
          isActive: v.isActive,
        },
        {
          onSuccess: () => {
            toast.success('Đã lưu thay đổi', { description: `${department.code} · ${v.name}` });
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
        name: v.name,
        ...(v.parentId ? { parentId: v.parentId } : {}),
        ...(v.managerId ? { managerId: v.managerId } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Đã thêm phòng ban', { description: `${v.code} · ${v.name}` });
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
          <DialogTitle>
            {editing ? `Sửa phòng ban ${department.code}` : 'Thêm phòng ban'}
          </DialogTitle>
          <DialogDescription>
            Phòng ban là cơ cấu tổ chức. Phân quyền dữ liệu khách hàng đi theo team, không theo
            phòng ban.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            {editing ? null : (
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Mã phòng ban</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus placeholder="vd: SALES" className="font-mono" />
                    </FormControl>
                    <FormDescription>Không đổi được sau khi tạo</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Tên phòng ban</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus={editing} placeholder="Kinh doanh" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thuộc phòng ban</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Thuộc phòng ban">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>— Cấp cao nhất —</SelectItem>
                      {parentOptions.map((d) => (
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
              name="managerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trưởng phòng</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Trưởng phòng">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>— Chưa có —</SelectItem>
                      {users.map((u) => (
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
            {editing ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Đang hoạt động</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
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
                {editing ? 'Lưu thay đổi' : 'Thêm phòng ban'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
