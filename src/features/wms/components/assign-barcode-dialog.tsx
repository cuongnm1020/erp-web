'use client';

import { useState } from 'react';
import { EntityPicker } from '@/components/data/form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { barcodeCodeSchema } from '@/lib/shared';
import { useAssignBarcodeAtReceipt, useSkuSearch } from '../api/use-locations';

/**
 * Quét mã chưa có trong hệ thống ở màn nhập hàng (2026-10-13) → chọn sản phẩm → gán mã cho đơn vị
 * bán chính của SKU (POST /skus/{id}/barcodes/at-receipt, quyền nhập kho). Gán xong `onAssigned`
 * để màn gọi lại luồng quét — mã giờ ra SKU như mọi mã khác, dùng tiếp khi pick / pack / hàng
 * hoàn / kiểm kho. Mã thùng / pallet (ĐVT khác) vẫn khai ở chi tiết sản phẩm → tab Barcode.
 */
export function AssignBarcodeDialog({
  code,
  onClose,
  onAssigned,
}: {
  /** Mã vừa quét; null = đóng. */
  code: string | null;
  onClose: () => void;
  onAssigned: (code: string) => void;
}) {
  const assign = useAssignBarcodeAtReceipt();
  const [skuId, setSkuId] = useState('');
  const [skuLabel, setSkuLabel] = useState('');
  const valid = code !== null && barcodeCodeSchema.safeParse(code).success;

  const close = () => {
    setSkuId('');
    setSkuLabel('');
    onClose();
  };

  return (
    <Dialog open={code !== null} onOpenChange={(o) => !o && !assign.isPending && close()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Mã chưa gán cho sản phẩm nào</DialogTitle>
          <DialogDescription>
            Chọn sản phẩm mang mã này. Gán xong, quét mã ở mọi bước (nhập hàng, lấy hàng, đóng gói,
            hàng hoàn, kiểm kho) đều ra sản phẩm này.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Mã vừa quét</div>
            <div className="break-all rounded-md border bg-muted px-2 py-1.5 font-mono text-sm">
              {code}
            </div>
            {!valid ? (
              <p className="mt-1 text-sm text-destructive">
                Mã có dấu tiếng Việt hoặc khoảng trắng — thường do bộ gõ tiếng Việt đang bật khi
                quét. Tắt bộ gõ (Unikey/EVKey) rồi quét lại.
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="assign-barcode-sku">
              Sản phẩm
            </label>
            <EntityPicker
              id="assign-barcode-sku"
              value={skuId}
              onChange={(id, option) => {
                setSkuId(id);
                setSkuLabel(option?.label ?? '');
              }}
              useSearch={useSkuSearch}
              selectedLabel={skuLabel || undefined}
              placeholder="Chọn sản phẩm…"
              searchPlaceholder="Mã / tên sản phẩm…"
              disabled={!valid}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={assign.isPending}>
            Bỏ qua
          </Button>
          <Button
            disabled={!valid || !skuId || assign.isPending}
            onClick={() => {
              if (!code) return;
              assign.mutate(
                { skuId, code },
                {
                  onSuccess: () => {
                    toast.success('Đã gán mã', { description: `${code} → ${skuLabel}` });
                    setSkuId('');
                    setSkuLabel('');
                    onAssigned(code);
                  },
                  onError: (err) => toast.error(messageFor(err)),
                },
              );
            }}
          >
            {assign.isPending ? 'Đang gán…' : 'Gán mã và thêm vào phiếu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
