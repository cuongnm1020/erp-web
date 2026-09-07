'use client';

import { Info, PlugZap, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
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
import { formatDateTime } from '@/lib/format/date';
import { Can } from '@/lib/permission';
import {
  useDeletePancakeConfig,
  usePancakeConfig,
  useVerifyPancakeConfig,
  type PancakeConfigList,
  type PancakeShopConfig,
} from '../api/use-pancake-config';
import { PancakeConfigDialog } from './pancake-config-dialog';

/**
 * Kết nối Pancake POS — GET/PUT/DELETE /pancake-sync/config, POST …/verify.
 *
 * Một dòng cho mỗi shop: mã, tên gợi nhớ, 4 ký tự cuối khoá, bật/tắt, kết quả kiểm tra
 * kết nối gần nhất. Khoá API không bao giờ về tới trình duyệt (server chỉ trả hint).
 * Dòng `source = env` là khoá lấy từ biến môi trường của server API — thắng khoá nhập ở đây,
 * nên không sửa/xoá được tại màn này (đổi env + khởi động lại API).
 */
export function PancakeConfigScreen() {
  const query = usePancakeConfig();
  const [creating, setCreating] = useState(false);

  const header = (description: string) => (
    <PageHeader
      title="Kết nối Pancake POS"
      description={description}
      breadcrumb={[{ label: 'Quản trị' }, { label: 'Kết nối Pancake' }]}
      actions={
        <Can I="config" a="Sync">
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Thêm shop
          </Button>
        </Can>
      }
    />
  );

  return (
    <>
      <QueryState
        query={query}
        skeleton={
          <>
            {header('Khoá API và mã shop dùng để đồng bộ đơn, khách hàng, sản phẩm từ Pancake')}
            <ListSkeleton rows={3} columns={6} />
          </>
        }
        isEmpty={(d) => d.items.length === 0}
        empty={
          <>
            {header('Chưa kết nối shop nào')}
            <EnvNotice env={query.data?.env} />
            <EmptyState
              icon={PlugZap}
              title="Chưa kết nối shop Pancake nào"
              description="Thêm mã shop và khoá API (Pancake POS › Cài đặt › API) để bắt đầu đồng bộ."
              action={
                <Can I="config" a="Sync">
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus aria-hidden />
                    Thêm shop
                  </Button>
                </Can>
              }
            />
          </>
        }
      >
        {(data) => (
          <>
            {header(
              `${data.items.length} shop · khoá API được mã hoá trước khi lưu, chỉ hiện 4 ký tự cuối`,
            )}
            <EnvNotice env={data.env} />
            <ShopTable items={data.items} />
          </>
        )}
      </QueryState>
      {creating ? <PancakeConfigDialog open={creating} onOpenChange={setCreating} /> : null}
    </>
  );
}

/** Nhắc rõ khi server đang lấy khoá từ env — người vận hành hay tưởng sửa ở đây là có hiệu lực ngay. */
function EnvNotice({ env }: { env: PancakeConfigList['env'] | undefined }) {
  if (!env?.hasApiKey) return null;
  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <p>
        Server API đang dùng khoá từ biến môi trường{' '}
        <code className="font-mono">PANCAKE_API_KEY</code>
        {env.shopId ? (
          <>
            {' '}
            cho shop <span className="font-mono">{env.shopId}</span>
          </>
        ) : (
          ' cho mọi shop'
        )}
        . Khoá đó thắng khoá nhập ở đây; muốn dùng khoá trên màn này thì gỡ biến môi trường rồi khởi
        động lại API.
      </p>
    </div>
  );
}

function ShopTable({ items }: { items: PancakeShopConfig[] }) {
  const [editing, setEditing] = useState<PancakeShopConfig | null>(null);
  const remove = useDeletePancakeConfig();
  const verify = useVerifyPancakeConfig();
  const [verifying, setVerifying] = useState<string | null>(null);

  const onVerify = (shop: PancakeShopConfig) => {
    setVerifying(shop.shopId);
    verify.mutate(Number(shop.shopId), {
      onSuccess: (r) =>
        toast.success('Kết nối Pancake thành công', {
          description: `Shop ${r.shopId} · Pancake trả về ${r.warehouses} kho`,
        }),
      onError: (err) => toast.error(messageFor(err)),
      onSettled: () => setVerifying(null),
    });
  };

  return (
    <>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Khoá API</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Kiểm tra kết nối</TableHead>
              <TableHead className="text-right">Giới hạn</TableHead>
              <TableHead>Cập nhật</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((shop) => {
              const fromEnv = shop.source === 'env';
              const dbRow = shop.updatedAt !== null;
              return (
                <TableRow key={shop.shopId}>
                  <TableCell>
                    <div className="font-mono text-sm">{shop.shopId}</div>
                    <div className="text-xs text-muted-foreground">{shop.shopName ?? '—'}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{shop.apiKeyHint}</span>{' '}
                    {fromEnv ? <StatusBadge tone="brand">từ env</StatusBadge> : null}
                    {!shop.keyReadable ? (
                      <StatusBadge tone="err" className="ml-1">
                        Khoá không đọc được
                      </StatusBadge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {shop.isActive ? (
                      <StatusBadge tone="ok">Đang bật</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Tắt</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {shop.lastVerifyError ? (
                      <span className="text-sm text-destructive">{shop.lastVerifyError}</span>
                    ) : shop.lastVerifiedAt ? (
                      <span className="text-sm">
                        <StatusBadge tone="ok">OK</StatusBadge>{' '}
                        <span className="text-muted-foreground">
                          {formatDateTime(shop.lastVerifiedAt)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Chưa kiểm tra</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {shop.requestsPerSecond ?? '2'} req/s · burst {shop.burst ?? '4'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {shop.updatedAt ? formatDateTime(shop.updatedAt) : '—'}
                  </TableCell>
                  <TableCell>
                    <Can I="config" a="Sync">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={verifying !== null || (!fromEnv && !shop.isActive)}
                          onClick={() => onVerify(shop)}
                          aria-label={`Kiểm tra kết nối shop ${shop.shopId}`}
                        >
                          <RefreshCw
                            className={verifying === shop.shopId ? 'animate-spin' : undefined}
                            aria-hidden
                          />
                          Kiểm tra kết nối
                        </Button>
                        {dbRow ? (
                          <RowActions
                            onEdit={() => setEditing(shop)}
                            onDelete={() =>
                              remove
                                .mutateAsync(Number(shop.shopId))
                                .then(() =>
                                  toast.success('Đã xóa kết nối', {
                                    description: `Shop ${shop.shopId}`,
                                  }),
                                )
                                .catch((err) => toast.error(messageFor(err)))
                            }
                            itemName={`kết nối shop ${shop.shopId}`}
                            deleteDescription="Đồng bộ cho shop này sẽ dừng cho tới khi nhập lại khoá. Dữ liệu đã đồng bộ giữ nguyên."
                          />
                        ) : null}
                      </div>
                    </Can>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {editing ? (
        <PancakeConfigDialog open onOpenChange={(o) => !o && setEditing(null)} config={editing} />
      ) : null}
    </>
  );
}
