import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

/** asChild: lớp nút phải gắn vào phần tử con (vd <a>), không rơi vào Fragment (lỗi 2026-10-20). */
describe('Button asChild', () => {
  it('gắn lớp nút + phím tắt vào link con', () => {
    render(
      <Button asChild variant="outline" shortcut="E">
        <a href="https://example.test/x">Sửa đơn</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: /^Sửa đơn/ });
    expect(link).toHaveClass('h-control');
    expect(link).toHaveAttribute('href', 'https://example.test/x');
    expect(link.querySelector('kbd')).toHaveTextContent('E');
  });

  it('không asChild: là <button type="button">, loading thì khóa', () => {
    render(<Button loading>Lưu</Button>);
    const btn = screen.getByRole('button', { name: 'Lưu' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});
