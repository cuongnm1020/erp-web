'use client';

import { RefreshCw, X } from 'lucide-react';
import { DateRangePicker } from '@/components/data/date-range-picker';
import { ForbiddenState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import { useReportOwners, useReportTeams, useSalesRollupRebuild } from '../api/use-sales-report';
import { rangeLabel } from './report-parts';
import {
  CHANNELS,
  SALES_MAX_DAYS,
  useSalesReportState,
  type ReportFilterKey,
} from './report-state';
import { SalesOverviewTab } from './sales-overview-tab';
import { SalesProductTab } from './sales-product-tab';
import { SalesStaffTab } from './sales-staff-tab';
import { SalesTopTab } from './sales-top-tab';

type TabKey = 'overview' | 'product' | 'staff' | 'top';

/**
 * Tab của màn. Chỉ tab đang mở mới gọi API (component tab khác không mount).
 * RPT-05c: thêm { key: 'supplier', label: 'Nhà cung cấp' } (sau 'staff') khi có
 * GET /reports/sales/by-supplier — không hiện tab chết trước đó.
 */
const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Tổng quan theo thời gian' },
  { key: 'product', label: 'Sản phẩm' },
  { key: 'staff', label: 'Nhân viên' },
  { key: 'top', label: 'Bán chạy' },
];

const ALL = '__all__';

/**
 * Báo cáo doanh thu bán hàng (RPT-07) — /reports/sales. Bộ lọc chung (khoảng ngày + kênh + team +
 * người phụ trách) và tab nằm trên URL (luật 8), áp cho mọi tab. Doanh thu theo D-CR1 (đơn đã chốt,
 * ngày đặt hàng giờ VN, net KM − hàng hoàn); phạm vi xem do API scope theo D-CR2.
 */
export function SalesReportScreen() {
  const ability = useAbility();
  const canView = ability.can('sales', 'Report');
  const canAll = ability.can('sales_all', 'Report');
  const { state, range, today, setFilters, setRange, set } = useSalesReportState();
  const tab: TabKey = TABS.some((t) => t.key === state.filters.tab)
    ? (state.filters.tab as TabKey)
    : 'overview';

  // Chọn team / người phụ trách: chỉ người xem toàn công ty (report.sales_all) mới có danh sách;
  // trưởng nhóm / nhân viên lọc bằng nút "Lọc" ở tab Nhân viên (API vẫn giao với phạm vi của họ).
  const teamPicker = canView && canAll && ability.can('read', 'Customer');
  const ownerPicker = canView && canAll && ability.can('read', 'User');
  const teams = useReportTeams(teamPicker);
  const owners = useReportOwners(ownerPicker);
  const rebuild = useSalesRollupRebuild();

  if (!canView) return <ForbiddenState className="m-4" />;

  const teamOptions = (teams.data ?? []).filter((t) => t.type === 'SALES');
  const ownerOptions = owners.data?.items ?? [];
  const teamId = state.filters.teamId;
  const ownerId = state.filters.ownerId;
  const showTeamChip = !!teamId && !teamOptions.some((t) => t.id === teamId);
  const showOwnerChip = !!ownerId && !ownerOptions.some((u) => u.id === ownerId);
  const hasFilter = !!(state.filters.channel || teamId || ownerId);

  const clearKeys = (...keys: ReportFilterKey[]) =>
    setFilters(Object.fromEntries(keys.map((k) => [k, undefined])));

  const runRebuild = () =>
    rebuild.mutate(range, {
      onSuccess: (r) =>
        toast.success('Đã yêu cầu tính lại số liệu', {
          description: `${r.days} ngày (${rangeLabel(r.from, r.to)}) — hệ thống tính lại dần trong nền; trong lúc đó báo cáo dùng số tức thời.`,
        }),
      onError: (err) => toast.error(messageFor(err)),
    });

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Doanh thu bán hàng"
        description={`Đơn đã chốt theo ngày đặt hàng · ${rangeLabel(range.from, range.to)}`}
        breadcrumb={[{ label: 'Báo cáo' }, { label: 'Doanh thu bán hàng' }]}
        actions={
          <Can I="sales_all" a="Report">
            <Button
              variant="outline"
              size="sm"
              onClick={runRebuild}
              disabled={rebuild.isPending}
              title="Tính lại bảng tổng hợp ngày cho khoảng đang xem (sau khi sửa dữ liệu ngoài luồng hoặc sau deploy)"
            >
              <RefreshCw aria-hidden className={cn(rebuild.isPending && 'animate-spin')} />
              {rebuild.isPending ? 'Đang gửi…' : 'Tính lại số liệu'}
            </Button>
          </Can>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card px-3 py-2">
        <DateRangePicker value={range} onChange={setRange} today={today} maxDays={SALES_MAX_DAYS} />
        <FilterSelect
          label="Kênh"
          value={state.filters.channel}
          options={CHANNELS}
          onChange={(v) => setFilters({ channel: v })}
        />
        {teamPicker ? (
          <FilterSelect
            label="Team"
            value={showTeamChip ? undefined : teamId}
            options={teamOptions.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => setFilters({ teamId: v, teamName: undefined })}
          />
        ) : null}
        {ownerPicker ? (
          <FilterSelect
            label="Nhân viên phụ trách"
            value={showOwnerChip ? undefined : ownerId}
            options={ownerOptions.map((u) => ({ value: u.id, label: u.fullName }))}
            onChange={(v) => setFilters({ ownerId: v, ownerName: undefined })}
          />
        ) : null}
        {showTeamChip ? (
          <FilterChip
            label={`Team: ${state.filters.teamName ?? 'đã chọn'}`}
            onClear={() => clearKeys('teamId', 'teamName')}
          />
        ) : null}
        {showOwnerChip ? (
          <FilterChip
            label={`Nhân viên: ${state.filters.ownerName ?? 'đã chọn'}`}
            onClear={() => clearKeys('ownerId', 'ownerName')}
          />
        ) : null}
        {hasFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearKeys('channel', 'teamId', 'teamName', 'ownerId', 'ownerName')}
          >
            <X aria-hidden /> Xóa lọc
          </Button>
        ) : null}
      </div>

      <div className="flex border-b" role="tablist" aria-label="Góc xem báo cáo">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() =>
              // Đổi tab: bỏ trang / sắp xếp / tìm của tab cũ, giữ bộ lọc chung.
              set({
                page: 1,
                q: '',
                sort: { id: 'revenue', desc: true },
                filters: { ...state.filters, tab: t.key === 'overview' ? undefined : t.key },
              })
            }
            className={cn(
              '-mb-px flex h-9 items-center border-b-2 px-3 text-sm',
              tab === t.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)!.label}>
        {tab === 'overview' ? <SalesOverviewTab /> : null}
        {tab === 'product' ? <SalesProductTab /> : null}
        {tab === 'staff' ? <SalesStaffTab /> : null}
        {tab === 'top' ? <SalesTopTab /> : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {label}
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger className="h-8 w-44" aria-label={label}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-md border bg-secondary pl-2.5 text-xs font-semibold text-secondary-foreground">
      {label}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        aria-label={`Bỏ lọc ${label}`}
        onClick={onClear}
      >
        <X aria-hidden />
      </Button>
    </span>
  );
}
