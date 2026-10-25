import type { DoseEvent } from '@/api';

const ASKING = ['asked', 'retake_requested', 'reminded'];

/** E4 에서 사진을 받을 수 있는 건 (3.18). 전날 건은 사진 없이 무응답 인계된 건도 받는다 (3.17, R-021 Q-007) */
export function canTakePhoto(ev: DoseEvent): boolean {
  if (ev.state === 'scheduled' || ASKING.includes(ev.state)) return true;
  return ev.carried_over && ev.state === 'handed_off' && ev.photos.length === 0;
}

/**
 * 어르신 홈이 E3 대신 E4 를 보여줄 열린 건 (R-022).
 * asked·retake_requested·reminded 인 건(전날 건 포함)과, 사진 없이 무응답 인계된 전날 건. 가장 이른 건부터
 */
export function firstOpenDose(items: DoseEvent[]): DoseEvent | undefined {
  return items
    .filter((e) => ASKING.includes(e.state) || (e.carried_over && canTakePhoto(e)))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
}
