import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { api, guardianMessage, isApiError, type Verdict } from '@/api';
import { ReadingView } from '@/components/guardian/ReadingView';
import { Section, ErrorText, GButton, GScreen, GText, IconBubble, Notice, SectionTitle, StatusChip } from '@/components/guardian/ui';
import { SimulationTag } from '@/components/MockBanner';
import { VERDICT_CHIP } from '@/lib/doseStatus';
import { reasonDetail, reasonTitle, VERDICT_LABEL } from '@/lib/handoff';
import { doseName } from '@/lib/doseLabel';
import { goBackOr } from '@/lib/nav';
import { spokenTime } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { guardian } from '@/theme';

const C = guardian.color;

/**
 * G5 인계 상세 (api.md 3.21). 버튼은 서버가 준 allowed_verdicts 대로 (MVP #5).
 * 순서: 무슨 일인지 → 사진과 AI 판독 → 한계 안내 → 보호자 판정(하단 고정).
 * 강조: bbox 가 있는 칸은 사진 위, 없는 칸은 격자 그림 위. 신뢰도 숫자는 없다 (R-008 C5)
 */
export default function HandoffDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: me } = useMe();
  const { data: h, reload } = useApiData(() => api.handoff(id), [id]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');

  if (!h || !me) return null;
  const ev = h.dose_event;
  const tod = doseName(ev);
  // 최근 판독을 맨 위에, 이전 판독(첫 촬영)은 아래에
  const readings = h.readings.slice().reverse();

  const decide = async (v: Verdict) => {
    setBusy(true);
    setMsg('');
    setInfo('');
    try {
      await api.verdict(h.id, v);
      if (v === 'not_refilled') setInfo('약통을 새로 채우면 리필 등록을 해 주세요.');
      else goBackOr('/guardian');
    } catch (e) {
      setMsg(guardianMessage(e));
      if (isApiError(e, 'handoff_already_resolved')) reload();
    } finally {
      setBusy(false);
    }
  };

  // 판정 버튼은 같은 무게로 나란히 둔다. 어느 한쪽으로 유도하지 않는다 (원칙 1)
  const verdicts = h.allowed_verdicts;
  const footer = h.verdict ? (
    <>
      {info ? <Notice tone="info">{info}</Notice> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
        <GText variant="bodyStrong" style={{ flex: 1 }}>
          {h.verdict_by?.display_name ?? '보호자'} 판정
        </GText>
        <StatusChip tone={VERDICT_CHIP[h.verdict].tone} icon={VERDICT_CHIP[h.verdict].icon} label={VERDICT_CHIP[h.verdict].label} />
      </View>
    </>
  ) : (
    <>
      {info ? <Notice tone="info">{info}</Notice> : null}
      {msg ? <ErrorText>{msg}</ErrorText> : null}
      <GText variant="label" color={C.sub}>
        보호자 판정
      </GText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {verdicts.map((v) => (
          <View key={v} style={{ flex: 1 }}>
            <GButton
              variant="secondary"
              stacked={verdicts.length > 2}
              icon={VERDICT_CHIP[v]?.icon}
              iconColor={VERDICT_CHIP[v] ? TONE_FG[VERDICT_CHIP[v].tone] : undefined}
              label={VERDICT_CHIP[v]?.label ?? v}
              accessibilityLabel={VERDICT_LABEL[v] ?? v}
              onPress={() => decide(v)}
              busy={busy}
            />
          </View>
        ))}
      </View>
    </>
  );

  return (
    <GScreen footer={footer}>
      {ev.is_simulated ? <SimulationTag /> : null}

      <Section>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconBubble name="alert" tone="danger" size={48} />
          <View style={{ flex: 1 }}>
            <GText variant="title" color={C.danger} accessibilityRole="header">
              {reasonTitle(h.reason)}
            </GText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <StatusChip tone="info" icon="pill" label={`${tod} 약`} />
          <StatusChip tone="neutral" icon="bell" label={`${spokenTime(new Date(h.notified_at))} 알림`} />
        </View>
        <GText>{reasonDetail(h, me.family.elder_display_name)}</GText>
        {/* '중복 복용'으로 판정하면 서버가 미리 비워진 칸의 오늘 남은 건을 닫는다. 판정 전에 알린다 */}
        {h.reason === 'double_suspected' && !h.verdict ? (
          <Notice tone="info" icon="info">
            중복 복용으로 판정하면 미리 비워진 칸의 오늘 약은 건너뛰어요.
          </Notice>
        ) : null}
        {h.late_photo ? (
          <Notice tone="info" icon="image">
            알려드린 뒤에 사진이 올라왔어요.
          </Notice>
        ) : null}
        <GButton variant="secondary" icon="phone" label={`${me.family.elder_display_name}께 전화하기`} onPress={() => Linking.openURL('tel:')} />
      </Section>

      <SectionTitle>사진과 AI 판독</SectionTitle>
      {readings.length ? (
        readings.map((r, i) => (
          <ReadingView key={r.id} reading={r} layout={h.layout} title={readings.length > 1 ? (i === 0 ? '다시 찍은 사진' : '처음 사진') : undefined} />
        ))
      ) : (
        <Section>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <IconBubble name="image" tone="neutral" />
            <GText color={C.sub}>사진이 없어요.</GText>
          </View>
        </Section>
      )}

      {readings.length ? (
        <Notice tone="info" icon="info" title="칸이 빈 것만 확인했어요.">
          드셨는지는 직접 확인해 주세요.
        </Notice>
      ) : (
        // 사진이 없는 건(무응답 등)은 확인한 것이 없으므로 "칸이 빈 것만 확인했어요"라고 하지 않는다
        <Notice tone="info" icon="info" title="사진이 없어 확인한 것이 없어요.">
          드셨는지는 직접 확인해 주세요.
        </Notice>
      )}
    </GScreen>
  );
}

const TONE_FG = { ok: C.ok, warn: C.warn, danger: C.danger, neutral: C.neutral, info: C.primaryStrong };
