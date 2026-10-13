import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScanInput } from './scan-input';

describe('ScanInput', () => {
  const scan = (code: string) => {
    const input = screen.getByLabelText('Quét');
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('Enter = một lần quét (trim, xoá ô); mã link giữ nguyên ký tự : / .', () => {
    const onScan = vi.fn();
    render(<ScanInput label="Quét" onScan={onScan} />);
    scan('  https://www.thiennongnamviet.com.vn/combi ');
    expect(onScan).toHaveBeenCalledWith('https://www.thiennongnamviet.com.vn/combi');
    expect(screen.getByLabelText('Quét')).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mã có dấu tiếng Việt (bộ gõ Telex đổi "www" → "ưưư") → nhắc tắt bộ gõ; quét đúng lại thì tắt nhắc', () => {
    const onScan = vi.fn();
    render(<ScanInput label="Quét" onScan={onScan} />);
    scan('https://ưưư.thiennongnamviet.com.vn/combi');
    expect(screen.getByRole('alert')).toHaveTextContent('tắt bộ gõ');
    scan('https://www.thiennongnamviet.com.vn/combi');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
