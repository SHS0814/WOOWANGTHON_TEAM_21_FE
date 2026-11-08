import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GButton, GText } from '@/components/guardian/ui';
import { spokenHHMM } from '@/lib/time';
import { guardian } from '@/theme';

const C = guardian.color;
const ITEM = 52;
const VISIBLE = 5;
const pad = (n: number) => `${n}`.padStart(2, '0');

/**
 * 24시간제 시:분 선택기 (R-051, T-FE16). 알람 앱처럼 시·분 바퀴를 굴려 고른다 (1분 단위).
 * 네이티브 모듈 없이 기본 ScrollView 로 만든다 (개발 빌드 재설치를 피하려고).
 * 화면 읽기 프로그램에서는 바퀴마다 위·아래로 쓸어 1씩 바꾼다 (adjustable)
 */
export function TimePickerSheet({
  visible,
  title,
  value,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  value: string;
  onCancel: () => void;
  onConfirm: (hhmm: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const [hh, mm] = value.split(':').map(Number);
    setH(hh);
    setM(mm);
  }, [visible, value]);

  const picked = `${pad(h)}:${pad(m)}`;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.scrim} accessibilityRole="button" accessibilityLabel="닫기" onPress={onCancel} />
      <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={{ gap: 2 }}>
          <GText variant="section" accessibilityRole="header">
            {title}
          </GText>
          <GText variant="sub" color={C.sub}>
            {spokenHHMM(picked)}
          </GText>
        </View>
        {visible ? (
          <View style={s.wheels}>
            <View pointerEvents="none" style={s.band} />
            <Wheel count={24} value={h} onChange={setH} unit="시" />
            <Text style={s.colon}>:</Text>
            <Wheel count={60} value={m} onChange={setM} unit="분" />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <GButton variant="secondary" label="취소" onPress={onCancel} />
          </View>
          <View style={{ flex: 2 }}>
            <GButton label={`${picked}로 정하기`} accessibilityLabel={`${spokenHHMM(picked)}로 정하기`} icon="check" onPress={() => onConfirm(picked)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Wheel({ count, value, onChange, unit }: { count: number; value: number; onChange: (v: number) => void; unit: string }) {
  const ref = useRef<ScrollViewInstance>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef(value);

  const scrollTo = (v: number, animated: boolean) => ref.current?.scrollTo({ y: v * ITEM, animated });

  // 처음 열 때와 밖에서 값이 바뀔 때 그 자리로
  useEffect(() => {
    if (current.current !== value) {
      current.current = value;
      scrollTo(value, false);
    }
  }, [value]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (v !== current.current) {
      current.current = v;
      onChange(v);
    }
    // 웹은 snap 이 끝나도 momentum 이벤트가 오지 않을 수 있어, 멈추면 칸에 맞춘다
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => scrollTo(current.current, true), 140);
  };
  useEffect(() => () => void (settle.current && clearTimeout(settle.current)), []);

  const set = (v: number) => {
    const nv = (v + count) % count;
    current.current = nv;
    onChange(nv);
    scrollTo(nv, true);
  };

  return (
    <View
      style={s.wheel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={unit === '시' ? '시' : '분'}
      accessibilityValue={{ text: `${value}${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={() => scrollTo(value, false)}
        contentContainerStyle={{ paddingVertical: ITEM * ((VISIBLE - 1) / 2) }}
      >
        {Array.from({ length: count }, (_, i) => (
          <Pressable key={i} onPress={() => set(i)} style={s.item} importantForAccessibility="no">
            <Text style={[s.itemText, i === value && s.itemOn]}>{pad(i)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(11,31,51,0.45)' },
  sheet: {
    backgroundColor: C.card,
    paddingHorizontal: guardian.space.gutter,
    paddingTop: 20,
    gap: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ITEM * VISIBLE },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM * ((VISIBLE - 1) / 2),
    height: ITEM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    backgroundColor: C.primarySoft,
  },
  wheel: { width: 96, height: ITEM * VISIBLE },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 26, color: C.muted, fontVariant: ['tabular-nums'] },
  itemOn: { fontSize: 32, fontWeight: '800', color: C.text },
  colon: { fontSize: 32, fontWeight: '800', color: C.text, marginHorizontal: 8 },
});
