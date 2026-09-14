'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { formatDateTime, formatQuantity } from '@/lib/format';
import type { PrintController } from '@/lib/print';
import type { WaveDetail } from '../api/use-waves';

const SHEET_STYLE: CSSProperties = { padding: '8mm 10mm', fontSize: '10pt', lineHeight: 1.3 };
const SMALL: CSSProperties = { fontSize: '8pt' };

/**
 * Phiếu lượt pick gộp A5 (PLAN-barcode-pick-pack E3): mã vạch WAVE để quét nhận cả lượt, dòng
 * gộp theo lối đi (vị trí → SKU → tổng SL), mỗi dòng ghi các đơn góp vào để người lấy biết
 * hàng này chia về đâu — máy quét tự chia, phiếu chỉ để đối chiếu.
 */
export function WavePrintSheet({ wave, printer }: { wave: WaveDetail; printer: PrintController }) {
  return (
    <PrintSheet open={printer.open} onDone={printer.done} size="A5">
      <div data-print-page style={SHEET_STYLE} className="text-foreground">
        <header className="flex items-start justify-between gap-4 border-b pb-2">
          <div>
            <div className="text-lg font-semibold">Phiếu lấy hàng gộp</div>
            <div className="font-mono text-base">{wave.docNumber}</div>
            <div style={SMALL}>
              Kho {wave.warehouseCode} · {wave.taskCount} đơn · tạo {formatDateTime(wave.createdAt)}
              {wave.assigneeName ? ` · ${wave.assigneeName}` : ''}
            </div>
          </div>
          <Barcode value={wave.docNumber} symbology="code128" height={14} scale={2} />
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
              <th className="py-1 text-right" style={SMALL}>
                Tổng SL
              </th>
              <th className="py-1 text-left" style={SMALL}>
                Chia về đơn
              </th>
              <th className="py-1 text-center" style={SMALL}>
                ✓
              </th>
            </tr>
          </thead>
          <tbody>
            {wave.lines.map((g) => (
              <tr key={g.key} className="border-b align-top">
                <td className="py-1 pr-2 font-mono text-base font-semibold">
                  {g.locationCode ?? '—'}
                </td>
                <td className="py-1 pr-2">
                  <div>{g.skuName}</div>
                  <div className="font-mono" style={SMALL}>
                    {g.skuCode}
                    {g.lotNumber ? ` · lô ${g.lotNumber}` : ''}
                  </div>
                </td>
                <td className="py-1 pr-2 text-right text-base font-semibold tabular-nums">
                  {formatQuantity(g.qtyPlanned)}
                </td>
                <td className="py-1 pr-2 font-mono" style={SMALL}>
                  {g.shares.map((sh) => (
                    <div key={sh.taskLineId}>
                      {sh.refDocNumber ?? sh.taskDocNumber} × {formatQuantity(sh.qtyPlanned)}
                    </div>
                  ))}
                </td>
                <td className="py-1 text-center">☐</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-3" style={SMALL}>
          <div className="font-semibold">Đơn trong lượt</div>
          <div className="font-mono">
            {wave.tasks.map((t) => t.refDocNumber ?? t.docNumber).join(' · ')}
          </div>
        </section>
      </div>
    </PrintSheet>
  );
}
