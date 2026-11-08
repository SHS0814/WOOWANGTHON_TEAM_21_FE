import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { api, guardianMessage, type TimeOfDay } from '@/api';
import { Icon } from '@/components/guardian/Icon';
import { TimePickerSheet } from '@/components/guardian/TimePicker';
import { ErrorText, GButton, GScreen, GText, IconBubble, ListGroup, Notice, RadioRow, Section, SectionTitle } from '@/components/guardian/ui';
import { goBackOr } from '@/lib/nav';
import { missingWeekdays, pillboxKind, rowsFromSlots, slotsFromRows, suggestedTimesOfDay, timeOn, timeRows, TOD_ORDER, type RowEntry } from '@/lib/slots';
import { spokenHHMM, TIME_OF_DAY_LABELS, WEEKDAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { guardian } from '@/theme';

const C = guardian.color;

// 처음 정하거나 새로 더할 때의 제안값. 보호자가 바로 고친다
const SUGGESTED_TIMES: Record<TimeOfDay, string> = { morning: '08:00', noon: '12:30', evening: '19:00', bedtime: '21:30' };

type Picking = { kind: 'entry'; row: number; weekday?: number } | { kind: 'add' } | null;

/** 요일별 시각의 짧은 요약: "08:00~09:30" */
function rangeText(e: RowEntry): string {
  const ts = [...(e.by_day ?? [e.dose_time])].sort();
  return ts[0] === ts[ts.length - 1] ? ts[0] : `${ts[0]}~${ts[ts.length - 1]}`;
}

/**
 * G3 복약 시각 (api.md 3.13·3.14, R-051·R-054). 시각을 누르면 24시간제 시:분 선택기가 뜬다.
 * 시간대 하나 = 일주일 약통의 한 줄(7칸) 또는 하루 약통의 한 칸(월~일 매일). 시간대마다 '매일 같은 시각'이 기본이고,
 * 켜면 요일마다 시각을 따로 정한다. 저장된 일정의 요일별 시각이 다르면 요일별로 연다 (R-053 후속 1: 덮어쓰기 방지).
 * 시간대 추가는 일정이 없는 줄(하루 약통은 칸)이 남아 있을 때만, 삭제는 그 시간대의 모든 요일 일정을 지운다 (최소 1개는 남김).
 * 저장은 PUT /schedule 전체 교체 그대로
 */
export default function Schedule() {
  const { data: box, error: boxError } = useApiData(() => api.currentPillbox());
  const { data: schedule } = useApiData(() => api.schedule());
  const { data: me } = useMe();
  const [entries, setEntries] = useState<RowEntry[] | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [collapsing, setCollapsing] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ tod: TimeOfDay; time: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schedule || !box || entries) return;
    const layout = box.pillbox.layout;
    if (schedule.slots.length) return setEntries(rowsFromSlots(layout, schedule.slots));
    // 약통을 새로 등록하면 일정이 비어 있다 (3.11) → 약통 줄·칸 이름에서 시간대를 읽어 제안값을 채운다
    const tods = suggestedTimesOfDay(layout);
    setEntries(tods ? tods.map((t, row) => ({ row, time_of_day: t, dose_time: SUGGESTED_TIMES[t], by_day: null })) : []);
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
  const kind = pillboxKind(layout);
  const daily = kind === 'daily';
  const unit = daily ? '칸' : '줄';
  const rows = timeRows(layout);
  const slots = rows ? slotsFromRows(layout, entries) : null;
  const timing = me?.server.timing;
  const sorted = [...entries].sort((a, b) => timeOn(a, 0).localeCompare(timeOn(b, 0)));
  const freeRows = (rows ?? []).filter((r) => !entries.some((e) => e.row === r.index));
  const freeTods = TOD_ORDER.filter((t) => !entries.some((e) => e.time_of_day === t));
  const canAdd = freeRows.length > 0 && freeTods.length > 0;
  const savedPerDay = schedule.slots.length > 0 && rowsFromSlots(layout, schedule.slots).some((e) => e.by_day);
  const savedMissing = schedule.slots.length > 0 && missingWeekdays(layout, schedule.slots);

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

  const update = (row: number, f: (e: RowEntry) => RowEntry) => setEntries((es) => es!.map((e) => (e.row === row ? f(e) : e)));
  const setTime = (row: number, time: string, weekday?: number) =>
    update(row, (e) => {
      if (weekday === undefined || !e.by_day) return { ...e, dose_time: time, by_day: null };
      const by_day = e.by_day.map((t, d) => (d === weekday ? time : t));
      return { ...e, by_day, dose_time: by_day[0] };
    });
  const setPerDay = (row: number, on: boolean) => {
    const e = entries.find((x) => x.row === row);
    if (!e) return;
    if (on) return update(row, (x) => ({ ...x, by_day: Array(7).fill(x.dose_time) }));
    // 끌 때 요일별 시각이 서로 다르면 한 번 묻는다 (말없이 덮어쓰지 않게)
    if (e.by_day && new Set(e.by_day).size > 1) return setCollapsing(row);
    update(row, (x) => ({ ...x, by_day: null }));
  };
  const collapse = (row: number, time: string) => {
    update(row, (x) => ({ ...x, dose_time: time, by_day: null }));
    setCollapsing(null);
  };
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
    setEntries((es) => [...es!, { row: freeRows[0].index, time_of_day: adding.tod, dose_time: adding.time, by_day: null }]);
    setAdding(null);
  };

  const pickerEntry = picking?.kind === 'entry' ? entries.find((e) => e.row === picking.row) : undefined;
  const pickerWeekday = picking?.kind === 'entry' ? picking.weekday : undefined;
  const pickerTitle =
    picking?.kind === 'add' && adding
      ? `${TIME_OF_DAY_LABELS[adding.tod]} 시각`
      : pickerEntry
        ? `${pickerWeekday !== undefined ? `${WEEKDAY_LABELS[pickerWeekday]}요일 ` : ''}${TIME_OF_DAY_LABELS[pickerEntry.time_of_day]} 시각`
        : '시각';
  const pickerValue = (picking?.kind === 'add' ? adding?.time : pickerEntry ? timeOn(pickerEntry, pickerWeekday ?? 0) : undefined) ?? '08:00';

  return (
    <GScreen footer={<GButton label="저장" icon="check" busy={busy} disabled={!slots || !slots.length || !!adding || collapsing !== null} onPress={save} />}>
      {!rows ? (
        <Notice tone="warn" title="약통 칸을 요일·시간대로 이을 수 없어요.">
          약통을 다시 등록해 주세요.
        </Notice>
      ) : null}
      {daily ? (
        <Notice tone="info" icon="pillbox" title="하루 약통: 매일 드신 뒤 다시 채워요">
          칸마다 한 시간대를 월요일부터 일요일까지 매일 써요.
        </Notice>
      ) : null}
      {schedule.slots.length === 0 && entries.length ? (
        <Notice tone="info" icon="clock">
          처음 정하는 시각이에요. 시각을 눌러 드시는 시각에 맞게 고쳐 주세요.
        </Notice>
      ) : null}
      {savedPerDay ? (
        <Notice tone="neutral" icon="calendar">
          요일마다 시각이 달라 요일별로 보여 드려요. 그대로 저장하면 요일별 시각이 유지돼요.
        </Notice>
      ) : null}
      {savedMissing ? <Notice tone="warn">일정이 없는 요일이 있어요. 저장하면 모든 요일에 일정이 생겨요.</Notice> : null}

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
            const perDay = !!e.by_day;
            return (
              <View key={e.row} style={{ paddingBottom: 8 }}>
                <View style={styles.row}>
                  {perDay ? (
                    <View style={[styles.timeBtn, { flex: 1 }]} accessible accessibilityLabel={`${label}, 요일마다 다른 시각 ${rangeText(e)}`}>
                      <IconBubble name="clock" tone="info" />
                      <View style={{ flex: 1 }}>
                        <GText variant="label" color={C.sub}>
                          {label}
                        </GText>
                        <GText variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                          {rangeText(e)}
                        </GText>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${label} 매일 ${spokenHHMM(e.dose_time)}. 시각 바꾸기`}
                      onPress={() => setPicking({ kind: 'entry', row: e.row })}
                      style={({ pressed }) => [styles.timeBtn, { flex: 1 }, pressed && { backgroundColor: C.neutralSoft }]}
                    >
                      <IconBubble name="clock" tone="info" />
                      <View style={{ flex: 1 }}>
                        <GText variant="label" color={C.sub}>
                          {label} · 매일
                        </GText>
                        <GText variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                          {e.dose_time}
                        </GText>
                      </View>
                      <GText variant="label" color={C.primaryStrong}>
                        바꾸기
                      </GText>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={entries.length <= 1 ? `${label} 빼기. 시간대는 하나 이상 있어야 해요` : `${label} 빼기`}
                    accessibilityState={{ disabled: entries.length <= 1 }}
                    disabled={entries.length <= 1}
                    onPress={() => (setRemoving(e.row), setAdding(null), setCollapsing(null))}
                    style={({ pressed }) => [styles.removeBtn, pressed && { backgroundColor: C.dangerSoft }]}
                  >
                    <Icon name="trash" size={22} color={entries.length <= 1 ? '#B8C1CC' : C.danger} />
                  </Pressable>
                </View>

                {/* 요일별 시각 켜고 끄기 */}
                <View style={styles.switchRow}>
                  <GText variant="label" color={C.sub} style={{ flex: 1 }}>
                    요일마다 다른 시각
                  </GText>
                  <Switch
                    accessibilityLabel={`${label} 요일마다 다른 시각`}
                    value={perDay}
                    onValueChange={(on) => setPerDay(e.row, on)}
                    trackColor={{ true: C.primary, false: '#C5CEDA' }}
                    thumbColor={C.card}
                  />
                </View>

                {collapsing === e.row && e.by_day ? (
                  <View style={styles.confirm} accessibilityLiveRegion="polite">
                    <GText variant="bodyStrong">요일별 시각을 하나로 합칠까요?</GText>
                    <GText variant="sub" color={C.sub}>
                      모든 요일이 월요일 시각 {e.by_day[0]}로 바뀌어요. 저장해야 반영돼요.
                    </GText>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <GButton compact variant="secondary" label="취소" onPress={() => setCollapsing(null)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <GButton compact label={`매일 ${e.by_day[0]}`} onPress={() => collapse(e.row, e.by_day![0])} />
                      </View>
                    </View>
                  </View>
                ) : null}

                {e.by_day ? (
                  <View style={styles.days}>
                    {e.by_day.map((t, d) => (
                      <Pressable
                        key={d}
                        accessibilityRole="button"
                        accessibilityLabel={`${WEEKDAY_LABELS[d]}요일 ${label} ${spokenHHMM(t)}. 시각 바꾸기`}
                        onPress={() => setPicking({ kind: 'entry', row: e.row, weekday: d })}
                        style={({ pressed }) => [styles.day, t !== e.by_day![0] && styles.dayDiff, pressed && { backgroundColor: C.neutralSoft }]}
                      >
                        <GText variant="label" color={C.sub}>
                          {WEEKDAY_LABELS[d]}
                        </GText>
                        <GText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                          {t}
                        </GText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
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
                시각 · 매일
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
            {daily
              ? `약통 ${(freeRows[0]?.index ?? 0) + 1}번째 칸${freeRows[0]?.label ? `(${freeRows[0].label})` : ''}을 매일 이 시간대로 써요.`
              : `약통 ${(freeRows[0]?.index ?? 0) + 1}번째 줄${freeRows[0]?.label ? `(${freeRows[0].label})` : ''}의 7칸을 이 시간대로 써요.`}{' '}
            요일별 시각은 추가한 뒤 켤 수 있어요.
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
        <Notice
          tone="info"
          icon="pillbox"
          title="약통 칸이 더 필요해요"
          onPress={() => router.push('/guardian/pillbox')}
          accessibilityLabel="약통 칸이 더 필요해요. 약통 다시 등록"
        >
          {`시간대를 더하려면 ${unit}이 더 많은 약통으로 다시 등록해 주세요. 약통 다시 등록`}
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
        title={pickerTitle}
        value={pickerValue}
        onCancel={() => setPicking(null)}
        onConfirm={(t) => {
          if (picking?.kind === 'entry') setTime(picking.row, t, picking.weekday);
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 52 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 52, paddingTop: 4 },
  day: {
    width: '31%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: guardian.radius.control,
    borderWidth: 1,
    borderColor: '#C5CEDA',
    backgroundColor: C.card,
  },
  dayDiff: { borderColor: C.primary, borderWidth: 2 },
});
