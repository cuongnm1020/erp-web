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
  StaffMultiSelect,
  StaffSelect,
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
  defaultParentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  users: UserListItem[];
  /** Có = sửa; không = tạo mới. */
  department?: Department;
  /** Tạo mới: chọn sẵn phòng ban cha (thêm phòng ban con từ Sơ đồ nhân sự). */
  defaultParentId?: string;
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
      parentId: department?.parentId ?? defaultParentId ?? '',
      managerId: department?.managerId ?? '',
      sortOrder: String(department?.sortOrder ?? ''),
      isActive: department?.isActive ?? true,
      kind: department?.kind ?? 'SALES',
      managerIds: department?.managerIds ?? [],
      groupLeadIds: department?.groupLeadIds ?? [],
    },
  });
  // Phòng CSKH đã có (đang sửa, chưa đổi loại): nhiều trưởng phòng + trưởng nhóm, chọn trong phòng.
  const kind = form.watch('kind');
  const careLeaders = editing && department.kind === 'CSKH' && kind === 'CSKH';
  // Người trong phòng + trưởng phòng đang ghi trên phòng mà thuộc phòng khác (dữ liệu cũ — server
  // cho giữ, không cho thêm mới người ngoài phòng).
  const members = useMemo(
    () =>
      editing
        ? users.filter(
            (u) =>
              (u.departmentId === department.id && u.isActive) || u.id === department.managerId,
          )
        : [],
    [users, editing, department],
  );
  const managerIds = form.watch('managerIds');
  const groupLeadIds = form.watch('groupLeadIds');

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
        knownFields: [
          'code',
          'name',
          'parentId',
          'managerId',
          'sortOrder',
          'isActive',
          'kind',
          'managerIds',
          'groupLeadIds',
        ],
      });
    if (editing) {
      update.mutate(
        {
          name: v.name,
          parentId: v.parentId || null,
          ...(careLeaders
            ? { managerIds: v.managerIds, groupLeadIds: v.groupLeadIds }
            : { managerId: v.managerId || null }),
          sortOrder: v.sortOrder ? Number(v.sortOrder) : 0,
          isActive: v.isActive,
          kind: v.kind,
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
        ...(v.sortOrder ? { sortOrder: Number(v.sortOrder) } : {}),
        ...(v.kind === 'CSKH' ? { kind: v.kind } : {}),
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
      <DialogContent>
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
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại phòng ban</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Loại phòng ban">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SALES">Kinh doanh</SelectItem>
                      <SelectItem value="CSKH">Chăm sóc khách hàng (CSKH)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    CSKH: cả leader lẫn nhân viên thấy khách được chia cho phòng; nhận khách mới
                    theo tỷ lệ ở Quản trị › Chia khách CSKH.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {careLeaders ? (
              <>
                <FormField
                  control={form.control}
                  name="managerIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Leader{' '}
                        <span className="font-normal text-muted-foreground">
                          · {field.value.length} người
                        </span>
                      </FormLabel>
                      <FormControl>
                        <StaffMultiSelect
                          value={field.value}
                          onChange={field.onChange}
                          staff={members}
                          exclude={groupLeadIds}
                          roleLabel="leader"
                          addPlaceholder="Thêm leader…"
                        />
                      </FormControl>
                      <FormDescription>
                        Các leader ngang hàng: cùng quản lý nhân viên và trưởng nhóm của phòng,
                        không sửa / khóa được nhau.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="groupLeadIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Trưởng nhóm{' '}
                        <span className="font-normal text-muted-foreground">
                          · {field.value.length} người
                        </span>
                      </FormLabel>
                      <FormControl>
                        <StaffMultiSelect
                          value={field.value}
                          onChange={field.onChange}
                          staff={members.filter((u) => u.departmentId === department?.id)}
                          exclude={managerIds}
                          roleLabel="trưởng nhóm"
                          addPlaceholder="Thêm trưởng nhóm…"
                        />
                      </FormControl>
                      <FormDescription>
                        Chỉ chọn được người trong phòng. Bỏ trưởng nhóm thì nhân viên của nhóm đó về
                        &ldquo;Chưa có nhóm&rdquo;. Quyền của từng trưởng nhóm đặt ở màn Nhân viên
                        của team.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leader</FormLabel>
                    <FormControl>
                      <StaffSelect
                        aria-label="Leader"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        staff={users}
                        noneLabel="— Chưa có —"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thứ tự trên sơ đồ</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" placeholder="0" className="w-28" />
                  </FormControl>
                  <FormDescription>Số nhỏ đứng trước trong các phòng ban cùng cấp</FormDescription>
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
