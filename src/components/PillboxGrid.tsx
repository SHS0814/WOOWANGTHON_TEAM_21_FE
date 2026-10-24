import { StyleSheet, Text, View } from 'react-native';

import type { CellResult, CellState, Layout } from '@/api';
import { ATTENTION_LABEL, attentionMark } from '@/lib/handoff';
import { colors } from '@/theme';

// 색만으로 구분하지 않도록 칸마다 기호를 쓴다
export const CELL_SYMBOL: Record<CellState, string> = { empty: '○', full: '●', unclear: '?' };
export const CELL_LABEL: Record<CellState, string> = { empty: '빈 칸', full: '찬 칸', unclear: 'AI가 판단하지 못한 칸' };

interface Props {
  layout: Layout;
  cells?: CellResult[];
  targetCellId?: string | null;
}

/**
 * 약통 칸 배열을 그린 그림과 판독 결과 (G2, G5, G7).
 * attention 이 있는 칸은 점선과 기호로 강조한다. 원본 신뢰도 숫자는 없다 (R-008 C5)
 */
export function PillboxGrid({ layout, cells, targetCellId }: Props) {
  const byId = new Map(cells?.map((c) => [c.cell_id, c]));
  const hasAttention = !!cells?.some((c) => c.attention);
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowLabel} />
        {layout.col_labels.map((c, i) => (
          <Text key={i} style={styles.colLabel}>
            {c}
          </Text>
        ))}
      </View>
      {Array.from({ length: layout.rows }).map((_, r) => (
        <View key={r} style={styles.row}>
          <Text style={[styles.rowLabel, styles.rowLabelText]}>{layout.row_labels[r]}</Text>
          {Array.from({ length: layout.cols }).map((__, c) => {
            const cell = layout.cells.find((x) => x.row === r && x.col === c);
            const res = cell ? byId.get(cell.id) : undefined;
            const isTarget = !!cell && cell.id === targetCellId;
            const att = res?.attention ?? null;
            const label = [
              `${layout.col_labels[c] ?? ''} ${layout.row_labels[r] ?? ''}`,
              isTarget && '이번 칸',
              res && CELL_LABEL[res.ai_state],
              att && ATTENTION_LABEL[att],
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <View key={c} accessible accessibilityLabel={label} style={[styles.cell, att && styles.flagged, isTarget && styles.target]}>
                <Text style={styles.symbol}>{res ? CELL_SYMBOL[res.ai_state] : ''}</Text>
                {att ? <Text style={styles.mark}>{attentionMark(att)}</Text> : null}
                {isTarget ? <Text style={styles.tag}>이번</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
      {cells ? (
        <Text style={styles.legend}>
          ○ 빈 칸 · ● 찬 칸 · ? AI가 판단 못 함{targetCellId ? ' · 굵은 테두리 = 이번 칸' : ''}
          {hasAttention ? ' · 점선 = 확인할 칸 (? 확실하지 않음, ! 기대와 다름)' : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowLabel: { width: 52, justifyContent: 'center' },
  rowLabelText: { fontSize: 16, fontWeight: '700', color: colors.text, paddingTop: 14 },
  colLabel: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  cell: {
    flex: 1,
    aspectRatio: 0.8,
    margin: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  target: { borderWidth: 4, borderStyle: 'solid', borderColor: colors.primary },
  flagged: { borderWidth: 4, borderStyle: 'dashed', borderColor: colors.attention, backgroundColor: colors.attentionBg },
  symbol: { fontSize: 22, color: colors.text, fontWeight: '700' },
  mark: { fontSize: 16, fontWeight: '900', color: colors.attention },
  tag: { fontSize: 12, fontWeight: '700', color: colors.text },
  legend: { marginTop: 8, fontSize: 16, color: colors.subtle, lineHeight: 22 },
});
