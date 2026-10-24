import { StyleSheet, Text, View } from 'react-native';

import type { CellReading, CellState, PillboxLayout } from '@/api';
import { colors } from '@/theme';

// 색만으로 구분하지 않도록 칸마다 기호를 쓴다
export const CELL_SYMBOL: Record<CellState, string> = { empty: '○', full: '●', unclear: '?' };
export const CELL_LABEL: Record<CellState, string> = { empty: '빈 칸', full: '찬 칸', unclear: 'AI가 확실하지 않은 칸' };

interface Props {
  layout: PillboxLayout;
  readings?: CellReading[];
  targetCellId?: string;
  /** 기대와 다른 칸 (이중 의심 등) */
  flaggedCellIds?: string[];
}

/** 약통 칸 배열과 판독 결과. 원본 신뢰도 숫자는 보여주지 않는다 (R-008 C5) */
export function PillboxGrid({ layout, readings, targetCellId, flaggedCellIds = [] }: Props) {
  const byId = new Map(readings?.map((r) => [r.cell_id, r]));
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowLabel} />
        {layout.col_labels.map((c) => (
          <Text key={c} style={styles.colLabel}>
            {c}
          </Text>
        ))}
      </View>
      {Array.from({ length: layout.rows }).map((_, r) => (
        <View key={r} style={styles.row}>
          <Text style={[styles.rowLabel, styles.rowLabelText]}>{layout.row_labels[r]}</Text>
          {Array.from({ length: layout.cols }).map((__, c) => {
            const cell = layout.cells.find((x) => x.row === r && x.col === c);
            const reading = cell ? byId.get(cell.id) : undefined;
            const isTarget = cell?.id === targetCellId;
            const flagged = !!cell && (flaggedCellIds.includes(cell.id) || reading?.state === 'unclear');
            const label = `${layout.col_labels[c]} ${layout.row_labels[r]}${isTarget ? ', 이번 칸' : ''}${
              reading ? `, ${CELL_LABEL[reading.state]}` : ''
            }${flagged ? ', 확인 필요' : ''}`;
            return (
              <View
                key={c}
                accessible
                accessibilityLabel={label}
                style={[styles.cell, isTarget && styles.target, flagged && styles.flagged]}
              >
                <Text style={styles.symbol}>{reading ? CELL_SYMBOL[reading.state] : ''}</Text>
                {isTarget ? <Text style={styles.tag}>이번</Text> : flagged ? <Text style={styles.tag}>확인</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
      {readings ? (
        <Text style={styles.legend}>
          ○ 빈 칸 · ● 찬 칸 · ? AI가 확실하지 않은 칸 · 굵은 테두리 = 이번 칸 · 점선 = 확인 필요
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowLabel: { width: 52, justifyContent: 'center' },
  rowLabelText: { fontSize: 16, fontWeight: '700', color: colors.text, textAlignVertical: 'center', paddingTop: 14 },
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
  target: { borderWidth: 4, borderColor: colors.primary },
  flagged: { borderWidth: 4, borderStyle: 'dashed', borderColor: colors.attention, backgroundColor: colors.attentionBg },
  symbol: { fontSize: 22, color: colors.text, fontWeight: '700' },
  tag: { fontSize: 12, fontWeight: '700', color: colors.text },
  legend: { marginTop: 8, fontSize: 16, color: colors.subtle, lineHeight: 22 },
});
