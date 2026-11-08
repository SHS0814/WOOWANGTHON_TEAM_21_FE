import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DoseEvent } from '@/api';
import { Icon, type IconName } from '@/components/guardian/Icon';
import { GText, TONE } from '@/components/guardian/ui';
import { doseName } from '@/lib/doseLabel';
import { seoulClock } from '@/lib/seoulTime';
import { spokenTime, TIME_OF_DAY_LABELS } from '@/lib/time';
import { guardian, type GuardianTone } from '@/theme';

const C = guardian.color;

/** 한 복약 건의 표시. 색만으로 구분하지 않도록 모양(채움·테두리)과 기호, 글자가 함께 바뀐다 */
type MarkKind = 'taken' | 'not_taken' | 'attention' | 'acknowledged' | 'progress' | 'scheduled';

const MARK: Record<MarkKind, { tone: GuardianTone; label: string; icon?: IconName; glyph?: string; filled: boolean }> = {
  taken: { tone: 'ok', label: '드심', icon: 'check', filled: true },
  not_taken: { tone: 'danger', label: '안 드심', icon: 'x', filled: true },
  attention: { tone: 'danger', label: '확인 필요', glyph: '!', filled: true },
  acknowledged: { tone: 'neutral', label: '확인함', icon: 'minus', filled: true },
  progress: { tone: 'info', label: '진행 중', glyph: '?', filled: false },
  scheduled: { tone: 'neutral', label: '예정', icon: 'clock', filled: false },
};

export function markKind(ev: DoseEvent): MarkKind {
  if (ev.outcome === 'taken') return 'taken';
  if (ev.outcome === 'not_taken') return 'not_taken';
  if (ev.outcome === 'acknowledged') return 'acknowledged';
  if (ev.handoff && !ev.handoff.verdict) return 'attention';
  if (ev.state === 'scheduled') return 'scheduled';
  return 'progress';
}

const MARK_SIZE = 30;
const PHOTO_SIZE = 26;
const LANE_H = 52;

/** 서울 시각의 하루 중 분 */
const minuteOf = (iso: string) => {
  const { h, min } = seoulClock(new Date(iso));
  return h * 60 + min;
};

/**
 * 오늘 가로 시간축 (R-051, G4). 축 아래는 예정 시각(복약 건 하나에 표시 하나), 축 위는 실제 사진 찍은 시각.
 * 표시를 누르면 그 건을 연다. 전날에서 넘어온 건(carried_over)은 오늘 축에 그리지 않는다 (확인할 일 목록에 나온다)
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
  const evs = items.filter((e) => !e.carried_over).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const photos = evs.flatMap((ev) => ev.photos.map((p) => ({ ev, at: p.taken_at, id: p.id })));
  const nowMin = minuteOf(now.toISOString());

  // 오늘 일정 범위 (앞뒤 1시간, 지금 포함, 최소 6시간)
  const mins = [...evs.map((e) => minuteOf(e.scheduled_at)), ...photos.map((p) => minuteOf(p.at)), nowMin];
  let start = Math.max(0, Math.floor((Math.min(...mins) - 60) / 60) * 60);
  let end = Math.min(1440, Math.ceil((Math.max(...mins) + 60) / 60) * 60);
  if (end - start < 360) {
    const pad = (360 - (end - start)) / 2;
    start = Math.max(0, Math.floor((start - pad) / 60) * 60);
    end = Math.min(1440, start + 360);
  }
  const span = end - start;
  const step = span <= 600 ? 120 : span <= 960 ? 180 : 360;
  const ticks: number[] = [];
  for (let m = Math.ceil(start / step) * step; m <= end; m += step) ticks.push(m);

  const inner = Math.max(0, width - MARK_SIZE);
  const x = (m: number) => MARK_SIZE / 2 + ((m - start) / span) * inner;

  // 가까운 예정 표시는 두 줄로 엇갈려 놓는다
  let lastX = -Infinity;
  let lastLane = 1;
  const marks = evs.map((ev) => {
    const px = x(minuteOf(ev.scheduled_at));
    const lane = px - lastX < 56 ? 1 - lastLane : 0;
    lastX = px;
    lastLane = lane;
    return { ev, px, lane };
  });
  const lanes = marks.some((m) => m.lane === 1) ? 2 : 1;
  const kinds = [...new Set(marks.map((m) => markKind(m.ev)))];

  const axisY = PHOTO_SIZE + 10;
  const height = axisY + MARK_SIZE / 2 + 24 + (lanes - 1) * LANE_H;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            {/* 축 */}
            <View style={[s.axis, { top: axisY, left: MARK_SIZE / 2, right: MARK_SIZE / 2 }]} />
            {ticks.map((m) => (
              <View key={m} style={[s.tick, { left: x(m) - 0.5, top: axisY - 4 }]} />
            ))}
            {nowMin >= start && nowMin <= end ? (
              <View style={[s.now, { left: x(nowMin) - 1, top: 0, height }]} accessibilityLabel={`지금 ${spokenTime(now)}`} />
            ) : null}
            {/* 사진 찍은 시각 (축 위) */}
            {photos.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${doseName(p.ev)} 약 사진, ${spokenTime(new Date(p.at))}. 자세히 보기`}
                hitSlop={10}
                onPress={() => onOpen(p.ev)}
                style={[s.photo, { left: x(minuteOf(p.at)) - PHOTO_SIZE / 2, top: 0 }]}
              >
                <Icon name="camera" size={16} color={C.primaryStrong} strokeWidth={2.2} />
              </Pressable>
            ))}
            {/* 예정 시각 (축 아래) */}
            {marks.map(({ ev, px, lane }) => {
              const k = markKind(ev);
              const mk = MARK[k];
              const t = TONE[mk.tone];
              const photoAt = ev.photos.length ? ev.photos[ev.photos.length - 1].taken_at : null;
              return (
                <Pressable
                  key={ev.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${doseName(ev)} 약 ${spokenTime(new Date(ev.scheduled_at))} 예정, ${mk.label}${photoAt ? `, ${spokenTime(new Date(photoAt))} 사진` : ''}${ev.is_simulated ? ', 시뮬레이션' : ''}. 자세히 보기`}
                  hitSlop={8}
                  onPress={() => onOpen(ev)}
                  style={[s.markWrap, { left: px - 30, top: axisY - MARK_SIZE / 2 + lane * LANE_H }]}
                >
                  <View
                    style={[
                      s.mark,
                      mk.filled ? { backgroundColor: t.fg, borderColor: t.fg } : { backgroundColor: C.card, borderColor: t.fg },
                    ]}
                  >
                    {mk.icon ? (
                      <Icon name={mk.icon} size={16} color={mk.filled ? C.onPrimary : t.fg} strokeWidth={3} />
                    ) : (
                      <Text style={[s.glyph, { color: mk.filled ? C.onPrimary : t.fg }]}>{mk.glyph}</Text>
                    )}
                  </View>
                  <Text style={s.markLabel} numberOfLines={1}>
                    {TIME_OF_DAY_LABELS[ev.slot.time_of_day]}
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
          ? ticks.map((m) => (
              <Text key={m} style={[s.tickLabel, { left: x(m) - 24 }]}>
                {m / 60}시
              </Text>
            ))
          : null}
      </View>
      {/* 범례: 이 화면에 나온 표시만 */}
      <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {kinds.map((k) => {
          const mk = MARK[k];
          const t = TONE[mk.tone];
          return (
            <View key={k} style={s.legendItem}>
              <View style={[s.legendMark, mk.filled ? { backgroundColor: t.fg, borderColor: t.fg } : { backgroundColor: C.card, borderColor: t.fg }]}>
                {mk.icon ? (
                  <Icon name={mk.icon} size={11} color={mk.filled ? C.onPrimary : t.fg} strokeWidth={3} />
                ) : (
                  <Text style={[s.legendGlyph, { color: mk.filled ? C.onPrimary : t.fg }]}>{mk.glyph}</Text>
                )}
              </View>
              <GText variant="sub" color={C.sub}>
                {mk.label}
              </GText>
            </View>
          );
        })}
        {photos.length ? (
          <View style={s.legendItem}>
            <View style={[s.legendMark, { backgroundColor: C.primarySoft, borderColor: C.primarySoft }]}>
              <Icon name="camera" size={11} color={C.primaryStrong} strokeWidth={2.4} />
            </View>
            <GText variant="sub" color={C.sub}>
              사진
            </GText>
          </View>
        ) : null}
        {extra}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  axis: { position: 'absolute', height: 2, backgroundColor: '#C5CEDA', borderRadius: 1 },
  tick: { position: 'absolute', width: 1, height: 10, backgroundColor: '#C5CEDA' },
  now: { position: 'absolute', width: 2, backgroundColor: C.primary, opacity: 0.35 },
  photo: {
    position: 'absolute',
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    backgroundColor: C.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrap: { position: 'absolute', width: 60, alignItems: 'center', gap: 2 },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 17, lineHeight: 20, fontWeight: '900' },
  markLabel: { fontSize: 16, lineHeight: 20, fontWeight: '700', color: C.text },
  tickLabel: { position: 'absolute', width: 48, textAlign: 'center', fontSize: 16, lineHeight: 20, color: C.sub },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendMark: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  legendGlyph: { fontSize: 12, lineHeight: 14, fontWeight: '900' },
});
