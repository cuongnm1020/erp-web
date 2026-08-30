import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RowActions } from './row-actions';

describe('<RowActions>', () => {
  it('editHref → link Sửa; không có onDelete → không có nút Xóa', () => {
    render(<RowActions editHref="/admin/users/u1" />);
    expect(screen.getByRole('link', { name: 'Sửa' })).toHaveAttribute('href', '/admin/users/u1');
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  });

  it('không có action nào → không render gì', () => {
    const { container } = render(<RowActions />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Xóa đi qua hộp xác nhận: Hủy không gọi onDelete, xác nhận mới gọi', async () => {
    const onDelete = vi.fn();
    render(<RowActions onDelete={onDelete} itemName="khách hàng KH-0001" />);

    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(screen.getByText('Xóa khách hàng KH-0001?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText('Xóa khách hàng KH-0001?')).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    // Trong dialog có 2 nút: "Hủy" và nút xác nhận "Xóa" — nút xác nhận là nút cuối
    const confirmButtons = screen.getAllByRole('button', { name: 'Xóa' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('click không lan ra ngoài (onRowClick của bảng không bị kích hoạt)', () => {
    const rowClick = vi.fn();
    render(
      <div onClick={rowClick}>
        <RowActions onEdit={() => undefined} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    expect(rowClick).not.toHaveBeenCalled();
  });
});
