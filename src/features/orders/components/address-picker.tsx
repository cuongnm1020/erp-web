'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { AlertTriangle, Check, Info, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { matchesVi } from '@/components/data/form/search-select';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useGeoUnits, type GeoGeneration, type GeoUnit } from '../api/use-orders';

/** Ba ô địa giới của đơn — tên đúng danh mục (bộ mới: `district` trống hoặc là huyện cũ làm gợi ý). */
export interface AddressValue {
  province: string;
  district: string;
  ward: string;
}

type Step = 'province' | 'district' | 'ward';

/** "Phường Buôn Ma Thuột, Đắk Lắk" — thứ tự như ô "Tỉnh / Phường xã". */
export function addressLabel(v: AddressValue): string {
  return [v.ward, v.province].filter((x) => x.trim()).join(', ');
}

/**
 * Ô "Tỉnh / Phường xã" kiểu Pancake (mockup K8qEG4ssEjZTB6GKoLhXVB, duyệt 2026-11-07). Bấm mở bảng
 * chọn: công tắc **Địa chỉ mới** (Tỉnh → Phường xã) / **Địa chỉ cũ** (Tỉnh → Quận huyện → Phường
 * xã). Chọn xã cũ → lưu theo địa chỉ mới tương ứng, huyện cũ giữ ở `district` làm gợi ý cho hãng;
 * xã cũ chưa có trong bảng đổi → lưu nguyên tên cũ. Gõ để lọc (không dấu cũng được), ↑ ↓ Enter,
 * Backspace khi ô trống → về bước trước, Esc đóng.
 */
export function AddressPicker({
  value,
  onChange,
  invalid,
  label = 'Tỉnh / Phường xã',
  className,
  triggerClassName,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  invalid?: boolean;
  label?: string;
  className?: string;
  /** Lớp thêm cho ô khi đóng (vd. màn Sửa đơn tô ô đã sửa). */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [gen, setGen] = useState<GeoGeneration>('NEW');
  const [step, setStep] = useState<Step>('province');
  const [province, setProvince] = useState<GeoUnit | null>(null);
  const [district, setDistrict] = useState<GeoUnit | null>(null);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parentId =
    step === 'province'
      ? undefined
      : step === 'district'
        ? province?.id
        : (district ?? province)?.id;
  const units = useGeoUnits(gen, parentId, open);
  const provinces = useGeoUnits('NEW', undefined, open);
  const items = useMemo(() => units.data?.items ?? [], [units.data]);

  // Mở lại khi đã có tỉnh mới → vào thẳng bước Phường xã của tỉnh đó.
  useEffect(() => {
    if (!open || gen !== 'NEW' || province || !value.province.trim()) return;
    const p = provinces.data?.items.find((x) => x.name === value.province);
    if (p) {
      setProvince(p);
      setStep('ward');
    }
  }, [open, gen, province, value.province, provinces.data]);

  const reset = (g: GeoGeneration) => {
    setGen(g);
    setStep('province');
    setProvince(null);
    setDistrict(null);
    setSearch('');
  };

  const close = () => {
    setOpen(false);
    setSearch('');
    setProvince(null);
    setDistrict(null);
    setStep('province');
  };

  /** Về bước trước: bỏ đơn vị đã chọn ở bước đó. */
  const back = () => {
    if (step === 'ward' && gen === 'OLD') {
      setDistrict(null);
      setStep('district');
    } else {
      setProvince(null);
      setDistrict(null);
      setStep('province');
    }
    setSearch('');
  };

  const pick = (u: GeoUnit) => {
    setSearch('');
    if (u.level === 'PROVINCE') {
      setProvince(u);
      setStep(gen === 'OLD' ? 'district' : 'ward');
      return;
    }
    if (u.level === 'DISTRICT') {
      setDistrict(u);
      setStep('ward');
      return;
    }
    if (gen === 'NEW') {
      onChange({ province: province?.name ?? '', district: '', ward: u.name });
    } else if (u.converted?.ward) {
      onChange({
        province: u.converted.province,
        district: district?.name ?? '',
        ward: u.converted.ward,
      });
    } else {
      onChange({ province: province?.name ?? '', district: district?.name ?? '', ward: u.name });
    }
    close();
  };

  const activeUnit = items.find((u) => u.id === active);
  const shown = addressLabel(value);
  const stepTabs: Array<{ key: Step; label: string; enabled: boolean }> =
    gen === 'NEW'
      ? [
          { key: 'province', label: province?.name ?? 'Tỉnh / Thành phố', enabled: true },
          { key: 'ward', label: 'Phường / Xã', enabled: !!province },
        ]
      : [
          { key: 'province', label: province?.name ?? 'Tỉnh / Thành phố', enabled: true },
          { key: 'district', label: district?.name ?? 'Quận / Huyện', enabled: !!province },
          { key: 'ward', label: 'Phường / Xã', enabled: !!district },
        ];
  const goTo = (s: Step) => {
    if (s === step) return;
    if (s === 'province') {
      setProvince(null);
      setDistrict(null);
    }
    if (s === 'district') setDistrict(null);
    setStep(s);
    setSearch('');
  };
  const placeholder =
    step === 'province'
      ? 'Tìm tỉnh / thành…'
      : step === 'district'
        ? 'Tìm quận / huyện…'
        : gen === 'OLD'
          ? 'Tìm phường xã cũ…'
          : 'Tìm phường xã…';

  return (
    <Command
      shouldFilter
      // value = mã đơn vị, keywords = tên → lọc theo tên (không dấu cũng được).
      filter={(_value, q, keywords) => (matchesVi((keywords ?? []).join(' '), q) ? 1 : 0)}
      value={active}
      onValueChange={setActive}
      className={cn('overflow-visible bg-transparent', className)}
      label={label}
    >
      <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative">
            {open ? (
              <div className="flex h-control w-full items-center gap-2 rounded-md border border-control-border-focus bg-card px-2.5">
                <CommandPrimitive.Input
                  ref={inputRef}
                  autoFocus
                  aria-label={label}
                  aria-controls={listId}
                  placeholder={placeholder}
                  value={search}
                  onValueChange={setSearch}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && search === '' && step !== 'province') {
                      e.preventDefault();
                      back();
                    }
                    if (e.key === 'Escape') close();
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle-foreground"
                />
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={false}
                  aria-controls={listId}
                  aria-label={label}
                  aria-invalid={invalid || undefined}
                  onClick={() => setOpen(true)}
                  className={cn(
                    'flex h-control w-full items-center justify-between gap-2 rounded-md border border-control-border bg-card px-2.5 text-left text-sm focus-visible:border-control-border-focus aria-[invalid=true]:border-destructive',
                    shown && 'pr-8',
                    triggerClassName,
                  )}
                  title={[value.ward, value.district, value.province].filter(Boolean).join(', ')}
                >
                  <span className={cn('truncate', !shown && 'text-subtle-foreground')}>
                    {shown || 'Chọn địa chỉ'}
                  </span>
                  {shown ? null : (
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </button>
                {shown ? (
                  <button
                    type="button"
                    aria-label="Xóa địa chỉ đã chọn"
                    onClick={() => onChange({ province: '', district: '', ward: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-96 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <b className="text-sm font-semibold">Chọn địa chỉ</b>
            <div
              role="tablist"
              aria-label="Bộ địa giới"
              className="flex overflow-hidden rounded-md border border-control-border"
            >
              {(
                [
                  ['NEW', 'Địa chỉ mới'],
                  ['OLD', 'Địa chỉ cũ'],
                ] as const
              ).map(([g, text], i) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={gen === g}
                  onClick={() => {
                    reset(g);
                    inputRef.current?.focus();
                  }}
                  className={cn(
                    'h-7 px-3 text-sm',
                    i > 0 && 'border-l border-control-border',
                    gen === g
                      ? 'bg-info-weak font-semibold text-primary'
                      : 'bg-card text-muted-foreground',
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          <div
            role="tablist"
            aria-label="Bước chọn"
            className={cn('grid border-b', gen === 'NEW' ? 'grid-cols-2' : 'grid-cols-3')}
          >
            {stepTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={step === t.key}
                disabled={!t.enabled}
                onClick={() => {
                  goTo(t.key);
                  inputRef.current?.focus();
                }}
                className={cn(
                  '-mb-px h-9 truncate border-b-2 px-2 text-sm disabled:text-subtle-foreground',
                  step === t.key
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <CommandList id={listId} className="max-h-80 p-1">
            {units.isLoading ? (
              <div className="flex flex-col gap-1.5 p-1" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : units.isError ? (
              <div className="flex flex-col items-start gap-2 p-2 text-sm">
                <span>Không tải được danh sách địa giới.</span>
                <Button size="sm" variant="outline" onClick={() => void units.refetch()}>
                  Thử lại
                </Button>
              </div>
            ) : units.data && !units.data.ready ? (
              <p className="p-2 text-sm text-muted-foreground">
                Danh mục địa giới đang nạp lần đầu — thử lại sau vài phút.
              </p>
            ) : (
              <>
                <CommandEmpty>Không có mục nào khớp</CommandEmpty>
                {items.map((u) => {
                  const chosen = u.level === 'WARD' && (u.converted?.ward ?? u.name) === value.ward;
                  return (
                    <CommandItem
                      key={u.id}
                      value={u.id}
                      keywords={[u.name]}
                      onSelect={() => pick(u)}
                      className="justify-between"
                    >
                      <span className="truncate">{u.name}</span>
                      {chosen ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                    </CommandItem>
                  );
                })}
              </>
            )}
          </CommandList>
          <PickerFooter
            gen={gen}
            step={step}
            count={items.length}
            province={province}
            district={district}
            active={activeUnit}
          />
        </PopoverContent>
      </Popover>
    </Command>
  );
}

function PickerFooter({
  gen,
  step,
  count,
  province,
  district,
  active,
}: {
  gen: GeoGeneration;
  step: Step;
  count: number;
  province: GeoUnit | null;
  district: GeoUnit | null;
  active: GeoUnit | undefined;
}) {
  if (step !== 'ward' || !active) {
    const what =
      step === 'province' ? 'tỉnh / thành' : step === 'district' ? 'quận / huyện' : 'phường / xã';
    return (
      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        {count} {what} · gõ để lọc (không dấu cũng được) · ↑ ↓ Enter
        {step !== 'province' ? ' · Backspace về bước trước' : ''}
      </div>
    );
  }
  if (gen === 'NEW') {
    return (
      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        Sẽ điền:{' '}
        <b className="font-semibold text-foreground">
          {active.name}, {province?.name}
        </b>
      </div>
    );
  }
  if (active.converted?.ward) {
    return (
      <div className="flex items-start gap-2 border-t bg-info-weak px-3 py-2 text-xs text-foreground">
        <Info className="mt-px h-4 w-4 shrink-0 text-info" aria-hidden />
        <span>
          Sẽ lưu theo địa chỉ mới:{' '}
          <b className="font-semibold">
            {active.converted.ward}, {active.converted.province}
          </b>
          . {district?.name} (cũ) giữ lại làm gợi ý cho hãng vận chuyển.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 border-t bg-warning-weak px-3 py-2 text-xs text-foreground">
      <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-warning" aria-hidden />
      <span>
        Chưa đổi được sang địa chỉ mới — mở tab <b className="font-semibold">Địa chỉ mới</b> để chọn
        Phường / Xã. Đơn vẫn lưu được.
      </span>
    </div>
  );
}
