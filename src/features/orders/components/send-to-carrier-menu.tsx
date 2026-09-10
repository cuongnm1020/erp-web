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
import { useCarriers, type Carrier } from '@/features/wms/api/use-shipping';
import type { SalesOrder } from '../api/use-orders';
import { SendToCarrierDialog } from './send-to-carrier-dialog';

/**
 * Nút "Gửi sang ĐVVC" trên thanh hành động hàng loạt: menu "Sang <hãng>" dựng từ GET /carriers
 * (hãng đang bật và có adapter thật — MANUAL / xe nhà không có cấu hình để gửi). Hãng chưa có
 * token trên server vẫn hiện nhưng mờ, để người dùng biết vì sao chưa gửi được thay vì đoán.
 * Chọn một hãng → SendToCarrierDialog cho lô đã chọn.
 */
export function SendToCarrierMenu({ rows, onDone }: { rows: SalesOrder[]; onDone: () => void }) {
  const carriers = useCarriers();
  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const options = (carriers.data ?? []).filter((c) => c.isActive && c.hasAdapter);

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
            <DropdownMenuItem disabled>Chưa có hãng vận chuyển nào được bật</DropdownMenuItem>
          ) : (
            options.map((c) => (
              <DropdownMenuItem
                key={c.id}
                disabled={!c.configured}
                onSelect={() => setCarrier(c)}
                aria-label={`Sang ${c.code}`}
              >
                Sang
                <StatusBadge tone="brand" className="ml-1.5">
                  {c.code}
                </StatusBadge>
                {c.configured ? null : (
                  <span className="ml-auto pl-3 text-xs text-muted-foreground">chưa cấu hình</span>
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {carrier ? (
        <SendToCarrierDialog
          carrier={carrier}
          rows={rows}
          open
          onOpenChange={(o) => {
            if (!o) setCarrier(null);
          }}
          onDone={onDone}
        />
      ) : null}
    </>
  );
}
