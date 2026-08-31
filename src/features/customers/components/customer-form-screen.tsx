'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MoneyInput,
} from '@/components/data/form';
import { DetailSkeleton, EmptyState, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { isApiError, type ApiError } from '@/lib/api/errors';
import { Can } from '@/lib/permission';
import {
  useCreateCustomer,
  useCustomer,
  useUpdateCustomer,
  type Customer,
} from '../api/use-customers';
import { useTeams } from '../api/use-teams';
import { CUSTOMER_TYPE_OPTIONS } from '../labels';
import {
  createCustomerSchema,
  editCustomerFormSchema,
  toCreateCustomerBody,
  toUpdateCustomerBody,
  type CustomerFormValues,
} from '../schema';

/**
 * B-03 Tạo / sửa khách hàng — POST /customers · PATCH /customers/{id}.
 * Bám design canvas (luật 15) trong phạm vi API cho phép; các điểm LỆCH so với artboard:
 * - Mã KH: canvas ghi "(tự động khi lưu)" nhưng CreateCustomerDto BẮT BUỘC `code`
 *   → thêm ô nhập tay (font-mono). Follow-up backend: cấp mã tự động rồi bỏ ô này.
 * - Team chăm sóc: canvas không có ô này (ngầm theo người tạo) nhưng CreateCustomerDto
 *   bắt buộc `teamId` → Select từ GET /teams, chỉ hiện team SALES.
 * - Loại khách: canvas là radio "Cá nhân / hộ KD | Doanh nghiệp"; API là enum
 *   RETAIL/WHOLESALE/DISTRIBUTOR/KEY_ACCOUNT → Select với nhãn tiếng Việt từ labels.ts.
 * - SĐT: canvas đánh dấu bắt buộc kèm "dò trùng khi lưu"; CreateCustomerDto để optional và
 *   chưa có API dò trùng → không bắt buộc, không hứa dò trùng (bỏ cả alert dò trùng).
 * - BỎ HẲN, không để nút chết (xem PENDING_API): nhóm/cấp độ/tag, bảng giá áp dụng,
 *   người phụ trách, bảng địa chỉ giao hàng, đồng ý nhận marketing (PDPD).
 * - Chế độ sửa: UpdateCustomerDto KHÔNG có code/teamId/ownerIds → mã KH hiện disabled,
 *   team chỉ đọc (đổi ở màn Phân bổ khách hàng). isActive/priceListId tuy có trong DTO
 *   nhưng không đặt ở đây: Ngừng hợp tác đã có luồng DELETE riêng, bảng giá chưa có
 *   GET /price-lists khai báo kiểu response.
 */
const PENDING_API: Array<{ title: string; need: string }> = [
  { title: 'Nhóm, cấp độ & tag', need: 'chưa có endpoint nhóm / cấp độ / tag khách hàng' },
  { title: 'Bảng giá áp dụng', need: 'GET /price-lists chưa khai báo kiểu response' },
  { title: 'Người phụ trách', need: 'chưa có danh bạ user để chọn — server tự gán người tạo' },
  {
    title: 'Địa chỉ giao hàng',
    need: 'CustomerDto chưa trả addresses, response thêm địa chỉ chưa có kiểu',
  },
  { title: 'Đồng ý nhận marketing (PDPD)', need: 'chưa có DTO consent theo khách' },
];

const CREATE_FIELDS = [
  'code',
  'name',
  'taxCode',
  'phone',
  'email',
  'type',
  'teamId',
  'creditLimit',
  'paymentTerm',
] as const;

const UPDATE_FIELDS = [
  'name',
  'taxCode',
  'phone',
  'email',
  'type',
  'creditLimit',
  'paymentTerm',
] as const;

function initialValues(customer?: Customer): CustomerFormValues {
  return {
    code: customer?.code ?? '',
    name: customer?.name ?? '',
    taxCode: customer?.taxCode ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    type: customer?.type ?? 'RETAIL',
    teamId: customer?.teamIds[0] ?? '',
    creditLimit: customer?.creditLimit ?? '',
    paymentTerm: customer?.paymentTerm == null ? '' : String(customer.paymentTerm),
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <header className="border-b px-3 py-2 text-sm font-semibold">{title}</header>
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3 px-3 py-3">{children}</div>
    </section>
  );
}

function CustomerFormBody({ customer }: { customer?: Customer }) {
  const editing = customer !== undefined;
  const router = useRouter();
  // Chỉ tải danh mục team khi tạo — form sửa không đổi được team (UpdateCustomerDto không có).
  const teams = useTeams({ enabled: !editing });
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? '');
  const isPending = create.isPending || update.isPending;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(editing ? editCustomerFormSchema : createCustomerSchema),
    defaultValues: initialValues(customer),
  });

  const save = (v: CustomerFormValues, andNew: boolean) => {
    if (!editing) {
      create.mutate(toCreateCustomerBody(v), {
        onSuccess: (c) => {
          toast.success('Đã lưu khách hàng', { description: `${c.code} · ${c.name}` });
          if (andNew) form.reset(initialValues());
          else router.push(`/crm/customers/${c.id}`);
        },
        onError: (err) => applyServerErrors(form, err as ApiError, { knownFields: CREATE_FIELDS }),
      });
      return;
    }
    const body = toUpdateCustomerBody(v, form.formState.dirtyFields);
    if (Object.keys(body).length === 0) {
      toast.info('Chưa có thay đổi nào để lưu');
      return;
    }
    update.mutate(body, {
      onSuccess: () => {
        toast.success('Đã lưu thay đổi');
        router.push(`/crm/customers/${customer.id}`);
      },
      onError: (err) => applyServerErrors(form, err as ApiError, { knownFields: UPDATE_FIELDS }),
    });
  };

  const onSubmit = form.handleSubmit((v) => save(v, false));
  const onSubmitAndNew = form.handleSubmit((v) => save(v, true));

  // Alt+S = lưu (phím tắt của màn theo canvas) — qua ref để listener không phải gắn lại.
  const submitRef = useRef<() => void>(() => {});
  useEffect(() => {
    submitRef.current = () => void onSubmit();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cancelHref = editing ? `/crm/customers/${customer.id}` : '/crm/customers';
  const saveLabel = editing ? 'Lưu thay đổi' : 'Lưu khách hàng';
  const rootError = form.formState.errors.root?.server?.message;

  const saveButton = (
    <Button size="sm" type="submit" form="customer-form" disabled={isPending}>
      {isPending ? 'Đang lưu…' : saveLabel}{' '}
      <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
        Alt S
      </kbd>
    </Button>
  );

  return (
    <Form {...form}>
      <form id="customer-form" onSubmit={onSubmit} noValidate>
        <PageHeader
          title={editing ? 'Sửa khách hàng' : 'Tạo khách hàng'}
          description={
            editing
              ? `${customer.code} · thay đổi áp dụng ngay sau khi lưu`
              : 'Điền thông tin chung; địa chỉ và phân loại chi tiết bổ sung sau'
          }
          breadcrumb={[
            { label: 'Khách hàng', href: '/crm/customers' },
            { label: 'Danh sách', href: '/crm/customers' },
            { label: editing ? 'Sửa khách hàng' : 'Tạo khách hàng' },
          ]}
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={cancelHref}>Hủy bỏ</Link>
              </Button>
              <Can I={editing ? 'update' : 'create'} a="Customer">
                {saveButton}
              </Can>
            </>
          }
        />

        <div className="grid grid-cols-2 items-start gap-3">
          <div className="flex flex-col gap-3">
            <Section title="Thông tin chung">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel required>Tên khách hàng</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus placeholder="Cửa hàng An Nhiên" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required={!editing}>Mã KH</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={editing}
                        placeholder="KH-00123"
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      {editing
                        ? 'Mã không đổi được sau khi tạo'
                        : 'Backend chưa cấp mã tự động — tạm nhập tay'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại khách</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CUSTOMER_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SĐT</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="tel"
                        className="font-mono"
                        placeholder="0936481220"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="ví dụ: annhien@gmail.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã số thuế</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="chỉ bắt buộc với doanh nghiệp" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>

            <Section title="Phân loại & bán hàng">
              {editing ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Team chăm sóc</span>
                  <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                    {customer.teamIds.length} team đang chăm sóc
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Đổi team và người phụ trách ở màn{' '}
                    <Link href="/crm/customers/assign" className="text-primary hover:underline">
                      Phân bổ khách hàng
                    </Link>
                  </p>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="teamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Team chăm sóc</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn team" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(teams.data ?? [])
                            .filter((t) => t.type === 'SALES')
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Quyết định team nào thấy và chăm khách này</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="creditLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hạn mức công nợ</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>Để trống nếu chưa đặt hạn mức</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentTerm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hạn thanh toán (ngày)</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" placeholder="vd: 30" />
                    </FormControl>
                    <FormDescription>Số ngày kể từ ngày xuất hóa đơn</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>
          </div>

          <div className="flex flex-col gap-3">
            <section className="rounded-md border bg-card">
              <header className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-semibold">
                <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                Bổ sung khi API sẵn sàng
              </header>
              <ul className="flex flex-col gap-2 px-3 py-3 text-sm">
                {PENDING_API.map((m) => (
                  <li key={m.title} className="flex flex-col">
                    <span className="font-medium">{m.title}</span>
                    <span className="text-xs text-muted-foreground">{m.need}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Luật 2: shape response phải sinh từ OpenAPI của apps/api — backend khai báo DTO cho
                các phần trên thì form nối được ngay, không để nút chết.
              </p>
            </section>

            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={cancelHref}>Hủy bỏ</Link>
              </Button>
              <Can I={editing ? 'update' : 'create'} a="Customer">
                {!editing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void onSubmitAndNew()}
                  >
                    Lưu và tạo tiếp
                  </Button>
                ) : null}
                {saveButton}
              </Can>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}

export function CustomerFormScreen({ customerId }: { customerId?: string } = {}) {
  const query = useCustomer(customerId ?? '');
  if (customerId === undefined) return <CustomerFormBody />;
  return isApiError(query.error) && query.error.isNotFound ? (
    <EmptyState
      title="Không tìm thấy khách hàng"
      description="Khách này có thể đã bị gộp, hoặc đang do người khác phụ trách."
      action={
        <Button variant="outline" asChild>
          <Link href="/crm/customers">Về danh sách khách hàng</Link>
        </Button>
      }
    />
  ) : (
    <QueryState query={query} skeleton={<DetailSkeleton fields={9} />}>
      {(c) => <CustomerFormBody customer={c} />}
    </QueryState>
  );
}
