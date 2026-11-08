import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/guardian/Icon';
import { GButton, GText } from '@/components/guardian/ui';
import { seoulDayOfKey } from '@/lib/seoulTime';
import { dateLabelOfKey, WEEKDAY_LABELS } from '@/lib/time';
import { guardian } from '@/theme';

const C = guardian.color;
const pad = (n: number) => `${n}`.padStart(2, '0');
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * 날짜 선택 (R-051, T-FE17). 달력 한 달을 보여 주고 날을 누른다. 네이티브 모듈 없이 JS로 만든다.
 * 날짜는 서울 기준 "YYYY-MM-DD" 로 주고받는다. max 뒤(미래)와 min 앞은 고를 수 없다
 */
export function DatePickerSheet({
  visible,
  title,
  value,
  min,
  max,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  value: string;
  min?: string;
  max: string;
  onCancel: () => void;
  onConfirm: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState(value);
  const [month, setMonth] = useState(() => {
    const d = seoulDayOfKey(value);
    return { y: d.y, m: d.m };
  });
  useEffect(() => {
    if (!visible) return;
    setPicked(value);
    const d = seoulDayOfKey(value);
    setMonth({ y: d.y, m: d.m });
  }, [visible, value]);

  const first = seoulDayOfKey(keyOf(month.y, month.m, 1));
  const daysInMonth = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first.weekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => keyOf(month.y, month.m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const shift = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const maxDay = seoulDayOfKey(max);
  const canNext = month.y < maxDay.y || (month.y === maxDay.y && month.m < maxDay.m);
  const minDay = min ? seoulDayOfKey(min) : null;
  const canPrev = !minDay || month.y > minDay.y || (month.y === minDay.y && month.m > minDay.m);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.scrim} accessibilityRole="button" accessibilityLabel="닫기" onPress={onCancel} />
      <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={{ gap: 2 }}>
          <GText variant="section" accessibilityRole="header">
            {title}
          </GText>
          <GText variant="sub" color={C.sub}>
            {dateLabelOfKey(picked)}
          </GText>
        </View>
        <View style={s.monthRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="이전 달" disabled={!canPrev} onPress={() => shift(-1)} style={s.navBtn}>
            <Icon name="chevronLeft" size={24} color={canPrev ? C.primaryStrong : '#B8C1CC'} strokeWidth={2.4} />
          </Pressable>
          <GText variant="bodyStrong" accessibilityLiveRegion="polite">
            {month.y}년 {month.m + 1}월
          </GText>
          <Pressable accessibilityRole="button" accessibilityLabel="다음 달" disabled={!canNext} onPress={() => shift(1)} style={s.navBtn}>
            <Icon name="chevronRight" size={24} color={canNext ? C.primaryStrong : '#B8C1CC'} strokeWidth={2.4} />
          </Pressable>
        </View>
        <View>
          <View style={s.week}>
            {WEEKDAY_LABELS.map((w) => (
              <Text key={w} style={s.weekday}>
                {w}
              </Text>
            ))}
          </View>
          {weeks.map((w, i) => (
            <View key={i} style={s.week}>
              {w.map((k, j) => {
                if (!k) return <View key={j} style={s.cell} />;
                const off = k > max || (!!min && k < min);
                const on = k === picked;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityLabel={dateLabelOfKey(k)}
                    accessibilityState={{ selected: on, disabled: off }}
                    disabled={off}
                    onPress={() => setPicked(k)}
                    style={[s.cell, on && s.cellOn]}
                  >
                    <Text style={[s.day, off && { color: '#B8C1CC' }, on && { color: C.onPrimary, fontWeight: '800' }, k === max && !on && s.today]}>
                      {Number(k.slice(8))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <GButton variant="secondary" label="취소" onPress={onCancel} />
          </View>
          <View style={{ flex: 2 }}>
            <GButton icon="check" label="이 날로 정하기" accessibilityLabel={`${dateLabelOfKey(picked)}로 정하기`} onPress={() => onConfirm(picked)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(11,31,51,0.45)' },
  sheet: { backgroundColor: C.card, paddingHorizontal: guardian.space.gutter, paddingTop: 20, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 28, color: C.sub },
  cell: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23 },
  cellOn: { backgroundColor: C.primary },
  day: { fontSize: 17, color: C.text, fontVariant: ['tabular-nums'] },
  today: { fontWeight: '800', color: C.primaryStrong, textDecorationLine: 'underline' },
});
