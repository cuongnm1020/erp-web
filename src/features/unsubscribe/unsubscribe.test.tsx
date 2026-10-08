import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { errorEnvelope, PUBLIC_UNSUBSCRIBE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { UnsubscribeScreen } from './components/unsubscribe-screen';

const TOKEN = 'eyJjIjoiYWJjIiwiY2giOiJTTVMifQ.c2lnbmF0dXJlLWJhc2U2NHVybA';

describe('UnsubscribeScreen — /public/unsubscribe/:token (CRM-13)', () => {
  it('loading → tên đã che + kênh + trạng thái; bấm Hủy nhận tin → POST → xác nhận', async () => {
    const posts: string[] = [];
    server.use(
      http.post('/api/public/unsubscribe/:token', ({ params }) => {
        posts.push(params.token as string);
        return HttpResponse.json({ ...PUBLIC_UNSUBSCRIBE, currentlyGranted: false });
      }),
    );
    renderApp(<UnsubscribeScreen token={TOKEN} />, { me: null });
    expect(screen.getByRole('status', { name: 'Đang tải' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Hủy nhận tin qua tin nhắn SMS' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ng*** V** A')).toBeInTheDocument();
    expect(screen.getByText(/Bạn đang nhận tin khuyến mãi qua tin nhắn SMS/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hủy nhận tin' }));
    expect(
      await screen.findByRole('heading', { name: 'Bạn đã hủy nhận tin qua tin nhắn SMS' }),
    ).toBeInTheDocument();
    expect(posts).toEqual([TOKEN]);
  });

  it('đã hủy từ trước (currentlyGranted=false) → hiện xác nhận, không cần bấm', async () => {
    server.use(
      http.get('/api/public/unsubscribe/:token', () =>
        HttpResponse.json({ ...PUBLIC_UNSUBSCRIBE, channel: 'ZALO', currentlyGranted: false }),
      ),
    );
    renderApp(<UnsubscribeScreen token={TOKEN} />, { me: null });
    expect(
      await screen.findByRole('heading', { name: 'Bạn đã hủy nhận tin qua Zalo' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy nhận tin' })).not.toBeInTheDocument();
  });

  it('chưa từng đăng ký (null) → vẫn cho bấm để ghi nhận từ chối', async () => {
    server.use(
      http.get('/api/public/unsubscribe/:token', () =>
        HttpResponse.json({ ...PUBLIC_UNSUBSCRIBE, channel: 'EMAIL', currentlyGranted: null }),
      ),
    );
    renderApp(<UnsubscribeScreen token={TOKEN} />, { me: null });
    expect(await screen.findByText(/Bạn chưa đăng ký nhận tin khuyến mãi qua email/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hủy nhận tin' })).toBeEnabled();
  });

  it('404 → "Link không hợp lệ", không có nút hủy', async () => {
    server.use(http.get('/api/public/unsubscribe/:token', () => errorEnvelope(404, 'NOT_FOUND')));
    renderApp(<UnsubscribeScreen token="tampered" />, { me: null });
    expect(await screen.findByRole('heading', { name: 'Link không hợp lệ' })).toBeInTheDocument();
    expect(screen.getByText(/Link hủy nhận tin không hợp lệ hoặc đã bị sửa/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy nhận tin' })).not.toBeInTheDocument();
  });

  it('429 khi tải → câu RATE_LIMITED + Thử lại (refetch)', async () => {
    let calls = 0;
    server.use(
      http.get('/api/public/unsubscribe/:token', () => {
        calls++;
        return calls === 1
          ? errorEnvelope(429, 'RATE_LIMITED')
          : HttpResponse.json(PUBLIC_UNSUBSCRIBE);
      }),
    );
    renderApp(<UnsubscribeScreen token={TOKEN} />, { me: null });
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn thao tác quá nhanh');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(
      await screen.findByRole('heading', { name: 'Hủy nhận tin qua tin nhắn SMS' }),
    ).toBeInTheDocument();
  });

  it('429 khi bấm hủy → báo inline, nút vẫn còn để bấm lại', async () => {
    server.use(
      http.post('/api/public/unsubscribe/:token', () => errorEnvelope(429, 'RATE_LIMITED')),
    );
    renderApp(<UnsubscribeScreen token={TOKEN} />, { me: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy nhận tin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn thao tác quá nhanh');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hủy nhận tin' })).toBeEnabled());
  });

  it('500 → câu chung + traceId + Thử lại', async () => {
    server.use(http.get('/api/public/unsubscribe/:token', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<UnsubscribeScreen token={TOKEN} />, { me: null });
    expect(await screen.findByText('Chưa tải được thông tin')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});
