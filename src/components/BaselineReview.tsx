import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, guardianMessage, type Layout, type Refill } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { BigButton } from '@/components/BigButton';
import { PillboxGrid } from '@/components/PillboxGrid';
import { T } from '@/components/Text';
import { colors } from '@/theme';

/**
 * 기준선 확인 (api.md 3.15 needs_review, 3.16). AI가 확실하지 않다고 본 칸을 보호자가 직접 고른다.
 * 보호자는 약통 앞에 있으므로 "차 있어요 / 비어 있어요"로 바로 답할 수 있다 (backend 5.1)
 */
export function BaselineReview({ refill, layout, onDone }: { refill: Refill; layout: Layout; onDone: () => void }) {
  const flagged = refill.baseline_reading.cells.filter((c) => c.attention);
  const [answers, setAnswers] = useState<Record<string, 'full' | 'empty'>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const name = (cellId: string) => {
    const cell = layout.cells.find((c) => c.id === cellId);
    return cell ? `${layout.col_labels[cell.col] ?? ''} ${layout.row_labels[cell.row] ?? ''}`.trim() : cellId;
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.updateBaseline(refill.id, Object.entries(answers).map(([cell_id, state]) => ({ cell_id, state })));
      onDone();
    } catch (e) {
      setError(guardianMessage(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <JudgeBadge kind="ai" isMock={refill.baseline_reading.is_mock} />
      <T variant="title">AI가 확실히 못 본 칸이 있어요</T>
      <T>약통을 보고 칸마다 알려주세요.</T>
      <PillboxGrid layout={layout} cells={refill.baseline_reading.cells} />
      {flagged.map((c) => (
        <View key={c.cell_id} style={styles.item}>
          <T style={{ fontWeight: '700' }}>{name(c.cell_id)} 칸</T>
          <View style={styles.pair}>
            {(['full', 'empty'] as const).map((st) => (
              <View key={st} style={{ flex: 1 }}>
                <BigButton
                  size="guardian"
                  variant={answers[c.cell_id] === st ? 'primary' : 'secondary'}
                  label={`${answers[c.cell_id] === st ? '✓ ' : ''}${st === 'full' ? '차 있어요' : '비어 있어요'}`}
                  onPress={() => setAnswers({ ...answers, [c.cell_id]: st })}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      {error ? <T style={{ color: colors.attention }}>{error}</T> : null}
      <BigButton size="guardian" label="확인 끝" busy={busy} disabled={flagged.some((c) => !answers[c.cell_id])} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: 8, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 },
  pair: { flexDirection: 'row', gap: 12 },
});
