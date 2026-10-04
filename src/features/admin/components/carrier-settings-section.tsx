'use client';

import { Pencil, RefreshCw, Truck } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
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
  useCarrierSettings,
  useVerifyCarrierSetting,
  type CarrierSetting,
  type CarrierSettingField,
} from '../api/use-carrier-settings';
import { CarrierSettingDialog } from './carrier-setting-dialog';

const SOURCE_LABEL: Record<NonNullable<CarrierSettingField['source']>, string> = {
  db: 'nhập ở đây',
  env: 'từ env',
  apiConfig: 'cấu hình cũ',
};

/**
 * Cấu hình hệ thống › Đơn vị vận chuyển — GET/PUT /carriers/settings, POST …/verify.
 * Mỗi hãng một dòng: trường đang hiệu lực + nguồn (nhập ở đây / env), kết quả kiểm tra kết nối
 * gần nhất. Lưu xong tự kiểm tra kết nối; nút "Kiểm tra kết nối" gọi lại bất cứ lúc nào.
 */
export function CarrierSettingsSection() {
  const query = useCarrierSettings();
  const verify = useVerifyCarrierSetting();
  const [editing, setEditing] = useState<CarrierSetting | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const runVerify = (code: string, name: string) => {
    setVerifying(code);
    verify.mutate(code, {
      onSuccess: (r) => {
        if (r.status === 'ok')
          toast.success(`Kết nối ${name} thành công`, { description: r.message });
        else if (r.status === 'failed')
          toast.error(`Kết nối ${name} thất bại`, { description: r.message });
        else toast.info(r.message);
      },
      onError: (err) => toast.error(messageFor(err)),
      onSettled: () => setVerifying(null),
    });
  };

  return (
    <section className="rounded-md border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Đơn vị vận chuyển</h2>
        <span className="text-xs text-muted-foreground">
          Giá trị nhập ở đây thắng biến môi trường, có hiệu lực ngay · token chỉ hiện 4 ký tự cuối
        </span>
      </div>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={4} columns={5} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={Truck}
            title="Chưa có hãng vận chuyển nào kết nối API"
            description="Hãng có tích hợp (GHN, GHTK, Viettel Post…) sẽ hiện ở đây khi được bật trong danh mục hãng."
          />
        }
      >
        {(items) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-2.5">Hãng</TableHead>
                  <TableHead className="px-2.5">Thông tin kết nối</TableHead>
                  <TableHead className="px-2.5">Kiểm tra kết nối</TableHead>
                  <TableHead className="px-2.5">Cập nhật</TableHead>
                  <TableHead className="w-px px-2.5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.code} className="align-top">
                    <TableCell className="px-2.5 py-2">
                      <div className="font-semibold">{c.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.configured ? (
                          <StatusBadge tone="ok">Đủ cấu hình</StatusBadge>
                        ) : (
                          <StatusBadge tone="warn">Thiếu cấu hình</StatusBadge>
                        )}
                        {c.isActive ? null : <StatusBadge tone="neutral">Đang tắt</StatusBadge>}
                        {c.secretsUnreadable ? (
                          <StatusBadge tone="err">Token không đọc được</StatusBadge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-2.5 py-2">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        {c.fields.map((f) => (
                          <FieldRow key={f.key} field={f} />
                        ))}
                      </dl>
                    </TableCell>
                    <TableCell className="max-w-xs px-2.5 py-2 text-sm">
                      {c.lastVerifyError ? (
                        <span className="text-destructive">{c.lastVerifyError}</span>
                      ) : c.lastVerifiedAt ? (
                        <span>
                          <StatusBadge tone="ok">OK</StatusBadge>{' '}
                          <span className="text-muted-foreground">
                            {formatDateTime(c.lastVerifiedAt)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {c.canVerify ? 'Chưa kiểm tra' : 'Hãng chưa hỗ trợ kiểm tra'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-2.5 py-2 text-sm text-muted-foreground">
                      {c.updatedAt ? formatDateTime(c.updatedAt) : '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-2">
                      <Can I="config" a="Carrier">
                        <div className="flex items-center justify-end gap-1">
                          {c.canVerify ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={verifying !== null}
                              onClick={() => runVerify(c.code, c.name)}
                              aria-label={`Kiểm tra kết nối ${c.name}`}
                            >
                              <RefreshCw
                                className={verifying === c.code ? 'animate-spin' : undefined}
                                aria-hidden
                              />
                              Kiểm tra kết nối
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(c)}
                            aria-label={`Sửa kết nối ${c.name}`}
                          >
                            <Pencil aria-hidden />
                            Sửa
                          </Button>
                        </div>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      {editing ? (
        <CarrierSettingDialog
          setting={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={(code) => {
            const c = query.data?.find((x) => x.code === code);
            if (c?.canVerify) runVerify(code, c.name);
          }}
        />
      ) : null}
    </section>
  );
}

function FieldRow({ field: f }: { field: CarrierSettingField }) {
  const shown = f.secret ? f.hint : f.value;
  return (
    <>
      <dt className="text-muted-foreground">{f.label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        {shown ? (
          <>
            <span className="truncate font-mono" title={shown}>
              {shown}
            </span>
            {f.source ? (
              <StatusBadge tone={f.source === 'db' ? 'brand' : 'neutral'}>
                {SOURCE_LABEL[f.source]}
              </StatusBadge>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </>
  );
}
