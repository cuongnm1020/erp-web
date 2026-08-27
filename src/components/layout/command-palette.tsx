'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { visibleModules } from '@/lib/navigation';
import { useAbility } from '@/lib/permission';

/**
 * Ctrl/⌘+K — FE-0-06 chỉ điều hướng theo module/quyền.
 * Tìm khách hàng / đơn / ticket gắn thêm ở FE-1+ qua prop `extra`.
 */
export function CommandPalette({ extra }: { extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ability = useAbility();
  const modules = visibleModules((a, s) => ability.can(a, s));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Tìm nhanh">
      <CommandInput placeholder="Đi tới màn hình…" />
      <CommandList>
        <CommandEmpty>Không có kết quả.</CommandEmpty>
        <CommandGroup heading="Điều hướng">
          {modules.map((m) => (
            <CommandItem key={m.href} value={`${m.label} ${m.href}`} onSelect={() => go(m.href)}>
              <m.icon aria-hidden />
              {m.label}
              {m.shortcut ? <CommandShortcut>{m.shortcut}</CommandShortcut> : null}
            </CommandItem>
          ))}
          {modules.flatMap((m) =>
            (m.children ?? [])
              .filter((c) => c.href !== m.href)
              .map((c) => (
                <CommandItem
                  key={c.href}
                  value={`${m.label} ${c.label} ${c.href}`}
                  onSelect={() => go(c.href)}
                >
                  <span className="text-muted-foreground">{m.label} /</span> {c.label}
                </CommandItem>
              )),
          )}
        </CommandGroup>
        {extra}
      </CommandList>
    </CommandDialog>
  );
}
