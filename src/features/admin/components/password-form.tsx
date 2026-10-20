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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { useChangeMyPassword } from '../api/use-me';
import { changeMyPasswordSchema, type ChangeMyPasswordValues } from '../schema';

const EMPTY_PASSWORD: ChangeMyPasswordValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * Đổi mật khẩu của chính mình (POST /me/password) — dùng ở Tài khoản của tôi và màn đổi mật khẩu
 * lần đầu. Sai mật khẩu hiện tại / trùng mật khẩu cũ → 422 gắn vào đúng ô (luật 6).
 */
export function PasswordForm({ onChanged }: { onChanged?: () => void }) {
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
        onChanged?.();
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
