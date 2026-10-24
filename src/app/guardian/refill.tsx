import { Stack } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { PillboxCamera } from '@/components/PillboxCamera';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { useApiData } from '@/lib/useApiData';
import { longDate, TIME_OF_DAY_LABELS, WEEKDAY_LABELS } from '@/lib/time';
import { colors } from '@/theme';

/** G7 리필. 남은 칸과 [약통 채웠어요 + 사진 찍기] (MVP #7, R-007 C1, R-008 C3) */
export default function Refill() {
  const { data: status } = useApiData(() => api.getRefillStatus());
  const { data: pillbox } = useApiData(() => api.getPillbox());
  const [shooting, setShooting] = useState(false);
  const [saved, setSaved] = useState(false);

  if (shooting) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PillboxCamera
          size="guardian"
          instruction="채운 약통을 찍어주세요"
          aspect={pillboxAspect(pillbox?.layout)}
          onCapture={async (uri) => {
            await api.createRefill(uri);
            setShooting(false);
            setSaved(true);
          }}
        />
      </>
    );
  }

  if (!status) return null;

  return (
    <Screen
      scroll
      footer={<BigButton size="guardian" label="약통 채웠어요 + 사진 찍기" onPress={() => setShooting(true)} />}
    >
      <Stack.Screen options={{ headerShown: true }} />
      {status.is_mock ? (
        <T variant="small" style={{ color: colors.mockBg }}>
          남은 칸은 모의 계산이에요.
        </T>
      ) : null}
      <T variant="title">
        남은 칸 {status.remaining_cells}칸 / 전체 {status.total_cells}칸
      </T>
      {status.last_covered && status.remaining_cells > 0 ? (
        <T variant="title">
          {WEEKDAY_LABELS[status.last_covered.weekday]}요일 {TIME_OF_DAY_LABELS[status.last_covered.time_of_day]}까지 남았어요
        </T>
      ) : (
        <T variant="title" style={{ color: colors.attention }}>
          ! 남은 칸이 없어요
        </T>
      )}
      <T style={{ color: colors.subtle }}>
        {status.last_refill_at ? `마지막으로 채운 날: ${longDate(new Date(status.last_refill_at))}` : '채운 기록이 아직 없어요'}
      </T>
      {saved ? <T style={{ fontWeight: '700' }}>✓ 기록했어요. 이 사진이 다음 확인의 기준이 돼요.</T> : null}
      <T variant="small" style={{ color: colors.subtle }}>
        남은 칸이 적으면 하루 요약에 한 번 알려드려요.
      </T>
    </Screen>
  );
}
