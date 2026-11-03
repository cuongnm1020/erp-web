import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { DatePicker } from './date-picker';

/** Ô chọn một ngày dùng lưới tháng T2…CN của bộ lọc khoảng ngày (2026-11-03). */
function Harness({ initial, toDate }: { initial: string; toDate?: Date }) {
  const [v, setV] = useState<string>(initial);
  return (
    <>
      <DatePicker aria-label="Ngày tạo đơn" value={v} onChange={setV} toDate={toDate} />
      <output>{v || 'trống'}</output>
    </>
  );
}

describe('DatePicker', () => {
  it('lịch "Tháng 11 / 2026" thứ T2…CN, chọn ngày → giá trị yyyy-mm-dd', () => {
    renderApp(<Harness initial="2026-11-03" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ngày tạo đơn' }));
    expect(screen.getByText('Tháng 11 / 2026')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('CN')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '10/11/2026' }));
    expect(screen.getByRole('status')).toHaveTextContent('2026-11-10');
  });

  it('toDate: ngày sau giới hạn không bấm được, không có mũi tên tháng sau', () => {
    renderApp(<Harness initial="2026-11-03" toDate={new Date(2026, 10, 5)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ngày tạo đơn' }));
    expect(screen.getByRole('button', { name: '06/11/2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '05/11/2026' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Xem tháng sau' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xem tháng trước' }));
    expect(screen.getByText('Tháng 10 / 2026')).toBeInTheDocument();
  });
});
