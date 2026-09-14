'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { formatDateTime, formatQuantity } from '@/lib/format';
import type { PrintController } from '@/lib/print';
import type { GoodsIssueDetail } from '../api/use-goods-issues';

// Khổ A5 dọc — lề và cỡ chữ vật lý khai bằng inline style (khổ giấy, không phải spacing UI).
const SHEET_STYLE: CSSProperties = { padding: '8mm 10mm', fontSize: '10pt', lineHeight: 1.3 };
const SMALL: CSSProperties = { fontSize: '8pt' };

/**
 * Phiếu pick A5 (PLAN-barcode-pick-pack A3): dòng theo vị trí lấy, mã vạch SKU nhỏ để đối
 * chiếu, mã vạch phiếu để quét mở việc.
 *
 * TODO(B): đổi sang GET /tasks/:id khi api có — mã vạch to phải là `Task.docNumber` (PICK-…)
 * của task pick, và thứ tự dòng theo `pickSequence` thật. Hiện GET /goods-issues/:id chưa
 * trả task id / docNumber nên tạm mã hoá `GoodsIssue.docNumber`; dòng xếp theo `locationCode`
 * (cùng thứ tự với `lineNo` do task engine đã đánh theo pickSequence).
 * Mã vạch dòng mã hoá `skuCode` (ProductService tự tạo mã = Sku.code khi tạo SKU).
 */
export function GdnPrintSheet({
  issue,
  printer,
}: {
  issue: GoodsIssueDetail;
  printer: PrintController;
}) {
  const lines = [...issue.lines].sort(
    (a, b) => (a.locationCode ?? '').localeCompare(b.locationCode ?? '') || a.lineNo - b.lineNo,
  );
  return (
    <PrintSheet open={printer.open} onDone={printer.done} size="A5">
      <div data-print-page style={SHEET_STYLE} className="text-foreground">
        <header className="flex items-start justify-between gap-4 border-b pb-2">
          <div>
            <div className="text-lg font-semibold">Phiếu lấy hàng</div>
            <div className="font-mono text-base">{issue.docNumber}</div>
            <div style={SMALL}>
              {issue.warehouseName} · tạo {formatDateTime(issue.createdAt)}
              {issue.refType === 'SalesOrder' && issue.refId ? ' · theo đơn bán' : ''}
            </div>
          </div>
          <Barcode value={issue.docNumber} symbology="code128" height={14} scale={2} />
        </header>

        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-left" style={SMALL}>
                Vị trí
              </th>
              <th className="py-1 text-left" style={SMALL}>
                Sản phẩm
              </th>
              <th className="py-1 text-left" style={SMALL}>
                Lô
              </th>
              <th className="py-1 text-right" style={SMALL}>
                SL lấy
              </th>
              <th className="py-1 text-left" style={SMALL}>
                Mã quét
              </th>
              <th className="py-1 text-center" style={SMALL}>
                ✓
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b align-top">
                <td className="py-1 pr-2 font-mono text-base font-semibold">
                  {l.locationCode ?? '—'}
                </td>
                <td className="py-1 pr-2">
                  <div>{l.skuName}</div>
                  <div className="font-mono" style={SMALL}>
                    {l.skuCode}
                  </div>
                  {l.exceptionNote ? <div style={SMALL}>⚠ {l.exceptionNote}</div> : null}
                </td>
                <td className="py-1 pr-2 font-mono">{l.lotNumber ?? '—'}</td>
                <td className="py-1 text-right font-semibold tabular-nums">
                  {formatQuantity(l.qtyPlanned)}
                </td>
                <td className="py-1 pl-2">
                  <Barcode
                    value={l.skuCode}
                    symbology="code128"
                    height={6}
                    scale={1}
                    showText={false}
                  />
                </td>
                <td className="py-1 text-center">☐</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="mt-3 flex justify-between" style={SMALL}>
          <span>{issue.lineCount} dòng</span>
          <span>Người lấy hàng: ______________</span>
        </footer>
      </div>
    </PrintSheet>
  );
}
