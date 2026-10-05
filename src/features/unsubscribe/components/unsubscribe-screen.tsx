'use client';

import { CheckCircle2, Clock, LinkIcon, MailX } from 'lucide-react';
import type { ReactNode } from 'react';
import { TraceId } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api/errors';
import { messageFor, messageForCode } from '@/lib/error-messages';
import type { ConsentChannelValue } from '@/lib/shared';
import {
  useConfirmUnsubscribe,
  usePublicUnsubscribe,
  type PublicUnsubscribe,
} from '../api/use-public-unsubscribe';

/**
 * Trang công khai /unsubscribe/[token] (CRM-13) — khách bấm link trong tin marketing.
 * Ngoài layout đăng nhập: không app shell, không nav, không dùng client có phiên nhân viên.
 * Hiện tên đã che + kênh + trạng thái; "Hủy nhận tin" → POST (idempotent) → xác nhận.
 * 404 = link sai / bị sửa; 429 = bấm quá nhanh (API rate limit theo IP).
 */
const CHANNEL_PHRASE: Record<ConsentChannelValue, string> = {
  EMAIL: 'email',
  SMS: 'tin nhắn SMS',
  ZALO: 'Zalo',
  PHONE_CALL: 'cuộc gọi',
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-muted px-4 py-10 sm:items-center">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">{children}</div>
    </main>
  );
}

function Loading() {
  return (
    <div role="status" aria-label="Đang tải" className="flex flex-col gap-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-2 h-10 w-full" />
    </div>
  );
}

function Message({
  icon,
  title,
  children,
  tone = 'neutral',
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  tone?: 'neutral' | 'ok' | 'err';
}) {
  const color =
    tone === 'ok' ? 'text-success' : tone === 'err' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className={color}>{icon}</span>
      <h1 className="text-lg font-semibold">{title}</h1>
      {children}
    </div>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isApiError(error) && error.isNotFound) {
    return (
      <Message
        tone="err"
        icon={<LinkIcon className="h-8 w-8" aria-hidden />}
        title="Link không hợp lệ"
      >
        <p className="text-sm text-muted-foreground">
          {messageForCode('UNSUBSCRIBE_LINK_INVALID', 404)}
        </p>
      </Message>
    );
  }
  const traceId = isApiError(error) ? error.traceId : undefined;
  const limited = isApiError(error) && error.status === 429;
  return (
    <Message
      tone="err"
      icon={
        limited ? (
          <Clock className="h-8 w-8" aria-hidden />
        ) : (
          <MailX className="h-8 w-8" aria-hidden />
        )
      }
      title={limited ? 'Thử lại sau ít phút' : 'Chưa tải được thông tin'}
    >
      <p role="alert" className="text-sm text-muted-foreground">
        {messageFor(error)}
      </p>
      {traceId && !limited ? <TraceId value={traceId} /> : null}
      <Button variant="outline" onClick={onRetry}>
        Thử lại
      </Button>
    </Message>
  );
}

function Done({ channel }: { channel: ConsentChannelValue }) {
  return (
    <Message
      tone="ok"
      icon={<CheckCircle2 className="h-8 w-8" aria-hidden />}
      title={`Bạn đã hủy nhận tin qua ${CHANNEL_PHRASE[channel]}`}
    >
      <p className="text-sm text-muted-foreground">
        Chúng tôi sẽ không gửi tin khuyến mãi qua {CHANNEL_PHRASE[channel]} cho bạn nữa. Tin về đơn
        hàng của bạn (giao hàng, thanh toán) vẫn được gửi bình thường.
      </p>
    </Message>
  );
}

function Ready({ token, info }: { token: string; info: PublicUnsubscribe }) {
  const confirm = useConfirmUnsubscribe(token);
  const phrase = CHANNEL_PHRASE[info.channel];

  if (confirm.data) return <Done channel={confirm.data.channel} />;
  if (isApiError(confirm.error) && confirm.error.isNotFound) {
    return <LoadError error={confirm.error} onRetry={() => confirm.reset()} />;
  }
  if (info.currentlyGranted === false) return <Done channel={info.channel} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Hủy nhận tin qua {phrase}</h1>
        <p className="text-sm text-muted-foreground">
          Khách hàng: <span className="font-medium text-foreground">{info.customerName}</span>
        </p>
      </div>
      <p className="text-sm">
        {info.currentlyGranted
          ? `Bạn đang nhận tin khuyến mãi qua ${phrase}. Bấm “Hủy nhận tin” để dừng nhận.`
          : `Bạn chưa đăng ký nhận tin khuyến mãi qua ${phrase}. Bấm “Hủy nhận tin” để ghi nhận bạn không muốn nhận.`}
      </p>
      {confirm.error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {messageFor(confirm.error)}
        </p>
      ) : null}
      <Button
        size="lg"
        className="w-full"
        onClick={() => confirm.mutate()}
        disabled={confirm.isPending}
      >
        {confirm.isPending ? 'Đang hủy…' : 'Hủy nhận tin'}
      </Button>
    </div>
  );
}

export function UnsubscribeScreen({ token }: { token: string }) {
  const query = usePublicUnsubscribe(token);
  return (
    <Shell>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Ready token={token} info={query.data} />
      )}
    </Shell>
  );
}
