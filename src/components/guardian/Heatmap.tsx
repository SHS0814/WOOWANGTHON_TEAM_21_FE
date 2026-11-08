import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import type { Summary } from '@/api';
import { GText } from '@/components/guardian/ui';
import { takenCount } from '@/lib/doseStatus';
import { seoulDayOfKey } from '@/lib/seoulTime';
import { addDaysKey, dateLabelOfKey, WEEKDAY_LABELS } from '@/lib/time';
import { guardian } from '@/theme';

const C = guardian.color;

/** 복용 비율 단계. 진할수록 많이 드셨다 (0%, 절반 미만, 100% 미만, 100%) */
const LEVELS = ['#E3E8EE', '#B5DEC6', '#56AE80', '#11704F'];
const LEVEL_TEXT = [C.text, C.text, '#FFFFFF', '#FFFFFF'];

export function dayLevel(s: Summary): number | null {
  if (!s.counts.scheduled) return null;
  const r = takenCount(s) / s.counts.scheduled;
  return r >= 1 ? 3 : r >= 0.5 ? 2 : r > 0 ? 1 : 0;
}

/** 인계가 있었거나 안 드신 날 */
export function hasException(s: Summary): boolean {
  return s.counts.not_taken > 0 || Object.values(s.handoffs_by_reason).some((n) => n > 0);
}

function cellLabel(key: string, s: Summary | undefined) {
  if (!s || !s.counts.scheduled) return `${dateLabelOfKey(key)}, 일정 없음`;
  return `${dateLabelOfKey(key)}, ${s.counts.scheduled}번 중 ${takenCount(s)}번 기록${hasException(s) ? ', 특이사항 있음' : ''}`;
}

/**
 * 잔디맵 (R-051, G6 통계). GitHub 기여 그래프처럼 날마다 한 칸, 진하기 = 그날 복용 비율.
 * 특이사항(인계·안 드심)이 있는 날은 기호(!·점)를 함께 그린다. 칸을 누르면 그 날 기록으로 간다.
 * 1주·1달은 달력(월~일 7열)으로 크게, 1년·전체는 주 단위 열로 작게 그리고 가로로 넘긴다
 */
export function Heatmap({ days, from, to, big, onPick }: { days: Summary[]; from: string; to: string; big: boolean; onPick: (key: string) => void }) {
  const byKey = new Map(days.map((d) => [d.period_start, d]));
  // 월요일부터 시작하는 주 단위로 채운다
  const start = addDaysKey(from, -seoulDayOfKey(from).weekday);
  const weeks: string[][] = [];
  for (let k = start; k <= to; k = addDaysKey(k, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDaysKey(k, i)));

  return (
    <View style={{ gap: 10 }}>
      {big ? (
        <BigGrid weeks={weeks} from={from} to={to} byKey={byKey} onPick={onPick} />
      ) : (
        <SmallGrid weeks={weeks} from={from} to={to} byKey={byKey} onPick={onPick} />
      )}
      <Legend big={big} />
    </View>
  );
}

type GridProps = { weeks: string[][]; from: string; to: string; byKey: Map<string, Summary>; onPick: (key: string) => void };

function BigGrid({ weeks, from, to, byKey, onPick }: GridProps) {
  return (
    <View style={{ gap: 4 }}>
      <View style={s.row}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={s.weekday}>
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w[0]} style={s.row}>
          {w.map((k) => {
            if (k < from || k > to) return <View key={k} style={s.bigCell} />;
            const d = byKey.get(k);
            const lv = d ? dayLevel(d) : null;
            const ex = d ? hasException(d) : false;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${cellLabel(k, d)}. 그날 기록 보기`}
                onPress={() => onPick(k)}
                style={[s.bigCell, lv === null ? s.none : { backgroundColor: LEVELS[lv], borderColor: LEVELS[lv] }]}
              >
                <Text style={[s.bigDay, { color: lv === null ? C.sub : LEVEL_TEXT[lv] }]}>{Number(k.slice(8))}</Text>
                {ex ? (
                  <View style={s.bigMark}>
                    <Text style={s.bigMarkText}>!</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const SMALL = 15;
const GAP = 3;

function SmallGrid({ weeks, from, to, byKey, onPick }: GridProps) {
  const ref = useRef<ScrollViewInstance>(null);
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <View style={{ gap: GAP, paddingTop: 22 }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={w} style={[s.smallWeekday, { opacity: i % 2 ? 0 : 1 }]}>
            {w}
          </Text>
        ))}
      </View>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}>
        <View>
          {/* 달 이름: 그 달 첫 주 위에 */}
          <View style={{ height: 22, flexDirection: 'row' }}>
            {weeks.map((w) => {
              // 그 달 1일이 들어 있는 주 위에 달 이름
              const firstOfMonth = w.find((k) => k.slice(8) === '01' && k >= from && k <= to);
              return (
                <View key={w[0]} style={{ width: SMALL + GAP, overflow: 'visible', zIndex: 1 }}>
                  {firstOfMonth ? <Text style={s.month}>{Number(firstOfMonth.slice(5, 7))}월</Text> : null}
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {weeks.map((w) => (
              <View key={w[0]} style={{ gap: GAP }}>
                {w.map((k) => {
                  if (k < from || k > to) return <View key={k} style={{ width: SMALL, height: SMALL }} />;
                  const d = byKey.get(k);
                  const lv = d ? dayLevel(d) : null;
                  const ex = d ? hasException(d) : false;
                  return (
                    <Pressable
                      key={k}
                      accessibilityRole="button"
                      accessibilityLabel={`${cellLabel(k, d)}. 그날 기록 보기`}
                      hitSlop={1}
                      onPress={() => onPick(k)}
                      style={[s.smallCell, lv === null ? s.none : { backgroundColor: LEVELS[lv], borderColor: LEVELS[lv] }]}
                    >
                      {ex ? <View style={s.dot} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Legend({ big }: { big: boolean }) {
  return (
    <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={s.legendItem}>
        <GText variant="sub" color={C.sub}>
          적게
        </GText>
        {LEVELS.map((c) => (
          <View key={c} style={[s.legendCell, { backgroundColor: c, borderColor: c }]} />
        ))}
        <GText variant="sub" color={C.sub}>
          다 드심
        </GText>
      </View>
      <View style={s.legendItem}>
        <View style={[s.legendCell, s.none]} />
        <GText variant="sub" color={C.sub}>
          일정 없음
        </GText>
      </View>
      <View style={s.legendItem}>
        {big ? (
          <View style={[s.bigMark, { position: 'relative', top: 0, right: 0 }]}>
            <Text style={s.bigMarkText}>!</Text>
          </View>
        ) : (
          <View style={[s.legendCell, { backgroundColor: LEVELS[3], borderColor: LEVELS[3], alignItems: 'center', justifyContent: 'center' }]}>
            <View style={s.dot} />
          </View>
        )}
        <GText variant="sub" color={C.sub}>
          특이사항 있는 날 (인계·안 드심)
        </GText>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 22, color: C.sub },
  bigCell: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  bigDay: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bigMark: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.danger,
    borderWidth: 2,
    borderColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigMarkText: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontWeight: '900' },
  none: { backgroundColor: C.card, borderColor: '#C5CEDA', borderStyle: 'dashed', borderWidth: 1.5 },
  smallWeekday: { fontSize: 13, lineHeight: SMALL, height: SMALL, color: C.sub },
  month: { position: 'absolute', left: 0, width: 44, fontSize: 14, lineHeight: 20, color: C.sub },
  smallCell: { width: SMALL, height: SMALL, borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.danger, borderWidth: 1, borderColor: '#FFFFFF' },
  legend: { gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell: { width: 16, height: 16, borderRadius: 3, borderWidth: 1 },
});
