import type { PillboxLayout } from '@/api';

/** 가이드 틀 비율. 칸 하나를 가로 0.8 : 세로 1 로 보고 열·행 수로 계산한다 */
export function pillboxAspect(layout: PillboxLayout | null | undefined): number {
  if (!layout) return 2;
  return Math.min(3, Math.max(0.8, (layout.cols * 0.8) / layout.rows));
}
