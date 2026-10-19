'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  applyServerErrors,
} from '@/components/data/form';
import { FormSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import {
  useChangeMyPassword,
  useMyProfile,
  useUpdateMyProfile,
  type MyProfile,
} from '../api/use-me';
import { useMyPancakeProfile, useUpdateMyPancakeProfile } from '../api/use-pancake-profile';
import {
  changeMyPasswordSchema,
  myProfileSchema,
  type ChangeMyPasswordValues,
  type MyProfileValues,
} from '../schema';
import { PancakeProfileSection } from './pancake-profile-section';

/**
 * Tài khoản của tôi (2026-10-19): người đăng nhập tự sửa họ tên, số điện thoại (PATCH /me/profile),
 * đổi mật khẩu (POST /me/password) và fb_id Pancake (PUT /me/pancake-profile). Không cần quyền
 * user.* — server chỉ cho sửa chính mình. Tên đăng nhập và email do quản trị cấp, chỉ hiển thị.
 */
export function MeScreen() {
  const query = useMyProfile();
  return (
    <>
      <PageHeader
        title="Tài khoản của tôi"
        description={query.data ? `Tên đăng nhập: ${query.data.code}` : undefined}
        breadcrumb={[{ label: 'Tài khoản của tôi' }]}
      />
      <div className="grid max-w-5xl items-start gap-3 lg:grid-cols-2">
        <section className="rounded-md border bg-card">
          <h2 className="border-b px-3 py-2 text-sm font-semibold">Thông tin cá nhân</h2>
          <div className="p-3">
            <QueryState query={query} skeleton={<FormSkeleton fields={4} />}>
              {(profile) => <ProfileForm key={profile.userId} profile={profile} />}
            </QueryState>
          </div>
        </section>
        <section className="rounded-md border bg-card">
          <h2 className="border-b px-3 py-2 text-sm font-semibold">Đổi mật khẩu</h2>
          <div className="p-3">
            <PasswordForm />
          </div>
        </section>
      </div>
      <div className="mt-3 max-w-5xl">
        <MyPancakeProfile />
      </div>
    </>
  );
}

function MyPancakeProfile() {
  const query = useMyPancakeProfile();
  const mutation = useUpdateMyPancakeProfile();
  return <PancakeProfileSection query={query} mutation={mutation} canEdit self />;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}

function ProfileForm({ profile }: { profile: MyProfile }) {
  const mutation = useUpdateMyProfile();
  const form = useForm<MyProfileValues>({
    resolver: zodResolver(myProfileSchema),
    defaultValues: { fullName: profile.fullName, phone: profile.phone ?? '' },
  });

  const onSubmit = form.handleSubmit((values) =>
    mutation
      .mutateAsync({ fullName: values.fullName, phone: values.phone })
      .then((saved) => {
        form.reset({ fullName: saved.fullName, phone: saved.phone ?? '' });
        toast.success('Đã lưu thay đổi');
      })
      .catch((err: unknown) => applyServerErrors(form, err)),
  );

  return (
    <Form {...form}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Tên đăng nhập" value={profile.code} />
          <ReadOnlyField label="Email" value={profile.email} />
        </div>
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Họ tên</FormLabel>
              <FormControl>
                <Input {...field} className="h-8" autoComplete="name" />
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
              <FormLabel>Số điện thoại</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  className="h-8"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Để trống nếu không khai"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root?.server ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.server.message}
          </p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
          {mutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
      </form>
    </Form>
  );
}

const EMPTY_PASSWORD: ChangeMyPasswordValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function PasswordForm() {
  const mutation = useChangeMyPassword();
  const form = useForm<ChangeMyPasswordValues>({
    resolver: zodResolver(changeMyPasswordSchema),
    defaultValues: EMPTY_PASSWORD,
  });

  const onSubmit = form.handleSubmit((values) =>
    mutation
      .mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      .then(() => {
        form.reset(EMPTY_PASSWORD);
        toast.success('Đã đổi mật khẩu');
      })
      .catch((err: unknown) => applyServerErrors(form, err)),
  );

  const fields: Array<{ name: keyof ChangeMyPasswordValues; label: string; auto: string }> = [
    { name: 'currentPassword', label: 'Mật khẩu hiện tại', auto: 'current-password' },
    { name: 'newPassword', label: 'Mật khẩu mới (tối thiểu 8 ký tự)', auto: 'new-password' },
    { name: 'confirmPassword', label: 'Nhập lại mật khẩu mới', auto: 'new-password' },
  ];

  return (
    <Form {...form}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
        {fields.map((f) => (
          <FormField
            key={f.name}
            control={form.control}
            name={f.name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{f.label}</FormLabel>
                <FormControl>
                  <Input {...field} type="password" className="h-8" autoComplete={f.auto} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        {form.formState.errors.root?.server ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.server.message}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Phiên đang mở trên máy này và PDA vẫn giữ nguyên; lần đăng nhập sau dùng mật khẩu mới.
        </p>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}
        </Button>
      </form>
    </Form>
  );
}
