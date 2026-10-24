import { Image, StyleSheet, Text, View } from 'react-native';

import type { CellReading, PillboxLayout } from '@/api';
import { colors } from '@/theme';

interface Props {
  uri: string | null;
  layout: PillboxLayout;
  readings?: CellReading[];
  flaggedCellIds?: string[];
  aspect: number;
}

/**
 * 사진 위에 "AI가 확실하지 않다고 본 칸"과 확인할 칸을 강조한다 (R-008 C5).
 * 촬영 화면의 가이드 틀에 약통을 맞춰 찍는다고 보고, 사진 전체를 약통 격자로 나눠서 표시한다.
 * 실제 AI가 칸 위치(bbox)를 돌려주게 되면 그 좌표로 바꾼다.
 */
export function PhotoWithGrid({ uri, layout, readings, flaggedCellIds = [], aspect }: Props) {
  const byId = new Map(readings?.map((r) => [r.cell_id, r]));
  return (
    <View style={[styles.frame, { aspectRatio: aspect }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="약통 사진" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noPhoto]}>
          <Text style={styles.noPhotoText}>사진 없음 (모의 촬영)</Text>
        </View>
      )}
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: layout.rows }).map((_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: layout.cols }).map((__, c) => {
              const cell = layout.cells.find((x) => x.row === r && x.col === c);
              const flagged = !!cell && (flaggedCellIds.includes(cell.id) || byId.get(cell.id)?.state === 'unclear');
              return (
                <View key={c} style={[styles.cell, flagged && styles.flagged]}>
                  {flagged ? <Text style={styles.mark}>?</Text> : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#222' },
  noPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDD' },
  noPhotoText: { fontSize: 18, color: colors.text },
  row: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.5)' },
  flagged: { borderWidth: 4, borderStyle: 'dashed', borderColor: '#FFB020', alignItems: 'center', justifyContent: 'center' },
  mark: { fontSize: 22, fontWeight: '900', color: '#FFB020', textShadowColor: '#000', textShadowRadius: 4 },
});
