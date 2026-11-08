import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { api, guardianMessage, type Device, type NotificationStatus, type UnchangedMode } from '@/api';
import { Section, ErrorText, GButton, GField, GScreen, GText, ListGroup, ListRow, Notice, RadioRow, SectionTitle, StatusChip } from '@/components/guardian/ui';
import { useRole } from '@/lib/role';
import { onPushStatus, pushStatus, type PushStatus } from '@/notify/guardianPush';
import { spokenTime } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { guardian, type GuardianTone } from '@/theme';

const C = guardian.color;

const RETENTION_OPTIONS = [30, 90, 180];

const PUSH_TEXT: Record<PushStatus, { tone: GuardianTone; text: string }> = {
  unknown: { tone: 'neutral', text: '알림을 준비하고 있어요.' },
  registered: { tone: 'ok', text: '이 폰으로 알려드려요.' },
  denied: { tone: 'warn', text: '알림 권한이 꺼져 있어요. 폰 설정에서 알림을 켜 주세요.' },
  unsupported: { tone: 'neutral', text: '이 폰(아이폰·웹)에서는 알림을 받을 수 없어요. 처리할 일은 홈에서 보여요.' },
  no_firebase: { tone: 'warn', text: '이 앱 빌드에는 푸시 설정이 없어 알림을 받을 수 없어요 (개발용). 처리할 일은 홈에서 보여요.' },
  failed: { tone: 'warn', text: '알림 등록에 실패했어요. 앱을 다시 열면 다시 시도해요. 처리할 일은 홈에서 보여요.' },
};

/** G8 설정 (api.md 3.7·3.8·3.26). 호칭, 시각, 약통 재등록, 칸 그대로 처리(R-009), 요약 알림·사진 보관(R-006), 기기 연결 */
export default function Settings() {
  const { data: me } = useMe();
  const { data: settings } = useApiData(() => api.settings());
  const { data: devices, reload: reloadDevices } = useApiData(() => api.devices());
  const { setRole } = useRole();
  const [elder, setElder] = useState('');
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const [push, setPush] = useState<PushStatus>(pushStatus());
  useEffect(() => onPushStatus(() => setPush(pushStatus())), []);

  useEffect(() => {
    if (settings) setElder(settings.elder_display_name);
  }, [settings]);

  if (!settings || !me) return null;

  const put = async (patch: Parameters<typeof api.putSettings>[0]) => {
    setMsg('');
    try {
      await api.putSettings(patch);
    } catch (e) {
      setMsg(guardianMessage(e));
    }
  };

  const unpair = async (d: Device) => {
    try {
      await api.deleteDevice(d.id);
      if (d.is_me) {
        await setRole(null);
        router.dismissAll();
        router.replace('/role');
      } else reloadDevices();
    } catch (e) {
      setMsg(guardianMessage(e));
    }
  };
  const confirmUnpair = (d: Device) => {
    const title = d.is_me ? '이 폰의 연결을 해제할까요?' : `${d.display_name} 폰의 연결을 해제할까요?`;
    if (Platform.OS === 'web') return void unpair(d);
    Alert.alert(title, '해제하면 다시 연결해야 써요.', [
      { text: '취소', style: 'cancel' },
      { text: '해제', style: 'destructive', onPress: () => void unpair(d) },
    ]);
  };

  const pushInfo = PUSH_TEXT[push];

  return (
    <GScreen inTabs title="설정">
      <SectionTitle>호칭</SectionTitle>
      <Section>
        <GField label="어르신 호칭" value={elder} onChangeText={(t) => (setElder(t), setSaved(false))} />
        <GButton
          variant="secondary"
          icon={saved ? 'check' : undefined}
          iconColor={C.ok}
          label={saved ? '저장했어요' : '호칭 저장'}
          accessibilityLabel={saved ? '저장했어요' : '호칭 저장'}
          disabled={!elder.trim()}
          onPress={async () => {
            await put({ elder_display_name: elder.trim() });
            setSaved(true);
          }}
        />
        {/* 보호자 자신의 이름은 이 API로 바꾸지 않는다 (3.26) */}
        <GText variant="sub" color={C.sub}>
          어르신 화면에 보이는 내 이름: {me.device.display_name}
        </GText>
      </Section>

      <SectionTitle>약통과 시각</SectionTitle>
      <ListGroup>
        <ListRow icon="clock" title="복약 시각 바꾸기" onPress={() => router.push('/guardian/schedule')} />
        <ListRow icon="pillbox" title="약통 다시 등록" onPress={() => router.push('/guardian/pillbox')} />
        <ListRow icon="camera" title="약통 채우기" onPress={() => router.push('/guardian/refill')} />
      </ListGroup>

      <SectionTitle>약 칸이 그대로일 때</SectionTitle>
      <ListGroup>
        <RadioRow
          selected={settings.unchanged_mode === 'remind_then_retake'}
          title="앱에서 한 번 안내하고 다시 찍기 (기본)"
          detail={'"약 드실 시간이에요"라고 한 번 말씀드리고 사진을 다시 받아요. 그래도 그대로면 알려드려요.'}
          onPress={() => put({ unchanged_mode: 'remind_then_retake' satisfies UnchangedMode })}
        />
        <RadioRow
          selected={settings.unchanged_mode === 'handoff_immediately'}
          title="바로 나에게 알리기"
          detail="안내 없이 바로 알려드려요."
          onPress={() => put({ unchanged_mode: 'handoff_immediately' })}
        />
      </ListGroup>

      <SectionTitle>알림</SectionTitle>
      <ListGroup>
        <ListRow icon="bell" iconTone={pushInfo.tone} title="확인이 필요할 때 알림" subtitle={pushInfo.text}>
          <View style={{ marginTop: 4 }}>
            <StatusChip tone={pushInfo.tone} label={push === 'registered' ? '받는 중' : push === 'unknown' ? '준비 중' : '받을 수 없음'} />
          </View>
        </ListRow>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, marginHorizontal: -8, paddingVertical: 14, minHeight: 64 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <GText variant="bodyStrong">하루 요약을 {settings.summary_push_time}에 알림으로 받기</GText>
            <GText variant="sub" color={C.sub}>
              {settings.summary_push_enabled ? '켜짐' : '꺼짐: 요약은 앱 안에서만 보여요'}
            </GText>
          </View>
          <Switch
            accessibilityLabel="하루 요약 알림"
            value={settings.summary_push_enabled}
            onValueChange={(v) => void put({ summary_push_enabled: v })}
            trackColor={{ true: C.primary, false: '#C5CEDA' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </ListGroup>

      <SectionTitle>사진 보관 기간</SectionTitle>
      <ListGroup>
        {RETENTION_OPTIONS.map((d) => (
          <RadioRow
            key={d}
            selected={settings.photo_retention_days === d}
            title={`${d}일${d === 90 ? ' (기본)' : ''}`}
            onPress={() => put({ photo_retention_days: d })}
          />
        ))}
      </ListGroup>

      <SectionTitle>연결된 폰</SectionTitle>
      <ListGroup>
        {(devices ?? []).map((d) => (
          <ListRow
            key={d.id}
            icon={d.role === 'elder' ? 'smartphone' : 'user'}
            iconTone={d.role === 'elder' ? 'info' : 'neutral'}
            title={`${d.role === 'elder' ? '어르신 폰' : '보호자 폰'} · ${d.display_name}${d.is_me ? ' (이 폰)' : ''}`}
          >
            {d.role === 'elder' ? <ElderNotificationStatus status={d.notification_status} /> : null}
            <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <GButton
                compact
                variant="danger"
                icon="x"
                label="연결 해제"
                accessibilityLabel={`${d.display_name} 연결 해제`}
                onPress={() => confirmUnpair(d)}
              />
            </View>
          </ListRow>
        ))}
        {!devices?.some((d) => d.role === 'elder') ? <ListRow icon="link" title="어르신 폰 연결" onPress={() => router.push('/guardian/connect')} /> : null}
      </ListGroup>
      {msg ? <ErrorText>{msg}</ErrorText> : null}
    </GScreen>
  );
}

/**
 * 어르신 폰 알림 준비 상태 (api.md 2.7, R-032). 무엇이 꺼져 있는지와 어디서 켜는지.
 * 정상이거나 아직 보고가 없으면 아무것도 보이지 않는다 (원칙 2)
 */
function ElderNotificationStatus({ status }: { status: NotificationStatus | null }) {
  if (!status || status.ready) return null;
  return (
    <View style={{ marginTop: 6 }}>
      <Notice tone="warn" title="어르신 폰 알림 설정이 꺼져 있어 알림이 늦을 수 있어요">
        <View style={{ gap: 4 }}>
          {!status.notifications_allowed ? <GText variant="sub">• 알림이 꺼져 있어요. 어르신 폰 설정 → 앱 → 약 챙김 → 알림을 허용해 주세요.</GText> : null}
          {status.exact_alarm_allowed === false ? (
            <GText variant="sub">• "알람 및 리마인더"가 꺼져 있어요. 어르신 폰 설정 → 앱 → 약 챙김 → 알람 및 리마인더를 켜 주세요.</GText>
          ) : null}
          <GText variant="sub" color={C.sub}>
            {spokenTime(new Date(status.reported_at))}에 어르신 폰에서 알려온 상태예요.
          </GText>
        </View>
      </Notice>
    </View>
  );
}
