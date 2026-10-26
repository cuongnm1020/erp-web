'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { PurposePicker } from '@/components/data/purpose-picker';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  useAddCustomerPurposes,
  useCreateCustomerNote,
  useCreatePurpose,
  useCustomerNotes,
  useCustomerPurposes,
  useDeleteCustomerNote,
  usePurposes,
  useRemoveCustomerPurpose,
  useUpdateCustomerNote,
  type CustomerNote,
} from '../api/use-care';

function CardShell({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card" aria-label={label}>
      <div className="flex min-h-card-header items-center border-b px-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * Mục đích sử dụng của khách (biên bản CSKH 2026-10-26, mockup màn 2): mỗi mục đích ghi ai gắn,
 * ngày gắn — khách trồng gì theo mùa. Ai lên đơn cũng gắn / tạo được; gỡ khi khách trong tầm nhìn.
 */
export function CustomerPurposeCard({ customerId }: { customerId: string }) {
  const mine = useCustomerPurposes(customerId);
  const catalog = usePurposes();
  const add = useAddCustomerPurposes(customerId);
  const remove = useRemoveCustomerPurpose(customerId);
  const create = useCreatePurpose();
  const [picking, setPicking] = useState(false);
  const have = (mine.data ?? []).map((p) => p.id);

  const attach = (ids: string[]) =>
    add.mutate(ids, {
      onSuccess: () => toast.success('Đã gắn mục đích'),
      onError: (e) => toast.error(messageFor(e)),
    });

  return (
    <CardShell title="Mục đích sử dụng" label="Mục đích sử dụng">
      {mine.isPending ? (
        <p className="px-3.5 py-3 text-sm text-muted-foreground">Đang tải…</p>
      ) : mine.error ? (
        <div className="flex items-center gap-2 px-3.5 py-3 text-sm text-muted-foreground">
          Không tải được mục đích của khách.
          <Button variant="link" size="sm" onClick={() => void mine.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 px-3.5 py-3">
          {(mine.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="inline-flex h-chip items-center rounded-chip bg-success-weak px-2 text-xs font-semibold text-success">
                {p.name}
              </span>
              <span className="flex-1 text-xs text-muted-foreground">
                {p.taggedByName ? `${p.taggedByName} gắn ` : 'Gắn '}
                {formatDate(p.taggedAt)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Gỡ mục đích ${p.name}`}
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(p.id, {
                    onSuccess: () => toast.success('Đã gỡ mục đích'),
                    onError: (e) => toast.error(messageFor(e)),
                  })
                }
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
          {!mine.data?.length ? (
            <li className="text-sm text-muted-foreground">
              Chưa gắn mục đích nào — khách dùng sản phẩm cho cây gì?
            </li>
          ) : null}
        </ul>
      )}
      <div className="border-t px-3.5 py-2.5">
        {picking ? (
          <PurposePicker
            options={catalog.data ?? []}
            selected={[]}
            locked={have}
            onToggle={(id) => attach([id])}
            creating={create.isPending}
            disabled={add.isPending}
            onCreate={async (name) => {
              try {
                const r = await create.mutateAsync(name);
                attach([r.purpose.id]);
              } catch (e) {
                toast.error(messageFor(e));
              }
            }}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            Gắn mục đích
          </Button>
        )}
      </div>
    </CardShell>
  );
}

function NoteItem({ customerId, note }: { customerId: string; note: CustomerNote }) {
  const update = useUpdateCustomerNote(customerId);
  const del = useDeleteCustomerNote(customerId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="flex flex-col gap-1 border-t px-3.5 py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground">{note.authorName}</strong>
          {note.authorDepartment ? ` · ${note.authorDepartment}` : ''} ·{' '}
          {formatDateTime(note.createdAt)}
          {note.orderCode ? ` · đơn ${note.orderCode}` : ''}
          {note.editedAt ? ' · đã sửa' : ''}
        </span>
        {note.mine && !editing ? (
          <span className="flex gap-1">
            <Button variant="link" size="sm" onClick={() => setEditing(true)}>
              Sửa
            </Button>
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirm(true)}>
              Xóa
            </Button>
          </span>
        ) : null}
      </div>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            aria-label="Sửa ghi chú"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setText(note.body);
                setEditing(false);
              }}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={!text.trim()}
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: note.id, body: text },
                  {
                    onSuccess: () => {
                      setEditing(false);
                      toast.success('Đã lưu thay đổi');
                    },
                    onError: (e) => toast.error(messageFor(e)),
                  },
                )
              }
            >
              Lưu thay đổi
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm">{note.body}</p>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Xóa ghi chú?"
        description="Ghi chú bị xóa hẳn khỏi lịch sử chăm sóc của khách."
        confirmLabel="Xóa ghi chú"
        destructive
        onConfirm={() =>
          del
            .mutateAsync(note.id)
            .then(() => toast.success('Đã xóa ghi chú'))
            .catch((e: unknown) => toast.error(messageFor(e)))
        }
      />
    </li>
  );
}

/**
 * Lịch sử chăm sóc (biên bản CSKH 2026-10-26): ai cũng ghi, cả team + sale lên đơn xem, mới nhất
 * lên đầu; chỉ người viết sửa / xóa (API chặn, nút chỉ hiện với ghi chú `mine`).
 */
export function CustomerNotesCard({ customerId }: { customerId: string }) {
  const notes = useCustomerNotes(customerId);
  const create = useCreateCustomerNote(customerId);
  const [draft, setDraft] = useState('');
  const save = () =>
    create.mutate(draft, {
      onSuccess: () => {
        setDraft('');
        toast.success('Đã lưu ghi chú');
      },
      onError: (e) => toast.error(messageFor(e)),
    });
  return (
    <CardShell
      title={`Lịch sử chăm sóc${notes.data ? ` (${notes.data.total})` : ''}`}
      label="Lịch sử chăm sóc"
    >
      <div className="flex flex-col gap-1.5 border-b px-3.5 py-2.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Nội dung trao đổi với khách, nhu cầu, hẹn lần sau…"
          aria-label="Thêm ghi chú"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && draft.trim()) save();
          }}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={!draft.trim()} loading={create.isPending} onClick={save}>
            Lưu ghi chú · Ctrl Enter
          </Button>
        </div>
      </div>
      {notes.isPending ? (
        <p className="px-3.5 py-3 text-sm text-muted-foreground">Đang tải…</p>
      ) : notes.error ? (
        <div className="flex items-center gap-2 px-3.5 py-3 text-sm text-muted-foreground">
          Không tải được lịch sử chăm sóc.
          <Button variant="link" size="sm" onClick={() => void notes.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : notes.data.items.length ? (
        <ol>
          {notes.data.items.map((n) => (
            <NoteItem key={n.id} customerId={customerId} note={n} />
          ))}
        </ol>
      ) : (
        <p className="px-3.5 py-3 text-sm text-muted-foreground">
          Chưa có ghi chú nào — ghi lại lần trao đổi đầu tiên với khách.
        </p>
      )}
    </CardShell>
  );
}
