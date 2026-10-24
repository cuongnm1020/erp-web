import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { TraceId } from '@/components/data/states';
import { cn } from '@/lib/cn';

export interface PdaFeedback {
  kind: 'ok' | 'info' | 'warn' | 'error';
  text: string;
  detail?: string;
  traceId?: string;
}

/** Dải phản hồi sau mỗi lần quét trên các màn PDA web (cất hàng, tra / chuyển vị trí). */
export function PdaFeedbackBanner({ feedback }: { feedback: PdaFeedback }) {
  const Icon =
    feedback.kind === 'error'
      ? CircleAlert
      : feedback.kind === 'warn'
        ? TriangleAlert
        : feedback.kind === 'info'
          ? Info
          : CheckCircle2;
  return (
    <div
      role={feedback.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-3',
        feedback.kind === 'error' && 'border-destructive-line bg-destructive-weak text-destructive',
        feedback.kind === 'warn' && 'border-warning-line bg-warning-weak text-warning',
        feedback.kind === 'ok' && 'border-success-line bg-success-weak text-success',
        feedback.kind === 'info' && 'border-info-line bg-info-weak text-info',
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">{feedback.text}</p>
        {feedback.detail ? <p className="text-sm text-foreground">{feedback.detail}</p> : null}
        {feedback.traceId ? <TraceId value={feedback.traceId} /> : null}
      </div>
    </div>
  );
}
