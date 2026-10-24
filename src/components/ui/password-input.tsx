'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input, type InputProps } from './input';

export type PasswordInputProps = Omit<InputProps, 'type'>;

/**
 * Ô mật khẩu có nút con mắt bên phải để hiện / ẩn chữ đã gõ (2026-10-24) — người dùng nhìn lại được
 * mật khẩu trước khi gửi. Mặc định ẩn; nút không gửi form và không lấy mất focus của ô.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const Icon = visible ? EyeOff : Eye;
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={cn('pr-8', className)}
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
        >
          <Icon className="size-4" aria-hidden />
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
