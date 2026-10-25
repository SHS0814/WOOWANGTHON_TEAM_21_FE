// 서울 시간(Asia/Seoul, UTC+9, 서머타임 없음) 기준 날짜 계산 (R-028 N22).
// 기기 시간대가 서울이 아니어도 복약 일정(서울 기준 "HH:MM", 요일)과 같은 순간을 가리키게 한다
const SEOUL_OFFSET_MS = 9 * 3_600_000;

export interface SeoulDay {
  y: number;
  /** 0 = 1월 */
  m: number;
  d: number;
  /** 월 = 0 ... 일 = 6 */
  weekday: number;
  key: string;
}

/** 지금부터 days 날 뒤의 서울 날짜 */
export function seoulDay(now: Date, days = 0): SeoulDay {
  const t = new Date(now.getTime() + SEOUL_OFFSET_MS + days * 86_400_000);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const d = t.getUTCDate();
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return { y, m, d, weekday: (t.getUTCDay() + 6) % 7, key: `${y}-${pad(m + 1)}-${pad(d)}` };
}

/** 서울 날짜의 "HH:MM" 이 가리키는 순간 */
export function seoulInstant(day: SeoulDay, hhmm: string): Date {
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(day.y, day.m, day.d, h, min) - SEOUL_OFFSET_MS);
}

/** 그 순간의 서울 시·분 */
export function seoulClock(d: Date): { h: number; min: number } {
  const t = new Date(d.getTime() + SEOUL_OFFSET_MS);
  return { h: t.getUTCHours(), min: t.getUTCMinutes() };
}

/** "YYYY-MM-DD"(서울 날짜) 의 월·일·요일. 기기 시간대로 해석하지 않는다 */
export function seoulDayOfKey(key: string): SeoulDay {
  const [y, m, d] = key.split('-').map(Number);
  return seoulDay(new Date(Date.UTC(y, m - 1, d, 12) - SEOUL_OFFSET_MS));
}
