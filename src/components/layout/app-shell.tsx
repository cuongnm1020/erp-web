'use client';

import { LogOut, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommandPalette } from './command-palette';
import { Sidebar } from './sidebar';

export interface ShellUser {
  code: string;
  roles: string[];
}

/**
 * Khung trang nội bộ. Nhận user/onLogout qua prop (luật 12: components không import features).
 * Không dùng cho màn công khai (E-06 khảo sát CSAT).
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
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
            <Button
              variant="outline"
              size="sm"
              className="w-64 justify-start text-muted-foreground"
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
                )
              }
            >
              <Search aria-hidden />
              Tìm nhanh…
              <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">
                Ctrl K
              </kbd>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Tài khoản">
                  <UserRound aria-hidden />
                  <span className="max-w-32 truncate">{user?.code ?? '…'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user?.code}</div>
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
          </header>
          <main className="flex-1 p-4">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </TooltipProvider>
  );
}
