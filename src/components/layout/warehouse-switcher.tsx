'use client';

import { Check, ChevronDown, Warehouse } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { ALL_WAREHOUSES, useWarehouse } from '@/lib/warehouse';

/**
 * Ô chọn kho đang làm việc (PLAN-warehouse-context) — trên thanh trên cạnh ô tìm nhanh (redesign
 * 2026-10-17: kho ảnh hưởng mọi số liệu nên luôn thấy, kể cả khi menu thu gọn). Chỉ liệt kê kho được
 * phép (server đã lọc trong /auth/me); "Tất cả kho" khi được phép nhiều kho. Đổi kho → mọi màn tải
 * lại theo kho mới (WarehouseProvider).
 */
export function WarehouseSwitcher() {
  const { options, selected, allowAll, ready, select } = useWarehouse();
  const current = options.find((o) => o.id === selected);
  const label = !ready
    ? 'Đang tải…'
    : selected === ALL_WAREHOUSES
      ? 'Tất cả kho'
      : (current?.name ?? 'Chưa được cấp kho');
  const shown = current ? `${current.code} · ${current.name}` : label;
  const disabled = !ready || options.length === 0 || (options.length === 1 && !allowAll);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Kho đang làm việc: ${label}`}
          title={shown}
          className="flex h-8 min-w-0 max-w-72 shrink items-center gap-2 whitespace-nowrap rounded-md border border-input bg-card px-2.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-card"
        >
          <span
            aria-hidden
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              ready && selected ? 'bg-success' : 'bg-muted-foreground',
            )}
          />
          <Warehouse aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
          <span className="hidden text-muted-foreground sm:inline">Kho</span>
          <span className="hidden min-w-0 truncate font-semibold sm:inline">{shown}</span>
          {disabled ? null : (
            <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Chọn kho làm việc
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allowAll ? (
          <WarehouseItem
            active={selected === ALL_WAREHOUSES}
            onSelect={() => select(ALL_WAREHOUSES)}
            name="Tất cả kho"
          />
        ) : null}
        {options.map((o) => (
          <WarehouseItem
            key={o.id}
            active={selected === o.id}
            onSelect={() => select(o.id)}
            name={o.name}
            code={o.code}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WarehouseItem({
  active,
  onSelect,
  name,
  code,
}: {
  active: boolean;
  onSelect: () => void;
  name: string;
  code?: string;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} aria-current={active || undefined}>
      <Check aria-hidden className={cn('h-4 w-4', active ? 'opacity-100' : 'opacity-0')} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {code ? <span className="font-mono text-xs text-muted-foreground">{code}</span> : null}
    </DropdownMenuItem>
  );
}
