import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { api, type DoseEvent } from '@/api';
import { DayTimeline } from '@/components/guardian/DayTimeline';
import { Icon } from '@/components/guardian/Icon';
import { RemotePhoto } from '@/components/RemotePhoto';
import { Section, GButton, GScreen, GText, IconBubble, ListGroup, ListRow, MockTag, Notice, SectionTitle, StatusChip } from '@/components/guardian/ui';
import { doseStatus, takenCount } from '@/lib/doseStatus';
import { clearResolvedHandoffNotifications } from '@/notify/guardianPush';
import { reasonTitle } from '@/lib/handoff';
import { doseName } from '@/lib/doseLabel';
import { dateKey, longDate, spokenTime, TIME_OF_DAY_LABELS, weekdayLong } from '@/lib/time';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { guardian } from '@/theme';

const C = guardian.color;
/** 확인할 일을 펼쳐 두는 최대 건수 */
const FIT_MAX = 2;

/**
 * G4 홈 (R-051, T-FE16). 스크롤 없이 한 화면: 오늘 요약(가로 시간축) → 확인할 일(정해진 개수, 나머지는 펼침)
 * → 다음 할 일(화면 아래 고정). 정상인 날은 요약 한 덩어리만 보이는 조용한 화면이 정상이다 (원칙 2)
 */
export default function GuardianHome() {
  const { data: hasToken } = useApiData(() => api.hasToken());
  const { data: me } = useMe();
  // 인계는 다른 기기(어르신 폰)나 서버 예약 작업(최대 1분 지연)에서 생기므로 주기적으로 다시 읽는다.
  // 아래 넷은 서버가 아직 구현 중이거나 약통이 없으면 실패할 수 있다 → 실패하면 그 부분만 숨긴다
  const { data: open } = useApiData(() => api.handoffs('open').catch(() => null), [], { pollMs: POLL_MS });
  // 이미 판정된 인계의 알림이 알림창에 남아 헷갈리지 않게 지운다 (열려 있는 목록을 읽을 때마다)
  useEffect(() => {
    if (open) void clearResolvedHandoffNotifications(open.map((h) => h.id));
  }, [open]);
  const { data: day } = useApiData(() => api.summaries('day', dateKey(new Date()), dateKey(new Date())).catch(() => null), [], { pollMs: POLL_MS });
  const { data: box } = useApiData(() => api.currentPillbox().catch(() => null), [], { pollMs: POLL_MS });
  // R-071: 어르신이 약통을 채우는 집(elder_refill_prompt)이면 약통 채우기는 보호자 할 일이 아니다. 못 읽으면 기본값(false)
  const { data: settings } = useApiData(() => api.settings().catch(() => null));
  // 어르신 폰 알림 준비가 안 됐을 때만 경고 (R-032, 원칙 2: 정상이면 아무것도 안 보인다)
  const { data: today } = useApiData(() => api.today().catch(() => null), [], { pollMs: POLL_MS });
  const [expanded, setExpanded] = useState(false);
  const { height } = useWindowDimensions();
  // 확인할 일을 몇 건까지 펼쳐 둘지 (R-051: 스크롤 없이 한 화면, R-053 후속 2).
  // 기본 2건. 넘치면 줄이고, 데이터가 늦게 와서 한때 넘쳤다가 공간이 남으면(행 높이만큼) 다시 늘린다.
  // 늘렸다가 다시 넘치면 그 개수에서 멈춘다 (오락가락 방지)
  const [fit, setFit] = useState(FIT_MAX);
  const rowH = useRef(0);
  const ceiling = useRef(FIT_MAX);
  const grew = useRef(false);
  const openCount = open?.length ?? 0;
  useEffect(() => {
    ceiling.current = FIT_MAX;
    grew.current = false;
    setFit(FIT_MAX);
  }, [openCount, height]);

  if (hasToken === undefined) return null;
  if (!hasToken) return <Redirect href="/guardian/connect" />;
  if (!me) return null;

  const now = new Date();
  const summary = day?.[day.length - 1];
  const c = summary?.counts;
  const items = today?.items ?? [];
  const next = today?.next_event;

  const openEvent = (ev: DoseEvent) =>
    ev.handoff
      ? router.push({ pathname: '/guardian/handoff/[id]', params: { id: ev.handoff.id } })
      : router.push({ pathname: '/guardian/event/[id]', params: { id: ev.id, date: ev.date } });

  // 확인할 일은 정해진 개수만 보이고 나머지는 펼친다. 작은 폰은 1건 (R-051: 다음 할 일이 항상 보이게)
  const compact = height < 760;
  const limit = fit;
  const onMeasure = (viewport: number, content: number) => {
    if (expanded) return;
    const slack = viewport - content;
    if (slack < -1 && fit > 0) {
      // 방금 늘려서 넘친 것이면 그 아래 개수를 상한으로 둔다
      if (grew.current) ceiling.current = fit - 1;
      grew.current = false;
      setFit(fit - 1);
    } else if (fit < Math.min(ceiling.current, openCount) && rowH.current > 0 && slack >= rowH.current + 2) {
      grew.current = true;
      setFit(fit + 1);
    }
  };
  const mockTags =
    summary && (summary.includes_mock || summary.includes_simulated) ? (
      <>
        {summary.includes_mock ? <MockTag label="모의 결과 포함" /> : null}
        {summary.includes_simulated ? <MockTag label="시뮬레이션 포함" /> : null}
      </>
    ) : null;
  const openList = open ?? [];
  const shown = expanded ? openList : openList.slice(0, limit);
  const hidden = openList.length - shown.length;
  // 오늘 기록: 끝났거나 진행 중인 건을 정상이든 아니든 모두 보여 준다 (사용자 결정 2026-11-14).
  // 아직 답을 기다리는 인계 건은 바로 위 '확인할 일'에 있으므로 여기서는 뺀다. 판정하면 이 목록으로 내려온다
  const records = items
    .filter((e) => !e.carried_over && e.state !== 'scheduled' && !(e.handoff && !e.handoff.verdict))
    .sort((a, b) => recordAt(a).localeCompare(recordAt(b)));

  // 화면 아래에는 다음 복약 시각만 둔다. 약통 채우기·약통 상태 불일치 행은 홈에 두지 않는다
  // (사용자 결정 2026-11-14: 보호자는 멀리 있어 약통을 채울 수 없다). 약통 채우기는 설정 탭에서 들어간다
  const nextRows = next ? (
    <ListGroup style={{ marginTop: 0, borderBottomWidth: 0 }}>
      <ListRow
        dense
        icon="clock"
        title={`다음 복약 · ${TIME_OF_DAY_LABELS[next.time_of_day]}`}
        subtitle={`${dateKey(new Date(next.scheduled_at)) === dateKey(now) ? '오늘' : longDate(new Date(next.scheduled_at))} ${spokenTime(new Date(next.scheduled_at))}에 여쭤봐요`}
      />
    </ListGroup>
  ) : undefined;

  return (
    <GScreen inTabs dense footer={nextRows} onMeasure={onMeasure}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <GText variant="title" accessibilityRole="header">
          오늘
        </GText>
        <GText variant="label" color={C.sub}>
          {longDate(now)} {weekdayLong(now)}
        </GText>
      </View>

      {today?.elder_notification_warning ? (
        <Notice
          tone="warn"
          title="어르신 폰 알림 설정이 꺼져 있어 알림이 늦을 수 있어요"
          onPress={() => router.push('/guardian/settings')}
          accessibilityLabel="어르신 폰 알림 설정이 꺼져 있어 알림이 늦을 수 있어요. 무엇을 켜야 하는지 보기"
        />
      ) : null}

      {!me.family.has_pillbox ? (
        <SetupCard
          step="1단계"
          title="약통을 등록해 주세요"
          detail="약을 채운 약통을 한 번 찍으면 AI가 칸 구조를 읽어요."
          icon="pillbox"
          label="약통 등록하기"
          onPress={() => router.push('/guardian/pillbox')}
        />
      ) : !me.family.has_schedule ? (
        <SetupCard
          step="2단계"
          title="복약 시각을 정해 주세요"
          detail="정한 시각에 앱이 어르신께 여쭤봐요."
          icon="clock"
          label="복약 시각 정하기"
          onPress={() => router.push('/guardian/schedule')}
        />
      ) : null}

      {/* 오늘 요약: 숫자 + 가로 시간축 */}
      {summary && c ? (
        <Section style={{ paddingBottom: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}
              accessible
              accessibilityLabel={`오늘 ${c.scheduled}번 중 ${takenCount(summary)}번 기록${c.pending ? `, ${c.pending}번 남음` : ''}`}
            >
              <GText variant="title">
                {takenCount(summary)}
                <GText variant="section" color={C.sub}>
                  {' '}
                  / {c.scheduled}번 기록
                </GText>
              </GText>
            </View>
            {summary.all_normal ? (
              <StatusChip tone="ok" label="모두 정상" />
            ) : c.open_handoffs ? (
              <StatusChip tone="danger" label={`오늘 확인할 일 ${c.open_handoffs}건`} />
            ) : c.pending ? (
              <StatusChip tone="neutral" label={`${c.pending}번 남음`} />
            ) : null}
          </View>
          {items.some((e) => !e.carried_over) ? <DayTimeline items={items} now={now} onOpen={openEvent} extra={mockTags} /> : mockTags}
        </Section>
      ) : null}

      {/* 확인할 일 */}
      {openList.length > 0 ? (
        <View style={{ marginTop: -8 }}>
          <SectionTitle right={<StatusChip tone="danger" label={`${openList.length}건`} />}>확인할 일</SectionTitle>
          <ListGroup style={{ marginTop: 4 }}>
            {shown.map((h) => (
              <View key={h.id} onLayout={(e) => (rowH.current = Math.max(rowH.current, e.nativeEvent.layout.height))}>
                <ListRow
                  dense
                  icon="alert"
                  iconTone="danger"
                  title={reasonTitle(h.reason)}
                  titleColor={C.danger}
                  subtitle={
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 }}>
                      <GText variant="sub" color={C.sub}>
                        {doseName(h.dose_event)} 약 · {spokenTime(new Date(h.notified_at))} 알림
                      </GText>
                      {h.dose_event.is_simulated ? <MockTag label="시뮬레이션" a11y="시뮬레이션, 실제 복약 시각 알림 아님" /> : null}
                    </View>
                  }
                  accessibilityLabel={`${doseName(h.dose_event)} 약, ${reasonTitle(h.reason)}${h.dose_event.is_simulated ? ', 시뮬레이션' : ''}. 자세히 보기`}
                  onPress={() => router.push({ pathname: '/guardian/handoff/[id]', params: { id: h.id } })}
                />
              </View>
            ))}
            {openList.length > limit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={expanded ? '확인할 일 접기' : `확인할 일 ${hidden}건 더 보기`}
                accessibilityState={{ expanded }}
                onPress={() => setExpanded((v) => !v)}
                style={({ pressed }) => [styles.more, pressed && { backgroundColor: C.neutralSoft }]}
              >
                <GText variant="label" color={C.primaryStrong}>
                  {expanded ? '접기' : shown.length ? `${hidden}건 더 보기` : `${hidden}건 보기`}
                </GText>
                <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={20} color={C.primaryStrong} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </ListGroup>
        </View>
      ) : null}

      {/* 오늘 기록 */}
      {records.length > 0 ? (
        <View style={{ marginTop: -8 }}>
          <SectionTitle>오늘 기록</SectionTitle>
          <ListGroup style={{ marginTop: 4 }}>
            {records.map((ev) => {
              const st = doseStatus(ev);
              const photo = ev.photos[ev.photos.length - 1];
              const when = spokenTime(new Date(recordAt(ev)));
              return (
                <Pressable
                  key={ev.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${doseName(ev)} 약, ${when}, ${st.label}${ev.reminded_at ? ', 한 번 안내한 뒤' : ''}${ev.is_simulated ? ', 시뮬레이션' : ''}. 자세히 보기`}
                  onPress={() => openEvent(ev)}
                  style={({ pressed }) => [styles.record, pressed && { backgroundColor: C.neutralSoft }]}
                >
                  {photo ? (
                    <RemotePhoto photo={photo} style={styles.thumb} label={`${doseName(ev)} 약통 사진`} />
                  ) : (
                    <IconBubble name="pill" tone="neutral" size={44} />
                  )}
                  <View style={{ flex: 1 }}>
                    <GText variant="bodyStrong">{doseName(ev)} 약</GText>
                    <GText variant="sub" color={C.sub}>
                      {when}
                      {/* 처음 사진에서 칸이 그대로여서 한 번 안내한 건은 그 뒤 정상으로 끝나도 표시한다 */}
                      {ev.reminded_at ? ' · 안내 1회 뒤' : ''}
                      {ev.is_simulated ? ' · 시뮬레이션' : ''}
                    </GText>
                  </View>
                  <StatusChip tone={st.tone} label={st.label} icon={st.icon} />
                </Pressable>
              );
            })}
          </ListGroup>
        </View>
      ) : null}
    </GScreen>
  );
}

/** 기록 시각: 사진을 찍은 시각, 없으면 예정 시각 */
function recordAt(ev: DoseEvent): string {
  return ev.photos.length ? ev.photos[ev.photos.length - 1].taken_at : ev.scheduled_at;
}

function SetupCard({
  step,
  title,
  detail,
  icon,
  label,
  onPress,
}: {
  step: string;
  title: string;
  detail: string;
  icon: 'pillbox' | 'clock';
  label: string;
  onPress: () => void;
}) {
  return (
    <Section>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <IconBubble name={icon} tone="info" size={48} />
        <View style={{ flex: 1 }}>
          <GText variant="label" color={C.primaryStrong}>
            시작하기 · {step}
          </GText>
          <GText variant="section">{title}</GText>
        </View>
      </View>
      <GText color={C.sub}>{detail}</GText>
      <GButton label={label} onPress={onPress} />
    </Section>
  );
}

const styles = StyleSheet.create({
  record: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  thumb: { width: 60, height: 45, borderRadius: 6, backgroundColor: C.neutralSoft },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginHorizontal: -8, paddingHorizontal: 8 },
});
