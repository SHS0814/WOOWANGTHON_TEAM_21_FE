import type { Attention, Handoff, HandoffReason, Verdict } from '@/api';

export const REASON_TITLE: Record<HandoffReason, string> = {
  no_response: '답이 없으셨어요',
  unclear: '사진 판독이 애매해요',
  unchanged: '약 칸이 그대로예요',
  double_suspected: '이중 복용이 의심돼요',
  refill_unconfirmed: '약통을 채우셨나요?',
  refill_overdue: '이번 약은 확인할 수 없어요',
};

/** 계약서에 아직 없는 사유가 와도 화면이 깨지지 않게 한다 (1.6) */
export function reasonTitle(reason: string): string {
  return REASON_TITLE[reason as HandoffReason] ?? '확인이 필요해요';
}

export function reasonDetail(h: Handoff, elder: string): string {
  const unchangedCount = h.readings.filter((r) => r.classification === 'unchanged').length;
  switch (h.reason as HandoffReason) {
    case 'no_response':
      return `${elder}께 ${h.dose_event.ask_times.length}번 여쭤봤는데 답이 없으셨어요.`;
    case 'unclear':
      return 'AI가 사진에서 이번 칸을 확실히 보지 못했어요. 사진을 보고 판정해 주세요.';
    case 'unchanged':
      return unchangedCount >= 2 ? '"약 드실 시간이에요"라고 한 번 안내했는데도 칸이 그대로예요.' : '이번 칸에 약이 그대로 있어요.';
    case 'double_suspected':
      return '아직 차 있어야 할 다른 칸도 비어 있어요.';
    case 'refill_unconfirmed':
      return '약통 칸이 모두 차 있는데 채운 기록이 없어요.';
    case 'refill_overdue':
      return '약통이 비어 있어 이번 약은 확인할 수 없어요. 약통을 채워 주세요.';
    default:
      return '';
  }
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  taken: '✓ 드심',
  not_taken: '✕ 안 드심',
  acknowledged: '확인했어요',
  refilled: '네, 채웠어요',
  not_refilled: '아니요',
};

export const ATTENTION_LABEL: Record<Attention, string> = {
  unclear: 'AI가 판단하지 못한 칸',
  low_confidence: 'AI가 확실하지 않은 칸',
  unexpected_empty: '차 있어야 하는데 비어 보이는 칸',
  unexpected_full: '비어 있어야 하는데 차 보이는 칸',
};

/** 강조 기호. ? = AI가 확실하지 않음, ! = 기대와 다름 */
export function attentionMark(a: Attention): string {
  return a === 'unclear' || a === 'low_confidence' ? '?' : '!';
}
