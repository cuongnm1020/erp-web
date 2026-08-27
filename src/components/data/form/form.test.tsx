import { zodResolver } from '@hookform/resolvers/zod';
import { moneySchema, phoneSchema } from '@erp/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from './apply-server-errors';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './form';
import { MoneyInput } from './money-input';
import { QuantityInput } from './quantity-input';

function MoneyHarness({ initial = '' }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <MoneyInput aria-label="Giá" value={v} onChange={setV} />
      <output data-testid="raw">{v}</output>
    </>
  );
}

describe('MoneyInput', () => {
  it('gõ "1.234,5" → giá trị "1234.5"; blur hiển thị nhóm nghìn', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness />);
    const input = screen.getByLabelText('Giá');
    await user.click(input);
    await user.type(input, '1.234,5');
    expect(screen.getByTestId('raw')).toHaveTextContent('1234.5');
    await user.tab();
    expect(input).toHaveValue('1.235');
    expect(screen.getByTestId('raw')).toHaveTextContent('1234.5');
  });

  it('giữ nguyên "1234.5000" — không qua Number', () => {
    render(<MoneyHarness initial="1234.5000" />);
    expect(screen.getByTestId('raw')).toHaveTextContent('1234.5000');
  });

  it('xóa hết → ""', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness initial="500" />);
    const input = screen.getByLabelText('Giá');
    await user.click(input);
    await user.clear(input);
    await user.tab();
    expect(screen.getByTestId('raw')).toHaveTextContent('');
  });
});

describe('QuantityInput', () => {
  it('chỉ nhận số nguyên, ↑/↓ tăng giảm, kẹp min', () => {
    const onChange = vi.fn();
    render(<QuantityInput aria-label="SL" value="5" onChange={onChange} min={0} />);
    const input = screen.getByLabelText('SL');
    fireEvent.change(input, { target: { value: '1a2' } });
    expect(onChange).toHaveBeenLastCalledWith('12');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('6');
    fireEvent.click(screen.getByRole('button', { name: 'Giảm' }));
    expect(onChange).toHaveBeenLastCalledWith('4');
  });
});

const schema = z.object({
  name: z.string().min(1, 'Nhập tên'),
  phone: phoneSchema,
  creditLimit: moneySchema,
});
type Values = z.infer<typeof schema>;

function SampleForm({
  onSubmit,
  serverError,
}: {
  onSubmit: (v: Values) => void;
  serverError?: ApiError;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', creditLimit: '' },
  });
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => {
          if (serverError) applyServerErrors(form, serverError);
          else onSubmit(v);
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Tên</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Điện thoại</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Hạn mức</FormLabel>
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
        {form.formState.errors.root?.server ? (
          <p role="alert">{form.formState.errors.root.server.message}</p>
        ) : null}
        <button type="submit">Lưu</button>
      </form>
    </Form>
  );
}

describe('Form kit + applyServerErrors', () => {
  it('đi hết form bằng bàn phím (Tab/Enter), schema dùng chung từ @erp/shared', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SampleForm onSubmit={onSubmit} />);
    await user.tab();
    await user.keyboard('Nguyễn Văn A');
    await user.tab();
    await user.keyboard('0912345678');
    await user.tab();
    await user.keyboard('1.000.000');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      name: 'Nguyễn Văn A',
      phone: '0912345678',
      creditLimit: '1000000',
    });
  });

  it('zod chặn: SĐT sai → FormMessage, không submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SampleForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Tên/), 'A');
    await user.type(screen.getByLabelText('Điện thoại'), '123');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Số điện thoại không hợp lệ')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('422 giả lập → setError đúng field, focus field sai đầu tiên, field lạ → root', async () => {
    const user = userEvent.setup();
    const err = new ApiError(
      422,
      'VALIDATION',
      'x',
      [
        { path: 'phone', message: 'SĐT đã tồn tại' },
        { path: 'name', message: 'Tên trùng' },
        { path: 'taxCode', message: 'Mã số thuế sai' },
      ],
      'trace-1',
    );
    render(<SampleForm onSubmit={vi.fn()} serverError={err} />);
    await user.type(screen.getByLabelText(/Tên/), 'A');
    await user.type(screen.getByLabelText('Điện thoại'), '0912345678');
    await user.type(screen.getByLabelText('Hạn mức'), '1');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('SĐT đã tồn tại')).toBeInTheDocument();
    expect(screen.getByText('Tên trùng')).toBeInTheDocument();
    expect(screen.getByText('Một số trường khác chưa hợp lệ.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Điện thoại')).toHaveFocus());
    expect(screen.getByLabelText('Điện thoại')).toHaveAttribute('aria-invalid', 'true');
  });

  it('Nest 400 message[] → map theo tên field', async () => {
    const user = userEvent.setup();
    const err = new ApiError(
      400,
      'VALIDATION',
      'x',
      ['phone must be a valid phone number'],
      undefined,
    );
    render(<SampleForm onSubmit={vi.fn()} serverError={err} />);
    await user.type(screen.getByLabelText(/Tên/), 'A');
    await user.type(screen.getByLabelText('Điện thoại'), '0912345678');
    await user.type(screen.getByLabelText('Hạn mức'), '1');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('phone must be a valid phone number')).toBeInTheDocument();
  });
});
