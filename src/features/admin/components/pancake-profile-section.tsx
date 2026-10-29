'use client';

import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { FormSkeleton, QueryState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import type {
  PancakeProfile,
  PancakeProfileInput,
  PancakeProfileResult,
} from '../api/use-pancake-profile';

const shopLabel = (s: PancakeProfile['shops'][number]) => s.shopName ?? `POS ${s.shopId}`;
/** "Không tự điền" (Radix Select không nhận value rỗng). */
const NO_POS = '__none__';

/** fb_id Pancake là chuỗi số; khớp ràng buộc DTO phía API (chữ, số, -, _). */
const FB_ID = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Khối "Hồ sơ Pancake" (2026-10-18) — dùng ở màn chi tiết nhân viên (admin khai hộ) và màn
 * Tài khoản của tôi (tự khai). Lưu = thay toàn bộ fb_id + tên + POS (PUT …/pancake-profile).
 */
export function PancakeProfileSection({
  query,
  mutation,
  canEdit,
  self = false,
}: {
  query: UseQueryResult<PancakeProfile>;
  mutation: UseMutationResult<PancakeProfileResult, unknown, PancakeProfileInput>;
  canEdit: boolean;
  /** Màn của chính mình — đổi lời hướng dẫn. */
  self?: boolean;
}) {
  return (
    <section className="rounded-md border bg-card p-3" aria-labelledby="pancake-profile-title">
      <h2 id="pancake-profile-title" className="text-sm font-semibold">
        Hồ sơ Pancake
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Đơn Pancake do Facebook ID này chốt sẽ gán cho {self ? 'bạn' : 'nhân viên này'}. Có đơn về
        từ POS chưa chọn thì POS đó tự được thêm.
      </p>
      <QueryState query={query} skeleton={<FormSkeleton fields={3} />}>
        {(profile) => (
          // key: dữ liệu server đổi (lưu xong / người khác sửa) → form nạp lại giá trị mới.
          <ProfileForm
            key={`${profile.fbId ?? ''}|${profile.pancakeName ?? ''}|${profile.defaultPosShopId ?? ''}|${selectedOf(profile).join(',')}`}
            profile={profile}
            mutation={mutation}
            canEdit={canEdit}
          />
        )}
      </QueryState>
    </section>
  );
}

const selectedOf = (p: PancakeProfile) =>
  p.shops
    .filter((s) => s.selected)
    .map((s) => s.shopId)
    .sort();

function ProfileForm({
  profile,
  mutation,
  canEdit,
}: {
  profile: PancakeProfile;
  mutation: UseMutationResult<PancakeProfileResult, unknown, PancakeProfileInput>;
  canEdit: boolean;
}) {
  const [fbId, setFbId] = useState(profile.fbId ?? '');
  const [name, setName] = useState(profile.pancakeName ?? '');
  const [shopIds, setShopIds] = useState<string[]>(selectedOf(profile));
  const [defaultPos, setDefaultPos] = useState(profile.defaultPosShopId ?? '');

  const fb = fbId.trim();
  const fbInvalid = fb !== '' && !FB_ID.test(fb);
  const dirty =
    fb !== (profile.fbId ?? '') ||
    name.trim() !== (profile.pancakeName ?? '') ||
    [...shopIds].sort().join(',') !== selectedOf(profile).join(',') ||
    defaultPos !== (profile.defaultPosShopId ?? '');

  const save = () =>
    mutation.mutate(
      {
        fbId: fb || null,
        pancakeName: name.trim() || null,
        shopIds: fb ? shopIds : [],
        defaultPosShopId: defaultPos || null,
      },
      {
        onSuccess: (r) => {
          toast.success('Đã lưu thay đổi');
          for (const t of r.transferredFrom) {
            toast.success(`Đã chuyển đơn và POS từ tài khoản ${t.code} — tài khoản đó đã khóa`);
          }
        },
      },
    );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pancake-fb-id" className="text-xs text-muted-foreground">
            Facebook ID trên Pancake
          </Label>
          <Input
            id="pancake-fb-id"
            className="h-8 font-mono"
            inputMode="numeric"
            placeholder="vd 154057992263134"
            value={fbId}
            disabled={!canEdit}
            aria-invalid={fbInvalid}
            onChange={(e) => setFbId(e.target.value)}
          />
          {fbInvalid ? (
            <p className="text-xs text-destructive">Facebook ID chỉ gồm chữ số (hoặc chữ, -, _).</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Để trống cũng được nếu email tài khoản này trùng email trên Pancake — đơn về sẽ tự gán
              và điền Facebook ID.
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="pancake-name" className="text-xs text-muted-foreground">
            Tên trên Pancake
          </Label>
          <Input
            id="pancake-name"
            className="h-8"
            placeholder="vd Thanh Vân Sale - NLPN"
            maxLength={200}
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1 sm:max-w-sm">
        <Label htmlFor="pancake-default-pos" className="text-xs text-muted-foreground">
          POS lên đơn
        </Label>
        <Select
          value={defaultPos || NO_POS}
          onValueChange={(v) => setDefaultPos(v === NO_POS ? '' : v)}
          disabled={!canEdit}
        >
          <SelectTrigger id="pancake-default-pos" aria-label="POS lên đơn">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_POS}>— Không tự điền —</SelectItem>
            {profile.shops.map((s) => (
              <SelectItem key={s.shopId} value={s.shopId}>
                {shopLabel(s)}
                {s.isActive ? '' : ' (đã ngắt kết nối)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Màn Tạo đơn tự điền POS này (vẫn đổi được trên từng đơn).
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-xs text-muted-foreground">POS đang làm việc</legend>
        {profile.shops.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có POS Pancake nào kết nối — kết nối ở màn Kết nối Pancake.
          </p>
        ) : (
          profile.shops.map((s) => (
            <label key={s.shopId} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={shopIds.includes(s.shopId)}
                disabled={!canEdit || fb === ''}
                onCheckedChange={(v) =>
                  setShopIds((cur) =>
                    v === true ? [...cur, s.shopId] : cur.filter((x) => x !== s.shopId),
                  )
                }
                aria-label={shopLabel(s)}
              />
              <span>{shopLabel(s)}</span>
              <span className="font-mono text-xs text-muted-foreground">{s.shopId}</span>
              {s.isActive ? null : (
                <span className="text-xs text-muted-foreground">(đã ngắt kết nối)</span>
              )}
            </label>
          ))
        )}
        {fb === '' && canEdit ? (
          <p className="text-xs text-muted-foreground">Nhập Facebook ID trước rồi chọn POS.</p>
        ) : null}
      </fieldset>

      {profile.otherFbIds.length ? (
        <p className="text-xs text-muted-foreground">
          Facebook ID khác cũng đang gán về tài khoản này:{' '}
          <span className="font-mono">{profile.otherFbIds.join(', ')}</span> — đổi ở màn Kết nối
          Pancake.
        </p>
      ) : null}

      {mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {messageFor(mutation.error)}
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!dirty || fbInvalid || mutation.isPending} onClick={save}>
            {mutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
          {dirty ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => {
                setFbId(profile.fbId ?? '');
                setName(profile.pancakeName ?? '');
                setShopIds(selectedOf(profile));
                setDefaultPos(profile.defaultPosShopId ?? '');
                mutation.reset();
              }}
            >
              Hủy bỏ
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
