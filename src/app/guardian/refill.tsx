import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { api, guardianMessage, isApiError, type Refill as RefillT } from '@/api';
import { BaselineReview } from '@/components/BaselineReview';
import { BigButton } from '@/components/BigButton';
import { PillboxCamera } from '@/components/PillboxCamera';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { longDate, spokenHHMM, TIME_OF_DAY_LABELS, WEEKDAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { colors } from '@/theme';

/** G7 리필. 남은 칸과 [약통 채웠어요 + 사진 찍기] (MVP #7, api.md 3.12·3.15·3.16, R-008 C3) */
export default function Refill() {
  const { data: box, error } = useApiData(() => api.currentPillbox());
  const [step, setStep] = useState<'status' | 'shoot' | 'saving' | 'review'>('status');
  const [refill, setRefill] = useState<RefillT | null>(null);
  const [msg, setMsg] = useState('');

  if (isApiError(error, 'pillbox_required')) {
    return (
      <Screen center footer={<BigButton size="guardian" label="약통 등록하기" onPress={() => router.replace('/guardian/pillbox')} />}>
        <T variant="title">약통을 먼저 등록해 주세요.</T>
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen center>
        <T variant="title">{guardianMessage(error)}</T>
      </Screen>
    );
  }
  if (!box) return null;

  if (step === 'shoot') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PillboxCamera
          size="guardian"
          instruction="채운 약통을 찍어주세요"
          aspect={pillboxAspect(box.pillbox.layout)}
          onCapture={async (photo) => {
            setStep('saving');
            setMsg('');
            try {
              const r = await api.createRefill(photo);
              setRefill(r);
              if (r.needs_review) setStep('review');
              else {
                setMsg('✓ 기록했어요. 이 사진이 다음 확인의 기준이 돼요.');
                setStep('status');
              }
            } catch (e) {
              setMsg(guardianMessage(e));
              setStep('status');
            }
          }}
        />
      </>
    );
  }

  if (step === 'saving') {
    return (
      <Screen center>
        <Stack.Screen options={{ headerShown: true }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <T variant="title" style={{ textAlign: 'center' }}>
          약통을 살펴보고 있어요
        </T>
      </Screen>
    );
  }

  if (step === 'review' && refill) {
    return (
      <Screen scroll>
        <Stack.Screen options={{ headerShown: true }} />
        <BaselineReview
          refill={refill}
          layout={box.pillbox.layout}
          onDone={() => {
            setMsg('✓ 기록했어요. 이 사진이 다음 확인의 기준이 돼요.');
            setStep('status');
          }}
        />
      </Screen>
    );
  }

  const st = box.refill_status;
  const until = st.covered_until;
  return (
    <Screen scroll footer={<BigButton size="guardian" label="약통 채웠어요 + 사진 찍기" onPress={() => setStep('shoot')} />}>
      <Stack.Screen options={{ headerShown: true }} />
      {api.mode === 'mock' ? (
        <T variant="small" style={{ color: colors.mockBg }}>
          남은 칸은 모의 계산이에요.
        </T>
      ) : null}
      <T variant="title">남은 칸 {st.remaining_cells}칸</T>
      {until ? (
        <T variant="title">
          {WEEKDAY_LABELS[until.weekday]}요일 {TIME_OF_DAY_LABELS[until.time_of_day]}({spokenHHMM(until.dose_time)})까지 남았어요
        </T>
      ) : (
        <T variant="title" style={{ color: colors.attention }}>
          {/* covered_until 이 null: 남은 칸이 없거나, 다음 복약 칸부터 비어 있다 (3.12) */}
          {st.remaining_cells > 0 ? '! 다음 약 칸이 비어 있어요' : '! 남은 칸이 없어요'}
        </T>
      )}
      {st.needs_refill ? <T style={{ color: colors.attention, fontWeight: '700' }}>! 곧 채워야 해요</T> : null}
      {box.pillbox_mismatch.detected ? <T style={{ color: colors.attention, fontWeight: '700' }}>! 약통 상태가 기록과 달라요</T> : null}
      <T style={{ color: colors.subtle }}>
        {box.last_refill ? `마지막으로 채운 날: ${longDate(new Date(box.last_refill.filled_at))}` : '채운 기록이 아직 없어요'}
      </T>
      {msg ? <T style={{ fontWeight: '700' }}>{msg}</T> : null}
      <T variant="small" style={{ color: colors.subtle }}>
        남은 칸이 적으면 하루 요약에 알려드려요.
      </T>
    </Screen>
  );
}
