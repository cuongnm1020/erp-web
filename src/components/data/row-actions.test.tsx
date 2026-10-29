import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RowActions } from './row-actions';

describe('<RowActions>', () => {
  it('editHref → link Sửa; không có onDelete → không có nút Xóa', () => {
    render(<RowActions editHref="/admin/users/u1" />);
    expect(screen.getByRole('link', { name: 'Sửa' })).toHaveAttribute('href', '/admin/users/u1');
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  });

  it('inline: mục thường + mục nguy hiểm đều thành nút icon trên dòng, không "⋯"; mục tắt vẫn hiện, bị khóa', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const cancel = vi.fn();
    render(
      <RowActions
        inline
        itemName="đơn SO-1"
        primary={{ label: 'Xem nhanh', icon: <span />, onClick: () => undefined }}
        items={[
          { label: 'Sửa đơn', icon: <span />, href: '/o/1/edit' },
          { label: 'Nhân bản đơn', icon: <span />, disabledReason: 'Không có quyền' },
          { label: 'Xin lại', icon: <span />, onSelect: retry },
          { label: 'Hủy đơn', icon: <span />, danger: true, onSelect: cancel },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Sửa đơn' })).toHaveAttribute('href', '/o/1/edit');
    expect(screen.getByRole('button', { name: 'Nhân bản đơn' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Xin lại' }));
    expect(retry).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Hủy đơn' }));
    expect(cancel).toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Thao tác khác cho đơn SO-1' }),
    ).not.toBeInTheDocument();
  });

  it('không có action nào → không render gì', () => {
    const { container } = render(<RowActions />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Xóa nằm trong menu "⋯", không phải nút icon trên dòng', async () => {
    const user = userEvent.setup();
    render(<RowActions onEdit={() => undefined} onDelete={() => undefined} itemName="KH-0001" />);
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thao tác khác cho KH-0001' }));
    expect(await screen.findByRole('menuitem', { name: 'Xóa' })).toBeInTheDocument();
  });

  it('mục tắt hiện kèm lý do thay vì ẩn', async () => {
    const user = userEvent.setup();
    render(
      <RowActions
        items={[{ label: 'Hủy đơn', danger: true, disabledReason: 'Đơn đã đóng gói' }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Thao tác khác' }));
    const item = await screen.findByRole('menuitem', { name: /Hủy đơn/ });
    expect(item).toHaveAttribute('data-disabled');
    expect(item).toHaveTextContent('Đơn đã đóng gói');
  });

  it('Xóa đi qua hộp xác nhận: Hủy không gọi onDelete, xác nhận mới gọi', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<RowActions onDelete={onDelete} itemName="khách hàng KH-0001" />);
    const openDelete = async () => {
      await user.click(
        screen.getByRole('button', { name: 'Thao tác khác cho khách hàng KH-0001' }),
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Xóa' }));
    };

    await openDelete();
    expect(await screen.findByText('Xóa khách hàng KH-0001?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText('Xóa khách hàng KH-0001?')).not.toBeInTheDocument(),
    );

    await openDelete();
    await screen.findByText('Xóa khách hàng KH-0001?');
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
