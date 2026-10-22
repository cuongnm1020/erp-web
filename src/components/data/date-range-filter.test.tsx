import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import {
  DateRangeFilter,
  rangePresetOptions,
  type DateRangeFilterValue,
} from './date-range-filter';

const TODAY = '2026-10-22';

function Harness({
  initial = {},
  required,
  rememberKey,
}: {
  initial?: DateRangeFilterValue;
  required?: boolean;
  rememberKey?: string;
}) {
  const [v, setV] = useState<DateRangeFilterValue>(initial);
  return (
    <>
      <DateRangeFilter
        label="Ngày đặt"
        today={TODAY}
        value={v}
        onChange={setV}
        required={required}
        rememberKey={rememberKey}
      />
      <output data-testid="v">{`${v.from ?? ''}|${v.to ?? ''}`}</output>
    </>
  );
}

const open = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));

describe('rangePresetOptions', () => {
  it('Đầu tuần từ thứ 2; Tháng trước trọn tháng; bỏ khoảng dài hơn maxDays; Mọi lúc khi includeAll', () => {
    const p = rangePresetOptions(TODAY, { includeAll: true });
    const by = (k: string) => p.find((x) => x.key === k)!;
    expect(by('weekToDate')).toMatchObject({ from: '2026-10-19', to: TODAY }); // 22/10/2026 là thứ 5
    expect(by('lastMonth')).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(by('all')).toMatchObject({ from: '', to: '' });
    expect(rangePresetOptions(TODAY, { maxDays: 31 }).map((x) => x.key)).not.toContain('last90');
  });
});

describe('DateRangeFilter (2026-10-22)', () => {
  it('chưa chọn → "tất cả"; chọn sẵn chỉ đổi khi Áp dụng; Đóng thì bỏ', async () => {
    renderApp(<Harness />);
    open('Ngày đặt: tất cả');
    fireEvent.click(await screen.findByRole('button', { name: '7 ngày qua' }));
    expect(screen.getByTestId('v')).toHaveTextContent('|');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByTestId('v')).toHaveTextContent(/^\|$/);

    open('Ngày đặt: tất cả');
    fireEvent.click(await screen.findByRole('button', { name: '7 ngày qua' }));
    fireEvent.click(screen.getByRole('button', { name: /^Áp dụng/ }));
    expect(screen.getByTestId('v')).toHaveTextContent('2026-10-16|2026-10-22');
    expect(screen.getByRole('button', { name: 'Ngày đặt: 7 ngày qua' })).toBeInTheDocument();
  });

  it('gõ Từ / Đến ngày (dd/mm/yyyy) → khoảng tùy chọn; nút × xóa lọc', async () => {
    renderApp(<Harness />);
    open('Ngày đặt: tất cả');
    const from = await screen.findByLabelText('Từ ngày');
    fireEvent.change(from, { target: { value: '3/10/2026' } });
    fireEvent.blur(from);
    const to = screen.getByLabelText('Đến ngày');
    fireEvent.change(to, { target: { value: '05/10/2026' } });
    fireEvent.blur(to);
    expect(screen.getByText('3 ngày')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Áp dụng/ }));
    expect(screen.getByTestId('v')).toHaveTextContent('2026-10-03|2026-10-05');
    open('Xóa lọc ngày đặt');
    expect(screen.getByTestId('v')).toHaveTextContent(/^\|$/);
  });

  it('bắt buộc: không có "Mọi lúc" / "Xóa ngày" / nút ×', async () => {
    renderApp(<Harness required initial={{ from: '2026-10-01', to: TODAY }} />);
    open('Ngày đặt: Đầu tháng đến nay · 01/10 – 22/10/2026');
    await screen.findByRole('button', { name: 'Hôm nay' });
    expect(screen.queryByRole('button', { name: 'Mọi lúc' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa ngày' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Xóa lọc/ })).toBeNull();
  });

  it('Ghi nhớ: lưu khoảng chọn sẵn (tương đối) qua /me/preferences; mở lại màn chưa chọn ngày → khôi phục', async () => {
    const saved: unknown[] = [];
    let stored: unknown = null;
    server.use(
      http.get('/api/me/preferences/:key', ({ params }) =>
        HttpResponse.json({ key: params.key, value: stored }),
      ),
      http.put('/api/me/preferences/:key', async ({ params, request }) => {
        const body = (await request.json()) as { value: unknown };
        saved.push({ key: params.key, value: body.value });
        stored = body.value;
        return HttpResponse.json({ key: params.key, value: body.value });
      }),
    );
    const first = renderApp(<Harness rememberKey="date.orders" />);
    open('Ngày đặt: tất cả');
    fireEvent.click(await screen.findByRole('button', { name: '30 ngày qua' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ghi nhớ khoảng ngày cho lần sau' }));
    fireEvent.click(screen.getByRole('button', { name: /^Áp dụng/ }));
    await waitFor(() =>
      expect(saved).toEqual([{ key: 'date.orders', value: { preset: 'last30' } }]),
    );
    first.unmount();

    renderApp(<Harness rememberKey="date.orders" />);
    await waitFor(() => expect(screen.getByTestId('v')).toHaveTextContent('2026-09-23|2026-10-22'));
  });

  it('lịch 2 tháng theo thiết kế: tháng trái = tháng của ngày cuối, "Tháng 10 / 2026", T2…CN; bấm 2 ngày = khoảng', async () => {
    renderApp(<Harness />);
    open('Ngày đặt: tất cả');
    expect(await screen.findByRole('group', { name: 'Tháng 10 / 2026' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tháng 11 / 2026' })).toBeInTheDocument();
    expect(screen.getAllByText('T2')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '05/10/2026' }));
    fireEvent.click(screen.getByRole('button', { name: '12/10/2026' }));
    expect(screen.getByRole('button', { name: '08/10/2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('8 ngày')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem tháng trước' }));
    expect(screen.getByRole('group', { name: 'Tháng 9 / 2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Áp dụng/ }));
    expect(screen.getByTestId('v')).toHaveTextContent('2026-10-05|2026-10-12');
    expect(
      screen.getByRole('button', { name: 'Ngày đặt: 05/10 – 12/10/2026' }),
    ).toBeInTheDocument();
  });
});
