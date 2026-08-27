'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isApiError } from '@/lib/api/errors';
import { safeNext } from '@/lib/auth/route-guard';
import { messageFor } from '@/lib/error-messages';
import { useLogin } from '../api/use-login';
import { loginSchema, type LoginInput } from '../schema';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const ids = { u: useId(), p: useId(), err: useId() };

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => {
        router.replace(safeNext(params.get('next')));
        router.refresh();
      },
    });
  });

  const err = login.error;
  const errorText = err
    ? isApiError(err) && err.status === 401
      ? 'Sai mã nhân viên hoặc mật khẩu.'
      : messageFor(err)
    : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-describedby={ids.err}>
      <div className="space-y-1.5">
        <Label htmlFor={ids.u}>Mã nhân viên hoặc email</Label>
        <Input
          id={ids.u}
          autoComplete="username"
          autoFocus
          aria-invalid={!!form.formState.errors.username}
          {...form.register('username')}
        />
        <FieldError message={form.formState.errors.username?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={ids.p}>Mật khẩu</Label>
        <Input
          id={ids.p}
          type="password"
          autoComplete="current-password"
          aria-invalid={!!form.formState.errors.password}
          {...form.register('password')}
        />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      <p id={ids.err} role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {errorText}
        {isApiError(err) && err.traceId && err.status >= 500 ? (
          <span className="block text-xs text-muted-foreground">Mã truy vết: {err.traceId}</span>
        ) : null}
      </p>
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  return <p className="min-h-4 text-xs text-destructive">{message}</p>;
}
