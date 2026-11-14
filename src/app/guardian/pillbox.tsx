import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api, guardianMessage, type DetectResponse, type Layout, type Refill } from '@/api';
import { BaselineReviewScreen } from '@/components/guardian/BaselineReview';
import { Icon } from '@/components/guardian/Icon';
import { PillboxGrid } from '@/components/guardian/PillboxGrid';
import { Section, ErrorText, GButton, GJudgeBadge, GScreen, GText, IconBubble, Notice } from '@/components/guardian/ui';
import { PillboxShot } from '@/components/guardian/PillboxShot';
import { SetupSteps } from '@/components/guardian/SetupSteps';
import { useMe } from '@/lib/useMe';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { DAILY_MAX_CELLS, dailyCellLabel, pillboxKind, suggestedTimesOfDay, TOD_ORDER } from '@/lib/slots';
import { TIME_OF_DAY_LABELS } from '@/lib/time';
import { guardian } from '@/theme';
import type { TimeOfDay } from '@/api';

const C = guardian.color;

// 줄 수에 따른 시간대 이름. 보호자가 줄 수를 고치면 이 이름을 쓴다
const ROW_PRESETS: Record<number, string[]> = { 1: ['하루'], 2: ['아침', '저녁'], 3: ['아침', '점심', '저녁'], 4: ['아침', '점심', '저녁', '취침'] };

function withRows(layout: Layout, rows: number): Layout {
  const cells = [];
  for (let c = 0; c < layout.cols; c++) for (let r = 0; r < rows; r++) cells.push({ id: `r${r}c${c}`, row: r, col: c });
  return { rows, cols: layout.cols, row_labels: ROW_PRESETS[rows], col_labels: layout.col_labels, cells };
}

// 하루 약통 칸 수에 따른 시간대 이름 (R-054)
const DAILY_PRESETS: Record<number, string[]> = { 1: ['아침'], 2: ['아침', '저녁'], 3: ['아침', '점심', '저녁'], 4: ['아침', '점심', '저녁', '자기 전'] };

/** 하루 약통의 칸 수를 고친다. 세로 한 줄이면 세로로, 아니면 가로 한 줄로 */
function withDailyCells(layout: Layout, n: number): Layout {
  const vertical = layout.cols === 1 && layout.rows > 1;
  const labels = DAILY_PRESETS[n];
  const cells = Array.from({ length: n }, (_, i) => (vertical ? { id: `r${i}c0`, row: i, col: 0 } : { id: `r0c${i}`, row: 0, col: i }));
  return vertical
    ? { rows: n, cols: 1, row_labels: labels, col_labels: ['하루'], cells }
    : { rows: 1, cols: n, row_labels: ['하루'], col_labels: labels, cells };
}

/** 하루 약통(한 줄) 칸의 시간대를 바꾼다. 칸 이름이 시간대가 되고, 이미 그 시간대인 칸과는 서로 바꾼다 */
function withDailyTod(layout: Layout, index: number, tod: TimeOfDay): Layout {
  const vertical = layout.cols === 1 && layout.rows > 1;
  const current = suggestedTimesOfDay(layout) ?? [];
  const next = [...current];
  const other = next.indexOf(tod);
  if (other >= 0) next[other] = current[index];
  next[index] = tod;
  const labels = next.map((t) => TIME_OF_DAY_LABELS[t]);
  return vertical ? { ...layout, row_labels: labels } : { ...layout, col_labels: labels };
}

type Step = 'shoot' | 'detecting' | 'confirm' | 'saving' | 'review';

/**
 * G2 약통 등록 (api.md 3.10 → 3.11 → 필요하면 3.16).
 * 약을 채운 약통 사진 1장 → AI가 칸 구조 제안 → 보호자가 확인하거나 고침 (원칙 4, R-008 C3).
 * 확정하면 서버가 같은 사진으로 첫 기준선을 만든다. 기존 일정은 지워지므로 바로 G3로 간다.
 */
export default function PillboxRegister() {
  const [step, setStep] = useState<Step>('shoot');
  const [detected, setDetected] = useState<DetectResponse | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [refill, setRefill] = useState<Refill | null>(null);
  const [error, setError] = useState('');

  // 처음 설정(약통이 아직 없음)일 때만 단계 표시를 보인다. 설정에서 다시 등록할 때는 보이지 않는다
  const { data: me } = useMe();
  const firstSetup = !!me && !me.family.has_pillbox;

  const toSchedule = () => router.replace('/guardian/schedule');

  if (step === 'shoot') {
    return (
      <>
        <Stack.Screen options={{ headerShown: true }} />
        <PillboxShot
          top={firstSetup ? <SetupSteps current={3} /> : undefined}
          allowSample
          title="약을 채운 약통을 찍어주세요"
          description="사진 한 장으로 AI가 칸 구조를 읽어요. 읽은 결과는 다음 화면에서 확인하고 고칠 수 있어요."
          aspect={pillboxAspect(layout)}
          onCapture={async (photo) => {
            setStep('detecting');
            setError('');
            try {
              const res = await api.detectPillbox(photo);
              setDetected(res);
              setLayout(res.proposal.layout);
              setStep('confirm');
            } catch (e) {
              setError(guardianMessage(e));
              setStep('confirm');
            }
          }}
        />
      </>
    );
  }

  if (step === 'detecting' || step === 'saving') {
    return (
      <GScreen center scroll={false}>
        <Stack.Screen options={{ headerShown: true }} />
        <View style={{ alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={C.primary} />
          <GText variant="title" style={{ textAlign: 'center' }}>
            {step === 'detecting' ? '약통 칸을 살펴보고 있어요' : '약통을 등록하고 있어요'}
          </GText>
        </View>
      </GScreen>
    );
  }

  if (step === 'review' && refill && layout) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true }} />
        <BaselineReviewScreen refill={refill} layout={layout} onDone={toSchedule} />
      </>
    );
  }

  if (!detected || !layout) {
    return (
      <GScreen center footer={<GButton label="다시 찍기" icon="camera" onPress={() => setStep('shoot')} />}>
        <Stack.Screen options={{ headerShown: true }} />
        <View style={{ alignItems: 'center', gap: 12 }}>
          <IconBubble name="image" tone="warn" size={56} />
          <GText variant="title" style={{ textAlign: 'center' }}>
            {error || '사진을 읽지 못했어요.'}
          </GText>
        </View>
      </GScreen>
    );
  }

  const save = async () => {
    setStep('saving');
    setError('');
    try {
      const res = await api.createPillbox({ photo_id: detected.photo.id, layout });
      // R-071: 하루 약통은 어르신이 매일 채우므로 마지막 칸 뒤 "약통을 채워 주세요" 안내를 켜고, 일주일 약통은 보호자가 채우므로 끈다
      // (재등록 포함, 설정 스위치로 다시 바꿀 수 있음). 약통 등록은 이미 끝났으므로 이 저장이 실패해도 등록 흐름은 막지 않는다
      await api.putSettings({ elder_refill_prompt: pillboxKind(layout) === 'daily' }).catch(() => null);
      if (res.refill.needs_review) {
        setRefill(res.refill);
        setStep('review');
      } else toSchedule();
    } catch (e) {
      setError(guardianMessage(e));
      setStep('confirm');
    }
  };

  const kind = pillboxKind(layout);
  const daily = kind === 'daily';
  // 칸 이름을 바꿀 수 있는 하루 약통 (한 줄). 격자(2×2)는 순서대로 시간대를 정하고 복약 시각 화면에서 고친다
  const dailyLine = daily && (layout.rows === 1 || layout.cols === 1);
  const dailyTods = daily ? suggestedTimesOfDay(layout) : null;
  const dailyCells = daily ? [...layout.cells].sort((a, b) => a.row - b.row || a.col - b.col) : [];

  return (
    <GScreen footer={<GButton label="이대로 등록" icon="check" disabled={!kind} onPress={save} />}>
      <Stack.Screen options={{ headerShown: true }} />
      <Section>
        <GJudgeBadge kind="ai" isMock={detected.is_mock} />
        <View>
          <GText variant="label" color={C.sub}>
            AI가 읽은 약통 구조
          </GText>
          <GText variant="title">{daily ? `하루 약통 · ${layout.cells.length}칸으로 봤어요` : `${layout.rows}줄 × ${layout.cols}칸으로 봤어요`}</GText>
        </View>
        {detected.proposal.uncertain ? (
          <Notice tone="warn" title="AI가 구조를 확신하지 못했어요.">
            구조를 직접 확인해 주세요.
          </Notice>
        ) : (
          <GText color={C.sub}>맞는지 확인해 주세요.</GText>
        )}
        <PillboxGrid layout={layout} />
        {daily ? (
          <Notice tone="info" icon="pillbox" title="하루 약통: 매일 드신 뒤 다시 채워요">
            요일 칸이 없어 칸마다 한 시간대를 월요일부터 일요일까지 매일 써요. 하루 약을 다 드신 뒤 약통을 채우고 사진을 찍어 기록해 주세요.
          </Notice>
        ) : !kind ? (
          <Notice tone="warn" title="칸을 요일·시간대로 이을 수 없어요.">
            요일 칸을 찾지 못했고 칸이 {DAILY_MAX_CELLS}개보다 많아요. 다시 찍거나 줄 수를 고쳐 주세요.
          </Notice>
        ) : null}
      </Section>
      {daily && dailyTods ? (
        <Section>
          <GText variant="section">칸마다 시간대</GText>
          <GText variant="sub" color={C.sub}>
            {dailyLine ? '칸 이름에서 읽었어요. 다르면 눌러서 고쳐 주세요.' : '칸 순서대로 정했어요. 복약 시각 화면에서 고칠 수 있어요.'}
          </GText>
          {dailyCells.map((cell, i) => (
            <View key={cell.id} style={{ gap: 6 }}>
              <GText variant="label" color={C.sub}>
                {i + 1}번째 칸{dailyCellLabel(layout, cell) ? ` (${dailyCellLabel(layout, cell)})` : ''}
              </GText>
              {dailyLine ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
                  {TOD_ORDER.map((t) => {
                    const on = dailyTods[i] === t;
                    return (
                      <Pressable
                        key={t}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on, checked: on }}
                        accessibilityLabel={`${i + 1}번째 칸 ${TIME_OF_DAY_LABELS[t]}`}
                        onPress={() => setLayout(withDailyTod(layout, i, t))}
                        style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && { backgroundColor: C.neutralSoft }]}
                      >
                        {on ? <Icon name="check" size={16} color={C.onPrimary} strokeWidth={3} /> : null}
                        <GText variant="label" color={on ? C.onPrimary : C.text}>
                          {TIME_OF_DAY_LABELS[t]}
                        </GText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <GText variant="bodyStrong">{TIME_OF_DAY_LABELS[dailyTods[i]]}</GText>
              )}
            </View>
          ))}
        </Section>
      ) : null}
      <Section>
        <GText variant="section">{daily ? '칸 수 고치기' : '줄 수 고치기'}</GText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            {daily ? (
              <GButton
                variant="secondary"
                icon="minus"
                label="칸 빼기"
                disabled={layout.cells.length <= 1}
                onPress={() => setLayout(withDailyCells(layout, layout.cells.length - 1))}
              />
            ) : (
              <GButton
                variant="secondary"
                icon="minus"
                label="줄 빼기"
                disabled={layout.rows <= 1}
                onPress={() => setLayout(withRows(layout, layout.rows - 1))}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            {daily ? (
              <GButton
                variant="secondary"
                icon="plus"
                label="칸 더하기"
                disabled={layout.cells.length >= DAILY_MAX_CELLS}
                onPress={() => setLayout(withDailyCells(layout, layout.cells.length + 1))}
              />
            ) : (
              <GButton
                variant="secondary"
                icon="plus"
                label="줄 더하기"
                disabled={layout.rows >= 4}
                onPress={() => setLayout(withRows(layout, layout.rows + 1))}
              />
            )}
          </View>
        </View>
        <GButton variant="ghost" icon="camera" label="다시 찍기" onPress={() => setStep('shoot')} />
      </Section>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </GScreen>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: guardian.radius.chip,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
});
