'use client';

import { AlertTriangle, Link2, Unlink, Upload, Warehouse } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { Can } from '@/lib/permission';
import {
  useLinkPancakeWarehouse,
  usePancakeWarehouseLinks,
  usePushPancakeWarehouses,
  useUnlinkPancakeWarehouse,
  type PancakeShopWarehouses,
  type PancakeWarehouseLinkRow,
} from '../api/use-pancake-warehouses';

/**
 * Kho trên Pancake (FE-PANCAKE-WH-1) — GET /pancake-sync/warehouses/links, POST
 * /pancake-sync/push/warehouses, PUT/DELETE /pancake-sync/warehouses/:id/link.
 *
 * Kho ERP được đẩy lên mọi shop đang bật để sale chọn kho khi lên đơn trên Pancake; đơn về ERP
 * giữ hàng ở đúng kho đó. Kho tạo tay trên Pancake mà tên khác kho ERP thì nối tay ở đây. Cả mục
 * cần `sync.config` — người chỉ xem cấu hình không thấy (API cũng trả 403).
 */
export function PancakeWarehouseSection() {
  return (
    <Can I="config" a="Sync">
      <WarehouseSectionBody />
    </Can>
  );
}

function WarehouseSectionBody() {
  const query = usePancakeWarehouseLinks();
  const push = usePushPancakeWarehouses();

  const onPush = () =>
    push.mutate(undefined, {
      onSuccess: (r) => {
        if (r.failed > 0) {
          toast.error(`Đẩy kho lên Pancake lỗi ${r.failed} lượt`, {
            description: 'Kiểm tra kết nối shop ở bảng trên rồi đẩy lại.',
          });
          return;
        }
        toast.success('Đã đẩy kho lên Pancake', {
          description: `${r.total} kho ERP · mọi shop đang bật`,
        });
      },
      onError: (err) => toast.error(messageFor(err)),
    });

  return (
    <section className="mt-6 space-y-2" aria-labelledby="pancake-warehouses-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="pancake-warehouses-title" className="text-base font-semibold">
            Kho trên Pancake
          </h2>
          <p className="text-sm text-muted-foreground">
            Kho ERP được đẩy lên mọi shop đang bật để sale chọn kho khi lên đơn. Đơn về ERP giữ hàng
            ở đúng kho đã chọn; kho đó thiếu hàng thì đơn vào Sự cố thiếu hàng.
          </p>
        </div>
        <Button size="sm" disabled={push.isPending} onClick={onPush}>
          <Upload aria-hidden />
          {push.isPending ? 'Đang đẩy kho…' : 'Đẩy kho lên Pancake'}
        </Button>
      </div>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={3} columns={3} />}
        isEmpty={(d) => d.shops.length === 0}
        empty={
          <EmptyState
            icon={Warehouse}
            title="Chưa có shop Pancake nào đang bật"
            description="Bật kết nối một shop ở bảng trên để đẩy kho ERP lên shop đó."
          />
        }
      >
        {(data) => (
          <div className="space-y-4">
            {data.shops.map((shop) => (
              <ShopWarehouses key={shop.shopId} shop={shop} />
            ))}
          </div>
        )}
      </QueryState>
    </section>
  );
}

function ShopWarehouses({ shop }: { shop: PancakeShopWarehouses }) {
  const [linking, setLinking] = useState<PancakeWarehouseLinkRow | null>(null);
  const [unlinking, setUnlinking] = useState<PancakeWarehouseLinkRow | null>(null);
  const unlink = useUnlinkPancakeWarehouse();
  const shopLabel = shop.shopName ? `${shop.shopName} · ${shop.shopId}` : shop.shopId;

  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-3 py-2 text-sm font-medium">{shopLabel}</div>
      {shop.error ? (
        <p
          role="status"
          className="flex items-center gap-2 border-b bg-warning/10 px-3 py-2 text-sm"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
          Không đọc được kho của shop — kiểm tra kết nối ở bảng trên. Liên kết đã lưu vẫn dùng cho
          đơn về.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Kho ERP</TableHead>
              <TableHead>Kho trên Pancake</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shop.warehouses.map((w) => (
              <TableRow key={w.warehouseId}>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{w.code}</span>{' '}
                  <span className="text-sm">{w.name}</span>
                  {!w.isActive ? (
                    <StatusBadge tone="neutral" className="ml-1">
                      Ngừng dùng
                    </StatusBadge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <PancakeSide row={w} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {w.isActive && shop.unlinked.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLinking(w)}
                        aria-label={`Nối kho ${w.code} với kho có sẵn trên shop ${shop.shopId}`}
                      >
                        <Link2 aria-hidden />
                        {w.externalId ? 'Nối kho khác' : 'Nối kho có sẵn'}
                      </Button>
                    ) : null}
                    {w.externalId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUnlinking(w)}
                        aria-label={`Gỡ liên kết kho ${w.code} trên shop ${shop.shopId}`}
                      >
                        <Unlink aria-hidden />
                        Gỡ
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {shop.unlinked.length > 0 ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Kho chỉ có trên Pancake (đơn chọn các kho này về kho mặc định ERP):{' '}
          {shop.unlinked.map((u) => u.name).join(', ')}
        </p>
      ) : null}
      {linking ? (
        <LinkDialog
          key={`${shop.shopId}:${linking.warehouseId}`}
          shop={shop}
          row={linking}
          onClose={() => setLinking(null)}
        />
      ) : null}
      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(o) => !o && setUnlinking(null)}
        title={`Gỡ liên kết kho ${unlinking?.code ?? ''} trên shop ${shop.shopId}?`}
        description="Kho trên Pancake giữ nguyên. Đơn mới chọn kho đó sẽ về kho mặc định ERP cho tới khi nối lại."
        confirmLabel="Gỡ liên kết"
        onConfirm={() =>
          unlinking
            ? unlink
                .mutateAsync({ warehouseId: unlinking.warehouseId, shopId: shop.shopId })
                .then(() => toast.success('Đã gỡ liên kết'))
                .catch((err) => toast.error(messageFor(err)))
            : undefined
        }
      />
    </div>
  );
}

function PancakeSide({ row }: { row: PancakeWarehouseLinkRow }) {
  if (!row.externalId) {
    return (
      <span className="text-sm text-muted-foreground">
        {row.isActive ? 'Chưa có — bấm Đẩy kho lên Pancake' : 'Không có trên Pancake'}
      </span>
    );
  }
  if (row.externalMissing) return <StatusBadge tone="err">Đã bị xóa trên Pancake</StatusBadge>;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-sm">
      {row.externalName ?? <span className="font-mono text-xs">{row.externalId}</span>}
      {!row.isActive ? <StatusBadge tone="neutral">Tắt lên đơn</StatusBadge> : null}
    </span>
  );
}

function LinkDialog({
  shop,
  row,
  onClose,
}: {
  shop: PancakeShopWarehouses;
  row: PancakeWarehouseLinkRow;
  onClose: () => void;
}) {
  const link = useLinkPancakeWarehouse();
  const [externalId, setExternalId] = useState('');

  const submit = () => {
    if (!externalId || link.isPending) return;
    link.mutate(
      { warehouseId: row.warehouseId, shopId: shop.shopId, externalId },
      {
        onSuccess: (r) => {
          if (r.action === 'failed') {
            toast.error('Đã nối kho nhưng Pancake chưa nhận tên / địa chỉ mới', {
              description: 'Bấm Đẩy kho lên Pancake để gửi lại.',
            });
          } else {
            toast.success('Đã nối kho', {
              description: `${row.code} · kho trên Pancake nhận tên và địa chỉ của kho ERP`,
            });
          }
          onClose();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !link.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Nối kho {row.code} với kho trên shop {shop.shopName ?? shop.shopId}
          </DialogTitle>
          <DialogDescription>
            Kho được chọn sẽ đổi tên và địa chỉ theo kho ERP. Đơn sale chọn kho này trên Pancake về
            ERP giữ hàng ở {row.name}.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1">
          <legend className="sr-only">Kho trên Pancake</legend>
          {shop.unlinked.map((u) => (
            <label
              key={u.externalId}
              className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name={`pancake-wh-${shop.shopId}`}
                value={u.externalId}
                checked={externalId === u.externalId}
                onChange={() => setExternalId(u.externalId)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{u.name}</span>
                {!u.allowCreateOrder ? (
                  <StatusBadge tone="neutral" className="ml-1">
                    Đang tắt lên đơn
                  </StatusBadge>
                ) : null}
                {u.fullAddress ? (
                  <span className="block text-xs text-muted-foreground">{u.fullAddress}</span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" disabled={link.isPending} onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button disabled={!externalId || link.isPending} onClick={submit}>
            {link.isPending ? 'Đang nối…' : 'Nối kho'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
