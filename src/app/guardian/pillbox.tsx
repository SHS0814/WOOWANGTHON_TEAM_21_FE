import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { api, type PillboxLayout } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { BigButton } from '@/components/BigButton';
import { PillboxCamera } from '@/components/PillboxCamera';
import { PillboxGrid } from '@/components/PillboxGrid';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { WEEKDAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { colors } from '@/theme';

// 줄 수에 따른 시간대 이름. 보호자가 줄 수를 고치면 이 이름을 쓴다
const ROW_PRESETS: Record<number, string[]> = {
  1: ['하루'],
  2: ['아침', '저녁'],
  3: ['아침', '점심', '저녁'],
  4: ['아침', '점심', '저녁', '취침'],
};

function withRows(layout: PillboxLayout, rows: number): PillboxLayout {
  const cols = layout.cols;
  const cells = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) cells.push({ id: `r${r}c${c}`, row: r, col: c });
  return { rows, cols, row_labels: ROW_PRESETS[rows], col_labels: WEEKDAY_LABELS.slice(0, cols), cells };
}

/**
 * G2 약통 등록. 약을 채운 약통 사진 1장 → AI가 칸 구조 제안 → 보호자가 확인하거나 고침 (원칙 4, R-008 C3).
 * 이 사진이 기대 상태의 기준선이 된다.
 */
export default function PillboxRegister() {
  const { data: current } = useApiData(() => api.getPillbox());
  const [step, setStep] = useState<'shoot' | 'detecting' | 'confirm'>('shoot');
  const [photo, setPhoto] = useState<string | null>(null);
  const [layout, setLayout] = useState<PillboxLayout | null>(null);
  const [isMock, setIsMock] = useState(true);
  const [busy, setBusy] = useState(false);

  if (step === 'shoot') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PillboxCamera
          size="guardian"
          instruction="약을 채운 약통을 찍어주세요"
          aspect={pillboxAspect(current?.layout)}
          onCapture={async (uri) => {
            setPhoto(uri);
            setStep('detecting');
            const proposal = await api.detectPillbox(uri);
            setLayout(proposal.layout);
            setIsMock(proposal.is_mock);
            setStep('confirm');
          }}
        />
      </>
    );
  }

  if (step === 'detecting' || !layout) {
    return (
      <Screen center>
        <Stack.Screen options={{ headerShown: true }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <T variant="title" style={{ textAlign: 'center' }}>
          약통 칸을 살펴보고 있어요
        </T>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <BigButton
          size="guardian"
          label="이대로 등록"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            await api.savePillbox(layout, photo);
            router.replace('/guardian/schedule');
          }}
        />
      }
    >
      <Stack.Screen options={{ headerShown: true }} />
      <JudgeBadge kind="ai" isMock={isMock} />
      <T variant="title">
        {layout.rows}줄 × {layout.cols}칸으로 봤어요
      </T>
      <T>맞는지 확인해 주세요. 줄은 시간대, 칸은 요일이에요.</T>
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
    </Screen>
  );
}
