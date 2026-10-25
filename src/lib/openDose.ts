import type { DoseEvent } from '@/api';

const ASKING = ['asked', 'retake_requested', 'reminded'];
/** 늦은 사진을 받는 시간: 예정 시각 후 6시간 (3.17, R-026 Q-009) */
const LATE_PHOTO_HOURS = 6;

/**
 * 물어보는 시간 안의 건 (R-022, R-026 Q-009). 홈의 E4 와 E4 직접 진입은 이 건만 연다.
 * 복약 시각이 된 scheduled 건도 인계 기한(handoff_at) 전이면 포함한다: 서버의 1분 예약 작업이 asked 로 바꾸기 전
 * (최대 1분, R-019)에 알림을 눌러도 E4 가 열리게
 */
export function isAsking(ev: DoseEvent, now = Date.now()): boolean {
  if (ASKING.includes(ev.state)) return true;
  return ev.state === 'scheduled' && now >= new Date(ev.scheduled_at).getTime() && now < new Date(ev.handoff_at).getTime();
}

/** E4 에서 사진을 받을 수 있는 건. 늦은 사진은 E8 에서만 연다 (R-026 Q-009) */
export function canTakePhoto(ev: DoseEvent): boolean {
  return isAsking(ev);
}

/** 어르신 홈이 E3 대신 E4 를 보여줄 건. 가장 이른 건부터 (R-022) */
export function firstOpenDose(items: DoseEvent[]): DoseEvent | undefined {
  return items.filter((e) => isAsking(e)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
}

/**
 * E8 "아직 기록이 없어요" 줄에서 늦은 사진을 올릴 수 있는 건 (R-026 Q-009, api.md 3.18).
 * 오늘 건은 사진 없이 무응답 인계된 건, 전날 건은 carried_over 인 건. 둘 다 예정 시각 후 6시간 안
 */
export function canSendLatePhoto(ev: DoseEvent, now = Date.now()): boolean {
  if (ev.elder_status === 'recorded') return false;
  if (now - new Date(ev.scheduled_at).getTime() > LATE_PHOTO_HOURS * 3_600_000) return false;
  // 어르신 응답에는 인계 사유가 없다. 사진 없이 인계된 건은 무응답 인계뿐이다 (다른 사유는 사진 판독에서 생김)
  const noResponse = ev.state === 'handed_off' && ev.photos.length === 0;
  if (ev.carried_over) return noResponse || ASKING.includes(ev.state);
  return noResponse;
}
