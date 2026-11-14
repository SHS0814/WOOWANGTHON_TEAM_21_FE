import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { DoseEvent } from '@/api';
import { Icon } from '@/components/guardian/Icon';
import { GText } from '@/components/guardian/ui';
import { doseName } from '@/lib/doseLabel';
import { isSkippedByDouble } from '@/lib/doseStatus';
import { reasonTitle } from '@/lib/handoff';
import { seoulClock } from '@/lib/seoulTime';
import { spokenTime } from '@/lib/time';
import { guardian } from '@/theme';

const C = guardian.color;

/**
 * 복약 기록 표시의 종류 (R-054). 끝난 건은 채운 삼각형(정상 복용 초록·중복 복용 빨강·미복용 주황·건너뜀 회색, 사용자 결정 2026-11-14).
 * 아직 끝나지 않은 건(예정·진행 중·확인 필요)은 사용자가 정하지 않아 테두리만 있는 삼각형으로 덜 눈에 띄게 그린다.
 * 확인 필요는 아래 '확인할 일' 목록이 주된 표시다. 색만으로 구분하지 않도록 범례 글자와 누르면 나오는 설명을 함께 둔다
 */
type MarkKind = 'taken' | 'not_taken' | 'acknowledged' | 'skipped' | 'attention' | 'progress' | 'scheduled';

const MARK: Record<MarkKind, { color: string; label: string; filled: boolean }> = {
  taken: { color: C.ok, label: '정상 복용', filled: true },
  not_taken: { color: C.warn, label: '미복용', filled: true },
  acknowledged: { color: C.danger, label: '중복 복용', filled: true },
  skipped: { color: '#8A96A3', label: '건너뜀', filled: true },
  attention: { color: C.danger, label: '확인 필요', filled: false },
  progress: { color: C.primary, label: '진행 중', filled: false },
  scheduled: { color: '#8A96A3', label: '예정', filled: false },
};
const LEGEND_ORDER: MarkKind[] = ['taken', 'acknowledged', 'not_taken', 'skipped', 'attention', 'progress', 'scheduled'];

export function markKind(ev: DoseEvent): MarkKind {
  if (ev.outcome === 'taken') return 'taken';
  if (ev.outcome === 'not_taken') return 'not_taken';
  if (isSkippedByDouble(ev)) return 'skipped';
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
/** 가까운 표시를 한 묶음으로 겹쳐 그릴 때 삼각형 사이 간격 (삼각형 너비보다 좁아 서로 겹친다) */
const FAN = 10;
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
 * 삼각형은 작지만 터치 영역은 48. 터치 영역이 겹칠 만큼 가까운 표시는 한 묶음으로 모아 같은 줄에 가로로 겹쳐 그린다
 * (세로로 쌓지 않아 높이가 늘지 않는다). 묶음에는 건수를 적고, 누르면 묶음 안의 건이 아래에 한 줄씩 나온다.
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

  // 터치 영역이 겹칠 만큼 가까운 표시는 한 묶음으로 모은다 (앞 표시와의 간격이 HIT 보다 좁으면 같은 묶음)
  const groups: { evs: DoseEvent[]; first: number; last: number }[] = [];
  for (const { ev, min } of evs) {
    const px = x(min);
    const g = groups[groups.length - 1];
    if (g && px - g.last < HIT) {
      g.evs.push(ev);
      g.last = px;
    } else groups.push({ evs: [ev], first: px, last: px });
  }
  // 묶음 안의 삼각형은 FAN 간격으로 가로로 겹쳐 그린다. 묶음의 가운데는 실제 위치의 가운데이고, 축 밖으로 나가지 않게 당긴다
  const clusters = groups.map((g) => {
    const span = (g.evs.length - 1) * FAN;
    const w = Math.max(HIT, span + TRI_W + 16);
    const center = Math.min(Math.max((g.first + g.last) / 2, w / 2), Math.max(w / 2, width - w / 2));
    return { id: g.evs[0].id, evs: g.evs, center, w, span };
  });
  const present = new Set(evs.map((m) => markKind(m.ev)));
  const kinds = LEGEND_ORDER.filter((k) => present.has(k));
  const sel = clusters.find((c) => c.id === selected) ?? null;

  const height = AXIS_Y + MARK_VISIBLE;

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
            {clusters.map((c) => {
              const on = selected === c.id;
              const many = c.evs.length > 1;
              const label = many ? `${c.evs.length}건: ${c.evs.map(markText).join(', ')}` : markText(c.evs[0]);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}. 설명 보기`}
                  accessibilityState={{ selected: on }}
                  onPress={() => setSelected(on ? null : c.id)}
                  style={({ pressed }) => [s.hit, { left: c.center - c.w / 2, top: AXIS_Y, width: c.w }, (pressed || on) && { backgroundColor: C.neutralSoft }]}
                >
                  <View style={{ width: c.span + TRI_W, height: TRI_H }}>
                    {c.evs.map((ev, i) => (
                      <View key={ev.id} style={{ position: 'absolute', left: i * FAN, top: 0 }}>
                        <Tri kind={markKind(ev)} up />
                      </View>
                    ))}
                  </View>
                  <Text style={s.markLabel} numberOfLines={1}>
                    {many ? `${c.evs.length}건` : doseName(c.evs[0])}
                  </Text>
                </Pressable>
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
      {sel
        ? sel.evs.map((ev) => (
            <Pressable
              key={ev.id}
              accessibilityRole="button"
              accessibilityLabel={`${markText(ev)}. 자세히 보기`}
              accessibilityLiveRegion="polite"
              onPress={() => onOpen(ev)}
              style={({ pressed }) => [s.detail, pressed && { backgroundColor: C.neutralSoft }]}
            >
              <Tri kind={markKind(ev)} up />
              <GText variant="bodyStrong" style={{ flex: 1 }}>
                {markText(ev)}
              </GText>
              <GText variant="label" color={C.primaryStrong}>
                자세히
              </GText>
              <Icon name="chevronRight" size={18} color={C.primaryStrong} />
            </Pressable>
          ))
        : null}
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
  hit: { position: 'absolute', height: HIT, alignItems: 'center', paddingTop: 1, borderRadius: 8 },
  markLabel: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: C.text, marginTop: 2 },
  tickLabel: { position: 'absolute', width: 48, textAlign: 'center', fontSize: 15, lineHeight: 20, color: C.sub },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
