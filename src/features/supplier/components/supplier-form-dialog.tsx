'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { phoneSchema } from '@/lib/shared';
import { useCreateSupplier, useUpdateSupplier, type Supplier } from '../api/use-suppliers';

/**
 * Mã NCC — khớp SUPPLIER_CODE của CreateSupplierDto: như mã chung nhưng cho phép ngoặc đơn
 * (danh sách kế toán có mã kiểu "Delta(BMC)").
 */
const supplierCodeSchema = z
  .string()
  .trim()
  .min(1, 'Không được để trống')
  .max(50, 'Tối đa 50 ký tự')
  .regex(/^[A-Za-z0-9._()-]+$/, 'Chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới, ngoặc đơn');

/** F2 — form tạo/sửa NCC, khớp CreateSupplierDto/UpdateSupplierDto (luật 11). */
const supplierSchema = z.object({
  code: supplierCodeSchema,
  name: z.string().trim().min(1, 'Nhập tên nhà cung cấp').max(300, 'Tối đa 300 ký tự'),
  taxCode: z.string().trim().max(20, 'Tối đa 20 ký tự'),
  phone: z.union([phoneSchema, z.literal('')]),
  email: z.union([z.string().email('Email không hợp lệ'), z.literal('')]),
  address: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  paymentTerm: z.string().trim().regex(/^\d*$/, 'Số ngày, ví dụ 30'),
  leadTimeDays: z.string().trim().regex(/^\d*$/, 'Số ngày, ví dụ 7'),
});
type SupplierValues = z.infer<typeof supplierSchema>;

const KNOWN_FIELDS = [
  'code',
  'name',
  'taxCode',
  'phone',
  'email',
  'address',
  'paymentTerm',
  'leadTimeDays',
];

export function SupplierFormDialog({
  supplier,
  open,
  onOpenChange,
}: {
  /** undefined = tạo mới; có = sửa (mã khóa). */
  supplier?: Supplier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = supplier !== undefined;
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const isPending = create.isPending || update.isPending;
  const form = useForm<SupplierValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      code: supplier?.code ?? '',
      name: supplier?.name ?? '',
      taxCode: supplier?.taxCode ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      address: supplier?.address ?? '',
      paymentTerm: supplier?.paymentTerm == null ? '' : String(supplier.paymentTerm),
      leadTimeDays: supplier?.leadTimeDays == null ? '' : String(supplier.leadTimeDays),
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    const shared = {
      name: v.name,
      ...(v.taxCode ? { taxCode: v.taxCode } : {}),
      ...(v.phone ? { phone: v.phone } : {}),
      ...(v.email ? { email: v.email } : {}),
      // Sửa: luôn gửi address (chuỗi rỗng = xóa địa chỉ); tạo: chỉ gửi khi có.
      ...(editing ? { address: v.address } : v.address ? { address: v.address } : {}),
      ...(v.paymentTerm !== '' ? { paymentTerm: Number(v.paymentTerm) } : {}),
      ...(v.leadTimeDays !== '' ? { leadTimeDays: Number(v.leadTimeDays) } : {}),
    };
    const done = (msg: string) => {
      toast.success(msg);
      onOpenChange(false);
    };
    const fail = (err: unknown) =>
      applyServerErrors(form, err as ApiError, { knownFields: KNOWN_FIELDS });
    if (editing) {
      update.mutate(
        { id: supplier.id, body: shared },
        { onSuccess: () => done('Đã lưu thay đổi'), onError: fail },
      );
    } else {
      create.mutate(
        { code: v.code, ...shared },
        { onSuccess: () => done('Đã thêm nhà cung cấp'), onError: fail },
      );
    }
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Sửa nhà cung cấp ${supplier.code}` : 'Thêm nhà cung cấp'}
          </DialogTitle>
          <DialogDescription>
            Địa chỉ kho / giao nhận có cấu trúc thêm ở màn chi tiết sau khi lưu.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã NCC</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="NCC-0001"
                        className="font-mono"
                        disabled={editing}
                        {...field}
                      />
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
                      <Input placeholder="0109123456" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên nhà cung cấp</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus={editing}
                      placeholder="Công ty TNHH Vật tư Nông nghiệp Xanh"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SĐT</FormLabel>
                    <FormControl>
                      <Input placeholder="024 3765 4321" {...field} />
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
                      <Input type="email" placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Địa chỉ</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Lô F12-F13, đường số 5, KCN Đức Hòa III, Xã Đức Lập, Tây Ninh"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Địa chỉ trụ sở theo đăng ký / hóa đơn.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="paymentTerm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hạn thanh toán (ngày)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="30" {...field} />
                    </FormControl>
                    <FormDescription>Bỏ trống / 0 = trả ngay.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="leadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead time (ngày)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="7" {...field} />
                    </FormControl>
                    <FormDescription>Từ đặt PO tới hàng về kho.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
