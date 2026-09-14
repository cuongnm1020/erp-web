import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrderDetail, makeOrders } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { OrderDetailScreen } from './components/order-detail-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders/x',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ORDER = makeOrders(1)[0]!;
const DETAIL = makeOrderDetail(ORDER.id)!;

describe('Phiếu đơn hàng — In phiếu đơn (PLAN-barcode-pick-pack A3)', () => {
  beforeEach(() => {
    window.print = vi.fn();
  });

  it('bấm In phiếu đơn → tờ in A5 có mã vạch CODE128 của docNumber và mã quét từng dòng', async () => {
    let snapshot: { root: number; docBarcode: number; lineBarcodes: number; size: string | null } =
      {
        root: 0,
        docBarcode: 0,
        lineBarcodes: 0,
        size: null,
      };
    (window.print as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const root = document.querySelector('[data-print-root]');
      snapshot = {
        root: root ? 1 : 0,
        docBarcode: root
          ? root.querySelectorAll(`[role="img"][aria-label="Mã vạch ${DETAIL.docNumber}"] svg`)
              .length
          : 0,
        lineBarcodes: root ? root.querySelectorAll('tbody [role="img"] svg').length : 0,
        size: root?.getAttribute('data-print-size') ?? null,
      };
    });
    renderApp(<OrderDetailScreen orderId={ORDER.id} />);
    await screen.findAllByText(DETAIL.docNumber);
    fireEvent.click(screen.getByRole('button', { name: 'In phiếu đơn' }));
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    expect(snapshot.root).toBe(1);
    expect(snapshot.size).toBe('A5');
    expect(snapshot.docBarcode).toBe(1);
    expect(snapshot.lineBarcodes).toBe(DETAIL.lines.length);
    // Màn hình thường không giữ tờ in lại
    expect(document.querySelector('[data-print-root]')).toBeNull();
  });
});
