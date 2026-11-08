import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { DoseEvent } from '@/api';
import { Icon } from '@/components/guardian/Icon';
import { GText } from '@/components/guardian/ui';
import { doseName } from '@/lib/doseLabel';
import { reasonTitle } from '@/lib/handoff';
import { seoulClock } from '@/lib/seoulTime';
import { spokenTime } from '@/lib/time';
import { guardian } from '@/theme';

const C = guardian.color;

/**
 * 복약 기록 표시의 종류 (R-054). 끝난 건은 채운 삼각형(드심 초록·안 드심 빨강·확인함 회색, 사용자 결정).
 * 아직 끝나지 않은 건(예정·진행 중·확인 필요)은 사용자가 정하지 않아 테두리만 있는 삼각형으로 덜 눈에 띄게 그린다.
 * 확인 필요는 아래 '확인할 일' 목록이 주된 표시다. 색만으로 구분하지 않도록 범례 글자와 누르면 나오는 설명을 함께 둔다
 */
type MarkKind = 'taken' | 'not_taken' | 'acknowledged' | 'attention' | 'progress' | 'scheduled';

const MARK: Record<MarkKind, { color: string; label: string; filled: boolean }> = {
  taken: { color: C.ok, label: '드심', filled: true },
  not_taken: { color: C.danger, label: '안 드심', filled: true },
  acknowledged: { color: '#8A96A3', label: '확인함', filled: true },
  attention: { color: C.danger, label: '확인 필요', filled: false },
  progress: { color: C.primary, label: '진행 중', filled: false },
  scheduled: { color: '#8A96A3', label: '예정', filled: false },
};
const LEGEND_ORDER: MarkKind[] = ['taken', 'not_taken', 'acknowledged', 'attention', 'progress', 'scheduled'];

export function markKind(ev: DoseEvent): MarkKind {
  if (ev.outcome === 'taken') return 'taken';
  if (ev.outcome === 'not_taken') return 'not_taken';
  if (ev.outcome === 'acknowledged') return 'acknowledged';
  if (ev.handoff && !ev.handoff.verdict) return 'attention';
  if (ev.state === 'scheduled') return 'scheduled';
  return 'progress';
}

const DAY = 1440;
const TICKS = [0, 360, 720, 1080, 1440];
/** 삼각형 그림 크기 (작게) */
const TRI_W = 16;
const TRI_H = 12;
/** 터치 영역 (44 이상) */
const HIT = 48;
/** 좌우 여백: 0시·24시의 터치 영역이 잘리지 않게 */
const PAD = HIT / 2;
const NOW_H = 12;
const AXIS_Y = NOW_H + 4;
const LANE_H = HIT;
/** 삼각형 + 이름이 보이는 높이 */
const MARK_VISIBLE = 38;

/** 서울 시각의 하루 중 분 */
const minuteOf = (iso: string) => {
  const { h, min } = seoulClock(new Date(iso));
  return h * 60 + min;
};

/** 표시 위치: 실제 사진 찍은 시각이 있으면 그 시각, 없으면 예정 시각 */
const markAt = (ev: DoseEvent) => (ev.photos.length ? ev.photos[ev.photos.length - 1].taken_at : ev.scheduled_at);

function Tri({ kind, up, size = 1 }: { kind: MarkKind | 'now'; up: boolean; size?: number }) {
  const w = TRI_W * size;
  const h = TRI_H * size;
  const m = kind === 'now' ? { color: C.primary, filled: true } : MARK[kind];
  const sw = 2;
  // 테두리 두께만큼 안쪽으로 그린다
  const pts = up ? `${w / 2},${sw} ${w - sw},${h - sw / 2} ${sw},${h - sw / 2}` : `${sw},${sw / 2} ${w - sw},${sw / 2} ${w / 2},${h - sw}`;
  return (
    <Svg width={w} height={h}>
      <Polygon points={pts} fill={m.filled ? m.color : C.card} stroke={m.color} strokeWidth={sw} strokeLinejoin="round" />
    </Svg>
  );
}

/** 누르면 나오는 글자 설명: "아침 8시 12분 드심" */
export function markText(ev: DoseEvent): string {
  const k = markKind(ev);
  const photo = ev.photos.length > 0;
  const when = spokenTime(new Date(markAt(ev)));
  const status = k === 'attention' && ev.handoff ? `확인 필요 · ${reasonTitle(ev.handoff.reason)}` : MARK[k].label;
  return `${doseName(ev)} ${when}${photo ? ' 사진' : ''} ${status}${ev.is_simulated ? ' (시뮬레이션)' : ''}`;
}

/**
 * 오늘 가로 시간축 (R-051, R-054, G4). 0시~24시 고정, 눈금 0·6·12·18·24시.
 * 지금 시각은 축 위의 파란 아래 방향 삼각형, 복약 기록은 축 아래의 위 방향 삼각형(사진 찍은 시각, 없으면 예정 시각).
 * 삼각형은 작지만 터치 영역은 48. 가까운 표시는 아래 줄로 내려 겹치지 않게 하고 세로선으로 축의 자리와 잇는다.
 * 누르면 그 건의 글자 설명과 '자세히'가 보인다. 전날에서 넘어온 건(carried_over)은 그리지 않는다 (확인할 일 목록에 나온다)
 */
export function DayTimeline({
  items,
  now,
  onOpen,
  extra,
}: {
  items: DoseEvent[];
  now: Date;
  onOpen: (ev: DoseEvent) => void;
  /** 범례 줄 끝에 붙일 표시 (예: 모의 결과 포함) */
  extra?: React.ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const evs = items
    .filter((e) => !e.carried_over)
    .map((ev) => ({ ev, min: minuteOf(markAt(ev)) }))
    .sort((a, b) => a.min - b.min);
  const nowMin = minuteOf(now.toISOString());

  const inner = Math.max(0, width - PAD * 2);
  const x = (m: number) => PAD + (m / DAY) * inner;

  // 터치 영역이 겹치는 표시는 다음 줄로 내린다 (줄마다 마지막 위치를 기억)
  const laneEnds: number[] = [];
  const marks = evs.map(({ ev, min }) => {
    const px = x(min);
    let lane = laneEnds.findIndex((end) => px - end >= HIT);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = px;
    return { ev, px, lane };
  });
  const lanes = Math.max(1, laneEnds.length);
  const present = new Set(marks.map((m) => markKind(m.ev)));
  const kinds = LEGEND_ORDER.filter((k) => present.has(k));
  const sel = marks.find((m) => m.ev.id === selected)?.ev ?? null;

  // 마지막 줄은 삼각형과 이름까지만 높이를 잡는다 (터치 영역의 아래 빈 부분은 눈금 글자와 겹쳐도 된다)
  const height = AXIS_Y + (lanes - 1) * LANE_H + MARK_VISIBLE;

  return (
    <View style={{ gap: 2 }}>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            {/* 축과 눈금 */}
            <View style={[s.axis, { top: AXIS_Y - 1, left: PAD, right: PAD }]} />
            {TICKS.map((m) => (
              <View key={m} style={[s.tick, { left: x(m) - 0.5, top: AXIS_Y - 4 }]} />
            ))}
            {/* 지금 (축 위, 아래 방향) */}
            <View
              style={{ position: 'absolute', left: x(nowMin) - TRI_W / 2, top: AXIS_Y - NOW_H - 1 }}
              accessible
              accessibilityLabel={`지금 ${spokenTime(now)}`}
            >
              <Tri kind="now" up={false} />
            </View>
            {/* 복약 기록 (축 아래, 위 방향) */}
            {marks.map(({ ev, px, lane }) => {
              const k = markKind(ev);
              const on = selected === ev.id;
              const top = AXIS_Y + lane * LANE_H;
              return (
                <View key={ev.id} pointerEvents="box-none">
                  {lane > 0 ? <View style={[s.stem, { left: px - 0.5, top: AXIS_Y, height: lane * LANE_H }]} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${markText(ev)}. 설명 보기`}
                    accessibilityState={{ selected: on }}
                    onPress={() => setSelected(on ? null : ev.id)}
                    style={({ pressed }) => [s.hit, { left: px - HIT / 2, top }, (pressed || on) && { backgroundColor: C.neutralSoft }]}
                  >
                    <Tri kind={k} up />
                    <Text style={s.markLabel} numberOfLines={1}>
                      {doseName(ev)}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        ) : null}
      </View>
      {/* 시각 눈금 */}
      <View style={{ height: 20 }}>
        {width > 0
          ? TICKS.map((m) => (
              <Text key={m} style={[s.tickLabel, { left: x(m) - 24 }]}>
                {m / 60}시
              </Text>
            ))
          : null}
      </View>
      {/* 누른 표시의 글자 설명 */}
      {sel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${markText(sel)}. 자세히 보기`}
          accessibilityLiveRegion="polite"
          onPress={() => onOpen(sel)}
          style={({ pressed }) => [s.detail, pressed && { backgroundColor: C.neutralSoft }]}
        >
          <Tri kind={markKind(sel)} up />
          <GText variant="bodyStrong" style={{ flex: 1 }}>
            {markText(sel)}
          </GText>
          <GText variant="label" color={C.primaryStrong}>
            자세히
          </GText>
          <Icon name="chevronRight" size={18} color={C.primaryStrong} />
        </Pressable>
      ) : null}
      {/* 범례: 지금 + 이 화면에 나온 표시 (삼각형 + 글자) */}
      <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={s.legendItem}>
          <Tri kind="now" up={false} size={0.85} />
          <GText variant="sub" color={C.sub}>
            지금
          </GText>
        </View>
        {kinds.map((k) => (
          <View key={k} style={s.legendItem}>
            <Tri kind={k} up size={0.85} />
            <GText variant="sub" color={C.sub}>
              {MARK[k].label}
            </GText>
          </View>
        ))}
        {extra}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  axis: { position: 'absolute', height: 2, backgroundColor: '#C5CEDA', borderRadius: 1 },
  tick: { position: 'absolute', width: 1, height: 8, backgroundColor: '#C5CEDA' },
  stem: { position: 'absolute', width: 1, backgroundColor: '#C5CEDA' },
  hit: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', paddingTop: 1, borderRadius: 8 },
  markLabel: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: C.text, marginTop: 2 },
  tickLabel: { position: 'absolute', width: 48, textAlign: 'center', fontSize: 15, lineHeight: 20, color: C.sub },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
