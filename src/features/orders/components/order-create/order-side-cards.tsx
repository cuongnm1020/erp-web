'use client';

import Decimal from 'decimal.js';
import { Check, ChevronDown, ChevronUp, MoreHorizontal, Plus, X } from 'lucide-react';
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
import { useCarriers } from '@/features/wms/api/use-shipping';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatMoney, formatQuantity } from '@/lib/format';
import { useCustomerBrief, useCustomerSearch } from '../../api/use-line-entry';
import {
  useCustomerPhoneMatch,
  useOrderStaffOptions,
  useOrderTags,
  useShippingQuotePreview,
  type ShippingQuotePreviewBody,
} from '../../api/use-order-create';
import { GENDER_LABEL } from '../../labels';
import { GENDERS, normalizePhoneInput, type CreateOrderValues } from '../../schema';

type Form = UseFormReturn<CreateOrderValues>;
/** Radix Select không nhận value rỗng. */
const NONE = '__none__';
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
    <section className={cn('flex flex-col gap-3 rounded-lg border bg-card p-4', className)}>
      <header className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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

// ── Thông tin ──────────────────────────────────────────────

function useStaffSearch(q: string): EntitySearchResult {
  const staff = useOrderStaffOptions();
  const needle = q.trim().toLowerCase();
  // Danh mục nhân viên nhỏ, đã tải hết một lần — lọc gợi ý tại chỗ.
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
}

function StaffField({
  form,
  name,
  label,
  placeholder,
}: {
  form: Form;
  name: 'ownerId' | 'packerId' | 'careStaffId' | 'marketerId';
  label: string;
  placeholder: string;
}) {
  const staff = useOrderStaffOptions();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <Row label={label}>
            <FormControl>
              <EntityPicker
                value={field.value}
                onChange={(id) => field.onChange(id)}
                useSearch={useStaffSearch}
                selectedLabel={staff.data?.find((u) => u.id === field.value)?.fullName}
                placeholder={placeholder}
                searchPlaceholder="Tìm tên, mã nhân viên…"
                emptyText="Không có nhân viên khớp"
                clearable
                aria-label={label}
              />
            </FormControl>
          </Row>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TagPicker({ form }: { form: Form }) {
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
          className="inline-flex h-7 items-center gap-1 rounded bg-warning/15 px-2 text-xs font-medium"
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

export function InfoCard({ form }: { form: Form }) {
  const [open, setOpen] = useState(true);
  return (
    <Card
      title={
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5"
        >
          Thông tin
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
          <StaffField
            form={form}
            name="ownerId"
            label="NV xử lý"
            placeholder="Tôi (người tạo đơn)"
          />
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
          <StaffField form={form} name="marketerId" label="Marketer" placeholder="Chọn Marketer" />
          <TagPicker form={form} />
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
  const [pickOpen, setPickOpen] = useState(false);

  // SĐT gõ trùng khách đã có (trong tầm nhìn) → gắn khách đó vào đơn: giá theo bảng giá của khách,
  // chọn được địa chỉ đã lưu. Server cũng tự khớp theo SĐT khi chốt.
  useEffect(() => {
    if (customerId || !match.data) return;
    form.setValue('customerId', match.data.id, { shouldDirty: true });
    if (form.getValues('customerName') === '') {
      form.setValue('customerName', match.data.name, { shouldDirty: true });
    }
  }, [match.data, customerId, form]);

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
                    <SelectTrigger aria-label="Giới tính" className="h-8 w-28">
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
                form.setValue('customerId', id, { shouldDirty: true });
                form.setValue('customerName', opt?.label ?? '', { shouldDirty: true });
                form.setValue('customerPhone', '', { shouldDirty: true });
                form.setValue('customerEmail', '', { shouldDirty: true });
                form.setValue('addressId', '', { shouldDirty: true });
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

      <div className="grid gap-2.5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Tên khách hàng</FormLabel>
              <FormControl>
                <Input placeholder="Tên khách hàng" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="customerPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Số điện thoại khách</FormLabel>
              <FormControl>
                <Input
                  placeholder="SĐT"
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
      </div>

      {customerId && brief.data ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm">
          <span>
            <b className="font-semibold">Khách cũ</b> · {brief.data.code}
            {brief.data.addresses.length > 0
              ? ` · ${brief.data.addresses.length} địa chỉ đã lưu`
              : ''}
          </span>
          <a
            href={`/crm/customers/${brief.data.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Xem hồ sơ
          </a>
        </div>
      ) : !customerId && /^0\d{9,10}$/.test(normalizePhoneInput(phone)) && match.data === null ? (
        <p className="text-xs text-muted-foreground">
          Khách mới — sẽ tạo hồ sơ khách khi chốt đơn.
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
  useEffect(() => {
    if (!brief.data || filledFor.current === brief.data.id) return;
    filledFor.current = brief.data.id;
    const typed = ADDRESS_FIELDS.some((k) => form.getValues(k) !== '');
    if (typed || form.getValues('addressId')) return;
    const preferred =
      addresses.find((a) => a.isDefault) ?? (addresses.length === 1 ? addresses[0] : undefined);
    if (preferred) fill(preferred.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi đổi khách
  }, [brief.data]);

  /** Sửa tay một ô của địa chỉ đã chọn → thành địa chỉ mới (server lưu thêm khi chốt). */
  const onTyped = (name: (typeof ADDRESS_FIELDS)[number], value: string) => {
    form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    if (form.getValues('addressId')) form.setValue('addressId', '', { shouldDirty: true });
  };

  const textField = (
    name: (typeof ADDRESS_FIELDS)[number],
    placeholder: string,
    extra?: { className?: string; inputMode?: 'tel' },
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={extra?.className}>
          <FormLabel className="sr-only">{placeholder}</FormLabel>
          <FormControl>
            <Input
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
    <Card
      title="Nhận hàng"
      actions={
        addresses.length > 0 ? (
          <Select
            value={addressId || NEW_ADDRESS}
            onValueChange={(v) => {
              if (v === NEW_ADDRESS) {
                form.setValue('addressId', '', { shouldDirty: true });
                for (const k of ADDRESS_FIELDS) form.setValue(k, '', { shouldDirty: true });
              } else fill(v);
            }}
          >
            <SelectTrigger aria-label="Chọn địa chỉ đã lưu" className="h-8 w-56">
              <SelectValue placeholder="Chọn địa chỉ" />
            </SelectTrigger>
            <SelectContent>
              {addresses.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label ? `${a.label} · ` : ''}
                  {a.recipient}
                  {a.isDefault ? ' (mặc định)' : ''}
                </SelectItem>
              ))}
              <SelectItem value={NEW_ADDRESS}>Địa chỉ mới (nhập tay)</SelectItem>
            </SelectContent>
          </Select>
        ) : null
      }
    >
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
      <div className="grid gap-2.5 sm:grid-cols-2">
        {textField('recipient', 'Tên người nhận')}
        {textField('recipientPhone', 'Số điện thoại', { inputMode: 'tel' })}
        {textField('line1', 'Địa chỉ chi tiết (số nhà, đường, thôn/xóm)', {
          className: 'sm:col-span-2',
        })}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {textField('ward', 'Phường / Xã')}
        {textField('district', 'Quận / Huyện (cũ)')}
        {textField('province', 'Tỉnh / Thành phố')}
      </div>
      {addressId ? (
        <p className="text-xs text-muted-foreground">
          Địa chỉ đã lưu của khách — sửa ô nào sẽ lưu thành địa chỉ mới.
        </p>
      ) : null}
    </Card>
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
  const active = (carriers.data ?? []).filter((c) => c.isActive);
  const carrier = active.find((c) => c.id === carrierId);
  const accounts = carrier?.accounts ?? [];
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

  const cmField = (name: 'lengthCm' | 'widthCm' | 'heightCm', label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="sr-only">{label}</FormLabel>
          <FormControl>
            <Input
              inputMode="numeric"
              aria-label={label}
              placeholder="0"
              className="w-16 px-2 text-right tabular-nums"
              {...field}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );

  return (
    <Card
      title="Vận chuyển"
      actions={
        <FormField
          control={form.control}
          name="carrierId"
          render={({ field }) => (
            <FormItem>
              <Select
                value={field.value || NONE}
                onValueChange={(v) => {
                  field.onChange(v === NONE ? '' : v);
                  form.setValue('carrierAccountId', '', { shouldDirty: true });
                }}
                disabled={carriers.isPending}
              >
                <FormControl>
                  <SelectTrigger aria-label="Đơn vị vận chuyển" className="h-8 w-40">
                    <SelectValue placeholder="ĐVVC" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>Chưa chọn ĐVVC</SelectItem>
                  {active.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      }
    >
      {accounts.length > 1 ? (
        <FormField
          control={form.control}
          name="carrierAccountId"
          render={({ field }) => (
            <FormItem>
              <Row label="Tài khoản hãng">
                <Select
                  value={field.value || NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                >
                  <FormControl>
                    <SelectTrigger aria-label="Tài khoản hãng">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>Tài khoản mặc định</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                        {a.isDefault ? ' (mặc định)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">Kích thước</span>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {cmField('lengthCm', 'Dài (cm)')}×{cmField('widthCm', 'Rộng (cm)')}×
          {cmField('heightCm', 'Cao (cm)')}
          <span>(cm)</span>
        </div>
      </div>

      <FormField
        control={form.control}
        name="shippingWeightKg"
        render={({ field }) => (
          <FormItem>
            <Row label="Khối lượng (kg)" htmlFor="order-weight">
              <FormControl>
                <Input
                  id="order-weight"
                  inputMode="decimal"
                  placeholder={
                    estimatedWeightKg ? `${formatQuantity(estimatedWeightKg)} (theo SP)` : '0'
                  }
                  className="text-right tabular-nums"
                  {...field}
                />
              </FormControl>
            </Row>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Input aria-label="Mã vận đơn" placeholder="Mã vận đơn — cấp khi gửi hãng" disabled />
        <div className="flex h-9 items-center justify-between rounded-md border bg-muted/40 px-3 text-sm">
          <span className="text-muted-foreground">Phí</span>
          <span className="tabular-nums">
            {!carrierId
              ? '—'
              : !canQuote
                ? 'Hãng không báo cước'
                : body === null
                  ? 'Cần tỉnh + khối lượng'
                  : quote.isFetching
                    ? 'Đang tra…'
                    : quote.data
                      ? formatMoney(quote.data.fee, { unit: '' })
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
