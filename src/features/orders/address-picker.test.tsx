import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { AddressPicker } from './components/address-picker';

describe('AddressPicker — mở lại địa chỉ cũ', () => {
  it('có huyện (2026-11-13, "Xã Long Hòa, Huyện Cần Giờ") → vào thẳng xã của huyện đó, xã đang lưu có dấu chọn', async () => {
    server.use(
      http.get('/api/geo/units', ({ request }) => {
        const parent = new URL(request.url).searchParams.get('parentId');
        const items =
          parent === '701'
            ? [
                { id: '70141', name: 'Huyện Bình Chánh', level: 'DISTRICT', converted: null },
                { id: '70143', name: 'Huyện Cần Giờ', level: 'DISTRICT', converted: null },
              ]
            : parent === '70143'
              ? [
                  { id: '7014301', name: 'Xã An Thới Đông', level: 'WARD', converted: null },
                  { id: '7014305', name: 'Xã Long Hòa', level: 'WARD', converted: null },
                ]
              : [{ id: '701', name: 'Hồ Chí Minh', level: 'PROVINCE', converted: null }];
        return HttpResponse.json({ ready: true, items });
      }),
    );
    const onChange = vi.fn();
    renderApp(
      <AddressPicker
        value={{ province: 'Hồ Chí Minh', district: 'Huyện Cần Giờ', ward: 'Xã Long Hòa' }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Tỉnh / Phường xã' }));
    expect(await screen.findByRole('option', { name: 'Xã Long Hòa' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Huyện Bình Chánh' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Huyện Cần Giờ' })).toBeInTheDocument(),
    );
  });
});
