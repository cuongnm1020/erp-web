'use client';

import Decimal from 'decimal.js';
import { Check, MapPin, MoreHorizontal, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import {
  DatePicker,
  EntityPicker,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type EntitySearchResult,
} from '@/components/data/form';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isCarrierReady, useCarriers } from '@/features/wms/api/use-shipping';
import { CarrierSelect } from '@/features/wms/components/carrier-select';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatMoney, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useCustomerBrief, useCustomerSearch } from '../../api/use-line-entry';
import {
  PHONE_SUGGEST_MIN_DIGITS,
  useCareLookup,
  useCustomerPhoneMatch,
  useCustomerPhoneSuggest,
  useSameDayOrders,
  useOrderMarketerOptions,
  useOrderOwnerOptions,
  useOrderStaffOptions,
  useOrderTags,
  useShippingQuotePreview,
  type ShippingQuotePreviewBody,
} from '../../api/use-order-create';
import { useGeoSuggest, type GeoSuggestion } from '../../api/use-orders';
import { GENDER_LABEL } from '../../labels';
import { GENDERS, normalizePhoneInput, type CreateOrderValues } from '../../schema';
import { AddressPicker, addressLabel, type AddressValue } from '../address-picker';
import { NewCustomerFarm } from './new-customer-farm';
import { useDebounced } from './use-debounced';
import { useOrderCustomerPhone } from './use-order-customer-phone';

type Form = UseFormReturn<CreateOrderValues>;
/** Radix Select không nhận value rỗng. */
const NONE = '__none__';

/** Tạm ẩn NV đóng hàng / NV chăm sóc / Marketer trên màn tạo đơn (2026-10-21) — bật lại = true. */
const SHOW_EXTRA_STAFF = false;
const NEW_ADDRESS = '__new__';

/** Khung card chung của màn tạo đơn. */
export function Card({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-2 rounded-lg border bg-card p-3', className)}>
      <header className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {actions ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Một hàng "nhãn ← → ô nhập" của card Thông tin / Vận chuyển. */
function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <label htmlFor={htmlFor} className="text-sm">
        {label}
      </label>
      <div className="w-full sm:w-56">{children}</div>
    </div>
  );
}

/** Nhãn `caption` đậm trên ô (thiết kế redesign Bán hàng 2026-10-22, artboard "Tạo đơn"). */
const FIELD_LABEL = 'text-xs font-semibold text-muted-foreground';

// ── Thông tin ──────────────────────────────────────────────

/** Danh mục nhân viên nhỏ, đã tải hết một lần — lọc gợi ý tại chỗ. */
const staffSearch =
  (useList: typeof useOrderStaffOptions) =>
  (q: string): EntitySearchResult => {
    const staff = useList();
    const needle = q.trim().toLowerCase();
    const options = (Array.isArray(staff.data) ? staff.data : undefined)
      ?.filter(
        (u) =>
          needle === '' ||
          u.fullName.toLowerCase().includes(needle) ||
          u.code.toLowerCase().includes(needle),
      )
      .slice(0, 30)
      .map((u) => ({ id: u.id, label: u.fullName, hint: u.code }));
    return { options, isPending: staff.isPending, error: staff.error };
  };
const useStaffSearch = staffSearch(useOrderStaffOptions);
/** NV xử lý chỉ chọn trong team người tạo (GET /sales-orders/owner-options). */
const useOwnerSearch = staffSearch(useOrderOwnerOptions);
/** Marketer chỉ chọn nhân viên sale (GET /sales-orders/marketer-options, 2026-11-11). */
const useMarketerSearch = staffSearch(useOrderMarketerOptions);

/**
 * Ô NV xử lý không gắn form (màn Sửa đơn, 2026-11-07): cùng danh sách người cùng team như lúc tạo
 * đơn. Doanh số nhân viên + team đi theo người chọn ở đây (server tính lại team).
 */
export function OwnerPicker({
  value,
  onChange,
  currentName,
  disabled,
}: {
  value: string;
  onChange: (id: string, name: string | null) => void;
  /** Tên NV xử lý hiện tại của đơn — người đó có thể không nằm trong danh sách chọn của mình. */
  currentName?: string | null;
  disabled?: boolean;
}) {
  const owners = useOrderOwnerOptions();
  const list = Array.isArray(owners.data) ? owners.data : [];
  return (
    <EntityPicker
      value={value}
      onChange={(id, option) => {
        if (id) onChange(id, option?.label ?? null);
      }}
      useSearch={useOwnerSearch}
      selectedLabel={list.find((u) => u.id === value)?.fullName ?? currentName ?? undefined}
      placeholder="Chọn NV xử lý"
      searchPlaceholder="Tìm tên, mã nhân viên…"
      emptyText="Không có nhân viên khớp"
      disabled={disabled}
      aria-label="NV xử lý"
    />
  );
}

/**
 * Ô Marketer không gắn form (màn Sửa đơn, 2026-11-11): chỉ nhân viên sale; xoá được (`''` = bỏ
 * gán). Marketer cũ có thể không còn là sale — hiện tên từ đơn.
 */
export function MarketerPicker({
  value,
  onChange,
  currentName,
  disabled,
}: {
  value: string;
  onChange: (id: string, name: string | null) => void;
  currentName?: string | null;
  disabled?: boolean;
}) {
  const marketers = useOrderMarketerOptions();
  const list = Array.isArray(marketers.data) ? marketers.data : [];
  return (
    <EntityPicker
      value={value}
      onChange={(id) => onChange(id, list.find((u) => u.id === id)?.fullName ?? null)}
      useSearch={useMarketerSearch}
      selectedLabel={list.find((u) => u.id === value)?.fullName ?? currentName ?? undefined}
      placeholder="Chọn nhân viên sale"
      searchPlaceholder="Tìm tên, mã nhân viên…"
      emptyText="Không có nhân viên sale khớp"
      clearable
      disabled={disabled}
      aria-label="Marketer"
    />
  );
}

/**
 * Ô chọn nhân viên trên đơn. `bare` = chỉ ô chọn (nhãn do nơi gọi vẽ — dải "Thông tin đơn" đầu
 * màn, redesign 2026-10-22); mặc định = hàng nhãn ← → ô của card bên phải.
 */
export function StaffField({
  form,
  name,
  label,
  placeholder,
  bare = false,
}: {
  form: Form;
  name: 'ownerId' | 'packerId' | 'careStaffId' | 'marketerId';
  label: string;
  placeholder: string;
  bare?: boolean;
}) {
  const isOwner = name === 'ownerId';
  const isMarketer = name === 'marketerId';
  const staffAll = useOrderStaffOptions();
  const owners = useOrderOwnerOptions();
  const marketers = useOrderMarketerOptions();
  const staff = isOwner ? owners : isMarketer ? marketers : staffAll;
  const useSearch = isOwner ? useOwnerSearch : isMarketer ? useMarketerSearch : useStaffSearch;
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const picker = (
          <FormControl>
            <EntityPicker
              value={field.value}
              onChange={(id) => field.onChange(id)}
              useSearch={useSearch}
              selectedLabel={staff.data?.find((u) => u.id === field.value)?.fullName}
              placeholder={placeholder}
              searchPlaceholder="Tìm tên, mã nhân viên…"
              emptyText="Không có nhân viên khớp"
              clearable
              aria-label={label}
            />
          </FormControl>
        );
        return (
          <FormItem>
            {bare ? picker : <Row label={label}>{picker}</Row>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

export function TagPicker({ form }: { form: Form }) {
  const tags = useOrderTags();
  const selected = useWatch({ control: form.control, name: 'tagIds' });
  const byId = useMemo(() => new Map((tags.data ?? []).map((t) => [t.id, t])), [tags.data]);
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    form.setValue('tagIds', next, { shouldDirty: true, shouldValidate: true });
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((id) => (
        <span
          key={id}
          className="inline-flex h-7 items-center gap-1 rounded bg-warning-weak px-2 text-xs font-medium"
        >
          {byId.get(id)?.name ?? '…'}
          <button
            type="button"
            aria-label={`Bỏ thẻ ${byId.get(id)?.name ?? ''}`}
            onClick={() => toggle(id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7">
            <Plus aria-hidden />
            Thêm thẻ
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Tìm thẻ…" />
            <CommandList>
              <CommandEmpty>
                {tags.isPending ? 'Đang tải…' : 'Chưa có thẻ — tạo ở Danh mục khách hàng › Thẻ'}
              </CommandEmpty>
              <CommandGroup>
                {(tags.data ?? []).map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`${t.name} ${t.code}`}
                    onSelect={() => toggle(t.id)}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        selected.includes(t.id) ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    {t.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * NV phụ (NV đóng hàng / NV chăm sóc) — tạm ẩn (user yêu cầu 2026-10-21), bật lại bằng cờ.
 * Marketer đã lên dải "Thông tin đơn" (2026-11-11). Ngày tạo đơn đã lên dải "Thông tin đơn" đầu màn (2026-11-03).
 */
export function InfoCard({ form }: { form: Form }) {
  if (!SHOW_EXTRA_STAFF) return null;
  return (
    <Card title="Nhân viên phụ">
      <StaffField
        form={form}
        name="packerId"
        label="NV đóng hàng"
        placeholder="Chọn NV đóng hàng"
      />
      <StaffField
        form={form}
        name="careStaffId"
        label="NV chăm sóc"
        placeholder="Chọn NV chăm sóc"
      />
    </Card>
  );
}

// ── Gợi ý khách theo SĐT gõ dở ─────────────────────────────

type PhoneSuggestion = NonNullable<ReturnType<typeof useCustomerPhoneSuggest>['data']>[number];

/**
 * Gợi ý khách khi gõ dở SĐT (2026-10-29) — chỉ khách người lên đơn được xem. Dùng ở ô SĐT khách và
 * ô SĐT người nhận (2026-11-14). Trả props combobox cho ô nhập + danh sách đặt ngay dưới ô.
 */
function usePhoneSuggest(
  rawPhone: string,
  enabled: boolean,
  listId: string,
  onPick: (c: PhoneSuggestion) => void,
) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const digits = useDebounced(enabled ? normalizePhoneInput(rawPhone) : '', 250);
  const suggest = useCustomerPhoneSuggest(digits);
  const items = digits.length >= PHONE_SUGGEST_MIN_DIGITS ? (suggest.data ?? []) : [];
  const show = open && enabled && items.length > 0;
  useEffect(() => setActive(0), [digits]);

  const pick = (c: PhoneSuggestion) => {
    setOpen(false);
    onPick(c);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!show) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return {
    inputProps: {
      role: 'combobox' as const,
      'aria-expanded': show,
      'aria-controls': listId,
      'aria-autocomplete': 'list' as const,
      onKeyDown,
      onFocus: () => setOpen(true),
    },
    /** Gọi trong onChange của ô — gõ thì mở lại danh sách. */
    reopen: () => setOpen(true),
    /** Gọi trong onBlur của ô — trễ để kịp nhận cú bấm vào gợi ý. */
    closeSoon: () => setTimeout(() => setOpen(false), 150),
    list: show ? (
      <ul
        id={listId}
        role="listbox"
        aria-label="Khách có SĐT khớp"
        className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full overflow-y-auto sm:w-80 rounded-md border bg-popover p-1 shadow-md"
      >
        {items.map((c, i) => (
          <li
            key={c.id}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(c)}
            className={cn(
              'cursor-pointer rounded px-2 py-1.5 text-sm',
              i === active && 'bg-accent',
            )}
          >
            <span className="block truncate font-medium">{c.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{normalizePhoneInput(c.phone ?? '')}</span> ·{' '}
              {c.code}
            </span>
          </li>
        ))}
      </ul>
    ) : null,
  };
}

/** Chọn khách từ gợi ý SĐT → gắn khách; phần Nhận hàng xoá để ReceiverCard điền địa chỉ đơn gần nhất. */
function attachSuggested(form: Form, c: PhoneSuggestion) {
  const set = (k: keyof CreateOrderValues, v: string) => form.setValue(k, v, { shouldDirty: true });
  set('addressId', '');
  for (const k of ADDRESS_FIELDS) set(k, '');
  set('customerId', c.id);
  set('customerName', c.name);
  set('customerPhone', normalizePhoneInput(c.phone ?? ''));
}

// ── Khách hàng ─────────────────────────────────────────────

export function CustomerCard({ form }: { form: Form }) {
  const customerId = useWatch({ control: form.control, name: 'customerId' });
  // SĐT gõ ở ô này (gợi ý, gỡ khách khi đổi số) …
  const typedPhone = useWatch({ control: form.control, name: 'customerPhone' });
  // … còn tra khách đã có / đơn trùng theo SĐT khách của đơn: ô này, trống thì SĐT người nhận
  // (2026-11-14 — ô Khách hàng chỉ để tìm, không bắt nhập lại).
  const phone = useOrderCustomerPhone(form);
  const brief = useCustomerBrief(customerId);
  const match = useCustomerPhoneMatch(customerId ? '' : phone);
  // Tra SĐT toàn hệ thống (mọi người lên đơn, 2026-10-22 — trước chỉ CSKH) — khách ngoài tầm nhìn
  // (của sale / team khác) vẫn lên đơn đúng khách, không tạo trùng; server tự gắn theo SĐT khi chốt
  // (không gắn customerId ở đây: hồ sơ khách đó không mở được).
  const canCare = useAbility().can('care', 'Customer');
  const care = useCareLookup(customerId ? '' : phone, match.data === null);
  const careCustomer = !customerId && match.data === null ? care.data?.customer : undefined;
  const sameDay = useSameDayOrders(phone);
  const [pickOpen, setPickOpen] = useState(false);
  const suggest = usePhoneSuggest(typedPhone, !customerId, 'customer-phone-suggest', (c) =>
    attachSuggested(form, c),
  );
  // Email / ngày sinh / giới tính không có trên thiết kế — gập sau menu ⋯, tự mở khi đã có giá trị.
  const [extraOpen, setExtraOpen] = useState(
    () =>
      form.getValues('customerEmail') !== '' ||
      form.getValues('customerBirthday') !== '' ||
      form.getValues('customerGender') !== '',
  );

  const [careChosenId, setCareChosenId] = useState('');
  const setValue = (k: keyof CreateOrderValues, v: string) =>
    form.setValue(k, v, { shouldDirty: true });
  const clearReceiver = () => {
    setValue('addressId', '');
    for (const k of ADDRESS_FIELDS) setValue(k, '');
  };

  // SĐT gõ trùng khách đã có (2026-10-28): KHÔNG tự gắn — hiện khách để người lên đơn bấm "Chọn
  // khách này", rồi mới điền tên + phần Nhận hàng (ghi đè cái đang gõ). Server vẫn tự khớp theo SĐT
  // khi chốt.
  /** Khách trong tầm nhìn → gắn vào đơn (giá theo bảng giá khách, địa chỉ đã lưu do ReceiverCard điền). */
  const pickMatch = () => {
    if (!match.data) return;
    clearReceiver();
    setValue('customerId', match.data.id);
    setValue('customerName', match.data.name);
  };
  /** Khách ngoài tầm nhìn → chỉ điền tên + địa chỉ mặc định (hồ sơ không mở được, không gắn id). */
  const pickCare = () => {
    if (!careCustomer) return;
    setCareChosenId(careCustomer.id);
    clearReceiver();
    // SĐT khách giữ ở ô Khách hàng — tra từ SĐT người nhận thì địa chỉ điền vào có thể mang số khác.
    setValue('customerPhone', phone);
    setValue('customerName', careCustomer.name);
    const a = careCustomer.address;
    setValue('recipient', a?.recipient || careCustomer.name);
    setValue('recipientPhone', a?.phone || careCustomer.phone || phone);
    if (!a) return;
    setValue('line1', [a.line1, a.hamlet].filter(Boolean).join(', '));
    setValue('ward', a.ward ?? '');
    setValue('district', a.district ?? '');
    setValue('province', a.province);
  };

  // Khách mới (SĐT chưa có trên hệ thống) → chép SĐT gõ ở ô này xuống SĐT người nhận, trừ khi người
  // nhận đã được gõ số khác.
  const normalizedPhone = phone;
  const typedNormalized = normalizePhoneInput(typedPhone);
  const isNewCustomer =
    !customerId &&
    /^0\d{9,10}$/.test(normalizedPhone) &&
    match.data === null &&
    care.isSuccess &&
    !care.data.customer;
  // Khách mới → bắt buộc thông tin khai thác (2026-11-02); cờ nằm trong form để schema kiểm.
  useEffect(() => {
    if (form.getValues('customerIsNew') !== isNewCustomer) {
      form.setValue('customerIsNew', isNewCustomer);
    }
  }, [isNewCustomer, form]);
  const autoRecipientPhone = useRef('');
  useEffect(() => {
    if (!isNewCustomer || typedNormalized === '') return;
    const cur = form.getValues('recipientPhone');
    if (cur !== '' && cur !== autoRecipientPhone.current) return;
    autoRecipientPhone.current = typedNormalized;
    form.setValue('recipientPhone', typedNormalized, { shouldDirty: true });
  }, [isNewCustomer, typedNormalized, form]);

  // Khách vừa gắn (chọn từ danh sách / khớp SĐT / tạo lại đơn) → điền các ô còn trống.
  useEffect(() => {
    if (!brief.data) return;
    const fillEmpty = (k: 'customerName' | 'customerPhone' | 'customerEmail', v: string | null) => {
      if (v && form.getValues(k) === '') form.setValue(k, v, { shouldDirty: true });
    };
    fillEmpty('customerName', brief.data.name);
    fillEmpty('customerPhone', brief.data.phone);
    fillEmpty('customerEmail', brief.data.email);
  }, [brief.data, form]);

  // Đổi SĐT ở ô này khác số của khách đang gắn → gỡ khách (đơn sẽ đi theo SĐT mới).
  useEffect(() => {
    if (!customerId || !brief.data?.phone) return;
    if (typedNormalized !== '' && typedNormalized !== normalizePhoneInput(brief.data.phone)) {
      form.setValue('customerId', '', { shouldDirty: true });
      form.setValue('addressId', '', { shouldDirty: true });
    }
  }, [typedNormalized, customerId, brief.data, form]);

  const clearCustomer = () => {
    for (const k of [
      'customerId',
      'customerName',
      'customerPhone',
      'customerEmail',
      'addressId',
    ] as const) {
      form.setValue(k, '', { shouldDirty: true });
    }
  };

  return (
    <Card
      title="Khách hàng"
      actions={
        <>
          {customerId && brief.data ? <StatusBadge tone="ok">Khách cũ</StatusBadge> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Tùy chọn khách hàng"
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setPickOpen(true)}>
                Chọn khách có sẵn…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setExtraOpen((o) => !o)}>
                {extraOpen ? 'Ẩn email, ngày sinh, giới tính' : 'Thêm email, ngày sinh, giới tính'}
              </DropdownMenuItem>
              {customerId || typedPhone ? (
                <DropdownMenuItem onSelect={clearCustomer}>Xóa thông tin khách</DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      {pickOpen ? (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <EntityPicker
              value={customerId}
              onChange={(id, opt) => {
                setPickOpen(false);
                if (!id) return;
                clearReceiver();
                form.setValue('customerId', id, { shouldDirty: true });
                form.setValue('customerName', opt?.label ?? '', { shouldDirty: true });
                form.setValue('customerPhone', '', { shouldDirty: true });
                form.setValue('customerEmail', '', { shouldDirty: true });
              }}
              useSearch={useCustomerSearch}
              placeholder="Tìm theo tên, mã, SĐT…"
              aria-label="Chọn khách có sẵn"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPickOpen(false)}>
            Đóng
          </Button>
        </div>
      ) : null}

      {/* SĐT trước tên (2026-10-21): gõ SĐT là tra ngay khách đã có trên hệ thống. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="customerPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={FIELD_LABEL}>Số điện thoại</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    aria-label="Số điện thoại khách"
                    placeholder="SĐT — tìm khách đã có"
                    inputMode="tel"
                    autoComplete="off"
                    className="tabular-nums"
                    {...suggest.inputProps}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      suggest.reopen();
                    }}
                    onBlur={() => {
                      field.onBlur();
                      suggest.closeSoon();
                    }}
                  />
                </FormControl>
                {suggest.list}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={FIELD_LABEL}>Tên khách</FormLabel>
              <FormControl>
                <Input
                  aria-label="Tên khách hàng"
                  placeholder="Trống = theo người nhận"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {extraOpen ? (
        <div className="grid gap-2.5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="customerEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Địa chỉ email</FormLabel>
                <FormControl>
                  <Input placeholder="Địa chỉ email" type="email" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="customerBirthday"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Ngày sinh</FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Ngày sinh"
                    toDate={new Date()}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="customerGender"
            render={({ field }) => (
              <FormItem>
                <Select
                  value={field.value || NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                >
                  <FormControl>
                    <SelectTrigger aria-label="Giới tính">
                      <SelectValue placeholder="Giới tính" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>Giới tính</SelectItem>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
      ) : null}

      {customerId && brief.data ? (
        <p className="flex min-w-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
          Mã KH
          <span className="min-w-0 truncate font-mono" title={brief.data.code}>
            {brief.data.code}
          </span>
          {brief.data.addresses.length > 0 ? (
            <span>· {brief.data.addresses.length} địa chỉ đã lưu</span>
          ) : null}
          <span>·</span>
          <a
            href={`/crm/customers/${brief.data.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Xem hồ sơ
          </a>
        </p>
      ) : !customerId && match.data ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-info-line bg-info-weak px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <b className="font-semibold">{match.data.name}</b>{' '}
            <span className="font-mono text-xs text-muted-foreground">{match.data.code}</span>{' '}
            <StatusBadge tone="ok">Khách đã có</StatusBadge>
            <p className="text-muted-foreground">Chọn để điền tên và địa chỉ nhận hàng.</p>
          </div>
          <Button type="button" size="sm" onClick={pickMatch}>
            Chọn khách này
          </Button>
        </div>
      ) : careCustomer ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-info-line bg-info-weak px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <b className="font-semibold">{careCustomer.name}</b>{' '}
            <span className="font-mono text-xs text-muted-foreground">{careCustomer.code}</span>{' '}
            <StatusBadge tone="neutral">
              {!canCare
                ? 'Khách đã có'
                : care.data?.careTeam === 'OTHER'
                  ? 'Khách team khác'
                  : 'Chưa thuộc team CSKH'}
            </StatusBadge>
            <p className="text-muted-foreground">
              {!canCare || care.data?.careTeam === 'OTHER'
                ? 'Đơn này tính doanh thu cho bạn và team bạn. Khách vẫn do người / team đang quản lý chăm.'
                : 'Chốt đơn sẽ đưa khách về team bạn.'}
            </p>
          </div>
          {careChosenId !== careCustomer.id ? (
            <Button type="button" size="sm" onClick={pickCare}>
              Chọn khách này
            </Button>
          ) : null}
        </div>
      ) : !customerId && /^0\d{9,10}$/.test(normalizedPhone) && match.data === null ? (
        <p className="text-xs text-muted-foreground">
          Khách mới — sẽ tạo hồ sơ khách khi chốt đơn.
        </p>
      ) : null}

      {isNewCustomer ? <NewCustomerFarm form={form} /> : null}

      {sameDay.data && sameDay.data.total > 0 ? (
        <p role="status" className="rounded-md bg-warning-weak px-3 py-2 text-sm text-warning">
          <b className="font-semibold">Khách đã có {sameDay.data.total} đơn hôm nay</b>
          {sameDay.data.hiddenCount > 0 ? ` (${sameDay.data.hiddenCount} đơn của team khác)` : ''}.
          Kiểm tra trước khi chốt để không giao trùng.
        </p>
      ) : null}
    </Card>
  );
}

// ── Nhận hàng ──────────────────────────────────────────────

const ADDRESS_FIELDS = [
  'recipient',
  'recipientPhone',
  'line1',
  'ward',
  'district',
  'province',
] as const;

export function ReceiverCard({ form }: { form: Form }) {
  const customerId = useWatch({ control: form.control, name: 'customerId' });
  const addressId = useWatch({ control: form.control, name: 'addressId' });
  const brief = useCustomerBrief(customerId);
  const addresses = useMemo(() => brief.data?.addresses ?? [], [brief.data]);
  const filledFor = useRef<string>('');
  const recipientPhone = useWatch({ control: form.control, name: 'recipientPhone' });
  // Gợi ý khách khi gõ dở SĐT người nhận (2026-11-14) — như ô Khách hàng; chưa gắn khách mới gợi ý.
  const suggest = usePhoneSuggest(recipientPhone, !customerId, 'recipient-phone-suggest', (c) =>
    attachSuggested(form, c),
  );

  const fill = (id: string) => {
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    form.setValue('addressId', a.id, { shouldDirty: true });
    form.setValue('recipient', a.recipient, { shouldDirty: true });
    form.setValue('recipientPhone', a.phone, { shouldDirty: true });
    form.setValue('line1', [a.line1, a.hamlet].filter(Boolean).join(', '), { shouldDirty: true });
    form.setValue('ward', a.ward ?? '', { shouldDirty: true });
    form.setValue('district', a.district ?? '', { shouldDirty: true });
    form.setValue('province', a.province, { shouldDirty: true });
  };

  // Khách vừa gắn vào đơn mà phần nhận hàng còn trống → điền sẵn địa chỉ của đơn mua gần nhất
  // (2026-10-29), chưa có thì địa chỉ mặc định. Không có địa chỉ để chọn sẵn → điền ít nhất tên +
  // SĐT khách làm người nhận.
  useEffect(() => {
    if (!brief.data) {
      if (!customerId) filledFor.current = '';
      return;
    }
    if (filledFor.current === brief.data.id) return;
    filledFor.current = brief.data.id;
    const typed = ADDRESS_FIELDS.some((k) => form.getValues(k) !== '');
    if (typed || form.getValues('addressId')) return;
    const preferred =
      addresses.find((a) => a.id === brief.data.lastOrderAddressId) ??
      addresses.find((a) => a.isDefault) ??
      (addresses.length === 1 ? addresses[0] : undefined);
    if (preferred) fill(preferred.id);
    else {
      form.setValue('recipient', brief.data.name, { shouldDirty: true });
      form.setValue('recipientPhone', brief.data.phone ?? '', { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi đổi khách
  }, [brief.data]);

  /** Sửa tay một ô của địa chỉ đã chọn → thành địa chỉ mới (server lưu thêm khi chốt). */
  const onTyped = (name: (typeof ADDRESS_FIELDS)[number], value: string) => {
    form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    if (form.getValues('addressId')) form.setValue('addressId', '', { shouldDirty: true });
  };

  const textField = (
    name: (typeof ADDRESS_FIELDS)[number],
    label: string,
    placeholder: string,
    extra?: { className?: string; inputMode?: 'tel' },
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={extra?.className}>
          <FormLabel className={FIELD_LABEL}>{label}</FormLabel>
          <FormControl>
            <Input
              aria-label={placeholder}
              placeholder={placeholder}
              autoComplete="off"
              inputMode={extra?.inputMode}
              name={field.name}
              ref={field.ref}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => onTyped(name, e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Card title="Nhận hàng">
      {addresses.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>Địa chỉ đã lưu</span>
          <Select
            value={addressId || NEW_ADDRESS}
            onValueChange={(v) => {
              if (v === NEW_ADDRESS) {
                form.setValue('addressId', '', { shouldDirty: true });
                for (const k of ADDRESS_FIELDS) form.setValue(k, '', { shouldDirty: true });
              } else fill(v);
            }}
          >
            <SelectTrigger aria-label="Chọn địa chỉ đã lưu">
              <SelectValue placeholder="Chọn địa chỉ" />
            </SelectTrigger>
            <SelectContent>
              {addresses.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label ? `${a.label} · ` : ''}
                  {a.recipient} · {[a.line1, a.ward, a.province].filter(Boolean).join(', ')}
                  {a.isDefault ? ' (mặc định)' : ''}
                </SelectItem>
              ))}
              <SelectItem value={NEW_ADDRESS}>Địa chỉ mới (nhập tay)</SelectItem>
            </SelectContent>
          </Select>
          {addressId ? (
            <p className="text-xs text-muted-foreground">
              Sửa ô nào bên dưới sẽ lưu thành địa chỉ mới của khách.
            </p>
          ) : null}
        </div>
      ) : null}
      {/* SĐT trước tên (2026-11-14, như ô Khách hàng): gõ SĐT là gợi ý khách đã có. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="recipientPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={FIELD_LABEL}>SĐT người nhận</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    aria-label="Số điện thoại người nhận"
                    placeholder="SĐT — tìm khách đã có"
                    autoComplete="off"
                    inputMode="tel"
                    className="tabular-nums"
                    {...suggest.inputProps}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={() => {
                      field.onBlur();
                      suggest.closeSoon();
                    }}
                    onChange={(e) => {
                      onTyped('recipientPhone', e.target.value);
                      suggest.reopen();
                    }}
                  />
                </FormControl>
                {suggest.list}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {textField('recipient', 'Người nhận', 'Tên người nhận')}
        {textField('line1', 'Địa chỉ', 'Địa chỉ chi tiết (số nhà, đường, thôn/xóm)', {
          className: 'sm:col-span-2',
        })}
      </div>
      <AddressSuggestions form={form} onApply={onTyped} />
      <AddressPickerField form={form} onApply={onTyped} />
      <FormField
        control={form.control}
        name="expectedDeliveryDate"
        render={({ field }) => (
          <FormItem>
            <Row label="Dự kiến nhận hàng">
              <FormControl>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Chọn ngày"
                  fromDate={new Date()}
                  className="w-full"
                />
              </FormControl>
            </Row>
            <FormMessage />
          </FormItem>
        )}
      />
    </Card>
  );
}

/**
 * Ô "Tỉnh / Phường xã" (bộ chọn kiểu Pancake, 2026-11-07) thay ba ô Xã / Huyện / Tỉnh gõ tay.
 * Lỗi bắt buộc của Tỉnh hiện dưới ô.
 */
function AddressPickerField({
  form,
  onApply,
}: {
  form: Form;
  onApply: (name: (typeof ADDRESS_FIELDS)[number], value: string) => void;
}) {
  const [ward, district, province] = useWatch({
    control: form.control,
    name: ['ward', 'district', 'province'],
  });
  const error = form.formState.errors.province?.message;
  return (
    <div className="flex flex-col gap-1">
      <span className={FIELD_LABEL}>Tỉnh / Phường xã</span>
      <AddressPicker
        value={{ ward: ward ?? '', district: district ?? '', province: province ?? '' }}
        invalid={!!error}
        onChange={(v) => {
          onApply('ward', v.ward);
          onApply('district', v.district);
          onApply('province', v.province);
        }}
      />
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * Gợi ý địa chỉ từ dòng Địa chỉ (2026-10-26, kiểu Pancake): gõ "0332119579, Xã Quảng Tân, Huyện Tuy
 * Đức, Đắk Nông" → "Xã Quảng Tân, Huyện Tuy Đức, Đắk Nông · Địa chỉ cũ"; bấm thì điền ô "Tỉnh /
 * Phường xã" đúng bộ khách gõ — địa chỉ cũ giữ cũ, mới giữ mới, KHÔNG tự đổi (user 2026-11-07:
 * nhiều hãng chưa dùng địa chỉ mới) — và dòng Địa chỉ chỉ còn phần không phải địa giới. Gợi ý trùng
 * với ô đang có thì ẩn.
 */
function AddressSuggestions({
  form,
  onApply,
}: {
  form: Form;
  onApply: (name: (typeof ADDRESS_FIELDS)[number], value: string) => void;
}) {
  const [line1, ward, district, province] = useWatch({
    control: form.control,
    name: ['line1', 'ward', 'district', 'province'],
  });
  const q = useDebounced(line1 ?? '', 300);
  const ctxProvince = useDebounced(province ?? '', 300);
  const ctxDistrict = useDebounced(district ?? '', 300);
  const suggest = useGeoSuggest(q, { province: ctxProvince, district: ctxDistrict });
  const items = (suggest.data?.items ?? [])
    .map((s) => ({ s, v: suggestionValue(s) }))
    .filter(
      ({ v }) =>
        !(v.province === province && v.ward === (ward ?? '') && v.district === (district ?? '')),
    );
  if (!items.length) return null;
  const apply = ({ s, v }: (typeof items)[number]) => {
    onApply('ward', v.ward);
    onApply('district', v.district);
    onApply('province', v.province);
    if (s.line1 && s.line1 !== line1) onApply('line1', s.line1);
  };
  return (
    <div
      className="flex flex-col gap-0.5 rounded-md border bg-card p-1"
      role="group"
      aria-label="Gợi ý địa chỉ"
    >
      <span className="px-2 py-0.5 text-xs font-semibold text-muted-foreground">Gợi ý địa chỉ</span>
      {items.map((it) => (
        <button
          key={`${it.s.generation}|${it.s.label}`}
          type="button"
          onClick={() => apply(it)}
          className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
        >
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{addressLabel(it.v)}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {it.s.generation === 'OLD' ? 'Địa chỉ cũ' : 'Địa chỉ mới'}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Giá trị điền vào ô địa chỉ từ một gợi ý — đúng bộ khách gõ (cũ giữ Xã / Huyện / Tỉnh cũ). */
function suggestionValue(s: GeoSuggestion): AddressValue {
  return { province: s.province, ward: s.ward ?? '', district: s.district ?? '' };
}

// ── Vận chuyển ─────────────────────────────────────────────

export function ShippingCard({
  form,
  estimatedWeightKg,
  codAmount,
}: {
  form: Form;
  /** Σ cân nặng dòng (kg) — gợi ý khi chưa nhập tay; null = chưa đủ dữ liệu. */
  estimatedWeightKg: string | null;
  /** Tiền thu hộ đang tính trên form, Decimal(18,4) chuỗi. */
  codAmount: string | null;
}) {
  const carriers = useCarriers();
  // Hãng vận chuyển chỉ kho / admin chọn (2026-10-31) — sale / CSKH không thấy ô chọn hãng.
  const canChooseCarrier = useAbility().can('send_carrier', 'SalesOrder');
  const [carrierId, carrierAccountId, warehouseId, province, ward, district, line1, weight] =
    useWatch({
      control: form.control,
      name: [
        'carrierId',
        'carrierAccountId',
        'warehouseId',
        'province',
        'ward',
        'district',
        'line1',
        'shippingWeightKg',
      ],
    });
  // Chỉ hãng đã cấu hình — hãng chưa có token / tài khoản chọn vào chỉ để hãng báo lỗi.
  const active = (carriers.data ?? []).filter(isCarrierReady);
  const carrier = active.find((c) => c.id === carrierId);
  const canQuote = carrier?.operations.includes('quote') ?? false;
  const weightKg = weight && !new Decimal(weight).isZero() ? weight : estimatedWeightKg;

  const body: ShippingQuotePreviewBody | null =
    carrierId && canQuote && province.trim() && weightKg && new Decimal(weightKg).greaterThan(0)
      ? {
          carrierId,
          ...(carrierAccountId ? { carrierAccountId } : {}),
          ...(warehouseId ? { warehouseId } : {}),
          province: province.trim(),
          ...(ward.trim() ? { ward: ward.trim() } : {}),
          ...(district.trim() ? { district: district.trim() } : {}),
          ...(line1.trim() ? { address: line1.trim() } : {}),
          weightKg: new Decimal(weightKg).toFixed(4),
          codAmount: codAmount ?? '0',
        }
      : null;
  const debouncedBody = useDebounced(body, 500);
  const quote = useShippingQuotePreview(debouncedBody);

  // Kích thước (dài × rộng × cao) ẩn theo yêu cầu 2026-10-22 — ô trống, đơn không gửi kích thước.
  return (
    <Card title="Vận chuyển">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {!canChooseCarrier ? (
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
            <span className={FIELD_LABEL}>ĐVVC</span>
            <span className="text-sm text-muted-foreground">Kho chọn khi gửi hàng</span>
          </div>
        ) : (
          <FormField
            control={form.control}
            name="carrierId"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel className={FIELD_LABEL}>ĐVVC</FormLabel>
                <FormControl>
                  <CarrierSelect
                    aria-label="Đơn vị vận chuyển"
                    value={
                      field.value
                        ? { carrierId: field.value, accountId: carrierAccountId || null }
                        : NONE
                    }
                    specials={[{ value: NONE, label: 'Chưa chọn ĐVVC' }]}
                    placeholder="Chưa chọn ĐVVC"
                    onChange={(v) => {
                      field.onChange(typeof v === 'string' ? '' : v.carrierId);
                      form.setValue(
                        'carrierAccountId',
                        typeof v === 'string' ? '' : (v.accountId ?? ''),
                        { shouldDirty: true },
                      );
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="shippingWeightKg"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={FIELD_LABEL} htmlFor="order-weight">
                Khối lượng
              </FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    id="order-weight"
                    aria-label="Khối lượng (kg)"
                    inputMode="decimal"
                    placeholder={
                      estimatedWeightKg ? `${formatQuantity(estimatedWeightKg)} (theo SP)` : '0'
                    }
                    className="pr-9 tabular-nums"
                    {...field}
                  />
                </FormControl>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  kg
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className={FIELD_LABEL}>Cước hãng báo</span>
          <span className="flex h-8 items-center text-sm font-semibold tabular-nums">
            {!carrierId
              ? '—'
              : !canQuote
                ? 'Hãng không báo cước'
                : body === null
                  ? 'Cần tỉnh + khối lượng'
                  : quote.isFetching
                    ? 'Đang tra…'
                    : quote.data
                      ? formatMoney(quote.data.fee)
                      : quote.isError
                        ? 'Không tra được'
                        : '—'}
          </span>
        </div>
      </div>
      {quote.isError && body !== null && !quote.isFetching ? (
        <p className="text-xs text-destructive">{messageFor(quote.error)}</p>
      ) : null}
      {quote.data ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Lấy hàng tại {quote.data.pickupSummary}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() =>
              form.setValue('shippingFee', new Decimal(quote.data.fee).toFixed(0), {
                shouldDirty: true,
              })
            }
          >
            Áp vào phí vận chuyển
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
