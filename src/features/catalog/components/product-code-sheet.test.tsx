import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductCodeSheet, type ProductCodeSheetData } from './product-code-sheet';

const base: ProductCodeSheetData = {
  code: 'SP-0173',
  type: 'QR',
  productName: 'Phân bón lá',
  skuCode: 'SP-0173',
  levelLabel: 'Sản phẩm · CHAI',
};

const symbologyOf = (data: ProductCodeSheetData) =>
  render(<ProductCodeSheet data={data} />)
    .container.querySelector('[data-barcode]')
    ?.getAttribute('data-barcode');

describe('<ProductCodeSheet>', () => {
  it('mã kiểu QR, không chọn format → in QR vuông', () => {
    expect(symbologyOf(base)).toBe('qrcode');
  });

  it('EAN13 hợp lệ + format linear → giữ EAN13', () => {
    expect(symbologyOf({ ...base, code: '8935001234999', type: 'EAN13', format: 'linear' })).toBe(
      'ean13',
    );
  });

  it('mã kiểu QR + format linear → in mã vạch ngang (CODE128) cùng chuỗi', () => {
    expect(symbologyOf({ ...base, format: 'linear' })).toBe('code128');
  });
});
