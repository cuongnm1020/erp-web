'use client';

import { FileDown, FileUp } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatQuantity } from '@/lib/format';
import { ALL_WAREHOUSES, useWarehouse } from '@/lib/warehouse';
import {
  stockExcelHref,
  useImportStockExcel,
  type StockExcelImportResult,
  type StockExcelImportRow,
} from '../api/use-stock';

/** Kho mặc định của hộp thoại = kho đang chọn ở sidebar (nếu là một kho cụ thể). */
function useDefaultWarehouse() {
  const wh = useWarehouse();
  const fallback = wh.selected && wh.selected !== ALL_WAREHOUSES ? wh.selected : '';
  return { options: wh.options, fallback };
}

function WarehouseSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const { options } = useWarehouse();
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">Kho</span>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Chọn kho" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * "Xuất Excel" — chọn kho rồi tải file tồn của kho đó (GET /stock/excel): hàng ERP, tồn sổ, đang
 * giữ cho đơn, cột "Tồn thực tế" để điền rồi nhập lại.
 */
export function StockExcelExportButton() {
  const { fallback } = useDefaultWarehouse();
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setWarehouseId(fallback);
          setOpen(true);
        }}
      >
        <FileDown className="h-4 w-4" aria-hidden />
        Xuất Excel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xuất Excel tồn kho</DialogTitle>
            <DialogDescription>
              File gồm mọi hàng ERP với tồn sổ và phần đang giữ cho đơn của kho đã chọn. Điền cột
              &quot;Tồn thực tế&quot; rồi dùng &quot;Nhập Excel&quot; để ghi lại.
            </DialogDescription>
          </DialogHeader>
          <WarehouseSelect value={warehouseId} onChange={setWarehouseId} label="Kho xuất Excel" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            {warehouseId ? (
              <Button asChild>
                {/* Anchor thật: tải file qua cookie phiên, như nút Xuất Pancake. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href={stockExcelHref(warehouseId)} onClick={() => setOpen(false)}>
                  Tải file
                </a>
              </Button>
            ) : (
              <Button disabled>Tải file</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ACTION_LABEL: Record<StockExcelImportRow['action'], string> = {
  INCREASE: 'Tăng',
  DECREASE: 'Giảm',
  UNCHANGED: 'Khớp',
  SKIPPED: 'Bỏ trống',
  ERROR: 'Lỗi',
};
const ACTION_TONE = {
  INCREASE: 'ok',
  DECREASE: 'warn',
  UNCHANGED: 'neutral',
  SKIPPED: 'neutral',
  ERROR: 'err',
} as const;

/**
 * "Nhập Excel" — chọn kho + file đã điền → "Kiểm tra" (xem trước, không ghi) → "Ghi tồn". Ghi =
 * "Nhập tồn thực tế": phần lệch vào sổ cái + phiếu kiểm kê đã ghi sổ; ô trống không đổi.
 */
export function StockExcelImportButton() {
  const { fallback } = useDefaultWarehouse();
  const { options } = useWarehouse();
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StockExcelImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useImportStockExcel();

  const reset = (patch: { warehouseId?: string; file?: File | null }) => {
    if (patch.warehouseId !== undefined) setWarehouseId(patch.warehouseId);
    if (patch.file !== undefined) setFile(patch.file);
    setPreview(null);
    setError(null);
  };
  const whName = options.find((o) => o.id === warehouseId)?.name ?? '';

  const check = () => {
    if (!warehouseId || !file) return;
    setError(null);
    run.mutate(
      { warehouseId, file, dryRun: true },
      { onSuccess: setPreview, onError: (e) => setError(messageFor(e)) },
    );
  };
  const apply = () => {
    if (!warehouseId || !file || !preview) return;
    const key = crypto.randomUUID();
    run.mutate(
      { warehouseId, file, dryRun: false, key },
      {
        onSuccess: (r) => {
          setOpen(false);
          toast.success(
            `Đã ghi tồn kho ${r.warehouseName}: ${r.increase} SKU tăng, ${r.decrease} SKU giảm`,
            {
              description: [
                r.docNumbers.length ? `Phiếu kiểm kê ${r.docNumbers.join(', ')}.` : '',
                r.errors ? `${r.errors} dòng lỗi không ghi.` : '',
              ]
                .filter(Boolean)
                .join(' '),
            },
          );
        },
        onError: (e) => setError(messageFor(e)),
      },
    );
  };

  const changes = preview ? preview.increase + preview.decrease : 0;
  const shown = preview?.rows.filter((r) => r.action !== 'SKIPPED' && r.action !== 'UNCHANGED');

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          reset({ warehouseId: fallback, file: null });
          setOpen(true);
        }}
      >
        <FileUp className="h-4 w-4" aria-hidden />
        Nhập Excel
      </Button>
      <Dialog open={open} onOpenChange={(o) => !run.isPending && setOpen(o)}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>Nhập Excel tồn kho</DialogTitle>
            <DialogDescription>
              Dùng file từ &quot;Xuất Excel&quot; của đúng kho. Hệ thống ghi phần chênh lệch giữa
              &quot;Tồn thực tế&quot; và tồn sổ, kèm phiếu kiểm kê để tra lại; ô trống không đổi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <WarehouseSelect
              value={warehouseId}
              onChange={(v) => reset({ warehouseId: v })}
              label="Kho nhập Excel"
            />
            <label className="block space-y-1 text-sm">
              <span className="font-medium">File Excel</span>
              <Input
                type="file"
                accept=".xlsx,.xls"
                aria-label="File Excel tồn kho"
                onChange={(e) => reset({ file: e.target.files?.[0] ?? null })}
              />
            </label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {preview ? (
            <div className="space-y-2 text-sm">
              <p>
                Kho <b className="font-semibold">{preview.warehouseName}</b>:{' '}
                <b className="font-semibold">{preview.increase}</b> SKU tăng,{' '}
                <b className="font-semibold">{preview.decrease}</b> SKU giảm, {preview.unchanged}{' '}
                khớp, {preview.skipped} bỏ trống
                {preview.errors ? (
                  <span className="text-destructive">, {preview.errors} dòng lỗi (không ghi)</span>
                ) : null}
                .
              </p>
              {shown && shown.length > 0 ? (
                <div className="max-h-80 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs" aria-label="Xem trước nhập Excel">
                    <thead className="sticky top-0 bg-muted text-left">
                      <tr>
                        <th className="px-2 py-1">Dòng</th>
                        <th className="px-2 py-1">Mã SKU</th>
                        <th className="px-2 py-1">Tên</th>
                        <th className="px-2 py-1 text-right">Tồn sổ</th>
                        <th className="px-2 py-1 text-right">Tồn thực tế</th>
                        <th className="px-2 py-1">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.row} className="border-t">
                          <td className="px-2 py-1 tabular-nums">{r.row}</td>
                          <td className="px-2 py-1 font-mono">{r.skuCode ?? '—'}</td>
                          <td className="max-w-56 truncate px-2 py-1" title={r.skuName ?? ''}>
                            {r.skuName ?? '—'}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {r.current === null ? '—' : formatQuantity(r.current)}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {r.counted === null ? '—' : formatQuantity(r.counted)}
                          </td>
                          <td className="px-2 py-1">
                            <StatusBadge tone={ACTION_TONE[r.action]}>
                              {ACTION_LABEL[r.action]}
                            </StatusBadge>
                            {r.note ? (
                              <span className="ml-1 text-muted-foreground">{r.note}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={run.isPending}
            >
              Hủy
            </Button>
            {preview ? (
              <Button
                onClick={apply}
                disabled={changes === 0}
                loading={run.isPending}
                loadingText="Đang ghi…"
              >
                {changes > 0 ? `Ghi tồn ${changes} SKU vào ${whName}` : 'Không có gì để ghi'}
              </Button>
            ) : (
              <Button
                onClick={check}
                disabled={!warehouseId || !file}
                loading={run.isPending}
                loadingText="Đang kiểm tra…"
              >
                Kiểm tra file
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
