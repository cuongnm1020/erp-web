import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { zodResolver } from '@hookform/resolvers/zod';
import { moneySchema, phoneSchema } from '@erp/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/errors';
import { FormSkeleton } from '../states/skeletons';
import { applyServerErrors } from './apply-server-errors';
import { DatePicker, DateRangePicker } from './date-picker';
import { EntityPicker, type EntitySearchResult } from './entity-picker';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';
import { MoneyInput } from './money-input';
import { QuantityInput } from './quantity-input';

const schema = z.object({
  name: z.string().min(1, 'Nhập tên'),
  phone: phoneSchema,
  ownerId: z.string().min(1, 'Chọn nhân viên'),
  creditLimit: moneySchema,
  qty: z.string().min(1, 'Nhập số lượng'),
  since: z.string().min(1, 'Chọn ngày'),
});
type Values = z.infer<typeof schema>;

const STAFF = [
  { id: 'u1', label: 'Nguyễn Văn An', hint: 'sale.hn.1' },
  { id: 'u2', label: 'Trần Thị Bình', hint: 'sale.hn.2' },
  { id: 'u3', label: 'Lê Văn Cường', hint: 'sale.hcm.1' },
];
const useStaffSearch = (q: string): EntitySearchResult => ({
  options: STAFF.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())),
  isPending: false,
});

function Demo({ serverError }: { serverError?: 'validation' | 'conflict' }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', ownerId: '', creditLimit: '', qty: '1', since: '' },
  });
  const onSubmit = form.handleSubmit((v) => {
    if (serverError === 'validation') {
      applyServerErrors(
        form,
        new ApiError(
          422,
          'VALIDATION',
          'x',
          [{ path: 'phone', message: 'SĐT đã tồn tại ở KH00012' }],
          't',
        ),
      );
      return;
    }
    if (serverError === 'conflict') {
      applyServerErrors(form, new ApiError(409, 'UNIQUE_VIOLATION', 'x', undefined, 'trace-409'));
      return;
    }
    toast.success('Đã lưu thay đổi', { description: JSON.stringify(v) });
  });
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="max-w-md space-y-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Tên khách hàng</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Điện thoại</FormLabel>
              <FormControl>
                <Input {...field} inputMode="tel" />
              </FormControl>
              <FormDescription>10 số, bắt đầu bằng 0</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ownerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Nhân viên phụ trách</FormLabel>
              <FormControl>
                <EntityPicker
                  value={field.value}
                  onChange={field.onChange}
                  useSearch={useStaffSearch}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="qty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Số lượng</FormLabel>
              <FormControl>
                <QuantityInput
                  value={field.value}
                  onChange={field.onChange}
                  unit="cái"
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="since"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Khách từ ngày</FormLabel>
              <FormControl>
                <DatePicker value={field.value} onChange={field.onChange} ref={field.ref} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root?.server ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.server.message}
          </p>
        ) : null}
        <Button type="submit">Lưu thay đổi</Button>
      </form>
    </Form>
  );
}

const meta: Meta<typeof Demo> = { title: 'Data/Form', component: Demo };
export default meta;

export const Success: StoryObj<typeof Demo> = {};
export const Loading: StoryObj = { render: () => <FormSkeleton fields={6} /> };
export const ServerValidation422: StoryObj<typeof Demo> = {
  name: 'Error (422 → field)',
  args: { serverError: 'validation' },
};
export const ServerConflict409: StoryObj<typeof Demo> = {
  name: 'Error (409 → root)',
  args: { serverError: 'conflict' },
};
export const Empty: StoryObj = {
  name: 'Empty (DateRangePicker rỗng)',
  render: () => <DateRangePicker value={{ from: '', to: '' }} onChange={() => undefined} />,
};
