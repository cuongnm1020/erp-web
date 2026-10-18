'use client';

import Decimal from 'decimal.js';
import { ArrowRightLeft, CheckCircle2, PackageOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { EntityPicker, MoneyInput } from '@/components/data/form';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { formatMoney } from '@/lib/format';
import {
  isMigrationRunning,
  useCatalogMigrationPreview,
  useCatalogMigrationStatus,
  useMigrationComponentSearch,
  useMigrationTargetSearch,
  useStartCatalogMigration,
  type CatalogMigrationPreview,
  type CatalogMigrationRow,
  type CatalogMigrationRowInput,
  type CatalogMigrationStatus,
} from '../api/use-pancake-catalog-migration';
import type { PancakeShopConfig } from '../api/use-pancake-config';

type Action = CatalogMigrationRowInput['action'];

interface Draft {
  row: CatalogMigrationRow;
  action: Action;
  skuId: string;
  skuLabel: string;
  componentSkuId: string;
  componentLabel: string;
  qty: string;
  /** Combo mới nhiều thành phần ("20 GÓI A + 10 B") theo gợi ý — chỉ xem, không sửa từng vế. */
  parts: { skuId: string; label: string; qty: number }[] | null;
  salePrice: string;
}

const ACTION_LABEL: Record<Action, string> = {
  MAP: 'Nối hàng ERP',
  NEW_COMBO: 'Tạo combo mới',
  SKIP: 'Giữ nguyên trên POS',
};

const STEP_LABEL: Record<NonNullable<CatalogMigrationStatus['step']>, string> = {
  combos: 'Tạo combo',
  links: 'Nối sản phẩm POS',
  catalog: 'Gán sản phẩm cho shop',
  push: 'Đẩy hàng ERP lên POS',
  // Chỉ còn ở lượt chạy trước 2026-10-18 — nay không ẩn sản phẩm gốc nữa.
  hide: 'Ẩn sản phẩm gốc',
  done: 'Xong',
};

function draftOf(row: CatalogMigrationRow): Draft {
  const s = row.suggestion;
  return {
    row,
    action: s.action === 'NONE' ? 'SKIP' : s.action,
    skuId: s.sku?.skuId ?? '',
    skuLabel: s.sku ? `${s.sku.code} · ${s.sku.name}` : '',
    componentSkuId: s.component?.skuId ?? '',
    componentLabel: s.component ? `${s.component.code} · ${s.component.name}` : '',
    qty: s.qty ? String(s.qty) : '',
    parts:
      s.components && s.components.length > 1
        ? s.components.map((c) => ({
            skuId: c.sku.skuId,
            label: `${c.sku.code} · ${c.sku.name}`,
            qty: c.qty,
          }))
        : null,
    salePrice: row.posPrice ?? '',
  };
}

/** Lỗi nhập của một dòng (null = hợp lệ) — server kiểm lại (422). */
function draftError(d: Draft): string | null {
  if (d.action === 'MAP' && !d.skuId) return 'Chọn hàng ERP';
  if (d.action === 'NEW_COMBO' && d.parts) {
    if (!d.salePrice || new Decimal(d.salePrice).lte(0)) return 'Nhập giá combo';
    return null;
  }
  if (d.action === 'NEW_COMBO') {
    if (!d.componentSkuId) return 'Chọn thành phần';
    if (!/^\d+$/.test(d.qty) || Number(d.qty) < 2) return 'Số lượng từ 2';
    if (!d.salePrice || new Decimal(d.salePrice).lte(0)) return 'Nhập giá combo';
  }
  return null;
}

function toInput(d: Draft): CatalogMigrationRowInput {
  const base = {
    externalProductId: d.row.externalProductId,
    externalVariationId: d.row.externalVariationId,
    action: d.action,
  };
  if (d.action === 'MAP') return { ...base, skuId: d.skuId };
  if (d.action === 'NEW_COMBO' && d.parts)
    return {
      ...base,
      components: d.parts.map((p) => ({ skuId: p.skuId, qty: p.qty })),
      name: d.row.posName,
      salePrice: d.salePrice,
    };
  if (d.action === 'NEW_COMBO')
    return {
      ...base,
      componentSkuId: d.componentSkuId,
      qty: Number(d.qty),
      name: d.row.posName,
      salePrice: d.salePrice,
    };
  return base;
}

/**
 * Chuyển danh mục POS sang ERP — POST /pancake-sync/config/{shopId}/catalog-migration.
 *
 * Shop mới nối vào ERP đang bán bằng sản phẩm tạo trên POS. Mỗi sản phẩm POS được gợi ý một hàng
 * ERP (SKU lẻ / combo có sẵn / combo mới giá theo POS); người dùng duyệt rồi chạy. Hệ thống tạo
 * combo, nối sản phẩm POS sang hàng ERP (đơn cũ vẫn vào đúng hàng), cho shop chỉ bán hàng ERP đã
 * gán và đẩy hàng ERP lên POS (gắn thẻ "ERP"). Sản phẩm gốc giữ nguyên — người dùng lọc thẻ ERP
 * trên POS, đối chiếu rồi tự ẩn (2026-10-18).
 */
export function PancakeCatalogMigrationDialog({
  shop,
  open,
  onOpenChange,
}: {
  shop: PancakeShopConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const status = useCatalogMigrationStatus(shop.shopId);
  const [showResult, setShowResult] = useState(false);
  const running = isMigrationRunning(status.data);
  const preview = useCatalogMigrationPreview(shop.shopId, open && !running && !showResult);
  const start = useStartCatalogMigration(shop.shopId);

  useEffect(() => {
    if (running) setShowResult(true);
  }, [running]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            Chuyển danh mục POS sang ERP — shop {shop.shopName ?? shop.shopId}
          </DialogTitle>
          <DialogDescription>
            Duyệt hàng ERP tương ứng với từng sản phẩm đang có trên POS. Sau khi chuyển, shop chỉ
            bán hàng ERP đã gán, hàng ERP lên POS mang thẻ “ERP”. Sản phẩm gốc vẫn hiện — lọc thẻ
            ERP trên Pancake để đối chiếu rồi tự ẩn sản phẩm gốc. Đơn cũ vẫn vào đúng hàng.
          </DialogDescription>
        </DialogHeader>
        {showResult && status.data ? (
          <MigrationProgress
            status={status.data}
            onAgain={() => {
              setShowResult(false);
              void preview.refetch();
            }}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <QueryState
            query={preview}
            skeleton={<ListSkeleton rows={6} />}
            isEmpty={(d) => d.rows.length === 0}
            empty={
              <EmptyState
                icon={PackageOpen}
                title="Shop chưa có sản phẩm nào trên POS"
                description="Không có gì để chuyển. Gán sản phẩm ERP cho shop ở cột Sản phẩm bán."
                action={
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Đóng
                  </Button>
                }
              />
            }
          >
            {(data) => (
              <MigrationReview
                key={data.rows.length}
                data={data}
                pending={start.isPending}
                onStart={(rows) =>
                  start
                    .mutateAsync(rows)
                    .then(() => {
                      setShowResult(true);
                      toast.success('Đã bắt đầu chuyển danh mục', {
                        description: 'Hệ thống chạy nền — có thể đóng cửa sổ này.',
                      });
                    })
                    .catch((err) => toast.error(messageFor(err)))
                }
              />
            )}
          </QueryState>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MigrationReview({
  data,
  pending,
  onStart,
}: {
  data: CatalogMigrationPreview;
  pending: boolean;
  onStart: (rows: CatalogMigrationRowInput[]) => void;
}) {
  const pendingRows = useMemo(() => data.rows.filter((r) => r.state === 'PENDING'), [data.rows]);
  const migrated = data.rows.filter((r) => r.state === 'MIGRATED');
  const erpCount = data.rows.filter((r) => r.state === 'ERP').length;
  const [drafts, setDrafts] = useState<Draft[]>(() => pendingRows.map(draftOf));
  const [confirming, setConfirming] = useState(false);

  const patch = (i: number, p: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const errors = drafts.map(draftError);
  const invalid = errors.some((e) => e !== null);
  const moving = drafts.filter((d) => d.action !== 'SKIP').length;
  const newCombos = drafts.filter((d) => d.action === 'NEW_COMBO').length;

  return (
    <>
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span>{pendingRows.length} sản phẩm chưa chuyển</span>
        {migrated.length ? <span>· {migrated.length} đã chuyển</span> : null}
        {erpCount ? <span>· {erpCount} do ERP đẩy lên (bỏ qua)</span> : null}
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Mã POS</TableHead>
              <TableHead>Sản phẩm trên POS</TableHead>
              <TableHead className="text-right">Giá POS</TableHead>
              <TableHead className="w-48">Xử lý</TableHead>
              <TableHead className="min-w-80">Hàng ERP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((d, i) => (
              <TableRow key={d.row.externalVariationId}>
                <TableCell className="font-mono text-sm">{d.row.posCode ?? '—'}</TableCell>
                <TableCell>
                  <div>{d.row.posName}</div>
                  <MatchBadge row={d.row} />
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {d.row.posPrice ? formatMoney(d.row.posPrice) : '—'}
                </TableCell>
                <TableCell>
                  <Select value={d.action} onValueChange={(v) => patch(i, { action: v as Action })}>
                    <SelectTrigger aria-label={`Xử lý ${d.row.posName}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABEL) as Action[]).map((a) => (
                        <SelectItem key={a} value={a}>
                          {ACTION_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {d.action === 'MAP' ? (
                    <>
                      <EntityPicker
                        value={d.skuId}
                        selectedLabel={d.skuLabel}
                        useSearch={useMigrationTargetSearch}
                        placeholder="Chọn SKU / combo ERP…"
                        aria-label={`Hàng ERP cho ${d.row.posName}`}
                        onChange={(id, o) =>
                          patch(i, { skuId: id, skuLabel: o ? `${o.hint} · ${o.label}` : '' })
                        }
                      />
                      {d.row.suggestion.targetPriced === false &&
                      d.skuId === d.row.suggestion.sku?.skuId ? (
                        <div className="mt-1 text-xs text-destructive">
                          Hàng ERP này chưa có giá bán lẻ — lên POS sẽ giá 0. Đặt giá cho SKU trước
                          hoặc chọn hàng khác.
                        </div>
                      ) : null}
                    </>
                  ) : d.action === 'NEW_COMBO' && d.parts ? (
                    <div className="flex flex-wrap items-start gap-2">
                      <ul
                        className="min-w-48 flex-1 space-y-0.5 text-sm"
                        aria-label={`Thành phần combo cho ${d.row.posName}`}
                      >
                        {d.parts.map((p) => (
                          <li key={p.skuId}>
                            <span className="font-mono">{p.qty} ×</span> {p.label}
                          </li>
                        ))}
                      </ul>
                      <MoneyInput
                        className="w-32"
                        value={d.salePrice}
                        aria-label={`Giá combo cho ${d.row.posName}`}
                        onChange={(v) => patch(i, { salePrice: v })}
                      />
                      {d.row.suggestion.componentPriced === false ? (
                        <span className="w-full text-xs text-destructive">
                          Có thành phần chưa có giá bán lẻ — đặt giá cho SKU đó trước, combo mới tạo
                          được.
                        </span>
                      ) : null}
                    </div>
                  ) : d.action === 'NEW_COMBO' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="w-16"
                        inputMode="numeric"
                        value={d.qty}
                        aria-label={`Số lượng thành phần cho ${d.row.posName}`}
                        onChange={(e) => patch(i, { qty: e.target.value.replace(/\D/g, '') })}
                      />
                      <span className="text-sm">×</span>
                      <EntityPicker
                        className="min-w-48 flex-1"
                        value={d.componentSkuId}
                        selectedLabel={d.componentLabel}
                        useSearch={useMigrationComponentSearch}
                        placeholder="Chọn thành phần…"
                        aria-label={`Thành phần combo cho ${d.row.posName}`}
                        onChange={(id, o) =>
                          patch(i, {
                            componentSkuId: id,
                            componentLabel: o ? `${o.hint} · ${o.label}` : '',
                          })
                        }
                      />
                      <MoneyInput
                        className="w-32"
                        value={d.salePrice}
                        aria-label={`Giá combo cho ${d.row.posName}`}
                        onChange={(v) => patch(i, { salePrice: v })}
                      />
                      {d.row.suggestion.componentPriced === false &&
                      d.componentSkuId === d.row.suggestion.component?.skuId ? (
                        <span className="w-full text-xs text-destructive">
                          Thành phần chưa có giá bán lẻ — đặt giá cho SKU này trước, combo mới tạo
                          được.
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Không nối — sản phẩm vẫn bán trên POS như hiện tại
                    </span>
                  )}
                  {errors[i] ? (
                    <div className="mt-1 text-xs text-destructive">{errors[i]}</div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {migrated.map((r) => (
              <TableRow key={r.externalVariationId} className="text-muted-foreground">
                <TableCell className="font-mono text-sm">{r.posCode ?? '—'}</TableCell>
                <TableCell>{r.posName}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.posPrice ? formatMoney(r.posPrice) : '—'}
                </TableCell>
                <TableCell>
                  <StatusBadge tone="ok">Đã chuyển</StatusBadge>
                </TableCell>
                <TableCell className="text-sm">
                  {r.current ? `${r.current.code} · ${r.current.name}` : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DialogFooter className="items-center gap-2 sm:justify-between">
        <span className="text-sm text-muted-foreground">
          {moving} sản phẩm sẽ chuyển{newCombos ? ` · ${newCombos} combo mới` : ''}
        </span>
        <Button disabled={pending || invalid || moving === 0} onClick={() => setConfirming(true)}>
          <ArrowRightLeft aria-hidden />
          Chuyển danh mục
        </Button>
      </DialogFooter>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Chuyển ${moving} sản phẩm sang hàng ERP?`}
        description='Shop sẽ chỉ bán hàng ERP đã gán. Hàng ERP được đẩy lên POS kèm thẻ "ERP"; sản phẩm gốc vẫn hiện — đối chiếu trên Pancake rồi tự ẩn. Combo mới lấy giá đã nhập.'
        confirmLabel="Chuyển danh mục"
        onConfirm={() => onStart(drafts.map(toInput))}
      />
    </>
  );
}

function MatchBadge({ row }: { row: CatalogMigrationRow }) {
  const c = row.suggestion.confidence;
  if (c === 'EXACT') return <StatusBadge tone="ok">Khớp</StatusBadge>;
  if (c === 'FUZZY') return <StatusBadge tone="warn">Gần khớp — kiểm tra lại</StatusBadge>;
  return <StatusBadge tone="neutral">Không tìm thấy hàng ERP</StatusBadge>;
}

function MigrationProgress({
  status,
  onAgain,
  onClose,
}: {
  status: CatalogMigrationStatus;
  onAgain: () => void;
  onClose: () => void;
}) {
  const running = isMigrationRunning(status);
  const c = status.counts;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {status.state === 'completed' ? (
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
        ) : null}
        <span className="font-medium">
          {status.state === 'failed'
            ? 'Chuyển danh mục bị dừng'
            : status.state === 'completed'
              ? 'Đã chuyển danh mục'
              : `Đang chạy: ${status.step ? STEP_LABEL[status.step] : 'chờ bắt đầu'}`}
          {running && status.step === 'push' ? ` (${status.done}/${status.total})` : null}
        </span>
      </div>
      {status.error ? <p className="text-sm text-destructive">{status.error}</p> : null}
      <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <li>Đã nối: {c.linked}</li>
        <li>Combo mới: {c.combosCreated}</li>
        <li>Combo dùng lại: {c.combosReused}</li>
        <li>Đẩy lên POS: {c.pushed}</li>
        <li>Đẩy lỗi: {c.pushFailed}</li>
        {c.hidden ? <li>Đã ẩn trên POS: {c.hidden}</li> : null}
        <li>Giữ nguyên: {c.skipped}</li>
      </ul>
      {status.failures.length ? (
        <div className="max-h-48 overflow-auto rounded-md border p-2 text-sm">
          <div className="mb-1 font-medium">Chưa xong — hàng ERP tương ứng chưa lên POS:</div>
          <ul className="space-y-1">
            {status.failures.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.item}</span>: {f.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <DialogFooter>
        {running ? null : (
          <Button variant="outline" onClick={onAgain}>
            Xem lại danh mục POS
          </Button>
        )}
        <Button onClick={onClose}>{running ? 'Chạy nền, đóng' : 'Đóng'}</Button>
      </DialogFooter>
    </div>
  );
}
