'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  ExportDeliveryContextProvider,
  type ExportDelivery,
  type ExportFile,
  type ExportInfo,
  type ExportOutcome,
  type ServerExport,
} from '@/components/data/export-delivery';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
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
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { groupVi } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { exportRequestFormSchema, type ExportRequestFormValues } from '@/lib/shared';
import { openDownload, saveBlob } from '@/lib/xlsx-writer';
import {
  useCreateExportRequest,
  useLogDirectExport,
  useServerExportRequest,
} from '../api/use-export-requests';

/** Email nhập lần trước — tiện cho lần sau, chỉ trên trình duyệt này. */
const EMAIL_KEY = 'erp.exportEmail';

function lastEmail(): string {
  try {
    return window.localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberEmail(email: string): void {
  try {
    window.localStorage.setItem(EMAIL_KEY, email);
  } catch {
    // Trình duyệt chặn lưu trữ — lần sau gõ lại.
  }
}

type Pending =
  | { kind: 'file'; file: ExportFile; resolve: (o: ExportOutcome) => void }
  | { kind: 'server'; exp: ServerExport; resolve: (o: ExportOutcome) => void };

/**
 * Luồng xuất Excel cho mọi màn đã đăng nhập (2026-11-02):
 * - có `export.direct`: tải ngay; file trình duyệt tạo thì báo POST /excel-logs trước (log lỗi → không
 *   tải, để mọi lần xuất đều có dấu vết); file server tạo thì server tự ghi.
 * - không: hộp "Gửi file qua email" → POST /export-requests (hoặc route server `?email=`), quản trị
 *   duyệt ở màn Duyệt xuất Excel rồi hệ thống gửi file.
 */
export function ExportDeliveryProvider({ children }: { children: ReactNode }) {
  const ability = useAbility();
  const canDirect = ability.can('direct', 'Export');
  const logDirect = useLogDirectExport();
  const [pending, setPending] = useState<Pending | null>(null);
  // Ref để callback ổn định (không đổi mỗi render) mà vẫn đọc quyền mới nhất.
  const directRef = useRef(canDirect);
  directRef.current = canDirect;
  const logRef = useRef(logDirect.mutateAsync);
  logRef.current = logDirect.mutateAsync;

  const deliverFile = useCallback(async (file: ExportFile): Promise<ExportOutcome> => {
    if (directRef.current) {
      try {
        await logRef.current({
          resource: file.resource,
          title: file.title,
          fileName: file.fileName,
          fileSize: file.blob.size,
          rowCount: file.rowCount,
          filters: file.filters,
        });
      } catch (err) {
        toast.error(messageFor(err));
        return 'cancelled';
      }
      saveBlob(file.blob, file.fileName);
      return 'downloaded';
    }
    return new Promise<ExportOutcome>((resolve) => setPending({ kind: 'file', file, resolve }));
  }, []);

  const deliverServer = useCallback((exp: ServerExport): Promise<ExportOutcome> => {
    if (directRef.current) {
      openDownload(exp.href);
      return Promise.resolve('downloaded');
    }
    return new Promise<ExportOutcome>((resolve) => setPending({ kind: 'server', exp, resolve }));
  }, []);

  const value = useMemo<ExportDelivery>(
    () => ({ canDirect, deliverFile, deliverServer }),
    [canDirect, deliverFile, deliverServer],
  );

  const close = (outcome: ExportOutcome) => {
    pending?.resolve(outcome);
    setPending(null);
  };

  return (
    <ExportDeliveryContextProvider value={value}>
      {children}
      {pending ? <ExportEmailDialog pending={pending} onDone={close} /> : null}
    </ExportDeliveryContextProvider>
  );
}

function infoOf(p: Pending): ExportInfo {
  return p.kind === 'file' ? p.file : p.exp;
}

/** Hộp nhập email cá nhân — file chờ quản trị duyệt rồi mới gửi. */
function ExportEmailDialog({
  pending,
  onDone,
}: {
  pending: Pending;
  onDone: (o: ExportOutcome) => void;
}) {
  const router = useRouter();
  const upload = useCreateExportRequest();
  const server = useServerExportRequest();
  const busy = upload.isPending || server.isPending;
  const info = infoOf(pending);
  const form = useForm<ExportRequestFormValues>({
    resolver: zodResolver(exportRequestFormSchema),
    defaultValues: { email: lastEmail() },
  });

  const onSuccess = (email: string) => {
    rememberEmail(email);
    toast.success('Đã gửi yêu cầu xuất Excel', {
      description: `File sẽ được gửi tới ${email} sau khi quản trị duyệt.`,
      action: { label: 'Xem yêu cầu', onClick: () => router.push('/exports') },
    });
    onDone('requested');
  };
  const onError = (err: unknown) => applyServerErrors(form, err, { knownFields: ['email'] });

  const onSubmit = form.handleSubmit(({ email }) => {
    if (pending.kind === 'file') {
      const f = pending.file;
      upload.mutate(
        {
          blob: f.blob,
          fileName: f.fileName,
          email,
          resource: f.resource,
          title: f.title,
          rowCount: f.rowCount,
          filters: f.filters,
        },
        { onSuccess: () => onSuccess(email), onError },
      );
      return;
    }
    server.mutate(
      { run: pending.exp.requestByEmail, email },
      { onSuccess: () => onSuccess(email), onError },
    );
  });

  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onDone('cancelled')}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gửi file Excel qua email</DialogTitle>
          <DialogDescription>
            {info.title}
            {info.rowCount !== undefined ? ` · ${groupVi(String(info.rowCount))} dòng` : ''}. Quản
            trị duyệt xong, hệ thống gửi file tới email bạn nhập.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Email nhận file</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoFocus
                      autoComplete="email"
                      placeholder="ten@gmail.com"
                    />
                  </FormControl>
                  <FormDescription>
                    Email cá nhân của bạn — file đính kèm trong thư.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onDone('cancelled')}
              >
                Hủy
              </Button>
              <Button type="submit" loading={busy} loadingText="Đang gửi…">
                Gửi yêu cầu
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
