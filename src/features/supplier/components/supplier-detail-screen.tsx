'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { EmptyState, DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { useAbility } from '@/lib/permission';
import { phoneSchema } from '@/lib/shared';
import {
  useAddSupplierAddress,
  useSupplier,
  useUpdateSupplier,
  type SupplierDetail,
} from '../api/use-suppliers';
import { SupplierFormDialog } from './supplier-form-dialog';
import { termLabel } from './supplier-list-screen';

/**
 * F2 (PLAN-master-data-lot-uom) — chi tiết NCC nối API thật: GET /suppliers/{id}
 * (thông tin + địa chỉ), sửa qua dialog dùng chung với list, thêm địa chỉ giao
 * nhận (POST /suppliers/{id}/addresses), bật lại hợp tác (PATCH isActive).
 *
 * Các tab của design canvas (Lịch sử mua / PO / Sản phẩm cung cấp / Công nợ)
 * chờ endpoint tổng hợp — ghi ở PENDING_API, không dựng số bịa.
 */
const PENDING_API: Array<{ title: string; need: string }> = [
  { title: 'Lịch sử mua (GRN theo NCC)', need: 'GET /goods-receipts chưa lọc theo supplier' },
  { title: 'PO đang mở', need: 'API purchase order chưa có mặt đọc theo NCC' },
  { title: 'Sản phẩm cung cấp & giá mua gần nhất', need: 'chưa có endpoint tổng hợp' },
  { title: 'Công nợ phải trả', need: 'fin chưa có API công nợ NCC' },
];

const addressSchema = z.object({
  label: z.string().trim().max(50, 'Tối đa 50 ký tự'),
  recipient: z.string().trim().min(1, 'Nhập người nhận').max(200),
  phone: phoneSchema,
  line1: z.string().trim().min(1, 'Nhập địa chỉ').max(300),
  ward: z.string().trim().max(100),
  district: z.string().trim().max(100),
  province: z.string().trim().min(1, 'Nhập tỉnh/thành').max(100),
  isDefault: z.boolean(),
});
type AddressValues = z.infer<typeof addressSchema>;

function AddressDialog({
  supplierId,
  open,
  onOpenChange,
}: {
  supplierId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddSupplierAddress();
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: '',
      recipient: '',
      phone: '',
      line1: '',
      ward: '',
      district: '',
      province: '',
      isDefault: false,
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    add.mutate(
      {
        id: supplierId,
        body: {
          ...(v.label ? { label: v.label } : {}),
          recipient: v.recipient,
          phone: v.phone,
          line1: v.line1,
          ...(v.ward ? { ward: v.ward } : {}),
          ...(v.district ? { district: v.district } : {}),
          province: v.province,
          isDefault: v.isDefault,
        },
      },
      {
        onSuccess: () => {
          toast.success('Đã thêm địa chỉ');
          onOpenChange(false);
        },
        onError: (err) =>
          applyServerErrors(form, err as ApiError, {
            knownFields: ['label', 'recipient', 'phone', 'line1', 'ward', 'district', 'province'],
          }),
      },
    );
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm địa chỉ</DialogTitle>
          <DialogDescription>Địa chỉ kho/giao nhận của nhà cung cấp.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhãn</FormLabel>
                    <FormControl>
                      <Input placeholder="Kho chính" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Người liên hệ</FormLabel>
                    <FormControl>
                      <Input placeholder="Nguyễn Thị Thu Hà" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SĐT</FormLabel>
                    <FormControl>
                      <Input placeholder="0903 112 233" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tỉnh / thành</FormLabel>
                    <FormControl>
                      <Input placeholder="TP.HCM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Địa chỉ</FormLabel>
                  <FormControl>
                    <Input placeholder="Lô 6-8-10, đường số 3, KCN Tân Tạo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quận / huyện</FormLabel>
                    <FormControl>
                      <Input placeholder="Q. Bình Tân" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ward"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phường / xã</FormLabel>
                    <FormControl>
                      <Input placeholder="P. Tân Tạo A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Đặt làm địa chỉ mặc định</FormLabel>
                </FormItem>
              )}
            />
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={add.isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? 'Đang lưu…' : 'Thêm địa chỉ'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ supplier }: { supplier: SupplierDetail }) {
  const ability = useAbility();
  const canUpdate = ability.can('update', 'Supplier');
  const update = useUpdateSupplier();
  const [editOpen, setEditOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  const infoRows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: 'Trạng thái',
      value: supplier.isActive ? (
        <StatusBadge tone="ok">Hoạt động</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Ngừng hợp tác</StatusBadge>
      ),
    },
    { label: 'Mã số thuế', value: supplier.taxCode ?? '—' },
    { label: 'SĐT', value: supplier.phone ?? '—' },
    {
      label: 'Email',
      value: supplier.email ? <span className="text-primary">{supplier.email}</span> : '—',
    },
    {
      label: 'Điều khoản',
      value: <span className="font-semibold">{termLabel(supplier.paymentTerm)}</span>,
    },
    {
      label: 'Lead time',
      value: supplier.leadTimeDays == null ? '—' : `${supplier.leadTimeDays} ngày`,
    },
  ];

  return (
    <>
      <PageHeader
        title={supplier.name}
        description={`${supplier.code} · ${supplier.isActive ? 'Hoạt động' : 'Ngừng hợp tác'}`}
        breadcrumb={[
          { label: 'Sản phẩm', href: '/catalog/products' },
          { label: 'Nhà cung cấp', href: '/catalog/suppliers' },
          { label: supplier.code },
        ]}
        actions={
          canUpdate ? (
            <>
              {!supplier.isActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update
                      .mutateAsync({ id: supplier.id, body: { isActive: true } })
                      .then(() => toast.success('Đã bật lại hợp tác'))
                      .catch((err) => toast.error(messageFor(err)))
                  }
                >
                  Bật lại hợp tác
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden /> Sửa thông tin
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[380px_1fr]">
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="border-b px-3 py-2 text-sm font-semibold">Thông tin</div>
          <dl className="flex flex-col gap-1.5 px-3 py-2 text-sm">
            {infoRows.map((r) => (
              <div key={r.label} className="grid grid-cols-[110px_1fr] gap-2">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Địa chỉ giao nhận</span>
            {canUpdate ? (
              <Button variant="outline" size="sm" onClick={() => setAddressOpen(true)}>
                <Plus aria-hidden /> Thêm địa chỉ
              </Button>
            ) : null}
          </div>
          {supplier.addresses.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Chưa có địa chỉ nào — thêm địa chỉ kho của NCC để lên PO nhanh hơn.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-28 px-2.5 text-xs">Nhãn</TableHead>
                  <TableHead className="w-40 px-2.5 text-xs">Người liên hệ</TableHead>
                  <TableHead className="w-32 px-2.5 text-xs">SĐT</TableHead>
                  <TableHead className="px-2.5 text-xs">Địa chỉ</TableHead>
                  <TableHead className="w-24 px-2.5 text-xs">
                    <span className="sr-only">Mặc định</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.addresses.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="px-2.5 py-1.5">{a.label ?? '—'}</TableCell>
                    <TableCell className="px-2.5 py-1.5">{a.contact ?? '—'}</TableCell>
                    <TableCell className="px-2.5 py-1.5">{a.phone ?? '—'}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {[a.line1, a.ward, a.district, a.province].filter(Boolean).join(', ')}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {a.isDefault ? <StatusBadge tone="brand">Mặc định</StatusBadge> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <section className="mt-3 rounded-md border bg-card">
        <header className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-semibold">
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          Bổ sung khi API sẵn sàng
        </header>
        <ul className="flex flex-col gap-1.5 px-3 py-2 text-sm">
          {PENDING_API.map((m) => (
            <li key={m.title}>
              <span className="font-medium">{m.title}</span>{' '}
              <span className="text-xs text-muted-foreground">— {m.need}</span>
            </li>
          ))}
        </ul>
      </section>

      {editOpen ? (
        <SupplierFormDialog supplier={supplier} open={editOpen} onOpenChange={setEditOpen} />
      ) : null}
      {addressOpen ? (
        <AddressDialog supplierId={supplier.id} open={addressOpen} onOpenChange={setAddressOpen} />
      ) : null}
    </>
  );
}

export function SupplierDetailScreen({ supplierId }: { supplierId: string }) {
  const query = useSupplier(supplierId);
  return (
    <QueryState query={query} skeleton={<DetailSkeleton fields={6} />}>
      {(s) =>
        s ? (
          <DetailBody supplier={s} />
        ) : (
          <EmptyState
            title="Không tìm thấy nhà cung cấp"
            description="Nhà cung cấp có thể đã bị xóa."
          />
        )
      }
    </QueryState>
  );
}
