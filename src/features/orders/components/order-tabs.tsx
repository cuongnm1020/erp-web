'use client';

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { groupVi } from '@/lib/format';
import type { CarrierIssue, CarrierStage, OrderTab, OrderTabCounts } from '../api/use-orders';
import {
  CARRIER_ISSUE_DEFS,
  carrierStageFamily,
  carrierStageLabel,
  ORDER_TAB_DEFS,
  type OrderFlowFamily,
} from '../labels';
import { FlowChip } from './order-flow-tabs';

export type OrderTabView = 'orders' | 'issues';

/**
 * Tab cha màn Đơn hàng (2026-11-07, mockup https://claude.ai/artifact/SbgUqZzjfFrgyto7HKPeVC đã
 * duyệt): "Đơn hàng" (mỗi đơn đúng một chip theo vòng đời) | "Cần xử lý" (đơn cần người thao tác —
 * số cạnh tên = các chip đỏ, không tính Chưa đối soát). Tab cha gạch chân như các màn danh sách
 * khác; chip con giữ nguyên FlowChip (màu theo họ, số đếm). Chip "Tất cả" luôn đứng đầu:
 * "Đơn hàng" › Tất cả = mọi đơn (`searching`, như trước); "Cần xử lý" › Tất cả = đơn ở mọi chip đỏ
 * (bỏ Chưa đối soát — user chốt 2026-11-07, số chip = số trên tab cha).
 */
export function OrderTabs({
  view,
  tab,
  issue,
  orderCounts,
  issueCounts,
  searching,
  searchingLabel,
  onViewChange,
  onTabChange,
  onIssueChange,
  onShowAll,
  onExitSearch,
}: {
  view: OrderTabView;
  tab: OrderTab;
  /** null = chip "Tất cả" của Cần xử lý. */
  issue: CarrierIssue | null;
  orderCounts: OrderTabCounts | undefined;
  issueCounts: OrderTabCounts | undefined;
  /** Đơn hàng › Tất cả / ô tìm có chữ — xem mọi đơn. */
  searching: boolean;
  searchingLabel: string;
  onViewChange: (v: OrderTabView) => void;
  onTabChange: (t: OrderTab) => void;
  onIssueChange: (i: CarrierIssue | null) => void;
  onShowAll: () => void;
  onExitSearch: () => void;
}) {
  return (
    <div className="mb-3 grid gap-2">
      <OrderViewTabs view={view} issueCounts={issueCounts} onViewChange={onViewChange} />

      {view === 'orders' ? (
        <div
          role="tablist"
          aria-label="Trạng thái đơn"
          className="flex flex-wrap items-stretch gap-1.5"
        >
          <FlowChip
            label="Tất cả"
            n={orderCounts?.total}
            family="off"
            active={searching}
            onClick={() => {
              if (!searching) onShowAll();
            }}
          />
          {ORDER_TAB_DEFS.map((d) => (
            <FlowChip
              key={d.tab}
              label={d.label}
              n={orderCounts ? (orderCounts.counts[d.tab] ?? 0) : undefined}
              family={d.family}
              active={!searching && tab === d.tab}
              dim={searching}
              onClick={() => onTabChange(d.tab)}
            />
          ))}
        </div>
      ) : (
        <IssueChips issue={issue} issueCounts={issueCounts} onIssueChange={onIssueChange} />
      )}

      {view === 'orders' && searching ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-info-line bg-info-weak px-3 py-2 text-sm">
          <Search aria-hidden className="h-4 w-4 text-info" />
          {searchingLabel ? (
            <span>
              Đang tìm “<span className="font-semibold">{searchingLabel}</span>” trên mọi trạng thái
            </span>
          ) : (
            <span>Đang xem đơn ở mọi trạng thái</span>
          )}
          <Button variant="link" size="sm" onClick={onExitSearch}>
            Quay lại {ORDER_TAB_DEFS.find((d) => d.tab === tab)?.label ?? 'trạng thái'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hàng tab cha "Đơn hàng | Cần xử lý" (gạch chân) — số đỏ cạnh "Cần xử lý" = `attention` (các chip
 * đỏ). Dùng chung màn Đơn hàng (/crm/orders) và Kho › Đơn hàng (/wms/print-orders, 2026-11-09).
 */
export function OrderViewTabs({
  view,
  issueCounts,
  onViewChange,
}: {
  view: OrderTabView;
  issueCounts: OrderTabCounts | undefined;
  onViewChange: (v: OrderTabView) => void;
}) {
  const attention = issueCounts?.attention;
  return (
    <div role="tablist" aria-label="Nhóm tab" className="flex border-b">
      <ParentTab active={view === 'orders'} onClick={() => onViewChange('orders')}>
        Đơn hàng
      </ParentTab>
      <ParentTab active={view === 'issues'} onClick={() => onViewChange('issues')}>
        Cần xử lý
        {attention !== undefined && attention > 0 ? (
          <span className="rounded-full bg-destructive-weak px-1.5 text-xs font-semibold leading-5 text-destructive tabular-nums">
            {groupVi(String(attention))}
          </span>
        ) : null}
      </ParentTab>
    </div>
  );
}

/** Dãy chip của tab cha "Cần xử lý": "Tất cả" (mọi chip đỏ) + từng loại vấn đề hãng. */
export function IssueChips({
  issue,
  issueCounts,
  onIssueChange,
}: {
  /** null = chip "Tất cả". */
  issue: CarrierIssue | null;
  issueCounts: OrderTabCounts | undefined;
  onIssueChange: (i: CarrierIssue | null) => void;
}) {
  return (
    <div role="tablist" aria-label="Đơn cần xử lý" className="flex flex-wrap items-stretch gap-1.5">
      <FlowChip
        label="Tất cả"
        n={issueCounts?.total}
        family="off"
        active={issue === null}
        onClick={() => onIssueChange(null)}
      />
      {CARRIER_ISSUE_DEFS.map((d) => (
        <FlowChip
          key={d.issue}
          label={d.label}
          n={issueCounts ? (issueCounts.counts[d.issue] ?? 0) : undefined}
          family={d.family}
          active={issue === d.issue}
          onClick={() => onIssueChange(d.issue)}
        />
      ))}
    </div>
  );
}

/** Chấm màu theo họ — viết đủ chuỗi để Tailwind sinh lớp. */
const DOT: Record<OrderFlowFamily, string> = {
  wait: 'bg-flow-wait',
  fulfil: 'bg-flow-fulfil',
  ship: 'bg-flow-ship',
  done: 'bg-flow-done',
  issue: 'bg-flow-issue',
  off: 'bg-flow-off',
};

/** Thẻ trạng thái hãng trên dòng đơn (cột "Thẻ" của mockup, 2026-11-07): chấm màu + chữ. */
export function CarrierStageTag({ stage }: { stage: CarrierStage }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 text-xs leading-5">
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', DOT[carrierStageFamily(stage)])}
      />
      {carrierStageLabel(stage)}
    </span>
  );
}

function ParentTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm',
        active
          ? 'border-primary font-semibold text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
