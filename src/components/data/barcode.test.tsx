import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Barcode, withIntrinsicSize } from './barcode';

describe('withIntrinsicSize', () => {
  it('gắn width/height theo viewBox khi bwip-js không cho', () => {
    const out = withIntrinsicSize('<svg viewBox="0 0 334 96" xmlns="http://www.w3.org/2000/svg">');
    expect(out).toBe(
      '<svg width="334" height="96" viewBox="0 0 334 96" xmlns="http://www.w3.org/2000/svg">',
    );
  });

  it('đã có width → giữ nguyên', () => {
    const src = '<svg width="10" height="5" viewBox="0 0 10 5">';
    expect(withIntrinsicSize(src)).toBe(src);
  });
});

describe('<Barcode>', () => {
  it('SVG sinh ra có width/height thật (không rộng 0 trong ô bảng / inline-block) — bug in phiếu 2026-09-15', () => {
    const { container } = render(
      <Barcode value="SOP2609-00001" symbology="code128" height={14} scale={2} />,
    );
    const svg = container.querySelector('[role="img"] svg');
    expect(svg).not.toBeNull();
    const w = Number(svg!.getAttribute('width'));
    const h = Number(svg!.getAttribute('height'));
    expect(w).toBeGreaterThan(100);
    expect(h).toBeGreaterThan(20);
    expect(svg!.getAttribute('viewBox')).toBe(`0 0 ${w} ${h}`);
  });

  it('QR cũng có kích thước', () => {
    const { container } = render(<Barcode value="BVTV-0001-2" symbology="qrcode" scale={2} />);
    const svg = container.querySelector('[role="img"] svg');
    expect(Number(svg!.getAttribute('width'))).toBeGreaterThan(20);
    expect(svg!.getAttribute('height')).toBe(svg!.getAttribute('width'));
  });

  it('chuỗi rỗng → hiện chữ thay thế, không SVG', () => {
    const { container } = render(<Barcode value="" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('[data-barcode-fallback]')).toHaveTextContent('—');
  });
});
