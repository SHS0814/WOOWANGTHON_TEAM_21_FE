import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { api, guardianMessage, type TimeOfDay } from '@/api';
import { Section, ErrorText, GButton, GScreen, GText, IconBubble, Notice } from '@/components/guardian/ui';
import { goBackOr } from '@/lib/nav';
import { buildSlots, cellMapping } from '@/lib/slots';
import { spokenHHMM, TIME_OF_DAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { guardian } from '@/theme';

const C = guardian.color;

const ORDER: TimeOfDay[] = ['morning', 'noon', 'evening', 'bedtime'];
const STEP_MIN = 10;
// 일정이 아직 없을 때만 쓰는 첫 제안값. 보호자가 바로 고친다
const SUGGESTED_TIMES: Record<TimeOfDay, string> = { morning: '08:00', noon: '12:30', evening: '19:00', bedtime: '21:30' };

function shift(hhmm: string, delta: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (h * 60 + m + delta + 1440) % 1440;
  return `${`${Math.floor(t / 60)}`.padStart(2, '0')}:${`${t % 60}`.padStart(2, '0')}`;
}

/** G3 복약 시각 (api.md 3.13·3.14). 시간대별로 하나씩 정하고, 약통 칸과 이어서 일정 전체를 저장한다 */
export default function Schedule() {
  const { data: box, error: boxError } = useApiData(() => api.currentPillbox());
  const { data: schedule } = useApiData(() => api.schedule());
  const { data: me } = useMe();
  const [times, setTimes] = useState<Partial<Record<TimeOfDay, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schedule || !box) return;
    const t: Partial<Record<TimeOfDay, string>> = {};
    for (const s of schedule.slots) t[s.time_of_day] = s.dose_time;
    // 약통을 새로 등록하면 일정이 비어 있다 (3.11) → 약통 줄에서 시간대를 읽어 제안값을 채운다
    for (const m of cellMapping(box.pillbox.layout) ?? []) t[m.time_of_day] ??= SUGGESTED_TIMES[m.time_of_day];
    setTimes(t);
  }, [schedule, box]);

  if (boxError) {
    return (
      <GScreen center>
        <Notice tone="danger">{guardianMessage(boxError)}</Notice>
      </GScreen>
    );
  }
  if (!box || !schedule) return null;

  const present = ORDER.filter((k) => times[k]);
  const slots = buildSlots(box.pillbox.layout, times);
  const timing = me?.server.timing;

  const save = async () => {
    if (!slots) return;
    setBusy(true);
    setError('');
    try {
      await api.putSchedule(slots);
      goBackOr('/guardian');
    } catch (e) {
      setError(guardianMessage(e));
      setBusy(false);
    }
  };

  return (
    <GScreen footer={<GButton label="저장" icon="check" busy={busy} disabled={!slots} onPress={save} />}>
      {!slots ? (
        <Notice tone="warn" title="약통 칸을 요일·시간대로 이을 수 없어요.">
          약통을 다시 등록해 주세요.
        </Notice>
      ) : null}
      {schedule.slots.length === 0 ? (
        <Notice tone="info" icon="clock">
          처음 정하는 시각이에요. 드시는 시각에 맞게 고쳐 주세요.
        </Notice>
      ) : null}
      {present.map((k) => (
        <Section key={k}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBubble name="clock" tone="info" />
            <View style={{ flex: 1 }}>
              <GText variant="label" color={C.sub}>
                {TIME_OF_DAY_LABELS[k]}
              </GText>
              <GText variant="title" accessibilityLabel={`${TIME_OF_DAY_LABELS[k]} ${spokenHHMM(times[k]!)}`}>
                {spokenHHMM(times[k]!)}
              </GText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <GButton
                variant="secondary"
                icon="minus"
                label={`${STEP_MIN}분 빠르게`}
                accessibilityLabel={`${TIME_OF_DAY_LABELS[k]} ${STEP_MIN}분 빠르게`}
                onPress={() => setTimes((t) => ({ ...t, [k]: shift(t[k]!, -STEP_MIN) }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <GButton
                variant="secondary"
                icon="plus"
                label={`${STEP_MIN}분 늦게`}
                accessibilityLabel={`${TIME_OF_DAY_LABELS[k]} ${STEP_MIN}분 늦게`}
                onPress={() => setTimes((t) => ({ ...t, [k]: shift(t[k]!, STEP_MIN) }))}
              />
            </View>
          </View>
        </Section>
      ))}
      {timing ? (
        <Notice tone="neutral" icon="bell">
          {`답이 없으면 ${timing.reask_offsets_min.join('분, ')}분 뒤에 다시 여쭤보고, ${timing.no_response_handoff_min}분이 지나면 알려드려요.`}
        </Notice>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </GScreen>
  );
}
