import type { Layout } from '@/api';

/** 가이드 틀 비율. 칸 하나를 가로 0.8 : 세로 1 로 보고 열·행 수로 계산한다 */
export function pillboxAspect(layout: Layout | null | undefined): number {
  if (!layout) return 2;
  return Math.min(3, Math.max(0.8, (layout.cols * 0.8) / layout.rows));
}

/** 어르신 폰은 약통 구조(보호자 API)를 못 받으므로, 일정의 칸 id "r{행}c{열}" 로 행·열 수를 짐작한다 (1.4) */
export function aspectFromCellIds(cellIds: string[]): number {
  let rows = 0;
  let cols = 0;
  for (const id of cellIds) {
    const m = /^r(\d+)c(\d+)$/.exec(id);
    if (!m) continue;
    rows = Math.max(rows, Number(m[1]) + 1);
    cols = Math.max(cols, Number(m[2]) + 1);
  }
  if (!rows || !cols) return 2;
  return Math.min(3, Math.max(0.8, (cols * 0.8) / rows));
}
