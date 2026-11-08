import type { DoseEvent, Summary, Verdict } from '@/api';
import type { IconName } from '@/components/guardian/Icon';
import { reasonTitle } from '@/lib/handoff';
import type { GuardianTone } from '@/theme';

/**
 * 보호자 화면의 복약 건 상태 칩 (G4 홈, G6 기록). 기존 기록 화면의 판단 순서를 그대로 쓴다.
 * 색만으로 구분하지 않도록 아이콘 모양과 글자가 함께 바뀐다
 */
export function doseStatus(ev: DoseEvent): { tone: GuardianTone; label: string; icon: IconName } {
  if (ev.outcome && ev.outcome_source === 'guardian') return VERDICT_CHIP[ev.outcome];
  if (ev.outcome === 'taken') return { tone: 'ok', label: '정상', icon: 'checkCircle' };
  if (ev.handoff) return { tone: 'warn', label: reasonTitle(ev.handoff.reason), icon: 'alert' };
  if (ev.state === 'scheduled') return { tone: 'neutral', label: '예정', icon: 'clock' };
  return { tone: 'info', label: '진행 중', icon: 'refresh' };
}

/** 보호자 판정 결과. 글자는 lib/handoff VERDICT_LABEL 과 같고, 기호(✓ ✕) 대신 아이콘을 쓴다 */
export const VERDICT_CHIP: Record<Verdict, { tone: GuardianTone; label: string; icon: IconName }> = {
  taken: { tone: 'ok', label: '드심', icon: 'checkCircle' },
  not_taken: { tone: 'danger', label: '안 드심', icon: 'xCircle' },
  acknowledged: { tone: 'neutral', label: '확인했어요', icon: 'check' },
  refilled: { tone: 'ok', label: '네, 채웠어요', icon: 'checkCircle' },
  not_refilled: { tone: 'neutral', label: '아니요', icon: 'x' },
};

export function takenCount(s: Summary) {
  return s.counts.taken_ai + s.counts.taken_guardian;
}
