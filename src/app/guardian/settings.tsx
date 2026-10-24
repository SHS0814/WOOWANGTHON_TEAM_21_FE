import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { api, type UnchangedPolicy } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useRole } from '@/lib/role';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';
import { colors } from '@/theme';

const RETENTION_OPTIONS = [30, 90, 180];

/** G8 설정. 호칭, 시각, 약통 재등록, 칸 그대로 처리(R-009), 요약 알림·사진 보관(R-006), 연결 해제 */
export default function Settings() {
  const family = useFamily();
  const { data: settings } = useApiData(() => api.getSettings());
  const { setRole } = useRole();
  const [elder, setElder] = useState('');
  const [me, setMe] = useState('');
  const [savedNames, setSavedNames] = useState(false);

  useEffect(() => {
    if (family) {
      setElder(family.elder_display_name);
      setMe(family.guardian_display_name);
    }
  }, [family]);

  if (!settings || !family) return null;

  const policy = (p: UnchangedPolicy) => api.updateSettings({ unchanged_policy: p });

  const disconnect = async () => {
    await api.unpair();
    await setRole(null);
    router.dismissAll();
    router.replace('/role');
  };
  const confirmDisconnect = () => {
    if (Platform.OS === 'web') return void disconnect();
    Alert.alert('연결을 해제할까요?', '어르신 폰의 연결도 끊어져요. 다시 쓰려면 새로 연결해야 해요.', [
      { text: '취소', style: 'cancel' },
      { text: '해제', style: 'destructive', onPress: disconnect },
    ]);
  };

  return (
    <Screen scroll>
      <Section title="호칭">
        <Field label="어르신 호칭" value={elder} onChangeText={(t) => (setElder(t), setSavedNames(false))} />
        <Field label="어르신 화면에 보일 내 이름" value={me} onChangeText={(t) => (setMe(t), setSavedNames(false))} />
        <BigButton
          size="guardian"
          variant="secondary"
          label={savedNames ? '✓ 저장했어요' : '호칭 저장'}
          disabled={!elder.trim() || !me.trim()}
          onPress={async () => {
            await api.updateNames({ elder_display_name: elder.trim(), guardian_display_name: me.trim() });
            setSavedNames(true);
          }}
        />
      </Section>

      <Section title="약통과 시각">
        <BigButton size="guardian" variant="secondary" label="복약 시각 바꾸기" onPress={() => router.push('/guardian/schedule')} />
        <BigButton size="guardian" variant="secondary" label="약통 다시 등록" onPress={() => router.push('/guardian/pillbox')} />
      </Section>

      <Section title="약 칸이 그대로일 때">
        <Choice
          selected={settings.unchanged_policy === 'remind'}
          title="앱에서 한 번 안내하고 다시 찍기 (기본)"
          detail={'"약 드실 시간이에요"라고 한 번 말씀드리고 사진을 다시 받아요. 그래도 그대로면 알려드려요.'}
          onPress={() => policy('remind')}
        />
        <Choice
          selected={settings.unchanged_policy === 'handoff'}
          title="바로 나에게 알리기"
          detail="안내 없이 바로 알려드려요."
          onPress={() => policy('handoff')}
        />
      </Section>

      <Section title="요약 알림">
        <View style={styles.switchRow}>
          <T style={{ flex: 1 }}>하루 요약을 {settings.summary_push_time}에 알림으로 받기</T>
          <Switch
            accessibilityLabel="하루 요약 알림"
            value={settings.summary_push_enabled}
            onValueChange={(v) => void api.updateSettings({ summary_push_enabled: v })}
          />
        </View>
        <T variant="small" style={{ color: colors.subtle }}>
          {settings.summary_push_enabled ? '켜짐' : '꺼짐: 요약은 앱 안에서만 보여요'}
        </T>
      </Section>

      <Section title="사진 보관 기간">
        {RETENTION_OPTIONS.map((d) => (
          <Choice key={d} selected={settings.photo_retention_days === d} title={`${d}일${d === 90 ? ' (기본)' : ''}`} onPress={() => api.updateSettings({ photo_retention_days: d })} />
        ))}
      </Section>

      <Section title="연결">
        <BigButton size="guardian" variant="secondary" label="연결 해제" onPress={confirmDisconnect} />
      </Section>
    </Screen>
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
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
    >
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
});
