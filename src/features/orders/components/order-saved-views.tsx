'use client';

import { Bookmark, Trash2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { useSaveUserPreference, useUserPreference } from '@/lib/preferences';

/** Một bộ lọc đã lưu = tên + chuỗi query của URL danh sách (tab, lọc, tìm — không giữ trang). */
export interface SavedOrderView {
  name: string;
  query: string;
}
interface SavedViewsPref {
  views: SavedOrderView[];
}

const PREF_KEY = 'orders.views';
/** Giữ gọn dưới giới hạn 8 KB của một preference. */
const MAX_VIEWS = 20;

/** Query hiện tại bỏ `page` — mở lại bộ lọc luôn về trang đầu. */
function currentQuery(params: URLSearchParams): string {
  const p = new URLSearchParams(params);
  p.delete('page');
  return p.toString();
}

/**
 * "Bộ lọc đã lưu" trên thanh lọc danh sách đơn (redesign Bán hàng 2026-10-22): lưu tổ hợp tab +
 * lọc + từ khóa dưới một tên, mở lại bằng một cú bấm. Lưu theo tài khoản qua
 * GET/PUT /me/preferences/orders.views (API có sẵn) — không đụng dữ liệu nghiệp vụ.
 */
export function OrderSavedViews() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pref = useUserPreference<SavedViewsPref>(PREF_KEY);
  const save = useSaveUserPreference<SavedViewsPref>(PREF_KEY);
  const views = pref.data?.views ?? [];
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const query = currentQuery(params);

  const write = (next: SavedOrderView[], done: string) =>
    save.mutate(
      { views: next },
      {
        onSuccess: () => toast.success(done),
        onError: () => toast.error('Không lưu được bộ lọc. Thử lại sau ít phút.'),
      },
    );

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    // Trùng tên → ghi đè bộ lọc cũ (người dùng đang cập nhật bộ lọc quen thuộc).
    const next = [{ name: n, query }, ...views.filter((v) => v.name !== n)].slice(0, MAX_VIEWS);
    write(next, `Đã lưu bộ lọc “${n}”`);
    setNaming(false);
    setName('');
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark aria-hidden />
            Bộ lọc đã lưu
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {views.length === 0 ? (
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              Chưa lưu bộ lọc nào
            </DropdownMenuLabel>
          ) : (
            views.map((v) => (
              <DropdownMenuItem
                key={v.name}
                onSelect={() => router.push(v.query ? `${pathname}?${v.query}` : pathname)}
                className={v.query === query ? 'font-semibold' : undefined}
              >
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                <button
                  type="button"
                  aria-label={`Xóa bộ lọc ${v.name}`}
                  className="ml-2 rounded-sm p-0.5 text-subtle-foreground hover:bg-border hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    write(
                      views.filter((x) => x.name !== v.name),
                      `Đã xóa bộ lọc “${v.name}”`,
                    );
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!query} onSelect={() => setNaming(true)}>
            Lưu bộ lọc hiện tại…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lưu bộ lọc hiện tại</DialogTitle>
            <DialogDescription>
              Lưu tab, bộ lọc và từ khóa đang dùng để mở lại bằng một cú bấm. Chỉ bạn thấy.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-1.5 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Label htmlFor="saved-view-name">Tên bộ lọc</Label>
            <Input
              id="saved-view-name"
              autoFocus
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Chờ xử lý kho · chưa gán hãng"
            />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNaming(false)}>
              Hủy
            </Button>
            <Button onClick={submit} disabled={!name.trim()} loading={save.isPending}>
              Lưu bộ lọc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
