import { StyleSheet, Text, View } from 'react-native';

import type { Reading } from '@/api';
import { RemotePhoto } from '@/components/RemotePhoto';
import { attentionMark } from '@/lib/handoff';
import { guardian } from '@/theme';

/**
 * 판독 사진. 칸 위치(bbox)가 있는 칸만 사진 위에 강조한다 (api.md 3.21, R-012 3번).
 * bbox 가 없는 칸은 사진을 격자로 나누지 않는다 → 옆의 격자 그림(PillboxGrid)이 강조를 맡는다.
 */
export function PhotoWithBoxes({ reading, aspect }: { reading: Reading; aspect: number }) {
  const boxes = reading.cells.filter((c) => c.bbox && (c.attention || c.cell_id === reading.target_cell_id));
  const flaggedWithoutBox = reading.cells.some((c) => c.attention && !c.bbox);
  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.frame, { aspectRatio: aspect }]}>
        <RemotePhoto photo={reading.photo} style={StyleSheet.absoluteFill} />
        {boxes.map((c) => {
          const [x, y, w, h] = c.bbox!;
          const isTarget = c.cell_id === reading.target_cell_id;
          return (
            <View
              key={c.cell_id}
              pointerEvents="none"
              style={[
                styles.box,
                { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` },
                c.attention ? styles.flagged : isTarget && styles.target,
              ]}
            >
              {c.attention ? <Text style={styles.mark}>{attentionMark(c.attention)}</Text> : null}
            </View>
          );
        })}
      </View>
      {flaggedWithoutBox ? <Text style={styles.note}>사진에서 칸 위치를 알 수 없어서 아래 그림에 표시했어요.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E2632' },
  box: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  flagged: { borderWidth: 4, borderStyle: 'dashed', borderColor: '#FFB020' },
  target: { borderWidth: 3, borderColor: '#FFFFFF' },
  mark: { fontSize: 22, fontWeight: '900', color: '#FFB020', textShadowColor: '#000', textShadowRadius: 4 },
  note: { fontSize: 16, lineHeight: 23, color: guardian.color.sub },
});
