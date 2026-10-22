'use client';

import { PencilLine } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { barcodeCodeSchema, skuCodeSchema } from '@/lib/shared';
import { useChangeSkuCode, useReplaceBarcode, type ProductDetail } from '../api/use-products';

type Sku = ProductDetail['skus'][number];
type SkuBarcode = Sku['barcodes'][number];

/**
 * "Đổi mã" SKU (2026-10-22) — vd theo mã SKU nhà cung cấp gửi sang. POST /skus/{id}/code: đơn,
 * tồn, giá, liên kết Pancake nối theo id nên giữ nguyên; barcode cũ ở lại nên tem đã in vẫn quét.
 */
export function ChangeSkuCodeButton({ sku }: { sku: Sku }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(sku.code);
  const [error, setError] = useState<string | null>(null);
  const change = useChangeSkuCode();

  const openDialog = () => {
    setCode(sku.code);
    setError(null);
    setOpen(true);
  };
  const submit = () => {
    const parsed = skuCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Mã không hợp lệ');
      return;
    }
    if (parsed.data === sku.code) {
      setOpen(false);
      return;
    }
    change.mutate(
      { skuId: sku.id, version: sku.version, code: parsed.data },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success('Đã đổi mã SKU', { description: `${sku.code} → ${parsed.data}` });
        },
        onError: (err) => setError(messageFor(err)),
      },
    );
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={openDialog} aria-label={`Đổi mã SKU ${sku.code}`}>
        <PencilLine aria-hidden /> Đổi mã
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi mã SKU</DialogTitle>
            <DialogDescription>
              {sku.name} · mã hiện tại <span className="font-mono">{sku.code}</span>
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Mã SKU mới</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                aria-label="Mã SKU mới"
                className="font-mono"
              />
              {error ? <span className="block text-xs text-destructive">{error}</span> : null}
            </label>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Đơn hàng, tồn kho, giá bán giữ nguyên — đơn cũ hiện mã mới.</li>
              <li>Barcode không đổi theo: tem đã in mang mã cũ vẫn quét được.</li>
              <li>Mã mới tự đẩy lên các shop Pancake đã liên kết.</li>
              <li>File Excel nhập / xuất theo mã phải dùng mã mới.</li>
            </ul>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" loading={change.isPending} loadingText="Đang lưu…">
                Đổi mã SKU
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * "Đổi mã" một barcode (2026-10-22) — vd thay mã ERP tự sinh bằng CODE128 nhà cung cấp in sẵn trên
 * bao bì. Mã mới thành mã chính (in tem mặc định, đẩy Pancake); tuỳ chọn giữ mã cũ làm mã phụ.
 */
export function ReplaceBarcodeButton({ sku, barcode }: { sku: Sku; barcode: SkuBarcode }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [keepOld, setKeepOld] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const replace = useReplaceBarcode();

  const openDialog = () => {
    setCode('');
    setKeepOld(true);
    setError(null);
    setOpen(true);
  };
  const submit = () => {
    const parsed = barcodeCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Mã không hợp lệ');
      return;
    }
    replace.mutate(
      { skuId: sku.id, code: barcode.code, newCode: parsed.data, keepOld },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success('Đã đổi barcode', { description: `${barcode.code} → ${parsed.data}` });
        },
        onError: (err) => setError(messageFor(err)),
      },
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openDialog}
        aria-label={`Đổi mã ${barcode.code}`}
      >
        <PencilLine aria-hidden /> Đổi mã
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi barcode</DialogTitle>
            <DialogDescription>
              {sku.code} — {sku.name} · mã hiện tại{' '}
              <span className="font-mono">{barcode.code}</span>
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Mã mới (quét mã trên bao bì hoặc gõ)</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                aria-label="Barcode mới"
                className="font-mono"
              />
              {error ? <span className="block text-xs text-destructive">{error}</span> : null}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={keepOld}
                onCheckedChange={(v) => setKeepOld(v === true)}
                aria-label="Giữ mã cũ làm mã phụ"
              />
              <span>
                Giữ mã cũ làm mã phụ
                <span className="block text-xs text-muted-foreground">
                  Tem đã in mang mã {barcode.code} vẫn quét được. Bỏ chọn thì mã cũ bị xóa.
                </span>
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Mã mới thành mã chính: in tem mặc định và đẩy lên Pancake.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" loading={replace.isPending} loadingText="Đang lưu…">
                Đổi barcode
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
