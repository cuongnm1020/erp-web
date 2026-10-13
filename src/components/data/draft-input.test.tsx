import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftInput } from './draft-input';

const box = () => screen.getByRole('textbox', { name: 'q' }) as HTMLInputElement;

describe('<DraftInput>', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('chốt sau delay, cắt khoảng trắng, không đè chữ khi giá trị chốt vọng về', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<DraftInput aria-label="q" value="" onCommit={onCommit} />);
    box().focus();
    fireEvent.change(box(), { target: { value: 'cân ' } });
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenCalledWith('cân');

    rerender(<DraftInput aria-label="q" value="cân" onCommit={onCommit} />);
    expect(box().value).toBe('cân ');
  });

  it('URL cũ về muộn lúc đang gõ tiếp không ghi đè chữ mới', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<DraftInput aria-label="q" value="" onCommit={onCommit} />);
    box().focus();
    fireEvent.change(box(), { target: { value: 'ca' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(box(), { target: { value: 'cân b' } });
    fireEvent.change(box(), { target: { value: 'cân bằng' } });
    rerender(<DraftInput aria-label="q" value="ca" onCommit={onCommit} />);
    expect(box().value).toBe('cân bằng');
  });

  it('đang ghép dấu (IME) thì không chốt, Enter xác nhận chữ không tìm; xong ghép mới chốt', () => {
    const onCommit = vi.fn();
    render(<DraftInput aria-label="q" value="" onCommit={onCommit} />);
    box().focus();
    fireEvent.compositionStart(box());
    fireEvent.change(box(), { target: { value: 'caa' } });
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true });
    act(() => vi.advanceTimersByTime(1000));
    expect(onCommit).not.toHaveBeenCalled();

    box().value = 'câ';
    fireEvent.compositionEnd(box());
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('câ');
  });

  it('chuẩn hóa NFC: dấu tổ hợp từ bộ gõ thành ký tự dựng sẵn', () => {
    const onCommit = vi.fn();
    render(<DraftInput aria-label="q" value="" onCommit={onCommit} />);
    fireEvent.change(box(), { target: { value: 'cân' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('cân');
  });

  it('giá trị ngoài đổi khi ô không có focus (Xóa lọc) → ô cập nhật theo', () => {
    const { rerender } = render(<DraftInput aria-label="q" value="cân" onCommit={vi.fn()} />);
    rerender(<DraftInput aria-label="q" value="" onCommit={vi.fn()} />);
    expect(box().value).toBe('');
  });
});
