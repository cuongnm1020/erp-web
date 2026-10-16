'use client';

import { Check, ChevronsUpDown, Warehouse } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { ALL_WAREHOUSES, useWarehouse } from '@/lib/warehouse';

/**
 * Ô chọn kho đang làm việc (PLAN-warehouse-context) — góc trên trái sidebar. Chỉ liệt kê kho được
 * phép (server đã lọc trong /auth/me); "Tất cả kho" khi được phép nhiều kho. Đổi kho → mọi màn tải
 * lại theo kho mới (WarehouseProvider).
 */
export function WarehouseSwitcher({ collapsed }: { collapsed: boolean }) {
  const { options, selected, allowAll, ready, select } = useWarehouse();
  const current = options.find((o) => o.id === selected);
  const label = !ready
    ? 'Đang tải…'
    : selected === ALL_WAREHOUSES
      ? 'Tất cả kho'
      : (current?.name ?? 'Chưa được cấp kho');
  const short = selected === ALL_WAREHOUSES ? 'Tất cả' : (current?.code ?? '—');
  const disabled = !ready || options.length === 0 || (options.length === 1 && !allowAll);

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Kho đang làm việc: ${label}`}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent',
        collapsed ? 'h-8 w-8 justify-center' : 'h-9 w-full px-2',
      )}
    >
      <Warehouse aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-normal uppercase leading-none text-muted-foreground">
              Kho làm việc
            </span>
            <span className="block truncate font-semibold leading-tight">{label}</span>
          </span>
          {disabled ? null : (
            <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </>
      )}
    </button>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">
            {label} ({short})
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" side={collapsed ? 'right' : 'bottom'} className="w-60">
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
