import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrackingLink } from './tracking-link';

describe('<TrackingLink>', () => {
  it('có link mang sẵn mã → thẻ a mở tab mới, không sao chép', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const stop = vi.fn();
    render(
      <div onClick={stop}>
        <TrackingLink
          trackingNo="S23013020.MN2-25-Y51.1197893935"
          url="https://khachhang.giaohangtietkiem.vn/web/van-hanh/don-hang?module=detail&order=1197893935"
          prefilled
        />
      </div>,
    );
    const a = screen.getByRole('link', { name: /Xem vận đơn S23013020/ });
    expect(a).toHaveAttribute(
      'href',
      'https://khachhang.giaohangtietkiem.vn/web/van-hanh/don-hang?module=detail&order=1197893935',
    );
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(a);
    expect(writeText).not.toHaveBeenCalled();
    // Không lan lên dòng bảng (xem nhanh).
    expect(stop).not.toHaveBeenCalled();
  });

  it('trang hãng không nhận mã (VNPost) → bấm là sao chép mã rồi mở trang', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <TrackingLink trackingNo="CF376440765VN" url="https://www.vnpost.vn/" prefilled={false} />,
    );
    fireEvent.click(screen.getByRole('link'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('CF376440765VN'));
  });

  it('không có link → chữ bấm là sao chép (CopyText), không phải thẻ a', () => {
    render(<TrackingNoLinkCase />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sao chép mã vận đơn ABC123/ })).toBeInTheDocument();
  });
});

function TrackingNoLinkCase() {
  return <TrackingLink trackingNo="ABC123" url={null} prefilled={false} />;
}
