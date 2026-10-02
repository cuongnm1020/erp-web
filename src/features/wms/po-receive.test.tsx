import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { PoReceiveScreen } from './components/po-receive-screen';

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/po/receive',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const rowOf = (sku: string) => screen.getByText(sku).closest('tr')!;

describe('PoReceiveScreen — chọn ĐVT nhập (UI mẫu)', () => {
  it('mặc định nhận theo ĐVT của PO, hiện SL quy ra đơn vị bán chính', () => {
    renderApp(<PoReceiveScreen />);
    const row = rowOf('VBC-40G-10');
    expect(within(row).getByRole('combobox', { name: 'ĐVT nhập dòng 1' })).toHaveTextContent(
      'thùng',
    );
    // 50 thùng × 50 gói
    expect(within(row).getByText('= 2.500 gói')).toBeInTheDocument();
    expect(within(row).getByText('đủ')).toBeInTheDocument();
  });

  it('đổi sang đơn vị bán chính: 2.500 gói vẫn đủ; 100 gói → còn 48 thùng', async () => {
    renderApp(<PoReceiveScreen />);
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT nhập dòng 1' }));
    fireEvent.click(await screen.findByRole('option', { name: 'gói' }));
    fireEvent.change(screen.getByLabelText('Số lượng nhận dòng 1'), {
      target: { value: '2500' },
    });
    expect(within(rowOf('VBC-40G-10')).getByText('đủ')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Số lượng nhận dòng 1'), { target: { value: '100' } });
    expect(within(rowOf('VBC-40G-10')).getByText('còn 48 thùng')).toBeInTheDocument();
  });

  it('nhận theo pallet: 1 pallet = 2.000 gói = 40 thùng → còn 10 thùng', async () => {
    renderApp(<PoReceiveScreen />);
    fireEvent.click(screen.getByRole('combobox', { name: 'ĐVT nhập dòng 1' }));
    fireEvent.click(await screen.findByRole('option', { name: 'pallet (2.000 gói)' }));
    fireEvent.change(screen.getByLabelText('Số lượng nhận dòng 1'), { target: { value: '1' } });
    const row = rowOf('VBC-40G-10');
    expect(within(row).getByText('= 2.000 gói')).toBeInTheDocument();
    expect(within(row).getByText('còn 10 thùng')).toBeInTheDocument();
  });

  it('dòng giao dôi hiện "+2 thùng thừa"', () => {
    renderApp(<PoReceiveScreen />);
    expect(within(rowOf('RT-500')).getByText('+2 thùng thừa')).toBeInTheDocument();
  });
});
