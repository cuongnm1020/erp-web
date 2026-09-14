'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { formatDateTime, formatQuantity } from '@/lib/format';
import type { PrintController } from '@/lib/print';
import type { GoodsIssueDetail } from '../api/use-goods-issues';
import type { TaskDetail } from '../api/use-tasks';

// Khổ A5 dọc — lề và cỡ chữ vật lý khai bằng inline style (khổ giấy, không phải spacing UI).
const SHEET_STYLE: CSSProperties = { padding: '8mm 10mm', fontSize: '10pt', lineHeight: 1.3 };
const SMALL: CSSProperties = { fontSize: '8pt' };

interface SheetLine {
  id: string;
  locationCode: string | null;
  skuCode: string;
  skuName: string;
  lotNumber: string | null;
  qtyPlanned: string;
  scanCode: string;
  exceptionNote: string | null;
}

/**
 * Phiếu pick A5 (PLAN-barcode-pick-pack A3 + B3): mã vạch to là **số việc PICK**
 * (`Task.docNumber`, quét mở việc trên PDA/trạm), mã vạch đơn bán (`refDocNumber`) để quét
 * theo đơn, dòng theo `pickSequence` thật của `GET /tasks/:id`, mỗi dòng một mã vạch SKU nhỏ
 * (mã đầu tiên của SKU, không có thì mã SKU — ProductService tự tạo mã = Sku.code).
 *
 * `task` null (phiếu không từ đơn bán, hoặc task chưa sinh) → in từ chính phiếu: mã vạch
 * số phiếu, dòng theo `locationCode`, mã quét = `skuCode`.
 */
export function GdnPrintSheet({
  issue,
  task,
  printer,
}: {
  issue: GoodsIssueDetail;
  task: TaskDetail | null;
  printer: PrintController;
}) {
  const docNumber = task?.docNumber ?? issue.docNumber;
  const lines: SheetLine[] = task
    ? task.lines.map((l) => ({
        id: l.id,
        locationCode: l.fromLocationCode,
        skuCode: l.skuCode,
        skuName: l.skuName,
        lotNumber: l.lotNumber,
        qtyPlanned: l.qtyPlanned,
        scanCode: l.barcodes[0] ?? l.skuCode,
        exceptionNote: l.exceptionNote,
      }))
    : [...issue.lines]
        .sort(
          (a, b) =>
            (a.locationCode ?? '').localeCompare(b.locationCode ?? '') || a.lineNo - b.lineNo,
        )
        .map((l) => ({
          id: l.id,
          locationCode: l.locationCode,
          skuCode: l.skuCode,
          skuName: l.skuName,
          lotNumber: l.lotNumber,
          qtyPlanned: l.qtyPlanned,
          scanCode: l.skuCode,
          exceptionNote: l.exceptionNote,
        }));

  return (
    <PrintSheet open={printer.open} onDone={printer.done} size="A5">
      <div data-print-page style={SHEET_STYLE} className="text-foreground">
        <header className="flex items-start justify-between gap-4 border-b pb-2">
          <div>
            <div className="text-lg font-semibold">Phiếu lấy hàng</div>
            <div className="font-mono text-base">{docNumber}</div>
            <div style={SMALL}>
              {issue.warehouseName} · tạo {formatDateTime(issue.createdAt)}
              {task ? ` · phiếu xuất ${issue.docNumber}` : ''}
              {task?.assigneeName ? ` · ${task.assigneeName}` : ''}
            </div>
            {task?.refDocNumber ? (
              <div className="mt-1 flex items-center gap-2">
                <span style={SMALL}>Đơn bán</span>
                <Barcode value={task.refDocNumber} symbology="code128" height={8} scale={1} />
              </div>
            ) : null}
          </div>
          <Barcode value={docNumber} symbology="code128" height={14} scale={2} />
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
                    value={l.scanCode}
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
          <span>{lines.length} dòng</span>
          <span>Người lấy hàng: {task?.assigneeName ?? '______________'}</span>
        </footer>
      </div>
    </PrintSheet>
  );
}
