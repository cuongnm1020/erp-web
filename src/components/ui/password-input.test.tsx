import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('mặc định ẩn; bấm con mắt → hiện chữ, bấm lại → ẩn; không gửi form', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <label htmlFor="pw">Mật khẩu</label>
        <PasswordInput id="pw" autoComplete="current-password" />
      </form>,
    );
    const input = screen.getByLabelText('Mật khẩu');
    await user.type(input, 'Bi-mat1');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('Bi-mat1');
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(input).toHaveAttribute('type', 'password');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ô bị khóa thì nút con mắt cũng khóa', () => {
    render(<PasswordInput aria-label="Mật khẩu" disabled />);
    expect(screen.getByRole('button', { name: 'Hiện mật khẩu' })).toBeDisabled();
  });
});
