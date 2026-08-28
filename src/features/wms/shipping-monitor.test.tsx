import { fireEvent, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { makeStuckShipments } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ShippingMonitorScreen } from './components/shipping-monitor-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/shipping',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const FIRST = makeStuckShipments(1)[0]!;

describe('ShippingMonitorScreen — đơn treo + timeline hãng (BE-carrier-sync)', () => {
  beforeEach(() => {
    search = '';
  });

  it('liệt kê đơn treo, tổng trên tiêu đề theo ngưỡng ngày mặc định 5', async () => {
    renderApp(<ShippingMonitorScreen />);
    expect(await screen.findByText(FIRST.docNumber)).toBeInTheDocument();
    expect(screen.getByText(/đơn treo quá 5 ngày/)).toBeInTheDocument();
    // mã hãng thô gần nhất hiển thị để đối soát
    expect(screen.getAllByText(FIRST.carrierStatusCode!).length).toBeGreaterThanOrEqual(1);
  });

  it('đổi ngưỡng ngày trên URL (?days=7) → lọc phía server', async () => {
    search = 'days=7';
    renderApp(<ShippingMonitorScreen />);
    await screen.findByText(/đơn treo quá 7 ngày/);
    // daysSinceShipped bắt đầu từ 6 → dòng 6 ngày không còn khi lọc 7
    expect(screen.queryByText(FIRST.docNumber)).not.toBeInTheDocument();
  });

  it('nhấn dòng → mở timeline: nguồn Webhook/Đối soát, mã lạ có ghi chú', async () => {
    renderApp(<ShippingMonitorScreen />);
    fireEvent.click(await screen.findByText(FIRST.docNumber));
    expect(await screen.findByText(`Hành trình ${FIRST.docNumber}`)).toBeInTheDocument();
    expect(await screen.findByText('Webhook')).toBeInTheDocument();
    expect(screen.getByText('Đối soát')).toBeInTheDocument();
    expect(screen.getByText('Mã lạ')).toBeInTheDocument();
    expect(screen.getByText('mã trạng thái 45 chưa được ánh xạ')).toBeInTheDocument();
  });

  it('empty: không có đơn treo', async () => {
    server.use(
      http.get('/api/carriers/stuck-shipments', () => HttpResponse.json({ items: [], total: 0 })),
    );
    renderApp(<ShippingMonitorScreen />);
    expect(await screen.findByText(/Không có đơn nào treo quá 5 ngày/)).toBeInTheDocument();
  });
});
