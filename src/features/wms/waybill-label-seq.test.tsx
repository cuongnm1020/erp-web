import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ShipmentLabelData } from './api/use-pda';
import { WaybillLabel } from './components/waybill-label';

/** Số thứ tự tem trong lô in "x/N" (2026-10-31) — tem ERP và tem GHTK 100×75. */
const base: ShipmentLabelData = {
  shipmentId: 'sh-1',
  shipmentDocNumber: 'DN2610-00001',
  orderDocNumber: 'SOP2610-00001',
  carrierCode: 'VTP',
  carrierName: 'Viettel Post',
  trackingNo: '1234567890',
  codAmount: '100000.0000',
  weightKg: '0.5000',
  recipient: {
    name: 'Khách A',
    phone: '0901234567',
    address: 'Ấp 1, Xã A, Tỉnh B',
    street: 'Ấp 1',
    locality: 'Xã A, Tỉnh B',
    fromWard: 'Xã A, Tỉnh B',
    fromDistrict: 'Tỉnh B',
    province: 'Tỉnh B',
  },
  sender: {
    name: 'Shop',
    phone: '0339213208',
    address: 'Kho, Xã C, Hà Nội',
    street: 'Kho',
    locality: 'Xã C, Hà Nội',
    fromWard: 'Xã C, Hà Nội',
    fromDistrict: 'Hà Nội',
    province: 'Hà Nội',
    warehouseName: 'Kho Long An',
  },
  allowInspection: false,
  callShopOnFailure: null,
  items: [{ name: 'Phân bón A', qty: '1.000000' }],
  note: null,
} as ShipmentLabelData;

const printedAt = new Date('2026-10-31T03:00:00.000Z');

describe('WaybillLabel — số thứ tự trong lô in', () => {
  it('tem ERP: có seq → "#3/50"; in lẻ → không có', () => {
    const { unmount } = render(
      <WaybillLabel
        data={base}
        orientation="landscape"
        printedAt={printedAt}
        seq={{ index: 3, total: 50 }}
      />,
    );
    expect(screen.getByText('#3/50')).toBeInTheDocument();
    unmount();
    render(<WaybillLabel data={base} orientation="landscape" printedAt={printedAt} />);
    expect(screen.queryByText(/#\d+\/\d+/)).not.toBeInTheDocument();
  });

  it('tem GHTK 100×75 ngang: có seq → "#12/40"', () => {
    render(
      <WaybillLabel
        data={{
          ...base,
          carrierCode: 'GHTK',
          carrierName: 'GHTK',
          trackingNo: 'S23119447.MB21.A1.123456789',
        }}
        orientation="landscape"
        printedAt={printedAt}
        seq={{ index: 12, total: 40 }}
      />,
    );
    expect(screen.getByText('#12/40')).toBeInTheDocument();
  });
});
