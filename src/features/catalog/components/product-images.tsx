'use client';

import { ImagePlus, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import {
  useDeleteImage,
  useSetPrimaryImage,
  useUploadProductImage,
  useUploadSkuImage,
  type ProductImage,
} from '../api/use-products';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

/** Lọc file hợp lệ (jpg/png/webp ≤5MB) — file bị loại báo toast theo tên, phần hợp lệ vẫn nhận. */
export function acceptImageFiles(list: FileList | File[] | null): File[] {
  const ok: File[] = [];
  for (const f of Array.from(list ?? [])) {
    if (!ALLOWED.has(f.type)) {
      toast.error(`${f.name}: chỉ nhận ảnh jpg / png / webp`);
      continue;
    }
    if (f.size > MAX_BYTES) {
      toast.error(`${f.name}: ảnh tối đa 5MB`);
      continue;
    }
    ok.push(f);
  }
  return ok;
}

/**
 * Vùng kéo-thả ảnh (upload zone): thả nhiều file hoặc bấm/Enter để chọn.
 * Chỉ lo nhận file — upload/hàng chờ do màn hình gọi quyết định.
 */
export function ImageDropzone({
  onFiles,
  disabled,
  label = 'Kéo thả ảnh vào đây hoặc bấm để chọn',
  hint = 'jpg / png / webp · tối đa 5MB mỗi ảnh',
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (list: FileList | null) => {
    const ok = acceptImageFiles(list);
    if (ok.length > 0) onFiles(ok);
  };
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors',
        over && 'border-primary bg-primary/5 text-primary',
        disabled && 'pointer-events-none opacity-50',
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
    >
      <ImagePlus className="h-5 w-5" aria-hidden />
      <span className="font-medium">{label}</span>
      <span className="text-xs">{hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-label="Chọn file ảnh"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * Gallery ảnh sản phẩm cha: lưới thumbnail + tải lên (jpg/png/webp ≤ 5MB, lưu S3),
 * đặt ảnh chính (sao), xóa qua hộp xác nhận. Ảnh chính dùng làm thumbnail danh sách
 * khi SKU không có ảnh riêng.
 */
export function ProductGallery({
  productId,
  images,
  canEdit,
}: {
  productId: string;
  images: ProductImage[];
  canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadProductImage();
  const setPrimary = useSetPrimaryImage();
  const del = useDeleteImage();
  const [deleting, setDeleting] = useState<ProductImage | null>(null);

  const onPick = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { productId, file },
      {
        onSuccess: () => toast.success('Đã thêm ảnh sản phẩm'),
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  /** Upload zone nhận nhiều file — tải TUẦN TỰ để thứ tự (và ảnh chính đầu tiên) ổn định. */
  const onDropFiles = async (files: File[]) => {
    let ok = 0;
    for (const file of files) {
      try {
        await upload.mutateAsync({ productId, file });
        ok += 1;
      } catch (err) {
        toast.error(`${file.name}: ${messageFor(err)}`);
      }
    }
    if (ok > 0) toast.success(`Đã thêm ${ok} ảnh sản phẩm`);
  };

  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">
          Ảnh sản phẩm <span className="font-normal text-muted-foreground">· {images.length}</span>
        </span>
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Chọn ảnh sản phẩm"
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus aria-hidden />
              {upload.isPending ? 'Đang tải…' : 'Thêm ảnh'}
            </Button>
          </>
        ) : null}
      </header>
      {canEdit ? (
        <div className="px-3 pt-3">
          <ImageDropzone onFiles={(files) => void onDropFiles(files)} disabled={upload.isPending} />
        </div>
      ) : null}
      {images.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          Chưa có ảnh — ảnh chính sẽ hiện ở danh sách sản phẩm và khi lên đơn.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-3 px-3 py-3">
          {images.map((img) => (
            <li key={img.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned URL S3 hết hạn ~1h, không dùng next/image optimizer */}
              <img
                src={img.url}
                alt={img.fileName}
                className={cn(
                  'h-24 w-24 rounded-md border object-cover',
                  img.isPrimary && 'ring-2 ring-primary',
                )}
              />
              {img.isPrimary ? (
                <span className="absolute left-1 top-1 rounded bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  Ảnh chính
                </span>
              ) : null}
              {canEdit ? (
                <span className="absolute bottom-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {!img.isPrimary ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6"
                      aria-label={`Đặt làm ảnh chính: ${img.fileName}`}
                      title="Đặt làm ảnh chính"
                      onClick={() =>
                        setPrimary.mutate(img.id, {
                          onSuccess: () => toast.success('Đã đổi ảnh chính'),
                          onError: (err) => toast.error(messageFor(err)),
                        })
                      }
                    >
                      <Star aria-hidden />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6 hover:text-destructive"
                    aria-label={`Xóa ảnh: ${img.fileName}`}
                    title="Xóa ảnh"
                    onClick={() => setDeleting(img)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Xóa ảnh ${deleting?.fileName ?? ''}?`}
        description="Ảnh bị xóa khỏi S3 luôn — không hoàn tác được. Nếu là ảnh chính, ảnh cũ nhất còn lại sẽ lên thay."
        onConfirm={() =>
          deleting
            ? del
                .mutateAsync(deleting.id)
                .then(() => toast.success('Đã xóa ảnh'))
                .catch((err) => toast.error(messageFor(err)))
            : undefined
        }
      />
    </section>
  );
}

/** Ô ảnh nhỏ trên từng dòng biến thể: thumbnail + tải/thay ảnh riêng của SKU. */
export function SkuImageCell({
  skuId,
  image,
  canEdit,
}: {
  skuId: string;
  image: ProductImage | undefined;
  canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadSkuImage();

  return (
    <div className="flex items-center gap-1.5">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL S3, không qua next/image
        <img src={image.url} alt={image.fileName} className="h-8 w-8 rounded border object-cover" />
      ) : (
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded border border-dashed text-muted-foreground"
        >
          <ImagePlus className="h-3.5 w-3.5" />
        </span>
      )}
      {canEdit ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Chọn ảnh biến thể"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                upload.mutate(
                  { skuId, file },
                  {
                    onSuccess: () => toast.success('Đã thêm ảnh biến thể'),
                    onError: (err) => toast.error(messageFor(err)),
                  },
                );
              }
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? 'Đang tải…' : image ? 'Thêm ảnh' : 'Tải ảnh'}
          </button>
        </>
      ) : null}
    </div>
  );
}
