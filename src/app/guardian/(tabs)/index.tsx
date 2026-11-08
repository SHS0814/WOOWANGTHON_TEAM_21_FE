import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Section, GButton, GScreen, GText, IconBubble, ListGroup, ListRow, MockTag, Notice, SectionTitle, StatusChip } from '@/components/guardian/ui';
import { SimulationTag } from '@/components/MockBanner';
import { doseStatus, takenCount } from '@/lib/doseStatus';
import { reasonTitle } from '@/lib/handoff';
import { doseName } from '@/lib/doseLabel';
import { dateKey, longDate, spokenTime, TIME_OF_DAY_LABELS, weekdayLong } from '@/lib/time';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { guardian } from '@/theme';

const C = guardian.color;

/**
 * G4 홈. 오늘 요약 카드 → 확인할 일 → 다음 복약 → 약통 (T-FE14).
 * 정상인 날은 요약 카드 한 장만 보이는 조용한 화면이 정상이다 (원칙 2)
 */
export default function GuardianHome() {
  const { data: hasToken } = useApiData(() => api.hasToken());
  const { data: me } = useMe();
  // 인계는 다른 기기(어르신 폰)나 서버 예약 작업(최대 1분 지연)에서 생기므로 주기적으로 다시 읽는다.
  // 아래 넷은 서버가 아직 구현 중이거나 약통이 없으면 실패할 수 있다 → 실패하면 그 부분만 숨긴다
  const { data: open } = useApiData(() => api.handoffs('open').catch(() => null), [], { pollMs: POLL_MS });
  const { data: day } = useApiData(() => api.summaries('day', dateKey(new Date()), dateKey(new Date())).catch(() => null), [], { pollMs: POLL_MS });
  const { data: box } = useApiData(() => api.currentPillbox().catch(() => null));
  // 어르신 폰 알림 준비가 안 됐을 때만 경고 (R-032, 원칙 2: 정상이면 아무것도 안 보인다)
  const { data: today } = useApiData(() => api.today().catch(() => null), [], { pollMs: POLL_MS });

  if (hasToken === undefined) return null;
  if (!hasToken) return <Redirect href="/guardian/connect" />;
  if (!me) return null;

  const now = new Date();
  const summary = day?.[day.length - 1];
  const c = summary?.counts;
  const elder = me.family.elder_display_name;
  const items = today?.items ?? [];
  const next = today?.next_event;

  return (
    <GScreen inTabs eyebrow={`${longDate(now)} ${weekdayLong(now)}`} title={`${elder} 오늘`}>
      {today?.elder_notification_warning ? (
        <Notice
          tone="warn"
          title="어르신 폰 알림 설정이 꺼져 있어 알림이 늦을 수 있어요"
          onPress={() => router.push('/guardian/settings')}
          accessibilityLabel="어르신 폰 알림 설정이 꺼져 있어 알림이 늦을 수 있어요. 무엇을 켜야 하는지 보기"
        >
          무엇을 켜야 하는지 보기
        </Notice>
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

      {/* 오늘 요약 */}
      {summary && c ? (
        <Section>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <GText variant="label" color={C.sub}>
                오늘 복약 기록
              </GText>
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}
                accessible
                accessibilityLabel={`오늘 ${c.scheduled}번 중 ${takenCount(summary)}번 기록`}
              >
                <GText variant="stat">{takenCount(summary)}</GText>
                <GText variant="section" color={C.sub}>
                  {' '}
                  / {c.scheduled}번
                </GText>
              </View>
            </View>
            {summary.all_normal ? (
              <StatusChip tone="ok" label="모두 정상" />
            ) : c.open_handoffs ? (
              <StatusChip tone="danger" label={`오늘 확인할 일 ${c.open_handoffs}건`} />
            ) : c.pending ? (
              <StatusChip tone="neutral" label={`${c.pending}번 남음`} />
            ) : null}
          </View>
          {c.scheduled > 0 ? <Progress done={takenCount(summary)} total={c.scheduled} /> : null}
          {summary.all_normal ? (
            <GText color={C.sub}>✓ 오늘 {c.scheduled}번 모두 정상이에요.</GText>
          ) : (
            <GText color={C.sub}>
              오늘 {c.scheduled}번 중 {takenCount(summary)}번 기록
              {c.open_handoffs ? `, 처리할 일 ${c.open_handoffs}건` : ''}
              {c.pending ? `, ${c.pending}번 남음` : ''}
            </GText>
          )}
          {summary.includes_mock || summary.includes_simulated ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {summary.includes_mock ? <MockTag label="모의 결과 포함" /> : null}
              {summary.includes_simulated ? <MockTag label="시뮬레이션 포함" /> : null}
            </View>
          ) : null}
          {items.length ? (
            <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingTop: 4 }}>
              {items.map((ev) => {
                const st = doseStatus(ev);
                return (
                  <View key={ev.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <View style={{ flex: 1 }}>
                      <GText variant="bodyStrong">{doseName(ev)}</GText>
                      <GText variant="sub" color={C.sub}>
                        {spokenTime(new Date(ev.scheduled_at))}
                      </GText>
                      {ev.is_simulated ? <MockTag label="시뮬레이션" /> : null}
                    </View>
                    <StatusChip tone={st.tone} label={st.label} icon={st.icon} />
                  </View>
                );
              })}
            </View>
          ) : null}
        </Section>
      ) : null}

      {/* 확인할 일 */}
      {open && open.length > 0 ? (
        <>
          <SectionTitle right={<StatusChip tone="danger" label={`${open.length}건`} />}>확인할 일</SectionTitle>
          <ListGroup>
            {open.map((h) => (
              <ListRow
                key={h.id}
                icon="alert"
                iconTone="danger"
                title={reasonTitle(h.reason)}
                titleColor={C.danger}
                subtitle={`${doseName(h.dose_event)} 약 · ${spokenTime(new Date(h.notified_at))} 알림`}
                accessibilityLabel={`${doseName(h.dose_event)} 약, ${reasonTitle(h.reason)}. 자세히 보기`}
                onPress={() => router.push({ pathname: '/guardian/handoff/[id]', params: { id: h.id } })}
              >
                {h.dose_event.is_simulated ? (
                  <View style={{ marginTop: 4 }}>
                    <SimulationTag />
                  </View>
                ) : null}
                <GText variant="label" color={C.primaryStrong} style={{ marginTop: 2 }}>
                  자세히 보기
                </GText>
              </ListRow>
            ))}
          </ListGroup>
        </>
      ) : null}

      {/* 다음 복약과 약통 */}
      {next || me.family.has_pillbox ? (
        <>
          <SectionTitle>다음 할 일</SectionTitle>
          <ListGroup>
            {next ? (
              <ListRow
                icon="clock"
                title={`다음 복약 · ${TIME_OF_DAY_LABELS[next.time_of_day]}`}
                subtitle={`${dateKey(new Date(next.scheduled_at)) === dateKey(now) ? '오늘' : longDate(new Date(next.scheduled_at))} ${spokenTime(new Date(next.scheduled_at))}에 여쭤봐요`}
              />
            ) : null}
            {me.family.has_pillbox ? (
              <ListRow
                icon="pillbox"
                iconTone={box?.refill_status.needs_refill || box?.pillbox_mismatch.detected ? 'warn' : 'info'}
                title={box ? `약통 남은 칸 ${box.refill_status.remaining_cells}칸` : '약통 채우기'}
                subtitle={box?.refill_status.needs_refill ? undefined : '채운 뒤 사진을 찍어 기록해요'}
                accessibilityLabel={`${box ? `약통 남은 칸 ${box.refill_status.remaining_cells}칸` : '약통'}. 약통 채우기 화면 열기`}
                onPress={() => router.push('/guardian/refill')}
              >
                {box?.refill_status.needs_refill ? (
                  <GText variant="sub" color={C.warn} style={{ fontWeight: '700' }}>
                    ! 약통에 남은 칸이 {box.refill_status.remaining_cells}칸이에요.
                  </GText>
                ) : null}
                {box?.pillbox_mismatch.detected ? (
                  <GText variant="sub" color={C.warn} style={{ fontWeight: '700' }}>
                    ! 약통 상태가 기록과 달라요.
                  </GText>
                ) : null}
              </ListRow>
            ) : null}
          </ListGroup>
        </>
      ) : null}
    </GScreen>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = Math.min(1, total ? done / total : 0);
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: C.neutralSoft, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: C.primary, borderRadius: 4 }} />
    </View>
  );
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
