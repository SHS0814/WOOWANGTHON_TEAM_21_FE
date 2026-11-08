import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, guardianMessage, type TimeOfDay } from '@/api';
import { Icon } from '@/components/guardian/Icon';
import { TimePickerSheet } from '@/components/guardian/TimePicker';
import { ErrorText, GButton, GScreen, GText, IconBubble, ListGroup, Notice, RadioRow, Section, SectionTitle } from '@/components/guardian/ui';
import { goBackOr } from '@/lib/nav';
import { rowsFromSlots, slotsFromRows, suggestedTimesOfDay, timeRows, type RowEntry } from '@/lib/slots';
import { spokenHHMM, TIME_OF_DAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { guardian } from '@/theme';

const C = guardian.color;

const ORDER: TimeOfDay[] = ['morning', 'noon', 'evening', 'bedtime'];
// 처음 정하거나 새로 더할 때의 제안값. 보호자가 바로 고친다
const SUGGESTED_TIMES: Record<TimeOfDay, string> = { morning: '08:00', noon: '12:30', evening: '19:00', bedtime: '21:30' };

type Picking = { kind: 'entry'; row: number } | { kind: 'add' } | null;

/**
 * G3 복약 시각 (api.md 3.13·3.14, R-051). 시각을 누르면 24시간제 시:분 선택기가 뜬다.
 * 일정은 약통 칸과 1:1이라 시간대 하나 = 약통의 한 줄(7칸)이다. 시간대 추가는 일정이 없는 줄이 남아 있을 때만,
 * 삭제는 그 시간대의 모든 요일 일정을 지운다 (최소 1개는 남김). 저장은 PUT /schedule 전체 교체 그대로
 */
export default function Schedule() {
  const { data: box, error: boxError } = useApiData(() => api.currentPillbox());
  const { data: schedule } = useApiData(() => api.schedule());
  const { data: me } = useMe();
  const [entries, setEntries] = useState<RowEntry[] | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ tod: TimeOfDay; time: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schedule || !box || entries) return;
    const layout = box.pillbox.layout;
    if (schedule.slots.length) return setEntries(rowsFromSlots(layout, schedule.slots));
    // 약통을 새로 등록하면 일정이 비어 있다 (3.11) → 약통 줄 이름에서 시간대를 읽어 제안값을 채운다
    const tods = suggestedTimesOfDay(layout);
    setEntries(tods ? tods.map((t, row) => ({ row, time_of_day: t, dose_time: SUGGESTED_TIMES[t] })) : []);
  }, [schedule, box, entries]);

  if (boxError) {
    return (
      <GScreen center>
        <Notice tone="danger">{guardianMessage(boxError)}</Notice>
      </GScreen>
    );
  }
  if (!box || !schedule || !entries) return null;

  const layout = box.pillbox.layout;
  const rows = timeRows(layout);
  const slots = rows ? slotsFromRows(layout, entries) : null;
  const timing = me?.server.timing;
  const sorted = [...entries].sort((a, b) => a.dose_time.localeCompare(b.dose_time));
  const freeRows = (rows ?? []).filter((r) => !entries.some((e) => e.row === r.index));
  const freeTods = ORDER.filter((t) => !entries.some((e) => e.time_of_day === t));
  const canAdd = freeRows.length > 0 && freeTods.length > 0;

  const save = async () => {
    if (!slots || !slots.length) return;
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

  const setTime = (row: number, time: string) => setEntries((es) => es!.map((e) => (e.row === row ? { ...e, dose_time: time } : e)));
  const remove = (row: number) => {
    setEntries((es) => es!.filter((e) => e.row !== row));
    setRemoving(null);
  };
  const startAdd = () => {
    const tod = freeTods[0];
    setAdding({ tod, time: SUGGESTED_TIMES[tod] });
    setRemoving(null);
  };
  const confirmAdd = () => {
    if (!adding || !freeRows.length) return;
    setEntries((es) => [...es!, { row: freeRows[0].index, time_of_day: adding.tod, dose_time: adding.time }]);
    setAdding(null);
  };

  const pickerEntry = picking?.kind === 'entry' ? entries.find((e) => e.row === picking.row) : undefined;

  return (
    <GScreen footer={<GButton label="저장" icon="check" busy={busy} disabled={!slots || !slots.length || !!adding} onPress={save} />}>
      {!rows ? (
        <Notice tone="warn" title="약통 칸을 요일·시간대로 이을 수 없어요.">
          약통을 다시 등록해 주세요.
        </Notice>
      ) : null}
      {schedule.slots.length === 0 && entries.length ? (
        <Notice tone="info" icon="clock">
          처음 정하는 시각이에요. 시각을 눌러 드시는 시각에 맞게 고쳐 주세요.
        </Notice>
      ) : null}

      <View>
        <SectionTitle>복약 시간대 {entries.length}개</SectionTitle>
        <ListGroup style={{ marginTop: 4 }}>
          {sorted.map((e) => {
            const label = TIME_OF_DAY_LABELS[e.time_of_day];
            if (removing === e.row) {
              return (
                <View key={e.row} style={styles.confirm} accessibilityLiveRegion="polite">
                  <GText variant="bodyStrong" color={C.danger}>
                    {label} 복약을 뺄까요?
                  </GText>
                  <GText variant="sub" color={C.sub}>
                    모든 요일의 {label} 일정이 없어져요. 저장해야 반영돼요.
                  </GText>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <GButton compact variant="secondary" label="취소" onPress={() => setRemoving(null)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <GButton compact variant="danger" icon="trash" label={`${label} 빼기`} onPress={() => remove(e.row)} />
                    </View>
                  </View>
                </View>
              );
            }
            return (
              <View key={e.row} style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${label} ${spokenHHMM(e.dose_time)}. 시각 바꾸기`}
                  onPress={() => setPicking({ kind: 'entry', row: e.row })}
                  style={({ pressed }) => [styles.timeBtn, { flex: 1 }, pressed && { backgroundColor: C.neutralSoft }]}
                >
                  <IconBubble name="clock" tone="info" />
                  <View style={{ flex: 1 }}>
                    <GText variant="label" color={C.sub}>
                      {label}
                    </GText>
                    <GText variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                      {e.dose_time}
                    </GText>
                  </View>
                  <GText variant="label" color={C.primaryStrong}>
                    바꾸기
                  </GText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={entries.length <= 1 ? `${label} 빼기. 시간대는 하나 이상 있어야 해요` : `${label} 빼기`}
                  accessibilityState={{ disabled: entries.length <= 1 }}
                  disabled={entries.length <= 1}
                  onPress={() => (setRemoving(e.row), setAdding(null))}
                  style={({ pressed }) => [styles.removeBtn, pressed && { backgroundColor: C.dangerSoft }]}
                >
                  <Icon name="trash" size={22} color={entries.length <= 1 ? '#B8C1CC' : C.danger} />
                </Pressable>
              </View>
            );
          })}
        </ListGroup>
        {entries.length === 1 ? (
          <GText variant="sub" color={C.sub} style={{ marginTop: 6 }}>
            시간대는 하나 이상 있어야 해요.
          </GText>
        ) : null}
      </View>

      {/* 시간대 추가 */}
      {adding ? (
        <Section>
          <GText variant="section" accessibilityRole="header">
            복약 시간대 추가
          </GText>
          <ListGroup style={{ marginTop: 0 }}>
            {freeTods.map((t) => (
              <RadioRow
                key={t}
                selected={adding.tod === t}
                title={TIME_OF_DAY_LABELS[t]}
                onPress={() => setAdding({ tod: t, time: adding.tod === t ? adding.time : SUGGESTED_TIMES[t] })}
              />
            ))}
          </ListGroup>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`시각 ${spokenHHMM(adding.time)}. 바꾸기`}
            onPress={() => setPicking({ kind: 'add' })}
            style={({ pressed }) => [styles.timeBtn, pressed && { backgroundColor: C.neutralSoft }]}
          >
            <IconBubble name="clock" tone="info" />
            <View style={{ flex: 1 }}>
              <GText variant="label" color={C.sub}>
                시각
              </GText>
              <GText variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                {adding.time}
              </GText>
            </View>
            <GText variant="label" color={C.primaryStrong}>
              바꾸기
            </GText>
          </Pressable>
          <GText variant="sub" color={C.sub}>
            약통 {(freeRows[0]?.index ?? 0) + 1}번째 줄{freeRows[0]?.label ? `(${freeRows[0].label})` : ''}의 7칸을 이 시간대로 써요.
          </GText>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <GButton variant="secondary" label="취소" onPress={() => setAdding(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <GButton icon="plus" label="추가" onPress={confirmAdd} />
            </View>
          </View>
        </Section>
      ) : rows && canAdd ? (
        <GButton variant="secondary" icon="plus" label="복약 시간대 추가" onPress={startAdd} />
      ) : rows ? (
        <Notice tone="info" icon="pillbox" title="약통 칸이 더 필요해요" onPress={() => router.push('/guardian/pillbox')} accessibilityLabel="약통 칸이 더 필요해요. 약통 다시 등록">
          시간대를 더하려면 칸 줄이 더 많은 약통으로 다시 등록해 주세요. 약통 다시 등록
        </Notice>
      ) : null}

      {timing ? (
        <Notice tone="neutral" icon="bell">
          {`답이 없으면 ${timing.reask_offsets_min.join('분, ')}분 뒤에 다시 여쭤보고, ${timing.no_response_handoff_min}분이 지나면 알려드려요.`}
        </Notice>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <TimePickerSheet
        visible={!!picking}
        title={picking?.kind === 'add' && adding ? `${TIME_OF_DAY_LABELS[adding.tod]} 시각` : pickerEntry ? `${TIME_OF_DAY_LABELS[pickerEntry.time_of_day]} 시각` : '시각'}
        value={(picking?.kind === 'add' ? adding?.time : pickerEntry?.dose_time) ?? '08:00'}
        onCancel={() => setPicking(null)}
        onConfirm={(t) => {
          if (picking?.kind === 'entry') setTime(picking.row, t);
          else if (adding) setAdding({ ...adding, time: t });
          setPicking(null);
        }}
      />
    </GScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, marginHorizontal: -8, minHeight: 64 },
  removeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  confirm: { gap: 8, paddingVertical: 12 },
});
