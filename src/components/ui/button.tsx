import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Nút theo design system "Thiên Nông ERP" (2026-10-20): md 32px (mặc định) / sm 28px, bo 4px,
 * chữ 13px đậm 600. Mỗi vùng chỉ MỘT nút `default` (= primary), đặt cuối hàng.
 *
 * Tên biến thể giữ tên shadcn cũ để ~400 chỗ gọi không phải sửa; ánh xạ sang hệ thống:
 * - `default`       → primary (nền primary, hover primary-hover)
 * - `outline`       → secondary của hệ thống (nền card, viền input) — nút phụ phổ biến nhất
 * - `secondary`     → cùng hình với `outline` (biến thể nền xanh nhạt cũ không có trong hệ thống)
 * - `ghost`         → không nền, không viền
 * - `destructive`   → danger: CHỈ là nút xác nhận trong hộp thoại việc không hoàn tác được
 * - `danger-ghost`  → chữ đỏ, hover nền destructive-weak: Hủy / Xóa đặt ngoài hộp thoại
 * - `link`          → chữ primary, gạch chân khi hover
 */
const buttonVariants = cva(
  // Đổi màu hover / nhấn tức thì (duration-color 0ms) — không transition-colors.
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-semibold disabled:pointer-events-none disabled:opacity-45 aria-busy:pointer-events-none aria-busy:opacity-75 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover active:shadow-pressed',
        destructive:
          'bg-destructive text-destructive-foreground hover:brightness-[.92] active:shadow-pressed',
        outline:
          'border border-button-secondary-border bg-button-secondary-bg text-foreground hover:bg-muted active:bg-border',
        secondary:
          'border border-button-secondary-border bg-button-secondary-bg text-foreground hover:bg-muted active:bg-border',
        ghost: 'text-foreground hover:bg-muted active:bg-border',
        'danger-ghost': 'text-destructive hover:bg-destructive-weak',
        link: 'text-primary underline-offset-4 hover:text-primary-hover hover:underline',
      },
      size: {
        default: 'h-control px-3',
        sm: 'h-button-sm px-2.5 text-xs [&_svg]:size-3.5',
        lg: 'h-10 px-6',
        icon: 'h-control w-control',
        'icon-sm': 'h-button-sm w-button-sm [&_svg]:size-3.5',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Đang gửi: nhãn đổi sang `loadingText` ("Đang lưu…"), mờ 75%, khóa bấm — không spinner.
   * Thiếu `loadingText` thì giữ nhãn cũ.
   */
  loading?: boolean;
  loadingText?: React.ReactNode;
  /** Phím tắt hiện sau nhãn: "Ctrl S", "F2". Chỉ dùng trên nút chính / nút có phím tắt riêng. */
  shortcut?: string;
  /** Số đếm sau nhãn khi nút tác động lên nhóm đã chọn ("Gửi sang ĐVVC 12"). */
  count?: number;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      type = 'button',
      loading = false,
      loadingText,
      shortcut,
      count,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const primary = variant === 'default' || variant === undefined || variant === null;
    const extras =
      count !== undefined || shortcut ? (
        <>
          {count !== undefined ? (
            <span
              className={cn(
                'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-semibold',
                primary ? 'bg-primary-foreground/20' : 'bg-secondary text-primary',
              )}
            >
              {count}
            </span>
          ) : null}
          {shortcut ? (
            <kbd
              className={cn(
                'rounded-sm border px-1 font-mono text-xs font-normal leading-4',
                primary
                  ? 'border-primary-foreground/30 text-primary-foreground/80'
                  : 'border-border text-subtle-foreground',
              )}
            >
              {shortcut}
            </kbd>
          ) : null}
        </>
      ) : null;
    // asChild: Slottable phải là con TRỰC TIẾP của Slot — bọc Fragment thì Slot gắn className vào Fragment
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          aria-busy={loading || undefined}
          {...props}
        >
          <Slottable>{children}</Slottable>
          {extras}
        </Slot>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && loadingText ? loadingText : children}
        {extras}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
