'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { formatDate, formatQuantity } from '@/lib/format';
import type { PrintController } from '@/lib/print';
import type { SalesOrderDetail } from '../api/use-orders';
import { orderChannelLabel } from '../labels';

// Khổ A5 dọc — lề và cỡ chữ vật lý khai bằng inline style (khổ giấy, không phải spacing UI).
const SHEET_STYLE: CSSProperties = { padding: '8mm 10mm', fontSize: '10pt', lineHeight: 1.3 };
const SMALL: CSSProperties = { fontSize: '8pt' };

/**
 * Phiếu đơn hàng A5 (PLAN-barcode-pick-pack A3): mã vạch `docNumber` to để nhân viên kho
 * quét mở việc (hạng mục B `GET /pda/resolve/:code`), kèm dòng hàng có mã vạch SKU nhỏ.
 *
 * Mã vạch dòng mã hoá `skuCode`: `SalesOrderLineDto` không mang barcode của SKU, nhưng
 * `ProductService` tự tạo một mã (QR/CODE128) đúng bằng `Sku.code` khi tạo SKU, nên
 * `GET /barcodes/{skuCode}` và `/pda/scan` đều nhận. Địa chỉ giao không in được:
 * `SalesOrderCustomerDto` chỉ có id/mã/tên.
 */
export function OrderPrintSheet({
  order,
  printer,
}: {
  order: SalesOrderDetail;
  printer: PrintController;
}) {
  return (
    <PrintSheet open={printer.open} onDone={printer.done} size="A5">
      <div data-print-page style={SHEET_STYLE} className="text-foreground">
        <header className="flex items-start justify-between gap-4 border-b pb-2">
          <div>
            <div className="text-lg font-semibold">Phiếu đơn hàng</div>
            <div className="font-mono text-base">{order.docNumber}</div>
            <div style={SMALL}>
              Ngày {formatDate(order.orderDate)} · Kênh {orderChannelLabel(order.channel)}
            </div>
          </div>
          <Barcode value={order.docNumber} symbology="code128" height={14} scale={2} />
        </header>

        <dl className="my-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <dt style={SMALL} className="text-muted-foreground">
              Khách hàng
            </dt>
            <dd className="font-semibold">
              {order.customer.name}{' '}
              <span className="font-mono font-normal">({order.customer.code})</span>
            </dd>
          </div>
          <div>
            <dt style={SMALL} className="text-muted-foreground">
              Kho lấy hàng
            </dt>
            <dd>{order.warehouse ? `${order.warehouse.code} · ${order.warehouse.name}` : '—'}</dd>
          </div>
          <div>
            <dt style={SMALL} className="text-muted-foreground">
              Hãng vận chuyển
            </dt>
            <dd>{order.carrier ? order.carrier.name : '—'}</dd>
          </div>
          <div>
            <dt style={SMALL} className="text-muted-foreground">
              Cân nặng gửi hãng
            </dt>
            <dd>{order.weightKg} kg</dd>
          </div>
        </dl>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-t">
              <th className="py-1 text-left" style={SMALL}>
                #
              </th>
              <th className="py-1 text-left" style={SMALL}>
                Sản phẩm
              </th>
              <th className="py-1 text-right" style={SMALL}>
                SL
              </th>
              <th className="py-1 text-left" style={SMALL}>
                ĐVT
              </th>
              <th className="py-1 text-left" style={SMALL}>
                Mã quét
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.id} className="border-b align-top">
                <td className="py-1 pr-1">{l.lineNo}</td>
                <td className="py-1 pr-2">
                  <div>{l.skuName}</div>
                  <div className="font-mono" style={SMALL}>
                    {l.skuCode}
                    {l.isGift ? ' · tặng' : ''}
                  </div>
                </td>
                <td className="py-1 text-right font-semibold tabular-nums">
                  {formatQuantity(l.qty)}
                </td>
                <td className="py-1 pl-2">{l.uomCode}</td>
                <td className="py-1 pl-2">
                  <Barcode
                    value={l.skuCode}
                    symbology="code128"
                    height={6}
                    scale={1}
                    showText={false}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="mt-3 flex justify-between" style={SMALL}>
          <span>{order.lineCount} dòng hàng</span>
          <span>Người lấy hàng: ______________ · Người đóng gói: ______________</span>
        </footer>
      </div>
    </PrintSheet>
  );
}
