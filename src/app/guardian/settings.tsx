import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { api, guardianMessage, type Device, type NotificationStatus, type UnchangedMode } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useRole } from '@/lib/role';
import { onPushStatus, pushStatus, type PushStatus } from '@/notify/guardianPush';
import { spokenTime } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { colors } from '@/theme';

const RETENTION_OPTIONS = [30, 90, 180];

const PUSH_TEXT: Record<PushStatus, string> = {
  unknown: '알림을 준비하고 있어요.',
  registered: '✓ 이 폰으로 알려드려요.',
  denied: '! 알림 권한이 꺼져 있어요. 폰 설정에서 알림을 켜 주세요.',
  unsupported: '이 환경(웹)에서는 알림을 받을 수 없어요. 처리할 일은 홈에서 보여요.',
  no_project: '! 이 앱 빌드에는 푸시 설정이 없어 알림을 받을 수 없어요 (개발용). 처리할 일은 홈에서 보여요.',
  failed: '! 알림 등록에 실패했어요. 앱을 다시 열면 다시 시도해요. 처리할 일은 홈에서 보여요.',
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

  return (
    <Screen scroll>
      <Section title="호칭">
        <Field label="어르신 호칭" value={elder} onChangeText={(t) => (setElder(t), setSaved(false))} />
        <BigButton
          size="guardian"
          variant="secondary"
          label={saved ? '✓ 저장했어요' : '호칭 저장'}
          disabled={!elder.trim()}
          onPress={async () => {
            await put({ elder_display_name: elder.trim() });
            setSaved(true);
          }}
        />
        {/* 보호자 자신의 이름은 이 API로 바꾸지 않는다 (3.26) */}
        <T variant="small" style={{ color: colors.subtle }}>
          어르신 화면에 보이는 내 이름: {me.device.display_name}
        </T>
      </Section>

      <Section title="약통과 시각">
        <BigButton size="guardian" variant="secondary" label="복약 시각 바꾸기" onPress={() => router.push('/guardian/schedule')} />
        <BigButton size="guardian" variant="secondary" label="약통 다시 등록" onPress={() => router.push('/guardian/pillbox')} />
      </Section>

      <Section title="약 칸이 그대로일 때">
        <Choice
          selected={settings.unchanged_mode === 'remind_then_retake'}
          title="앱에서 한 번 안내하고 다시 찍기 (기본)"
          detail={'"약 드실 시간이에요"라고 한 번 말씀드리고 사진을 다시 받아요. 그래도 그대로면 알려드려요.'}
          onPress={() => put({ unchanged_mode: 'remind_then_retake' satisfies UnchangedMode })}
        />
        <Choice
          selected={settings.unchanged_mode === 'handoff_immediately'}
          title="바로 나에게 알리기"
          detail="안내 없이 바로 알려드려요."
          onPress={() => put({ unchanged_mode: 'handoff_immediately' })}
        />
      </Section>

      <Section title="확인이 필요할 때 알림">
        <T>{PUSH_TEXT[push]}</T>
      </Section>

      <Section title="요약 알림">
        <View style={styles.switchRow}>
          <T style={{ flex: 1 }}>하루 요약을 {settings.summary_push_time}에 알림으로 받기</T>
          <Switch accessibilityLabel="하루 요약 알림" value={settings.summary_push_enabled} onValueChange={(v) => void put({ summary_push_enabled: v })} />
        </View>
        <T variant="small" style={{ color: colors.subtle }}>
          {settings.summary_push_enabled ? '켜짐' : '꺼짐: 요약은 앱 안에서만 보여요'}
        </T>
      </Section>

      <Section title="사진 보관 기간">
        {RETENTION_OPTIONS.map((d) => (
          <Choice key={d} selected={settings.photo_retention_days === d} title={`${d}일${d === 90 ? ' (기본)' : ''}`} onPress={() => put({ photo_retention_days: d })} />
        ))}
      </Section>

      <Section title="연결된 폰">
        {devices?.map((d) => (
          <View key={d.id} style={styles.device}>
            <T style={{ fontWeight: '700' }}>
              {d.role === 'elder' ? '어르신 폰' : '보호자 폰'} · {d.display_name}
              {d.is_me ? ' (이 폰)' : ''}
            </T>
            {d.role === 'elder' ? <ElderNotificationStatus status={d.notification_status} /> : null}
            <BigButton size="guardian" variant="secondary" label="연결 해제" onPress={() => confirmUnpair(d)} />
          </View>
        ))}
        {!devices?.some((d) => d.role === 'elder') ? (
          <BigButton size="guardian" variant="secondary" label="어르신 폰 연결" onPress={() => router.push('/guardian/connect')} />
        ) : null}
      </Section>
      {msg ? <T style={{ color: colors.attention }}>{msg}</T> : null}
    </Screen>
  );
}

/**
 * 어르신 폰 알림 준비 상태 (api.md 2.7, R-032). 무엇이 꺼져 있는지와 어디서 켜는지.
 * 정상이거나 아직 보고가 없으면 아무것도 보이지 않는다 (원칙 2)
 */
function ElderNotificationStatus({ status }: { status: NotificationStatus | null }) {
  if (!status || status.ready) return null;
  return (
    <View style={styles.warn}>
      <T style={{ fontWeight: '700' }}>! 어르신 폰 알림 설정이 꺼져 있어 알림이 늦을 수 있어요</T>
      {!status.notifications_allowed ? <T>• 알림이 꺼져 있어요. 어르신 폰 설정 → 앱 → 약 챙김 → 알림을 허용해 주세요.</T> : null}
      {status.exact_alarm_allowed === false ? (
        <T>• "알람 및 리마인더"가 꺼져 있어요. 어르신 폰 설정 → 앱 → 약 챙김 → 알람 및 리마인더를 켜 주세요.</T>
      ) : null}
      <T variant="small" style={{ color: colors.subtle }}>
        {spokenTime(new Date(status.reported_at))}에 어르신 폰에서 알려온 상태예요.
      </T>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <T variant="title">{title}</T>
      {children}
    </View>
  );
}

function Choice({ selected, title, detail, onPress }: { selected: boolean; title: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}>
      <T style={{ fontWeight: '700' }}>
        {selected ? '● ' : '○ '}
        {title}
      </T>
      {detail ? <T variant="small">{detail}</T> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72 },
  choice: { borderWidth: 2, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 4, minHeight: 72, justifyContent: 'center' },
  choiceOn: { borderWidth: 4, borderColor: colors.primary, backgroundColor: colors.secondaryBg },
  device: { gap: 8, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 10 },
  warn: { borderWidth: 2, borderColor: colors.attention, backgroundColor: colors.attentionBg, borderRadius: 12, padding: 12, gap: 6 },
});
