import type { DoseEvent, Summary, Verdict } from '@/api';
import type { IconName } from '@/components/guardian/Icon';
import { reasonTitle } from '@/lib/handoff';
import type { GuardianTone } from '@/theme';

/**
 * 보호자 화면의 복약 건 상태 칩 (G4 홈, G6 기록). 기존 기록 화면의 판단 순서를 그대로 쓴다.
 * 색만으로 구분하지 않도록 아이콘 모양과 글자가 함께 바뀐다
 */
/** 중복 복용 판정으로 닫힌 다음 건: 인계 없이 보호자가 acknowledged 로 닫은 건 (서버 _close_pre_emptied) */
export function isSkippedByDouble(ev: DoseEvent): boolean {
  return ev.outcome === 'acknowledged' && ev.outcome_source === 'guardian' && !ev.handoff;
}

export function doseStatus(ev: DoseEvent): { tone: GuardianTone; label: string; icon: IconName } {
  if (isSkippedByDouble(ev)) return { tone: 'neutral', label: '건너뜀', icon: 'minus' };
  if (ev.outcome && ev.outcome_source === 'guardian') return VERDICT_CHIP[ev.outcome];
  if (ev.outcome === 'taken') return { tone: 'ok', label: '정상 복용', icon: 'checkCircle' };
  if (ev.handoff) return { tone: 'warn', label: reasonTitle(ev.handoff.reason), icon: 'alert' };
  if (ev.state === 'scheduled') return { tone: 'neutral', label: '예정', icon: 'clock' };
  return { tone: 'info', label: '진행 중', icon: 'refresh' };
}

/**
 * 보호자 판정 결과. 세 가지로 통일한다 (사용자 결정 2026-11-14): 정상 복용 · 중복 복용 · 미복용.
 * 저장 값 acknowledged 가 '중복 복용'이다 (예전 '확인했어요'). 색: 정상 초록, 중복 빨강, 미복용 주황
 */
export const VERDICT_CHIP: Record<Verdict, { tone: GuardianTone; label: string; icon: IconName }> = {
  taken: { tone: 'ok', label: '정상 복용', icon: 'checkCircle' },
  not_taken: { tone: 'warn', label: '미복용', icon: 'xCircle' },
  acknowledged: { tone: 'danger', label: '중복 복용', icon: 'alert' },
  refilled: { tone: 'ok', label: '네, 채웠어요', icon: 'checkCircle' },
  not_refilled: { tone: 'neutral', label: '아니요', icon: 'x' },
};

export function takenCount(s: Summary) {
  return s.counts.taken_ai + s.counts.taken_guardian;
}
