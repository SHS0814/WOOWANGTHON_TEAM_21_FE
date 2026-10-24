// 이 기기에서 고른 "다음 사진 1장" 모의 판독 시나리오 (api.md 3.28).
// 서버는 지금 값을 돌려주는 GET 이 없으므로, 고른 값을 여기 기억해서 띠와 개발 도구에 보여준다.
// 사진을 한 번 올리면 서버에서 사라지므로 여기서도 지운다.
import type { MockScenario } from '@/api';

let pending: MockScenario | null = null;
const listeners = new Set<() => void>();

export const SCENARIO_LABELS: Record<MockScenario, string> = {
  normal: '정상',
  unclear: '애매',
  unchanged: '칸 그대로',
  double_suspected: '이중 의심',
};

export function pendingScenario() {
  return pending;
}

export function setPendingScenario(s: MockScenario | null) {
  pending = s;
  listeners.forEach((l) => l());
}

export function onPendingScenario(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
