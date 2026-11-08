import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { api, guardianMessage, isApiError, type Refill as RefillT } from '@/api';
import { BaselineReviewScreen } from '@/components/guardian/BaselineReview';
import { Card, GButton, GScreen, GText, IconBubble, ListGroup, ListRow, MockTag, Notice } from '@/components/guardian/ui';
import { PillboxCamera } from '@/components/PillboxCamera';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { longDate, spokenHHMM, TIME_OF_DAY_LABELS, WEEKDAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { guardian } from '@/theme';

const C = guardian.color;

/** G7 리필. 남은 칸과 [약통 채웠어요 + 사진 찍기] (MVP #7, api.md 3.12·3.15·3.16, R-008 C3) */
export default function Refill() {
  const { data: box, error } = useApiData(() => api.currentPillbox());
  const [step, setStep] = useState<'status' | 'shoot' | 'saving' | 'review'>('status');
  const [refill, setRefill] = useState<RefillT | null>(null);
  const [msg, setMsg] = useState('');

  if (isApiError(error, 'pillbox_required')) {
    return (
      <GScreen center footer={<GButton label="약통 등록하기" icon="pillbox" onPress={() => router.replace('/guardian/pillbox')} />}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <IconBubble name="pillbox" tone="info" size={56} />
          <GText variant="title" style={{ textAlign: 'center' }}>
            약통을 먼저 등록해 주세요.
          </GText>
        </View>
      </GScreen>
    );
  }
  if (error) {
    return (
      <GScreen center>
        <Notice tone="danger">{guardianMessage(error)}</Notice>
      </GScreen>
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
      <GScreen center scroll={false}>
        <Stack.Screen options={{ headerShown: true }} />
        <View style={{ alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={C.primary} />
          <GText variant="title" style={{ textAlign: 'center' }}>
            약통을 살펴보고 있어요
          </GText>
        </View>
      </GScreen>
    );
  }

  if (step === 'review' && refill) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true }} />
        <BaselineReviewScreen
          refill={refill}
          layout={box.pillbox.layout}
          onDone={() => {
            setMsg('✓ 기록했어요. 이 사진이 다음 확인의 기준이 돼요.');
            setStep('status');
          }}
        />
      </>
    );
  }

  const st = box.refill_status;
  const until = st.covered_until;
  return (
    <GScreen footer={<GButton label="약통 채웠어요 + 사진 찍기" icon="camera" onPress={() => setStep('shoot')} />}>
      <Stack.Screen options={{ headerShown: true }} />
      {api.mode === 'mock' ? <MockTag label="남은 칸은 모의 계산이에요." /> : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }} accessible accessibilityLabel={`남은 칸 ${st.remaining_cells}칸`}>
            <GText variant="label" color={C.sub}>
              약통 남은 칸
            </GText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <GText variant="stat">{st.remaining_cells}</GText>
              <GText variant="section" color={C.sub}>
                {' '}
                칸
              </GText>
            </View>
          </View>
        </View>
        {until ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <IconBubble name="calendar" tone="info" size={36} />
            <GText variant="bodyStrong" style={{ flex: 1 }}>
              {WEEKDAY_LABELS[until.weekday]}요일 {TIME_OF_DAY_LABELS[until.time_of_day]}({spokenHHMM(until.dose_time)})까지 남았어요
            </GText>
          </View>
        ) : (
          // covered_until 이 null: 남은 칸이 없거나, 다음 복약 칸부터 비어 있다 (3.12)
          <Notice tone="danger" title={st.remaining_cells > 0 ? '다음 약 칸이 비어 있어요' : '남은 칸이 없어요'} />
        )}
        {st.needs_refill ? <Notice tone="warn" title="곧 채워야 해요" /> : null}
        {box.pillbox_mismatch.detected ? <Notice tone="warn" title="약통 상태가 기록과 달라요" /> : null}
      </Card>
      {msg ? (
        <Notice tone={msg.startsWith('✓') ? 'ok' : 'danger'} title={msg.startsWith('✓') ? msg.slice(2) : undefined}>
          {msg.startsWith('✓') ? undefined : msg}
        </Notice>
      ) : null}
      <ListGroup>
        <ListRow
          icon="calendar"
          iconTone="neutral"
          title="마지막으로 채운 날"
          subtitle={box.last_refill ? longDate(new Date(box.last_refill.filled_at)) : '채운 기록이 아직 없어요'}
        />
        <ListRow icon="bell" iconTone="neutral" title="리필 알림" subtitle="남은 칸이 적으면 하루 요약에 알려드려요." />
      </ListGroup>
    </GScreen>
  );
}
