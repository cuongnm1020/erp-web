import { User } from 'lucide-react';
import { cn } from '@/lib/cn';

export type UserAvatarTone = 'default' | 'muted' | 'accent';

const TONE: Record<UserAvatarTone, string> = {
  default: 'bg-secondary text-primary',
  muted: 'bg-muted text-muted-foreground',
  accent: 'bg-accent text-accent-foreground',
};

const SIZE = {
  sm: { box: 'h-7 w-7', icon: 'h-4 w-4' },
  md: { box: 'h-8 w-8', icon: 'h-4 w-4' },
  lg: { box: 'h-10 w-10', icon: 'h-5 w-5' },
} as const;

/**
 * Avatar mặc định của một người (nhân sự, khách hàng): ô tròn biểu tượng người (2026-10-19 — thay chữ cái đầu của tên,
 * vốn trùng nhau nhiều và đọc nhầm thành mã). Trang trí thuần — tên luôn hiện cạnh bên, nên ẩn
 * khỏi trình đọc màn hình.
 */
export function UserAvatar({
  size = 'md',
  tone = 'default',
  className,
}: {
  size?: keyof typeof SIZE;
  tone?: UserAvatarTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        SIZE[size].box,
        TONE[tone],
        className,
      )}
    >
      <User className={SIZE[size].icon} />
    </span>
  );
}
