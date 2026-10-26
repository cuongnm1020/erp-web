import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PurposesScreen } from './components/purposes-screen';

const DURIAN = '00000000-0000-4000-8000-0000000000d1';
const TYPO = '00000000-0000-4000-8000-0000000000d2';

const LIST = [
  { id: DURIAN, name: 'Sầu riêng', color: null, customerCount: 12 },
  { id: TYPO, name: 'Sầu riên', color: null, customerCount: 2 },
];

describe('PurposesScreen — danh mục mục đích sử dụng (CSKH 2026-10-26)', () => {
  it('liệt kê số khách; Thêm mục đích gửi POST', async () => {
    const posted: unknown[] = [];
    server.use(
      http.get('/api/customer-purposes', () => HttpResponse.json(LIST)),
      http.post('/api/customer-purposes', async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json({
          purpose: { id: 'new', name: 'Thanh long', color: null },
          created: true,
        });
      }),
    );
    renderApp(<PurposesScreen />);
    expect(await screen.findByText('Sầu riêng')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Thêm mục đích/ })[0]!);
    fireEvent.change(await screen.findByLabelText('Tên mục đích'), {
      target: { value: 'Thanh long' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm mục đích' }).at(-1)!);
    await waitFor(() => expect(posted).toEqual([{ name: 'Thanh long' }]));
  });

  it('không có quyền purpose_manage → màn không có quyền', () => {
    renderApp(<PurposesScreen />, { me: ME_SALE });
    expect(screen.getByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});
