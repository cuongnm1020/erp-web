'use client';

import { FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { useImportSuppliers, type SupplierImportResult } from '../api/use-suppliers';

const ACCEPT = '.xlsx,.xls,.csv';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Nhập nhà cung cấp từ Excel "Danh sách nhà cung cấp" (mẫu kế toán: Mã NCC, Tên NCC, Địa chỉ,
 * MST/CCCD, Điện thoại). Server khớp theo mã: đã có → chỉ ghi đè, chưa có → tạo — nhập lại cùng
 * file không tạo trùng. Kết quả hiện ngay trong hộp: số tạo / ghi đè / khôi phục / bỏ qua + bảng
 * dòng lỗi (số dòng khớp Excel người dùng đang mở).
 */
export function SupplierImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importMut = useImportSuppliers();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SupplierImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (f: File | null) => {
    setResult(null);
    setError(null);
    if (!f) return setFile(null);
    if (f.size > MAX_BYTES) {
      setFile(null);
      setError('File quá 5 MB — tách nhỏ file rồi nhập lại.');
      return;
    }
    setFile(f);
  };

  const run = () => {
    if (!file) return;
    setError(null);
    importMut.mutate(file, {
      onSuccess: (r) => {
        setResult(r);
        const parts = [
          r.created ? `${r.created} tạo mới` : null,
          r.updated ? `${r.updated} ghi đè` : null,
          r.skipped ? `${r.skipped} bỏ qua` : null,
        ].filter(Boolean);
        toast.success(`Đã nhập ${r.total} nhà cung cấp — ${parts.join(', ') || 'không thay đổi'}`);
      },
      onError: (err) => {
        // 422 ở đây là file sai mẫu (không có cột Mã/Tên NCC, không đọc được) — câu cố định
        // phía web, không in message thô (luật 6).
        if (err instanceof ApiError && err.status === 422) {
          setError(
            'File không đúng mẫu: cần sheet đầu có dòng tiêu đề với cột "Mã nhà cung cấp" và "Tên nhà cung cấp" (file Excel .xlsx/.xls hoặc CSV).',
          );
        } else {
          setError(messageFor(err));
        }
      },
    });
  };

  const close = (o: boolean) => {
    if (importMut.isPending) return;
    onOpenChange(o);
    if (!o) {
      setFile(null);
      setResult(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Nhập nhà cung cấp từ Excel</DialogTitle>
          <DialogDescription>
            Theo mẫu “Danh sách nhà cung cấp” của kế toán (cột Mã nhà cung cấp, Tên nhà cung cấp,
            Địa chỉ, Mã số thuế, Điện thoại). Mã đã có trong hệ thống chỉ được ghi đè, không tạo
            thêm bản trùng; nhà cung cấp đã xóa trùng mã sẽ được khôi phục.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div
            className="flex items-center gap-3 rounded-md border border-dashed bg-muted/40 px-3 py-2.5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              {file ? (
                <>
                  <p className="truncate font-medium" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Kéo file vào đây hoặc bấm Chọn file (.xlsx, .xls, .csv ≤ 5 MB)
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importMut.isPending}
              onClick={() => inputRef.current?.click()}
            >
              Chọn file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Chọn file Excel nhà cung cấp"
              tabIndex={-1}
              onChange={(e) => {
                pick(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {result ? <ImportResult result={result} /> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={importMut.isPending}
            onClick={() => close(false)}
          >
            {result ? 'Đóng' : 'Hủy bỏ'}
          </Button>
          <Button type="button" disabled={!file || importMut.isPending} onClick={run}>
            <Upload aria-hidden />{' '}
            {importMut.isPending ? 'Đang nhập…' : result ? 'Nhập lại' : 'Nhập'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportResult({ result: r }: { result: SupplierImportResult }) {
  const stats: Array<{ label: string; value: number; tone?: 'ok' | 'warn' }> = [
    { label: 'Tạo mới', value: r.created, tone: 'ok' },
    { label: 'Ghi đè', value: r.updated },
    { label: 'Khôi phục', value: r.restored },
    { label: 'Bỏ qua', value: r.skipped, tone: r.skipped ? 'warn' : undefined },
  ];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd
              className={
                s.tone === 'ok' && s.value
                  ? 'text-lg font-semibold tabular-nums text-success'
                  : s.tone === 'warn'
                    ? 'text-lg font-semibold tabular-nums text-warning'
                    : 'text-lg font-semibold tabular-nums'
              }
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      {r.errors.length > 0 ? (
        <div className="max-h-56 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-16 px-2.5 text-xs">Dòng</TableHead>
                <TableHead className="w-36 px-2.5 text-xs">Mã</TableHead>
                <TableHead className="px-2.5 text-xs">Lý do bỏ qua</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.errors.map((e, i) => (
                <TableRow key={`${e.row}-${i}`}>
                  <TableCell className="px-2.5 py-1.5 tabular-nums">{e.row}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{e.code ?? '—'}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{e.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
