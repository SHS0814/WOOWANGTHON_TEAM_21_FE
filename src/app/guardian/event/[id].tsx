import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { api } from '@/api';
import { ReadingView } from '@/components/guardian/ReadingView';
import { GScreen, GText, IconBubble, Section, SectionTitle, StatusChip } from '@/components/guardian/ui';
import { SimulationTag } from '@/components/MockBanner';
import { RemotePhoto } from '@/components/RemotePhoto';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { doseName } from '@/lib/doseLabel';
import { doseStatus, isSkippedByDouble } from '@/lib/doseStatus';
import { spokenTime } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { guardian } from '@/theme';

const C = guardian.color;

/**
 * 복약 기록 상세. 보호자에게 넘어오지 않은 건(정상 기록 등)도 사진과 AI 판독을 볼 수 있게 한다.
 * 인계된 건은 인계 상세(G5)가 판정까지 맡으므로 이 화면으로 오지 않는다. 판정 버튼은 없다 (보기 전용).
 */
export default function EventDetail() {
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();
  const { data: events } = useApiData(() => api.doseEvents(date, date), [date]);
  const { data: box } = useApiData(() => api.currentPillbox().catch(() => null));

  if (events === undefined || box === undefined) return null;
  const ev = events.find((e) => e.id === id);
  if (!ev) {
    return (
      <GScreen center>
        <GText color={C.sub}>기록을 찾지 못했어요.</GText>
      </GScreen>
    );
  }
  const st = doseStatus(ev);
  const reading = ev.latest_reading;
  // 마지막 사진보다 먼저 찍은 사진들 (다시 찍기 전). 최근 것이 위로 오게
  const earlier = reading ? ev.photos.filter((p) => p.id !== reading.photo.id).reverse() : [];

  return (
    <GScreen>
      {ev.is_simulated ? <SimulationTag /> : null}

      <Section>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconBubble name={st.icon} tone={st.tone} size={48} />
          <View style={{ flex: 1 }}>
            <GText variant="title" accessibilityRole="header">
              {doseName(ev)} 약 · {st.label}
            </GText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <StatusChip tone="neutral" icon="clock" label={`${spokenTime(new Date(ev.scheduled_at))} 예정`} />
          {ev.reminded_at ? <StatusChip tone="warn" icon="bell" label={`${spokenTime(new Date(ev.reminded_at))} 안내 1회`} /> : null}
          {ev.taken_at ? <StatusChip tone="ok" icon="check" label={`${spokenTime(new Date(ev.taken_at))} 기록`} /> : null}
        </View>
      </Section>

      <SectionTitle>사진과 AI 판독</SectionTitle>
      {reading && box ? (
        <>
          <ReadingView reading={reading} layout={box.pillbox.layout} title={earlier.length ? '다시 찍은 사진' : undefined} />
          {/* 다시 찍기 전의 사진도 남긴다. 판독 결과는 마지막 사진 것만 서버가 주므로 사진과 시각만 보인다 */}
          {earlier.map((p) => (
            <Section key={p.id}>
              <View>
                <GText variant="bodyStrong">처음 사진</GText>
                <GText variant="sub" color={C.sub}>
                  {spokenTime(new Date(p.taken_at))} 촬영{ev.reminded_at ? ' · 칸이 그대로여서 한 번 안내했어요' : ''}
                </GText>
              </View>
              <RemotePhoto
                photo={p}
                style={{ width: '100%', aspectRatio: pillboxAspect(box.pillbox.layout), borderRadius: 12, overflow: 'hidden' }}
                label="처음 찍은 약통 사진"
              />
            </Section>
          ))}
        </>
      ) : (
        <Section>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <IconBubble name="image" tone="neutral" />
            {/* 인계 없이 보호자 확인으로 닫힌 건은 이중 복용 판정 때 미리 비워져 있던 칸뿐이다 */}
            <GText color={C.sub} style={{ flex: 1 }}>
              {isSkippedByDouble(ev) ? '중복 복용으로 건너뛴 약이에요.' : '아직 사진이 없어요.'}
            </GText>
          </View>
        </Section>
      )}
    </GScreen>
  );
}
