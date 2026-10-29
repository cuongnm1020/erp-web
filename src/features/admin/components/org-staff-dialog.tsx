'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
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
  StaffSelect,
  type StaffSelectItem,
} from '@/components/data/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import {
  useSetCareGroup,
  useSetCarePosition,
  type CarePosition,
  type OrgEmployee,
} from '../api/use-org-tree';
import { useUpdateUserPancakeProfile, useUserPancakeProfile } from '../api/use-pancake-profile';
import { useAssignableRoles } from '../api/use-roles';
import { useUpdateUser } from '../api/use-users';
import { editStaffSchema, type EditStaffValues } from '../schema';
import { PancakeProfileSection } from './pancake-profile-section';

const NONE = '__none__';

/** Vai trò CSKH đổi qua ô Chức vụ — server giữ nguyên khi PATCH roleCodes. */
const CARE_ROLES = ['CSKH_LEADER', 'CSKH_GROUP_LEAD', 'CSKH_MEMBER'];

const POSITION_LABEL: Record<CarePosition, string> = {
  MEMBER: 'Nhân viên',
  GROUP_LEAD: 'Trưởng nhóm',
  MANAGER: 'Leader',
};

/** Chức vụ + nhóm trong phòng CSKH (2026-10-24) — chỉ khi người sửa là trưởng phòng / quản trị. */
export interface CareEditOptions {
  position: CarePosition;
  groupLeaderId: string | null;
  /** Quản trị: được đặt / bỏ trưởng phòng. */
  canSetManager: boolean;
  /** Trưởng nhóm cùng phòng (để chọn nhóm). */
  groupLeads: StaffSelectItem[];
}

/**
 * Sửa nhân sự ngay trên Sơ đồ nhân sự — PATCH /users/{id} (họ tên, email, phòng ban, đặt lại
 * mật khẩu) + Facebook ID Pancake (PUT /users/{id}/pancake-profile, 2026-10-19: trưởng nhóm kinh
 * doanh khai fb_id cho nhân viên phòng mình → đơn Pancake về đúng người). Chỉ mở với nhân sự
 * `canManage` (trưởng phòng / người tạo / superadmin); server vẫn kiểm.
 * `departments`: các phòng ban người xem được chuyển tới (canAddMembers trên cây).
 */
export function OrgStaffDialog({
  employee,
  departments,
  allowUnassign,
  onOpenChange,
  care,
  roles,
}: {
  employee: OrgEmployee;
  /**
   * Vai trò hiện tại — có = hiện mục Vai trò (2026-10-29: trưởng phòng đổi vai trò nhân viên).
   * Tick được vai trò người sửa cấp được (GET /roles/assignable); vai trò ngoài tầm hiện khóa.
   */
  roles?: { code: string; name: string }[];
  /** Có = hiện Chức vụ + Trưởng nhóm (màn Nhân viên của team, người sửa là trưởng phòng / quản trị). */
  care?: CareEditOptions;
  departments: { id: string; name: string; path: string }[];
  /** Có user.update → được bỏ khỏi phòng ban. */
  allowUnassign: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateUser(employee.id);
  const setPosition = useSetCarePosition(employee.id);
  const setGroup = useSetCareGroup(employee.id);
  const [position, setPositionValue] = useState<CarePosition>(care?.position ?? 'MEMBER');
  const [groupLeaderId, setGroupLeaderId] = useState(care?.groupLeaderId ?? '');
  const busy = update.isPending || setPosition.isPending || setGroup.isPending;
  const assignable = useAssignableRoles(roles !== undefined);
  const currentRoles = (roles ?? []).filter((r) => !CARE_ROLES.includes(r.code));
  const roleOptions = [
    ...(assignable.data ?? []).filter((r) => !CARE_ROLES.includes(r.code)),
    ...currentRoles.filter((r) => !assignable.data?.some((a) => a.code === r.code)),
  ];
  const canAssign = (code: string) => assignable.data?.some((a) => a.code === code) ?? false;
  const [roleCodes, setRoleCodes] = useState(() => currentRoles.map((r) => r.code));
  const rolesChanged =
    roles !== undefined &&
    (roleCodes.length !== currentRoles.length ||
      roleCodes.some((c) => !currentRoles.some((r) => r.code === c)));
  const pancakeProfile = useUserPancakeProfile(employee.id);
  const updatePancakeProfile = useUpdateUserPancakeProfile(employee.id);
  const form = useForm<EditStaffValues>({
    resolver: zodResolver(editStaffSchema),
    defaultValues: {
      fullName: employee.fullName,
      email: employee.email,
      departmentId: employee.departmentId ?? '',
      password: '',
    },
  });

  /** Sau khi lưu thông tin: đổi chức vụ rồi nhóm (nhóm chỉ áp cho nhân viên). */
  const saveCare = async () => {
    if (!care) return;
    if (position !== care.position) await setPosition.mutateAsync(position);
    const nextGroup = groupLeaderId || null;
    if (position === 'MEMBER' && nextGroup !== (care.groupLeaderId ?? null))
      await setGroup.mutateAsync(nextGroup);
  };

  const onSubmit = form.handleSubmit((v) => {
    update.mutate(
      {
        fullName: v.fullName,
        email: v.email,
        ...(v.departmentId !== (employee.departmentId ?? '')
          ? { departmentId: v.departmentId || null }
          : {}),
        ...(v.password ? { password: v.password } : {}),
        ...(rolesChanged ? { roleCodes } : {}),
      },
      {
        onSuccess: async () => {
          try {
            await saveCare();
          } catch (err) {
            form.setError('root.server', { message: messageFor(err) });
            return;
          }
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
    <Dialog open onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent wide>
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
            {roles !== undefined && roleOptions.length > 0 ? (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Vai trò</legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {roleOptions.map((r) => (
                    <label key={r.code} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={roleCodes.includes(r.code)}
                        disabled={busy || !canAssign(r.code)}
                        onCheckedChange={(v) =>
                          setRoleCodes((cur) =>
                            v === true ? [...cur, r.code] : cur.filter((c) => c !== r.code),
                          )
                        }
                        aria-label={r.name}
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
                {roleOptions.some((r) => !canAssign(r.code)) ? (
                  <p className="text-xs text-muted-foreground">
                    Vai trò bị khóa nằm ngoài quyền của bạn — chỉ quản trị đổi được.
                  </p>
                ) : null}
              </fieldset>
            ) : null}
            {care ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="care-position">Chức vụ</Label>
                  <Select
                    value={position}
                    onValueChange={(v) => setPositionValue(v as CarePosition)}
                    disabled={busy || (care.position === 'MANAGER' && !care.canSetManager)}
                  >
                    <SelectTrigger id="care-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['MEMBER', 'GROUP_LEAD', 'MANAGER'] as const)
                        .filter((p) => p !== 'MANAGER' || care.canSetManager || care.position === p)
                        .map((p) => (
                          <SelectItem key={p} value={p}>
                            {POSITION_LABEL[p]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {care.canSetManager
                      ? 'Đổi chức vụ thay vai trò CSKH của người này.'
                      : 'Chỉ quản trị đặt / bỏ leader.'}
                  </p>
                </div>
                {position === 'MEMBER' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="care-group">Trưởng nhóm</Label>
                    <StaffSelect
                      id="care-group"
                      aria-label="Trưởng nhóm"
                      value={groupLeaderId}
                      onChange={setGroupLeaderId}
                      staff={care.groupLeads}
                      noneLabel="— Chưa có nhóm —"
                      disabled={busy}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mật khẩu mới</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} autoComplete="new-password" />
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
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" loading={busy}>
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <PancakeProfileSection query={pancakeProfile} mutation={updatePancakeProfile} canEdit />
      </DialogContent>
    </Dialog>
  );
}
