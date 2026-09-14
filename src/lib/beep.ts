/**
 * Tiếng bíp cho máy quét (trạm đóng gói / màn pick): người đứng cách màn hình một sải tay
 * cần nghe được "đúng" hay "sai" mà không nhìn. Web Audio thuần, không file âm thanh.
 * Trình duyệt chặn / jsdom không có AudioContext → im lặng, không ném.
 */
type BeepKind = 'ok' | 'error';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function beep(kind: BeepKind): void {
  const ac = audio();
  if (!ac) return;
  try {
    const tone = (freq: number, at: number, dur: number) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(at);
      osc.stop(at + dur);
    };
    const now = ac.currentTime;
    if (kind === 'ok') tone(1760, now, 0.08);
    else {
      tone(330, now, 0.18);
      tone(330, now + 0.22, 0.18);
    }
  } catch {
    // không có loa / bị chặn — bỏ qua
  }
}
