'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronRight, Folder, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
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
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { useAbility } from '@/lib/permission';
import { codeSchema } from '@/lib/shared';
import { useBrands, type Brand } from '../api/use-products';
import {
  useCategoryTree,
  useCreateBrand,
  useCreateCategory,
  useDeleteBrand,
  useDeleteCategory,
  useUpdateBrand,
  useUpdateCategory,
  type CategoryTreeNode,
} from '../api/use-taxonomy';

/**
 * F1 (PLAN-master-data-lot-uom) — nối API thật cho màn Danh mục & thương hiệu:
 * cây danh mục 3 cấp (GET /categories/tree, tạo/sửa-đổi-cha/xóa mềm, version
 * lock), bảng thương hiệu (GET/POST/PATCH/DELETE /brands). Đổi cha qua hộp
 * thoại sửa (server chặn vòng + sâu > 3). Quyền theo cặp action/subject Product.
 */

const MAX_DEPTH = 3;

/** Node phẳng hoá từ cây — giữ depth để thụt cấp + biết được phép thêm con. */
interface FlatNode {
  node: CategoryTreeNode;
  depth: number; // 1-based
}

function flatten(nodes: CategoryTreeNode[], depth = 1, out: FlatNode[] = []): FlatNode[] {
  for (const n of nodes) {
    out.push({ node: n, depth });
    flatten(n.children, depth + 1, out);
  }
  return out;
}

/** id của n + toàn bộ con cháu — loại khỏi select "cha" khi sửa (chặn vòng phía client). */
function subtreeIds(n: CategoryTreeNode, out = new Set<string>()): Set<string> {
  out.add(n.id);
  for (const c of n.children) subtreeIds(c, out);
  return out;
}

function subtreeHeight(n: CategoryTreeNode): number {
  return 1 + Math.max(0, ...n.children.map(subtreeHeight));
}

const categorySchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1, 'Nhập tên danh mục').max(200, 'Tối đa 200 ký tự'),
  parentId: z.string(), // '' = gốc
});
type CategoryValues = z.infer<typeof categorySchema>;

const ROOT = '__root__';

function CategoryDialog({
  tree,
  category,
  defaultParentId,
  open,
  onOpenChange,
}: {
  tree: CategoryTreeNode[];
  /** undefined = tạo mới; có = sửa (mã khóa, đổi được tên + cha). */
  category?: CategoryTreeNode;
  defaultParentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = category !== undefined;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const isPending = create.isPending || update.isPending;

  const flat = useMemo(() => flatten(tree), [tree]);
  const excluded = useMemo(() => (category ? subtreeIds(category) : new Set<string>()), [category]);
  // Cha hợp lệ: ngoài cây con của chính nó, và còn chỗ cho chiều cao cây con
  // (server là nguồn sự thật — đây chỉ là lọc trước cho đỡ bấm nhầm).
  const height = category ? subtreeHeight(category) : 1;
  const parents = flat.filter((f) => !excluded.has(f.node.id) && f.depth + height <= MAX_DEPTH);

  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      code: category?.code ?? '',
      name: category?.name ?? '',
      parentId: category?.parentId ?? defaultParentId ?? '',
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    const parentId = v.parentId || undefined;
    const done = (msg: string) => {
      toast.success(msg);
      onOpenChange(false);
    };
    const fail = (err: unknown) =>
      applyServerErrors(form, err as ApiError, { knownFields: ['code', 'name', 'parentId'] });
    if (editing) {
      update.mutate(
        {
          id: category.id,
          body: { version: category.version, name: v.name, parentId: parentId ?? null },
        },
        { onSuccess: () => done('Đã lưu thay đổi'), onError: fail },
      );
    } else {
      create.mutate(
        { code: v.code, name: v.name, ...(parentId ? { parentId } : {}) },
        { onSuccess: () => done('Đã thêm danh mục'), onError: fail },
      );
    }
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Sửa danh mục ${category.code}` : 'Thêm danh mục'}</DialogTitle>
          <DialogDescription>
            Tối đa {MAX_DEPTH} cấp. Đổi cha để di chuyển cả nhánh — sản phẩm gán vào danh mục không
            đổi.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã danh mục</FormLabel>
                  <FormControl>
                    <Input placeholder="BVTV" className="font-mono" disabled={editing} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên danh mục</FormLabel>
                  <FormControl>
                    <Input autoFocus={editing} placeholder="Thuốc bảo vệ thực vật" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Danh mục cha</FormLabel>
                  <Select
                    value={field.value === '' ? ROOT : field.value}
                    onValueChange={(v) => field.onChange(v === ROOT ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="— Gốc —" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ROOT}>— Gốc —</SelectItem>
                      {parents.map((f) => (
                        <SelectItem key={f.node.id} value={f.node.id}>
                          {' '.repeat((f.depth - 1) * 3)}
                          {f.node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm danh mục'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const brandSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1, 'Nhập tên thương hiệu').max(200, 'Tối đa 200 ký tự'),
  isActive: z.enum(['active', 'inactive']),
});
type BrandValues = z.infer<typeof brandSchema>;

function BrandDialog({
  brand,
  open,
  onOpenChange,
}: {
  brand?: Brand;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = brand !== undefined;
  const create = useCreateBrand();
  const update = useUpdateBrand();
  const isPending = create.isPending || update.isPending;
  const form = useForm<BrandValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      code: brand?.code ?? '',
      name: brand?.name ?? '',
      isActive: brand === undefined || brand.isActive ? 'active' : 'inactive',
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    const done = (msg: string) => {
      toast.success(msg);
      onOpenChange(false);
    };
    const fail = (err: unknown) =>
      applyServerErrors(form, err as ApiError, { knownFields: ['code', 'name'] });
    if (editing) {
      update.mutate(
        {
          id: brand.id,
          body: { version: brand.version, name: v.name, isActive: v.isActive === 'active' },
        },
        { onSuccess: () => done('Đã lưu thay đổi'), onError: fail },
      );
    } else {
      create.mutate(
        { code: v.code, name: v.name },
        { onSuccess: () => done('Đã thêm thương hiệu'), onError: fail },
      );
    }
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Sửa thương hiệu ${brand.code}` : 'Thêm thương hiệu'}
          </DialogTitle>
          <DialogDescription>
            Ngừng hợp tác vẫn hiển thị trong báo cáo — chỉ ẩn khỏi form chọn khi tạo sản phẩm.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã thương hiệu</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="THIENLONG"
                      className="font-mono"
                      disabled={editing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên thương hiệu</FormLabel>
                  <FormControl>
                    <Input autoFocus={editing} placeholder="Thiên Long" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {editing ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trạng thái</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Hoạt động</SelectItem>
                        <SelectItem value="inactive">Ngừng hợp tác</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            ) : null}
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm thương hiệu'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-card text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** Một dòng của cây — thụt theo cấp, toggle mở/đóng, thao tác khi có quyền. */
function TreeRow({
  flat,
  collapsed,
  onToggle,
  canUpdate,
  canCreate,
  canDelete,
  onAddChild,
  onEdit,
  onDelete,
}: {
  flat: FlatNode;
  collapsed: boolean;
  onToggle: () => void;
  canUpdate: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { node, depth } = flat;
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div
        className="group flex h-8 w-full items-center gap-1.5 pr-2 text-sm hover:bg-muted"
        style={{ paddingLeft: `${(depth - 1) * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={!hasChildren}
          aria-label={collapsed ? `Mở ${node.name}` : `Đóng ${node.name}`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground disabled:opacity-0"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{node.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{node.code}</span>
        <span className="ml-auto flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
          {canCreate && depth < MAX_DEPTH ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Thêm danh mục con"
              onClick={onAddChild}
            >
              <Plus aria-hidden />
              <span className="sr-only">Thêm danh mục con</span>
            </Button>
          ) : null}
          <RowActions
            onEdit={canUpdate ? onEdit : undefined}
            onDelete={canDelete ? onDelete : undefined}
            itemName={`danh mục ${node.name}`}
            deleteDescription="Chỉ xóa được danh mục không còn danh mục con và không còn sản phẩm."
          />
        </span>
      </div>
      {!collapsed && hasChildren ? null : null}
    </li>
  );
}

export function CategoriesScreen() {
  const treeQuery = useCategoryTree();
  const brandsQuery = useBrands();
  const deleteCategory = useDeleteCategory();
  const deleteBrand = useDeleteBrand();
  const ability = useAbility();
  const canCreate = ability.can('create', 'Product');
  const canUpdate = ability.can('update', 'Product');
  const canDelete = ability.can('delete', 'Product');

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [catDialog, setCatDialog] = useState<{
    open: boolean;
    category?: CategoryTreeNode;
    defaultParentId?: string;
  }>({ open: false });
  const [brandDialog, setBrandDialog] = useState<{ open: boolean; brand?: Brand }>({
    open: false,
  });
  const [brandFilter, setBrandFilter] = useState<'active' | 'inactive'>('active');
  const [brandSearch, setBrandSearch] = useState('');

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Phẳng hoá theo trạng thái mở/đóng — node dưới nhánh đóng không render. */
  const visibleFlat = useMemo(() => {
    const out: FlatNode[] = [];
    const walk = (nodes: CategoryTreeNode[], depth: number) => {
      for (const n of nodes) {
        out.push({ node: n, depth });
        if (!collapsed.has(n.id)) walk(n.children, depth + 1);
      }
    };
    walk(treeQuery.data ?? [], 1);
    return out;
  }, [treeQuery.data, collapsed]);

  const onDeleteCategory = (node: CategoryTreeNode) =>
    deleteCategory
      .mutateAsync(node.id)
      .then(() => toast.success(`Đã xóa danh mục ${node.name}`))
      .catch((err: unknown) => {
        const details = err instanceof ApiError ? (err.details as Record<string, number>) : null;
        if (details && (details.children || details.products)) {
          toast.error(
            'Danh mục còn danh mục con hoặc sản phẩm — chuyển chúng sang danh mục khác trước.',
          );
        } else toast.error(messageFor(err));
      });

  const onDeleteBrand = (brand: Brand) =>
    deleteBrand
      .mutateAsync(brand.id)
      .then(() => toast.success(`Đã xóa thương hiệu ${brand.name}`))
      .catch((err: unknown) => {
        const details = err instanceof ApiError ? (err.details as Record<string, number>) : null;
        if (details?.products) {
          toast.error(
            'Thương hiệu còn sản phẩm — chuyển sản phẩm đi, hoặc dùng "Ngừng hợp tác" trong hộp thoại sửa.',
          );
        } else toast.error(messageFor(err));
      });

  const brands = brandsQuery.data ?? [];
  const filteredBrands = brands.filter(
    (b) =>
      b.isActive === (brandFilter === 'active') &&
      (brandSearch === '' || b.name.toLowerCase().includes(brandSearch.toLowerCase())),
  );
  const categoryCount = useMemo(() => flatten(treeQuery.data ?? []).length, [treeQuery.data]);

  return (
    <>
      <PageHeader
        title="Danh mục & thương hiệu"
        description={
          treeQuery.data && brandsQuery.data
            ? `${categoryCount} danh mục (tối đa ${MAX_DEPTH} cấp) · ${brands.length} thương hiệu`
            : 'Đang tải…'
        }
        breadcrumb={[
          { label: 'Sản phẩm', href: '/catalog/products' },
          { label: 'Danh mục & thương hiệu' },
        ]}
        actions={
          canCreate ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setBrandDialog({ open: true })}>
                <Plus aria-hidden /> Thêm thương hiệu
              </Button>
              <Button size="sm" onClick={() => setCatDialog({ open: true })}>
                <Plus aria-hidden /> Thêm danh mục
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[420px_1fr]">
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Cây danh mục</span>
            <span className="text-xs text-muted-foreground">đổi cha trong hộp thoại sửa</span>
          </div>
          <QueryState
            query={treeQuery}
            skeleton={<ListSkeleton rows={8} columns={1} />}
            isEmpty={(d) => d.length === 0}
            empty={
              <EmptyState
                title="Chưa có danh mục nào"
                description="Tạo danh mục gốc đầu tiên để phân loại sản phẩm."
                action={
                  canCreate ? (
                    <Button onClick={() => setCatDialog({ open: true })}>
                      <Plus aria-hidden />
                      Thêm danh mục
                    </Button>
                  ) : undefined
                }
              />
            }
          >
            {() => (
              <ul className="py-1">
                {visibleFlat.map((f) => (
                  <TreeRow
                    key={f.node.id}
                    flat={f}
                    collapsed={collapsed.has(f.node.id)}
                    onToggle={() => toggle(f.node.id)}
                    canUpdate={canUpdate}
                    canCreate={canCreate}
                    canDelete={canDelete}
                    onAddChild={() => setCatDialog({ open: true, defaultParentId: f.node.id })}
                    onEdit={() => setCatDialog({ open: true, category: f.node })}
                    onDelete={() => void onDeleteCategory(f.node)}
                  />
                ))}
              </ul>
            )}
          </QueryState>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            Tối đa {MAX_DEPTH} cấp. Lọc sản phẩm theo danh mục cha sẽ gộp cả danh mục con.
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <div className="flex h-7 w-56 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm">
              <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <input
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Tìm thương hiệu…"
                className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            <FilterChip active={brandFilter === 'active'} onClick={() => setBrandFilter('active')}>
              Hoạt động
            </FilterChip>
            <FilterChip
              active={brandFilter === 'inactive'}
              onClick={() => setBrandFilter('inactive')}
            >
              Ngừng
            </FilterChip>
          </div>
          <QueryState
            query={brandsQuery}
            skeleton={<ListSkeleton rows={6} columns={4} />}
            isEmpty={(d) => d.length === 0}
            empty={
              <EmptyState
                title="Chưa có thương hiệu nào"
                description="Thêm thương hiệu để gán khi tạo sản phẩm."
                action={
                  canCreate ? (
                    <Button onClick={() => setBrandDialog({ open: true })}>
                      <Plus aria-hidden />
                      Thêm thương hiệu
                    </Button>
                  ) : undefined
                }
              />
            }
          >
            {() => (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted">
                        <TableHead className="w-32 px-2.5 text-xs">Mã</TableHead>
                        <TableHead className="px-2.5 text-xs">Thương hiệu</TableHead>
                        <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
                        <TableHead className="w-20 px-2.5 text-xs">
                          <span className="sr-only">Thao tác</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBrands.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                            {b.code}
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5 font-semibold">{b.name}</TableCell>
                          <TableCell className="px-2.5 py-1.5">
                            {b.isActive ? (
                              <StatusBadge tone="ok">Hoạt động</StatusBadge>
                            ) : (
                              <StatusBadge tone="neutral">Ngừng</StatusBadge>
                            )}
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5">
                            <RowActions
                              onEdit={
                                canUpdate
                                  ? () => setBrandDialog({ open: true, brand: b })
                                  : undefined
                              }
                              onDelete={canDelete ? () => void onDeleteBrand(b) : undefined}
                              itemName={`thương hiệu ${b.name}`}
                              deleteDescription="Chỉ xóa được thương hiệu không còn sản phẩm. Còn sản phẩm thì dùng Ngừng hợp tác."
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredBrands.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="px-2.5 py-6 text-center text-sm text-muted-foreground"
                          >
                            Không có thương hiệu nào khớp bộ lọc.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                  {filteredBrands.length} / {brands.length} thương hiệu
                </div>
              </>
            )}
          </QueryState>
        </div>
      </div>

      {catDialog.open && treeQuery.data ? (
        <CategoryDialog
          key={catDialog.category?.id ?? catDialog.defaultParentId ?? 'new'}
          tree={treeQuery.data}
          category={catDialog.category}
          defaultParentId={catDialog.defaultParentId}
          open={catDialog.open}
          onOpenChange={(o) => setCatDialog((d) => ({ ...d, open: o }))}
        />
      ) : null}
      {brandDialog.open ? (
        <BrandDialog
          key={brandDialog.brand?.id ?? 'new'}
          brand={brandDialog.brand}
          open={brandDialog.open}
          onOpenChange={(o) => setBrandDialog((d) => ({ ...d, open: o }))}
        />
      ) : null}
    </>
  );
}
