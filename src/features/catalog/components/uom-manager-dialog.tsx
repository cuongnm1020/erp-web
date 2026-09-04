'use client';

import { Check, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { useCreateUom, useUoms, useUpdateUom, type Uom } from '../api/use-products';

/**
 * F3 — quản lý ĐVT "nhỏ" ngay trong form sản phẩm: danh sách + thêm + đổi tên
 * (version lock). Mã ĐVT bất biến sau khi tạo — quy đổi/barcode/bảng giá tựa vào.
 */
const CODE_RE = /^[A-Z0-9_]{1,10}$/;

function EditRow({ uom, onDone }: { uom: Uom; onDone: () => void }) {
  const update = useUpdateUom();
  const [name, setName] = useState(uom.name);
  const save = () => {
    if (!name.trim()) return;
    update.mutate(
      { id: uom.id, body: { version: uom.version, name: name.trim() } },
      {
        onSuccess: () => {
          toast.success('Đã lưu thay đổi');
          onDone();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };
  return (
    <>
      <TableCell className="px-2.5 py-1.5">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape') onDone();
          }}
          className="h-7"
        />
      </TableCell>
      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{uom.decimals}</TableCell>
      <TableCell className="px-2.5 py-1.5">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Lưu"
            disabled={update.isPending}
            onClick={save}
          >
            <Check aria-hidden />
            <span className="sr-only">Lưu</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Hủy" onClick={onDone}>
            <X aria-hidden />
            <span className="sr-only">Hủy</span>
          </Button>
        </div>
      </TableCell>
    </>
  );
}

export function UomManagerDialog({
  open,
  onOpenChange,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const uoms = useUoms();
  const create = useCreateUom();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: '', name: '', decimals: '0' });

  const add = () => {
    const code = draft.code.trim().toUpperCase();
    if (!CODE_RE.test(code)) {
      toast.error('Mã ĐVT: 1–10 ký tự HOA/số/gạch dưới, ví dụ BOX, THUNG24');
      return;
    }
    if (!draft.name.trim()) {
      toast.error('Nhập tên ĐVT');
      return;
    }
    create.mutate(
      {
        code,
        name: draft.name.trim(),
        ...(draft.decimals !== '' ? { decimals: Number(draft.decimals) } : {}),
      },
      {
        onSuccess: () => {
          toast.success(`Đã thêm ĐVT ${code}`);
          setDraft({ code: '', name: '', decimals: '0' });
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Đơn vị tính</DialogTitle>
          <DialogDescription>
            Mã ĐVT không đổi được sau khi tạo — quy đổi, barcode và bảng giá tựa vào nó. Số lẻ = số
            chữ số thập phân cho phép khi nhập lượng (0 = số nguyên).
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-24 px-2.5 text-xs">Mã</TableHead>
                <TableHead className="px-2.5 text-xs">Tên</TableHead>
                <TableHead className="w-16 px-2.5 text-right text-xs">Số lẻ</TableHead>
                <TableHead className="w-20 px-2.5 text-xs">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(uoms.data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{u.code}</TableCell>
                  {editingId === u.id ? (
                    <EditRow uom={u} onDone={() => setEditingId(null)} />
                  ) : (
                    <>
                      <TableCell className="px-2.5 py-1.5">{u.name}</TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {u.decimals}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {canEdit ? (
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Đổi tên"
                              onClick={() => setEditingId(u.id)}
                            >
                              <Pencil aria-hidden />
                              <span className="sr-only">Đổi tên</span>
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {canEdit ? (
          <div className="flex items-end gap-2">
            <div className="w-28">
              <label className="text-xs text-muted-foreground" htmlFor="uom-new-code">
                Mã mới
              </label>
              <Input
                id="uom-new-code"
                placeholder="THUNG24"
                className="font-mono uppercase"
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground" htmlFor="uom-new-name">
                Tên
              </label>
              <Input
                id="uom-new-name"
                placeholder="Thùng 24 chai"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
              />
            </div>
            <div className="w-16">
              <label className="text-xs text-muted-foreground" htmlFor="uom-new-decimals">
                Số lẻ
              </label>
              <Input
                id="uom-new-decimals"
                inputMode="numeric"
                value={draft.decimals}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, decimals: e.target.value.replace(/\D/g, '') }))
                }
              />
            </div>
            <Button type="button" onClick={add} disabled={create.isPending}>
              <Plus aria-hidden /> Thêm
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
