'use client';

import { Bell, Keyboard, LogOut, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/data/user-avatar';
import { CommandPalette } from './command-palette';
import { Sidebar } from './sidebar';
import { WarehouseSwitcher } from './warehouse-switcher';

export interface ShellUser {
  code: string;
  roles: string[];
  /** Họ tên hiển thị — /auth/me chưa trả (chờ API), thiếu thì hiện mã nhân viên. */
  name?: string;
}

/** Phím tắt chung của khung — phím riêng từng màn (trạm đóng gói, tạo đơn…) xem trong màn đó. */
const SHELL_SHORTCUTS: ReadonlyArray<[keys: string[], label: string]> = [
  [['Ctrl', 'K'], 'Tìm nhanh màn hình'],
  [['['], 'Thu gọn / mở rộng menu trái'],
  [['Esc'], 'Đóng hộp thoại, menu đang mở'],
];

const openPalette = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

/**
 * Khung trang nội bộ (redesign 2026-10-17). Nhận user/onLogout qua prop (luật 12: components không
 * import features). Không dùng cho màn công khai (E-06 khảo sát CSAT).
 * Cuộn theo cửa sổ như trước: thanh trên dính ở đỉnh, sidebar dính cao bằng màn hình, PageHeader
 * dính ngay dưới thanh trên — các màn có footer `sticky bottom-0` không phải đổi.
 */
export function AppShell({
  user,
  onLogout,
  children,
}: {
  user?: ShellUser;
  onLogout?: () => void;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const display = user?.name ?? user?.code;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen">
        <Sidebar mobileOpen={drawer} onMobileClose={closeDrawer} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2.5 border-b bg-card px-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden"
              aria-label="Mở menu"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <Menu aria-hidden />
            </Button>
            <WarehouseSwitcher />
            <button
              type="button"
              onClick={openPalette}
              aria-label="Tìm nhanh"
              className="flex h-8 min-w-0 max-w-lg flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <Search aria-hidden className="h-4 w-4 shrink-0" />
              <span className="truncate">Tìm nhanh màn hình…</span>
              <kbd className="ml-auto hidden whitespace-nowrap rounded border px-1.5 font-mono text-xs leading-4 sm:inline">
                Ctrl K
              </kbd>
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden h-9 w-9 text-muted-foreground sm:inline-flex"
                    aria-label="Phím tắt"
                    onClick={() => setShortcuts(true)}
                  >
                    <Keyboard aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Phím tắt</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground"
                    aria-label="Thông báo"
                  >
                    <Bell aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {/* Chờ API: /notifications/inbox chưa có DTO trong OpenAPI (luật 2) — chưa đọc được. */}
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    Thông báo trong ứng dụng đang được làm, chưa có dữ liệu để hiện.
                  </p>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Tài khoản"
                    className="ml-1 flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 hover:bg-muted"
                  >
                    <UserAvatar size="sm" tone="accent" />
                    <span className="hidden min-w-0 text-left lg:block">
                      <span className="block max-w-40 truncate text-sm font-semibold leading-4">
                        {display ?? '…'}
                      </span>
                      <span className="block max-w-40 truncate text-xs text-muted-foreground">
                        {user?.roles[0] ?? ''}
                      </span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium">{display}</div>
                    <div className="text-xs text-muted-foreground">{user?.roles.join(', ')}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/me">Hồ sơ cá nhân</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onLogout}>
                    <LogOut aria-hidden />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-5">{children}</main>
        </div>
      </div>
      <CommandPalette />
      <Dialog open={shortcuts} onOpenChange={setShortcuts}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Phím tắt</DialogTitle>
            <DialogDescription>
              Phím tắt chung. Màn nào có phím riêng (trạm đóng gói, tạo đơn…) thì xem ngay trong màn
              đó.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y text-sm">
            {SHELL_SHORTCUTS.map(([keys, label]) => (
              <li key={label} className="flex items-center justify-between gap-4 py-2">
                <span>{label}</span>
                <span className="flex gap-1">
                  {keys.map((k) => (
                    <kbd
                      key={k}
                      className="rounded border bg-muted px-1.5 font-mono text-xs leading-5"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
