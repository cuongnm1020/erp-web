'use client';

import { Box, ExternalLink, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import {
  LAYOUT_IMAGE_MAX_BYTES,
  LAYOUT_IMAGE_TYPES,
  useDeleteWarehouseLayoutImage,
  useUploadWarehouseLayoutImage,
  type Warehouse,
} from '../api/use-warehouses';

/**
 * Ảnh phối cảnh 3D mặt bằng của kho đang chọn (Warehouse.layoutImageUrl — presigned S3 ~1h).
 * Mỗi kho một ảnh: tải ảnh mới là thay ảnh cũ. Tải / gỡ cần stock.adjust.
 */
export function WarehouseLayoutImage({
  warehouse,
  canAdjust,
}: {
  warehouse: Warehouse;
  canAdjust: boolean;
}) {
  const upload = useUploadWarehouseLayoutImage();
  const remove = useDeleteWarehouseLayoutImage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const url = warehouse.layoutImageUrl;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!LAYOUT_IMAGE_TYPES.includes(file.type)) {
      toast.error('Chỉ nhận ảnh jpg / png / webp');
      return;
    }
    if (file.size > LAYOUT_IMAGE_MAX_BYTES) {
      toast.error('Ảnh tối đa 10MB');
      return;
    }
    upload
      .mutateAsync({ id: warehouse.id, file })
      .then(() => toast.success(`Đã cập nhật ảnh 3D kho ${warehouse.code}`))
      .catch((err) => toast.error(messageFor(err)));
  };

  return (
    <section className="mt-3 rounded-md border bg-card" aria-label="Ảnh 3D mặt bằng kho">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Box className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          Ảnh 3D mặt bằng · {warehouse.code}
        </h2>
        {canAdjust ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="file"
              accept={LAYOUT_IMAGE_TYPES.join(',')}
              className="hidden"
              aria-label="Chọn ảnh 3D mặt bằng"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload aria-hidden />
              {upload.isPending ? 'Đang tải lên…' : url ? 'Thay ảnh' : 'Tải ảnh 3D'}
            </Button>
            {url ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-destructive"
                disabled={remove.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 aria-hidden />
                Gỡ ảnh
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="group relative block p-2"
          title="Mở ảnh gốc"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned URL S3 hết hạn ~1h, không dùng next/image optimizer */}
          <img
            src={url}
            alt={`Phối cảnh 3D mặt bằng kho ${warehouse.code}`}
            className="mx-auto max-h-[520px] w-auto rounded"
          />
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink className="h-3 w-3" aria-hidden />
            Ảnh gốc
          </span>
        </a>
      ) : (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          Kho chưa có ảnh 3D mặt bằng.
          {canAdjust ? ' Tải ảnh jpg / png / webp (tối đa 10MB).' : ''}
        </p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Gỡ ảnh 3D kho ${warehouse.code}?`}
        description="Ảnh bị xóa khỏi kho lưu trữ, không hoàn tác được."
        confirmLabel="Gỡ ảnh"
        destructive
        onConfirm={() =>
          remove
            .mutateAsync(warehouse.id)
            .then(() => toast.success('Đã gỡ ảnh 3D'))
            .catch((err) => toast.error(messageFor(err)))
        }
      />
    </section>
  );
}
