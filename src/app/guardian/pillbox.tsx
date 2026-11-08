import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { api, guardianMessage, type DetectResponse, type Layout, type Refill } from '@/api';
import { BaselineReviewScreen } from '@/components/guardian/BaselineReview';
import { PillboxGrid } from '@/components/guardian/PillboxGrid';
import { Section, ErrorText, GButton, GJudgeBadge, GScreen, GText, IconBubble, Notice } from '@/components/guardian/ui';
import { PillboxCamera } from '@/components/PillboxCamera';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { guardian } from '@/theme';

const C = guardian.color;

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
    <GScreen footer={<GButton label="이대로 등록" icon="check" onPress={save} />}>
      <Stack.Screen options={{ headerShown: true }} />
      <Section>
        <GJudgeBadge kind="ai" isMock={detected.is_mock} />
        <View>
          <GText variant="label" color={C.sub}>
            AI가 읽은 약통 구조
          </GText>
          <GText variant="title">
            {layout.rows}줄 × {layout.cols}칸으로 봤어요
          </GText>
        </View>
        {detected.proposal.uncertain ? (
          <Notice tone="warn" title="AI가 구조를 확신하지 못했어요.">
            구조를 직접 확인해 주세요.
          </Notice>
        ) : (
          <GText color={C.sub}>맞는지 확인해 주세요.</GText>
        )}
        <PillboxGrid layout={layout} />
      </Section>
      <Section>
        <GText variant="section">줄 수 고치기</GText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <GButton
              variant="secondary"
              icon="minus"
              label="줄 빼기"
              disabled={layout.rows <= 1}
              onPress={() => setLayout(withRows(layout, layout.rows - 1))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <GButton
              variant="secondary"
              icon="plus"
              label="줄 더하기"
              disabled={layout.rows >= 4}
              onPress={() => setLayout(withRows(layout, layout.rows + 1))}
            />
          </View>
        </View>
        <GButton variant="ghost" icon="camera" label="다시 찍기" onPress={() => setStep('shoot')} />
      </Section>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </GScreen>
  );
}
