'use client';

import {
  ArrowRightLeft,
  Copy,
  CopyPlus,
  Info,
  KeyRound,
  PackageCheck,
  PlugZap,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { publicEnv } from '@/lib/env';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format/date';
import { Can } from '@/lib/permission';
import {
  pancakeShopProductsQuery,
  useDeletePancakeConfig,
  usePancakeConfig,
  usePancakeShopProducts,
  useRotatePancakeWebhookSecret,
  useVerifyPancakeConfig,
  type PancakeConfigList,
  type PancakeShopConfig,
  type PancakeShopProducts,
} from '../api/use-pancake-config';
import { PancakeCatalogMigrationDialog } from './pancake-catalog-migration-dialog';
import { PancakeConfigDialog } from './pancake-config-dialog';
import { PancakeDuplicateDialog } from './pancake-duplicate-dialog';
import { PancakeShopProductsDialog } from './pancake-shop-products-dialog';
import { PancakeStaffSection } from './pancake-staff-section';
import { PancakeWarehouseSection } from './pancake-warehouse-section';

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
            <PancakeWarehouseSection />
            <PancakeStaffSection />
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
      className="mb-3 flex items-start gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm"
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

/** Bỏ dấu + thường hoá để tìm "phan bon" ra "Phân bón". */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Lọc shop phía client (danh sách shop đã tải hết): khớp mã shop, tên shop, hoặc tên / mã sản
 * phẩm ĐANG GÁN cho shop (chỉ shop giới hạn sản phẩm — shop "Tất cả sản phẩm" không có danh sách
 * gán). Trả về sản phẩm khớp theo shop để hiện dưới tên shop.
 */
function filterShops(
  items: PancakeShopConfig[],
  q: string,
  productsByShop: Map<string, PancakeShopProducts | undefined>,
): Array<{ shop: PancakeShopConfig; matchedProducts: PancakeShopProducts['products'] }> {
  const needle = fold(q);
  if (!needle) return items.map((shop) => ({ shop, matchedProducts: [] }));
  return items.flatMap((shop) => {
    const assigned = productsByShop.get(shop.shopId);
    const matchedProducts = assigned?.restricted
      ? assigned.products.filter(
          (p) => fold(p.name).includes(needle) || fold(p.code).includes(needle),
        )
      : [];
    const shopHit =
      fold(shop.shopId).includes(needle) || fold(shop.shopName ?? '').includes(needle);
    return shopHit || matchedProducts.length > 0 ? [{ shop, matchedProducts }] : [];
  });
}

function ShopTable({ items }: { items: PancakeShopConfig[] }) {
  const [q, setQ] = useState('');
  // Cùng query key với ô "Sản phẩm bán" từng dòng — dùng chung cache, không gọi thêm.
  const shopProducts = useQueries({
    queries: items.map((shop) => pancakeShopProductsQuery(shop.shopId)),
  });
  const productsByShop = new Map(items.map((shop, i) => [shop.shopId, shopProducts[i]?.data]));
  const productsLoading = shopProducts.some((r) => r.isPending);
  const rows = filterShops(items, q, productsByShop);
  const [editing, setEditing] = useState<PancakeShopConfig | null>(null);
  const [catalogShop, setCatalogShop] = useState<PancakeShopConfig | null>(null);
  const [migratingShop, setMigratingShop] = useState<PancakeShopConfig | null>(null);
  const [duplicating, setDuplicating] = useState<PancakeShopConfig | null>(null);
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
      <div className="mb-2 flex items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm shop theo tên, mã, sản phẩm đang gán…"
            aria-label="Tìm shop theo tên, mã shop hoặc sản phẩm đang gán"
            className="h-8 w-80 pl-7 pr-7 text-xs"
          />
          {q ? (
            <button
              type="button"
              aria-label="Xóa từ khoá tìm"
              onClick={() => setQ('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        {q ? (
          <span className="text-xs text-muted-foreground">
            {rows.length} / {items.length} shop
            {productsLoading ? ' · đang tải sản phẩm gán…' : ''}
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Khoá API</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Kiểm tra kết nối</TableHead>
              <TableHead>Sản phẩm bán</TableHead>
              <TableHead>Webhook (dán vào Pancake)</TableHead>
              <TableHead className="text-right">Giới hạn</TableHead>
              <TableHead>Cập nhật</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                  Không có shop nào khớp “{q}”.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map(({ shop, matchedProducts }) => {
              const fromEnv = shop.source === 'env';
              const dbRow = shop.updatedAt !== null;
              return (
                <TableRow key={shop.shopId}>
                  <TableCell>
                    <div className="font-mono text-sm">{shop.shopId}</div>
                    <div className="text-xs text-muted-foreground">{shop.shopName ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      SĐT gửi hàng:{' '}
                      {shop.senderPhones.length ? (
                        <span className="font-mono">{shop.senderPhones.join(', ')}</span>
                      ) : (
                        'số của kho'
                      )}
                    </div>
                    {matchedProducts.length > 0 ? (
                      <div className="mt-1 text-xs">
                        <span className="text-muted-foreground">Sản phẩm khớp: </span>
                        {matchedProducts
                          .slice(0, 3)
                          .map((p) => p.name)
                          .join(', ')}
                        {matchedProducts.length > 3 ? ` +${matchedProducts.length - 3}` : ''}
                      </div>
                    ) : null}
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
                  <TableCell>
                    <ShopCatalogCell shop={shop} onEdit={() => setCatalogShop(shop)} />
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <WebhookCell shop={shop} canRotate={dbRow} />
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Chuyển danh mục POS sang ERP"
                          aria-label={`Chuyển danh mục POS sang ERP — shop ${shop.shopId}`}
                          disabled={!shop.keyReadable || (!fromEnv && !shop.isActive)}
                          onClick={() => setMigratingShop(shop)}
                        >
                          <ArrowRightLeft aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Nhân bản sang shop mới"
                          aria-label={`Nhân bản kết nối shop ${shop.shopId}`}
                          disabled={!shop.keyReadable}
                          onClick={() => setDuplicating(shop)}
                        >
                          <CopyPlus aria-hidden />
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
      {duplicating ? (
        <PancakeDuplicateDialog
          key={duplicating.shopId}
          source={duplicating}
          open
          onOpenChange={(o) => !o && setDuplicating(null)}
        />
      ) : null}
      {migratingShop ? (
        <PancakeCatalogMigrationDialog
          key={migratingShop.shopId}
          shop={migratingShop}
          open
          onOpenChange={(o) => !o && setMigratingShop(null)}
        />
      ) : null}
      {catalogShop ? (
        <PancakeShopProductsDialog
          key={catalogShop.shopId}
          shop={catalogShop}
          open
          onOpenChange={(o) => !o && setCatalogShop(null)}
        />
      ) : null}
    </>
  );
}

/** "Tất cả" / "N sản phẩm" + nút mở dialog gán sản phẩm cho shop. */
function ShopCatalogCell({ shop, onEdit }: { shop: PancakeShopConfig; onEdit: () => void }) {
  const q = usePancakeShopProducts(shop.shopId);
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      {q.isPending ? (
        <Skeleton className="h-5 w-20" />
      ) : q.isError ? (
        <span className="text-sm text-destructive">Không tải được</span>
      ) : q.data.restricted ? (
        <StatusBadge tone="brand">{q.data.products.length} sản phẩm</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Tất cả sản phẩm</StatusBadge>
      )}
      <Can I="config" a="Sync">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          aria-label={`Chọn sản phẩm bán cho shop ${shop.shopId}`}
        >
          <PackageCheck aria-hidden />
          Chọn
        </Button>
      </Can>
    </div>
  );
}

/** Sao chép vào clipboard; trình duyệt không cho (http, iframe) thì báo để người dùng chọn tay. */
async function copyText(label: string, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  } catch {
    toast.error(`Không sao chép được ${label} — bôi đen rồi Ctrl+C.`);
  }
}

/**
 * URL + secret để dán vào cấu hình webhook của Pancake. URL = NEXT_PUBLIC_API_URL + webhookPath
 * (API không biết hostname công khai của mình). Secret hiện thẳng vì chính người này phải
 * dán nó sang Pancake; xoay = secret cũ mất hiệu lực ngay.
 */
function WebhookCell({ shop, canRotate }: { shop: PancakeShopConfig; canRotate: boolean }) {
  const rotate = useRotatePancakeWebhookSecret();
  const [confirming, setConfirming] = useState(false);
  const url = `${publicEnv.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}${shop.webhookPath}`;

  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-1">
        <code className="truncate font-mono" title={url}>
          {url}
        </code>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Sao chép URL webhook shop ${shop.shopId}`}
          onClick={() => void copyText('URL webhook', url)}
        >
          <Copy aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Secret</span>
        {shop.webhookSecret ? (
          <>
            <code className="truncate font-mono" title={shop.webhookSecret}>
              {shop.webhookSecret}
            </code>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Sao chép secret webhook shop ${shop.shopId}`}
              onClick={() => void copyText('secret webhook', shop.webhookSecret ?? '')}
            >
              <Copy aria-hidden />
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">chưa có — lưu lại cấu hình để sinh</span>
        )}
        {canRotate ? (
          <Can I="config" a="Sync">
            <Button
              variant="ghost"
              size="sm"
              disabled={rotate.isPending}
              aria-label={`Tạo lại secret webhook shop ${shop.shopId}`}
              onClick={() => setConfirming(true)}
            >
              <KeyRound aria-hidden />
              Tạo lại
            </Button>
          </Can>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Tạo lại secret webhook shop ${shop.shopId}?`}
        description="Secret hiện tại mất hiệu lực ngay. Webhook từ Pancake sẽ bị từ chối cho tới khi bạn dán secret mới vào Pancake."
        confirmLabel="Tạo lại secret"
        destructive={false}
        onConfirm={() =>
          rotate
            .mutateAsync(Number(shop.shopId))
            .then(() =>
              toast.success('Đã tạo lại secret webhook', {
                description: 'Dán secret mới vào Pancake',
              }),
            )
            .catch((err) => toast.error(messageFor(err)))
        }
      />
    </div>
  );
}
