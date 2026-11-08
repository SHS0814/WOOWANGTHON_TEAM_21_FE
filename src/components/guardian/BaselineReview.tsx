import { useState } from 'react';
import { View } from 'react-native';

import { api, guardianMessage, type Layout, type Refill } from '@/api';
import { PillboxGrid } from '@/components/guardian/PillboxGrid';
import { Card, ErrorText, GButton, GJudgeBadge, GScreen, GText, IconBubble } from '@/components/guardian/ui';
import { guardian } from '@/theme';

/**
 * 기준선 확인 (api.md 3.15 needs_review, 3.16). AI가 확실하지 않다고 본 칸을 보호자가 직접 고른다.
 * 보호자는 약통 앞에 있으므로 "차 있어요 / 비어 있어요"로 바로 답할 수 있다 (backend 5.1).
 * 저장 버튼은 화면 아래에 고정한다
 */
export function BaselineReviewScreen({ refill, layout, onDone }: { refill: Refill; layout: Layout; onDone: () => void }) {
  const state = useBaselineReview(refill, onDone);
  return (
    <GScreen footer={state.footer}>
      <BaselineReview refill={refill} layout={layout} state={state} />
    </GScreen>
  );
}

function useBaselineReview(refill: Refill, onDone: () => void) {
  const flagged = refill.baseline_reading.cells.filter((c) => c.attention);
  const [answers, setAnswers] = useState<Record<string, 'full' | 'empty'>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    try {
      await api.updateBaseline(
        refill.id,
        Object.entries(answers).map(([cell_id, state]) => ({ cell_id, state })),
      );
      onDone();
    } catch (e) {
      setError(guardianMessage(e));
      setBusy(false);
    }
  };

  const footer = <GButton label="확인 끝" icon="check" busy={busy} disabled={flagged.some((c) => !answers[c.cell_id])} onPress={save} />;
  return { flagged, answers, setAnswers, error, footer };
}

function BaselineReview({ refill, layout, state }: { refill: Refill; layout: Layout; state: ReturnType<typeof useBaselineReview> }) {
  const { flagged, answers, setAnswers, error } = state;
  const name = (cellId: string) => {
    const cell = layout.cells.find((c) => c.id === cellId);
    return cell ? `${layout.col_labels[cell.col] ?? ''} ${layout.row_labels[cell.row] ?? ''}`.trim() : cellId;
  };

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconBubble name="help" tone="warn" />
          <View style={{ flex: 1 }}>
            <GText variant="title">AI가 확실히 못 본 칸이 있어요</GText>
          </View>
        </View>
        <GText>약통을 보고 칸마다 알려주세요.</GText>
        <GJudgeBadge kind="ai" isMock={refill.baseline_reading.is_mock} />
        <PillboxGrid layout={layout} cells={refill.baseline_reading.cells} />
      </Card>
      {flagged.map((c) => (
        <Card key={c.cell_id}>
          <GText variant="section">{name(c.cell_id)} 칸</GText>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['full', 'empty'] as const).map((st) => {
              const on = answers[c.cell_id] === st;
              return (
                <View key={st} style={{ flex: 1 }}>
                  <GButton
                    variant="secondary"
                    selected={on}
                    icon={on ? 'check' : st === 'full' ? 'dot' : 'minus'}
                    iconColor={on ? guardian.color.primary : undefined}
                    label={st === 'full' ? '차 있어요' : '비어 있어요'}
                    accessibilityLabel={`${name(c.cell_id)} 칸 ${st === 'full' ? '차 있어요' : '비어 있어요'}${on ? ', 골랐음' : ''}`}
                    onPress={() => setAnswers((a) => ({ ...a, [c.cell_id]: st }))}
                  />
                </View>
              );
            })}
          </View>
        </Card>
      ))}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </>
  );
}
