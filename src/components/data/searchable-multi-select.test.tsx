import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SearchableMultiSelect } from './searchable-multi-select';

const OPTIONS = [
  { value: 'DELIVERED', label: 'Thành công' },
  { value: 'IN_TRANSIT', label: 'Đang giao' },
  { value: 'NOT_SENT', label: 'Chưa gửi hàng' },
  { value: 'RETURNED', label: 'Hoàn' },
];

function Harness() {
  const [v, setV] = useState<string[]>([]);
  return (
    <SearchableMultiSelect label="Tình trạng giao" values={v} options={OPTIONS} onChange={setV} />
  );
}

const labels = () =>
  screen.getAllByRole('option').map((o) => o.textContent?.replace(' (đã chọn)', ''));

describe('SearchableMultiSelect', () => {
  it('tick khi đang mở không làm dòng nhảy chỗ; mở lại thì mục đã chọn lên đầu (2026-11-05)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: 'Tình trạng giao' });

    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Hoàn' }));
    await user.click(screen.getByRole('option', { name: 'Đang giao' }));
    expect(labels()).toEqual(['Thành công', 'Đang giao', 'Chưa gửi hàng', 'Hoàn']);

    await user.keyboard('{Escape}');
    await user.click(trigger);
    expect(labels()).toEqual(['Đang giao', 'Hoàn', 'Thành công', 'Chưa gửi hàng']);
  });
});
