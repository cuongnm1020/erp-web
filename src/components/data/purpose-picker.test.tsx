import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PurposePicker } from './purpose-picker';

const OPTIONS = [
  { id: 'a', name: 'Cà phê', customerCount: 2 },
  { id: 'b', name: 'Sầu riêng', customerCount: 9 },
  { id: 'c', name: 'Thanh long', customerCount: 0 },
  { id: 'd', name: 'Măng cụt', customerCount: 5 },
];

function setup(props: Partial<Parameters<typeof PurposePicker>[0]> = {}) {
  const onToggle = vi.fn();
  const onCreate = vi.fn();
  render(
    <PurposePicker
      options={OPTIONS}
      selected={[]}
      onToggle={onToggle}
      onCreate={onCreate}
      {...props}
    />,
  );
  return { onToggle, onCreate };
}

const chipNames = () =>
  within(screen.getByRole('group', { name: 'Mục đích sử dụng' }))
    .getAllByRole('button')
    .map((b) => b.textContent);

describe('PurposePicker (2026-10-28: 2 dòng dùng nhiều nhất + gợi ý khi gõ)', () => {
  it('chip xếp: đang bật / khách đã có trước, rồi dùng nhiều nhất', () => {
    setup({ selected: ['c'], locked: ['a'] });
    expect(chipNames()).toEqual(['Cà phê', 'Thanh long', 'Sầu riêng', 'Măng cụt']);
  });

  it('gõ tên (không dấu) → gợi ý mục đích có sẵn; bấm gợi ý → bật, không tạo', () => {
    const { onToggle, onCreate } = setup();
    const input = screen.getByLabelText('Tìm hoặc tạo mục đích');
    fireEvent.change(input, { target: { value: 'mang' } });
    const hints = screen.getByRole('group', { name: 'Gợi ý mục đích' });
    fireEvent.click(within(hints).getByRole('button', { name: 'Măng cụt' }));
    expect(onToggle).toHaveBeenCalledWith('d');
    expect(onCreate).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('Enter khi trùng tên → bật mục đích có sẵn; chưa có → tạo mới', () => {
    const { onToggle, onCreate } = setup();
    const input = screen.getByLabelText('Tìm hoặc tạo mục đích');
    fireEvent.change(input, { target: { value: 'sau rieng' } });
    expect(screen.getByRole('button', { name: /Tạo & gắn/ })).toBeDisabled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledWith('b');

    fireEvent.change(input, { target: { value: 'Bơ' } });
    expect(screen.getByText(/Chưa có “Bơ”/)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledWith('Bơ');
  });
});
