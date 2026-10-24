import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderScanButton } from './components/order-scan-button';

let supported = true;
vi.mock('@/components/data/camera-scanner', () => ({
  isCameraScanSupported: () => supported,
  // Camera giả: bấm "Đọc mã" = đọc được mã vận đơn.
  CameraScanner: ({ onDetect }: { onDetect: (code: string) => void }) => (
    <button type="button" onClick={() => onDetect('S23119447.BO.MN3-02-T54.1818370518')}>
      Đọc mã
    </button>
  ),
}));

describe('OrderScanButton', () => {
  beforeEach(() => {
    supported = true;
  });

  it('không hiện khi trình duyệt không mở được camera', () => {
    supported = false;
    render(<OrderScanButton onScan={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Quét tìm đơn/ })).toBeNull();
  });

  it('quét được mã thì đóng camera và trả mã cho màn tìm', () => {
    const onScan = vi.fn();
    render(<OrderScanButton onScan={onScan} />);
    fireEvent.click(screen.getByRole('button', { name: /Quét tìm đơn/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Đọc mã' }));
    expect(onScan).toHaveBeenCalledWith('S23119447.BO.MN3-02-T54.1818370518');
    expect(screen.queryByRole('button', { name: 'Đọc mã' })).toBeNull();
  });
});
