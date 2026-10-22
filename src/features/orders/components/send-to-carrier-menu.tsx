'use client';

import { ChevronDown, Send } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  carrierAccountOptions,
  useCarriers,
  type CarrierAccountOption,
} from '@/features/wms/api/use-shipping';
import type { SalesOrder } from '../api/use-orders';
import { SendToCarrierDialog } from './send-to-carrier-dialog';

/**
 * Nút "Gửi sang ĐVVC" trên thanh hành động hàng loạt: menu "Sang <hãng>" dựng từ GET /carriers
 * (hãng đang bật và có adapter thật — MANUAL / xe nhà không có cấu hình để gửi). Hãng nhiều tài
 * khoản hiện từng tài khoản đủ cấu hình (2026-10-22); hãng / tài khoản chưa cấu hình thì ẩn.
 * Chọn một dòng → SendToCarrierDialog cho lô đã chọn, chọn sẵn tài khoản đó.
 */
export function SendToCarrierMenu({ rows, onDone }: { rows: SalesOrder[]; onDone: () => void }) {
  const carriers = useCarriers();
  const [picked, setPicked] = useState<CarrierAccountOption | null>(null);
  const options = carrierAccountOptions(carriers.data).filter((o) => o.carrier.hasAdapter);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-7 px-2 text-xs" disabled={carriers.isPending}>
            <Send aria-hidden />
            Gửi sang ĐVVC <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Gửi {rows.length} đơn sang hãng</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.length === 0 ? (
            <DropdownMenuItem disabled>Chưa có hãng vận chuyển nào được cấu hình</DropdownMenuItem>
          ) : (
            options.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onSelect={() => setPicked(o)}
                aria-label={`Sang ${o.carrier.code}${o.accountLabel ? ` · ${o.accountLabel}` : ''}`}
              >
                Sang
                <StatusBadge tone="brand" className="ml-1.5">
                  {o.carrier.code}
                </StatusBadge>
                {o.accountLabel ? <span className="ml-1.5 text-sm">{o.accountLabel}</span> : null}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {picked ? (
        <SendToCarrierDialog
          carrier={picked.carrier}
          accountId={picked.accountId}
          rows={rows}
          open
          onOpenChange={(o) => {
            if (!o) setPicked(null);
          }}
          onDone={onDone}
        />
      ) : null}
    </>
  );
}
