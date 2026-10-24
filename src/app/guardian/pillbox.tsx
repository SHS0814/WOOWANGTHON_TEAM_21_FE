import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { api, guardianMessage, type DetectResponse, type Layout, type Refill } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { BaselineReview } from '@/components/BaselineReview';
import { BigButton } from '@/components/BigButton';
import { PillboxCamera } from '@/components/PillboxCamera';
import { PillboxGrid } from '@/components/PillboxGrid';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { colors } from '@/theme';

// 줄 수에 따른 시간대 이름. 보호자가 줄 수를 고치면 이 이름을 쓴다
const ROW_PRESETS: Record<number, string[]> = {
  1: ['하루'],
  2: ['아침', '저녁'],
  3: ['아침', '점심', '저녁'],
  4: ['아침', '점심', '저녁', '취침'],
};

function withRows(layout: Layout, rows: number): Layout {
  const cells = [];
  for (let c = 0; c < layout.cols; c++) for (let r = 0; r < rows; r++) cells.push({ id: `r${r}c${c}`, row: r, col: c });
  return { rows, cols: layout.cols, row_labels: ROW_PRESETS[rows], col_labels: layout.col_labels, cells };
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

  const toSchedule = () => router.replace('/guardian/schedule');

  if (step === 'shoot') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PillboxCamera
          size="guardian"
          instruction="약을 채운 약통을 찍어주세요"
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
      <Screen center>
        <Stack.Screen options={{ headerShown: true }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <T variant="title" style={{ textAlign: 'center' }}>
          {step === 'detecting' ? '약통 칸을 살펴보고 있어요' : '약통을 등록하고 있어요'}
        </T>
      </Screen>
    );
  }

  if (step === 'review' && refill && layout) {
    return (
      <Screen scroll>
        <Stack.Screen options={{ headerShown: true }} />
        <BaselineReview refill={refill} layout={layout} onDone={toSchedule} />
      </Screen>
    );
  }

  if (!detected || !layout) {
    return (
      <Screen center footer={<BigButton size="guardian" label="다시 찍기" onPress={() => setStep('shoot')} />}>
        <Stack.Screen options={{ headerShown: true }} />
        <T variant="title">{error || '사진을 읽지 못했어요.'}</T>
      </Screen>
    );
  }

  const save = async () => {
    setStep('saving');
    setError('');
    try {
      const res = await api.createPillbox({ photo_id: detected.photo.id, layout });
      if (res.refill.needs_review) {
        setRefill(res.refill);
        setStep('review');
      } else toSchedule();
    } catch (e) {
      setError(guardianMessage(e));
      setStep('confirm');
    }
  };

  return (
    <Screen scroll footer={<BigButton size="guardian" label="이대로 등록" onPress={save} />}>
      <Stack.Screen options={{ headerShown: true }} />
      <JudgeBadge kind="ai" isMock={detected.is_mock} />
      <T variant="title">
        {layout.rows}줄 × {layout.cols}칸으로 봤어요
      </T>
      <T style={detected.proposal.uncertain ? { color: colors.attention, fontWeight: '700' } : undefined}>
        {detected.proposal.uncertain ? '! AI가 구조를 확신하지 못했어요. 구조를 직접 확인해 주세요.' : '맞는지 확인해 주세요.'}
      </T>
      <PillboxGrid layout={layout} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <BigButton size="guardian" variant="secondary" label="줄 빼기" disabled={layout.rows <= 1} onPress={() => setLayout(withRows(layout, layout.rows - 1))} />
        </View>
        <View style={{ flex: 1 }}>
          <BigButton size="guardian" variant="secondary" label="줄 더하기" disabled={layout.rows >= 4} onPress={() => setLayout(withRows(layout, layout.rows + 1))} />
        </View>
      </View>
      <BigButton size="guardian" variant="secondary" label="다시 찍기" onPress={() => setStep('shoot')} />
      {error ? <T style={{ color: colors.attention }}>{error}</T> : null}
    </Screen>
  );
}
