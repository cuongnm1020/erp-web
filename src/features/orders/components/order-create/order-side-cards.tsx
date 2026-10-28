'use client';

import Decimal from 'decimal.js';
import { Check, ChevronDown, ChevronUp, MapPin, MoreHorizontal, Plus, X } from 'lucide-react';
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
  useCareLookup,
  useCustomerPhoneMatch,
  useSameDayOrders,
  useOrderOwnerOptions,
  useOrderStaffOptions,
  useOrderTags,
  useShippingQuotePreview,
  type ShippingQuotePreviewBody,
} from '../../api/use-order-create';
import { useGeoSuggest, type GeoSuggestion } from '../../api/use-orders';
import { GENDER_LABEL } from '../../labels';
import { GENDERS, normalizePhoneInput, type CreateOrderValues } from '../../schema';

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
    const options = staff.data
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
  const staffAll = useOrderStaffOptions();
  const owners = useOrderOwnerOptions();
  const staff = isOwner ? owners : staffAll;
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
              useSearch={isOwner ? useOwnerSearch : useStaffSearch}
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
 * Giờ tạo đơn (ghi lùi) + NV phụ (đang ẩn). NV xử lý và Thẻ đã lên dải "Thông tin đơn" đầu màn
 * (redesign 2026-10-22) — card này đóng sẵn vì hiếm dùng.
 */
export function InfoCard({ form }: { form: Form }) {
  const orderDate = useWatch({ control: form.control, name: 'orderDate' });
  const [open, setOpen] = useState(Boolean(orderDate));
  return (
    <Card
      title={
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5"
        >
          Giờ tạo đơn
          {open ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </button>
      }
    >
      {open ? (
        <>
          <FormField
            control={form.control}
            name="orderDate"
            render={({ field }) => (
              <FormItem>
                <Row label="Tạo lúc" htmlFor="order-created-at">
                  <FormControl>
                    <Input
                      id="order-created-at"
                      type="datetime-local"
                      className="tabular-nums"
                      {...field}
                    />
                  </FormControl>
                </Row>
                <p className="text-right text-xs text-muted-foreground">
                  {field.value
                    ? 'Ghi lùi giờ tạo đơn — kỳ kế toán phải đang mở'
                    : 'Để trống = lúc chốt đơn'}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Tạm ẩn NV đóng hàng / NV chăm sóc / Marketer (user yêu cầu 2026-10-21) — bật lại bằng cờ. */}
          {SHOW_EXTRA_STAFF ? (
            <>
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
              <StaffField
                form={form}
                name="marketerId"
                label="Marketer"
                placeholder="Chọn Marketer"
              />
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

// ── Khách hàng ─────────────────────────────────────────────

export function CustomerCard({ form }: { form: Form }) {
  const customerId = useWatch({ control: form.control, name: 'customerId' });
  const phone = useWatch({ control: form.control, name: 'customerPhone' });
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
    setValue('customerName', careCustomer.name);
    const a = careCustomer.address;
    setValue('recipient', a?.recipient || careCustomer.name);
    setValue('recipientPhone', a?.phone || careCustomer.phone || normalizePhoneInput(phone));
    if (!a) return;
    setValue('line1', [a.line1, a.hamlet].filter(Boolean).join(', '));
    setValue('ward', a.ward ?? '');
    setValue('district', a.district ?? '');
    setValue('province', a.province);
  };

  // Khách mới (SĐT chưa có trên hệ thống) → chép SĐT xuống SĐT người nhận, trừ khi người nhận đã
  // được gõ số khác.
  const normalizedPhone = normalizePhoneInput(phone);
  const isNewCustomer =
    !customerId &&
    /^0\d{9,10}$/.test(normalizedPhone) &&
    match.data === null &&
    care.isSuccess &&
    !care.data.customer;
  const autoRecipientPhone = useRef('');
  useEffect(() => {
    if (!isNewCustomer) return;
    const cur = form.getValues('recipientPhone');
    if (cur !== '' && cur !== autoRecipientPhone.current) return;
    autoRecipientPhone.current = normalizedPhone;
    form.setValue('recipientPhone', normalizedPhone, { shouldDirty: true });
  }, [isNewCustomer, normalizedPhone, form]);

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

  // Đổi SĐT khác số của khách đang gắn → gỡ khách (đơn sẽ đi theo SĐT mới).
  useEffect(() => {
    if (!customerId || !brief.data?.phone) return;
    const cur = normalizePhoneInput(phone);
    if (cur !== '' && cur !== normalizePhoneInput(brief.data.phone)) {
      form.setValue('customerId', '', { shouldDirty: true });
      form.setValue('addressId', '', { shouldDirty: true });
    }
  }, [phone, customerId, brief.data, form]);

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
              {customerId || phone ? (
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
              <FormControl>
                <Input
                  aria-label="Số điện thoại khách"
                  placeholder="SĐT — tìm khách đã có"
                  inputMode="tel"
                  autoComplete="off"
                  className="tabular-nums"
                  {...field}
                />
              </FormControl>
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
                  placeholder="Tên khách hàng"
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

  // Khách vừa gắn vào đơn mà phần nhận hàng còn trống → điền sẵn địa chỉ mặc định của khách.
  // Không có địa chỉ để chọn sẵn → điền ít nhất tên + SĐT khách làm người nhận.
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
      addresses.find((a) => a.isDefault) ?? (addresses.length === 1 ? addresses[0] : undefined);
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
      <div className="grid gap-2.5 sm:grid-cols-2">
        {textField('recipient', 'Người nhận', 'Tên người nhận')}
        {textField('recipientPhone', 'SĐT người nhận', 'Số điện thoại', { inputMode: 'tel' })}
        {textField('line1', 'Địa chỉ', 'Địa chỉ chi tiết (số nhà, đường, thôn/xóm)', {
          className: 'sm:col-span-2',
        })}
      </div>
      <AddressSuggestions form={form} onApply={onTyped} />
      <div className="grid gap-2.5 sm:grid-cols-3">
        {textField('ward', 'Xã / Phường', 'Phường / Xã')}
        {textField('district', 'Quận / Huyện', 'Quận / Huyện (cũ)')}
        {textField('province', 'Tỉnh / TP', 'Tỉnh / Thành phố')}
      </div>
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
 * Gợi ý Xã / Huyện / Tỉnh từ dòng Địa chỉ (2026-10-26, kiểu Pancake): gõ "0332119579, Xã Quảng Tân,
 * Huyện Tuy Đức, Đắk Nông" → hiện "Đắk Nông, Huyện Tuy Đức, Xã Quảng Tân"; bấm thì điền ba ô (tên
 * đúng danh mục, địa giới cũ giữ tên cũ) và dòng Địa chỉ chỉ còn phần không phải địa giới. Gợi ý
 * trùng với ba ô đang có thì ẩn.
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
  const suggest = useGeoSuggest(q);
  const items = (suggest.data?.items ?? []).filter(
    (s) =>
      !(
        s.province === province &&
        (s.district ?? '') === (district ?? '') &&
        (s.ward ?? '') === (ward ?? '')
      ),
  );
  if (!items.length) return null;
  const apply = (s: GeoSuggestion) => {
    onApply('ward', s.ward ?? '');
    onApply('district', s.district ?? '');
    onApply('province', s.province);
    if (s.line1 && s.line1 !== line1) onApply('line1', s.line1);
  };
  return (
    <div className="flex flex-col gap-1" role="group" aria-label="Gợi ý xã, huyện, tỉnh">
      {items.map((s) => (
        <button
          key={`${s.generation}|${s.label}`}
          type="button"
          onClick={() => apply(s)}
          className="flex items-center gap-2 rounded-md border border-dashed border-input bg-card px-2.5 py-1.5 text-left text-sm hover:bg-muted"
        >
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate" title={s.label}>
            {s.label}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {s.generation === 'OLD' ? 'Địa giới cũ' : 'Địa giới mới'}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Vận chuyển ─────────────────────────────────────────────

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

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
