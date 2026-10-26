import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScanCounter } from './components/scan-counter';

describe('ScanCounter — khung đếm dòng đang lấy', () => {
  it('đang quét: ĐÃ QUÉT 2 / 5 chai, CÒN QUÉT 3, 5 ô tô 2', () => {
    render(<ScanCounter done="2" planned="5" unit="CHAI" feedback={null} />);
    expect(screen.getByTestId('scan-counter')).toHaveTextContent('2/ 5chai');
    expect(screen.getByText('CÒN QUÉT').nextSibling).toHaveTextContent('3');
    expect(screen.getByRole('img', { name: 'Đã quét 2 trên 5' }).children).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent('Quét mã sản phẩm — còn 3 chai');
  });

  it('đủ: hiện ĐỦ, không còn ô CÒN QUÉT', () => {
    render(<ScanCounter done="5" planned="5" unit="CHAI" feedback={null} />);
    expect(screen.getByText('ĐỦ')).toBeInTheDocument();
    expect(screen.queryByText('CÒN QUÉT')).not.toBeInTheDocument();
  });

  it('quét sai mã: phản hồi lỗi nằm trong khung, role alert', () => {
    render(
      <ScanCounter
        done="2"
        planned="5"
        feedback={{ kind: 'error', text: 'Mã này là SP-0310 — đang lấy SP-0002.' }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Mã này là SP-0310');
  });

  it('dòng trên 20 đơn vị: thanh chia 20 ô theo tỉ lệ', () => {
    render(<ScanCounter done="30" planned="60" feedback={null} />);
    const bar = screen.getByRole('img', { name: 'Đã quét 30 trên 60' });
    expect(bar.children).toHaveLength(20);
  });
});
