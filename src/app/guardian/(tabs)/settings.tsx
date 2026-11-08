import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, BackHandler, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, guardianMessage, type Device, type NotificationStatus, type Settings, type UnchangedMode } from '@/api';
import {
  ErrorText,
  GButton,
  GField,
  GScreen,
  GText,
  IconBubble,
  ListGroup,
  ListRow,
  Notice,
  RadioRow,
  TONE,
  useKeyboardOverlap,
} from '@/components/guardian/ui';
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

const UNCHANGED_OPTIONS: { key: UnchangedMode; title: string; short: string; detail: string }[] = [
  {
    key: 'remind_then_retake',
    title: '앱에서 한 번 안내하고 다시 찍기 (기본)',
    short: '안내 후 다시 찍기',
    detail: '"약 드실 시간이에요"라고 한 번 말씀드리고 사진을 다시 받아요. 그래도 그대로면 알려드려요.',
  },
  { key: 'handoff_immediately', title: '바로 나에게 알리기', short: '바로 알리기', detail: '안내 없이 바로 알려드려요.' },
];

type SheetKind = 'name' | 'unchanged' | 'retention' | null;

/**
 * G8 설정 (api.md 3.7·3.8·3.26). 호칭, 시각, 약통 재등록, 칸 그대로 처리(R-009), 요약 알림·사진 보관(R-006), 기기 연결.
 * 412×883 에서 스크롤을 줄이려고 모든 항목을 한 줄 행으로 두고, 값을 바꾸는 것은 아래에서 올라오는 시트에서 한다 (R-064)
 */
export default function Settings() {
  const { data: me } = useMe();
  const { data: settings } = useApiData(() => api.settings());
  const { data: devices, reload: reloadDevices } = useApiData(() => api.devices());
  const { setRole } = useRole();
  const [sheet, setSheet] = useState<SheetKind>(null);
  // 저장 직후 다시 읽기 전에도 바뀐 값을 보여 준다
  const [local, setLocal] = useState<Partial<Settings>>({});
  const [msg, setMsg] = useState('');
  const [push, setPush] = useState<PushStatus>(pushStatus());
  useEffect(() => onPushStatus(() => setPush(pushStatus())), []);
  useEffect(() => setLocal({}), [settings]);

  if (!settings || !me) return null;
  const cur = { ...settings, ...local };

  const put = async (patch: Partial<Settings>) => {
    setMsg('');
    setLocal((l) => ({ ...l, ...patch }));
    try {
      await api.putSettings(patch);
      return true;
    } catch (e) {
      setLocal((l) => {
        const next = { ...l };
        for (const k of Object.keys(patch) as (keyof Settings)[]) delete next[k];
        return next;
      });
      setMsg(guardianMessage(e));
      return false;
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
  const pushLabel = push === 'registered' ? '받는 중' : push === 'unknown' ? '준비 중' : '받을 수 없음';
  const unchanged = UNCHANGED_OPTIONS.find((o) => o.key === cur.unchanged_mode) ?? UNCHANGED_OPTIONS[0];

  return (
    <View style={{ flex: 1 }}>
      <GScreen inTabs dense>
        <GText variant="title" accessibilityRole="header">
          설정
        </GText>

        <Group title="가족">
          <ListRow
            dense
            icon="user"
            title="어르신 호칭"
            subtitle={`어르신 화면에 보이는 내 이름: ${me.device.display_name}`}
            right={<Value>{cur.elder_display_name}</Value>}
            accessibilityLabel={`어르신 호칭 ${cur.elder_display_name}. 바꾸기`}
            onPress={() => setSheet('name')}
          />
        </Group>

        <Group title="약통과 시각">
          <ListRow dense icon="clock" title="복약 시각 바꾸기" onPress={() => router.push('/guardian/schedule')} />
          <ListRow dense icon="pillbox" title="약통 다시 등록" onPress={() => router.push('/guardian/pillbox')} />
          <ListRow dense icon="camera" title="약통 채우기" onPress={() => router.push('/guardian/refill')} />
          {/* R-071: 마지막 칸을 쓴 뒤 어르신 결과 화면에 "약통을 채워 주세요" 한 줄. 하루 약통 등록 때 켜진다 */}
          <View style={styles.switchRow}>
            <IconBubble name="pillbox" size={36} />
            <View style={{ flex: 1 }}>
              <GText variant="bodyStrong">약통 채우기 안내를 어르신께 보여 드리기</GText>
              <GText variant="sub" color={C.sub}>
                {cur.elder_refill_prompt
                  ? '켜짐: 마지막 칸을 쓰면 어르신 화면에 "약통을 채워 주세요"가 나와요'
                  : '꺼짐: 약통은 보호자가 채워요. 남은 칸이 적으면 홈에서 알려 드려요'}
              </GText>
            </View>
            <Switch
              accessibilityLabel="약통 채우기 안내를 어르신께 보여 드리기"
              value={!!cur.elder_refill_prompt}
              onValueChange={(v) => void put({ elder_refill_prompt: v })}
              trackColor={{ true: C.primary, false: '#C5CEDA' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Group>

        <Group title="알림과 사진">
          <ListRow
            dense
            icon="pillbox"
            title="약 칸이 그대로일 때"
            right={<Value>{unchanged.short}</Value>}
            accessibilityLabel={`약 칸이 그대로일 때: ${unchanged.title}. 바꾸기`}
            onPress={() => setSheet('unchanged')}
          />
          <ListRow
            dense
            icon="bell"
            iconTone={pushInfo.tone}
            title="확인이 필요할 때 알림"
            accessibilityLabel={`확인이 필요할 때 알림: ${pushLabel}. ${push === 'registered' ? '' : pushInfo.text}`}
            subtitle={
              <GText variant="sub" color={C.sub}>
                <Text style={{ color: TONE[pushInfo.tone].fg, fontWeight: '700' }}>{pushLabel}</Text>
                {push === 'registered' ? '' : ` · ${pushInfo.text}`}
              </GText>
            }
          />
          <View style={styles.switchRow}>
            <IconBubble name="calendar" size={36} />
            <View style={{ flex: 1 }}>
              <GText variant="bodyStrong">하루 요약 알림 {cur.summary_push_time}</GText>
              <GText variant="sub" color={C.sub}>
                {cur.summary_push_enabled ? '켜짐' : '꺼짐: 요약은 앱 안에서만 보여요'}
              </GText>
            </View>
            <Switch
              accessibilityLabel={`하루 요약을 ${cur.summary_push_time}에 알림으로 받기`}
              value={cur.summary_push_enabled}
              onValueChange={(v) => void put({ summary_push_enabled: v })}
              trackColor={{ true: C.primary, false: '#C5CEDA' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <ListRow
            dense
            icon="image"
            title="사진 보관 기간"
            right={<Value>{`${cur.photo_retention_days}일`}</Value>}
            accessibilityLabel={`사진 보관 기간 ${cur.photo_retention_days}일. 바꾸기`}
            onPress={() => setSheet('retention')}
          />
        </Group>

        <Group title="연결된 폰">
          {(devices ?? []).map((d) => (
            <ListRow
              key={d.id}
              dense
              icon={d.role === 'elder' ? 'smartphone' : 'user'}
              iconTone={d.role === 'elder' ? 'info' : 'neutral'}
              title={`${d.role === 'elder' ? '어르신 폰' : '보호자 폰'} · ${d.display_name}${d.is_me ? ' (이 폰)' : ''}`}
              right={<GButton compact variant="danger" label="해제" accessibilityLabel={`${d.display_name} 연결 해제`} onPress={() => confirmUnpair(d)} />}
            >
              {d.role === 'elder' ? <ElderNotificationStatus status={d.notification_status} /> : null}
            </ListRow>
          ))}
          {!devices?.some((d) => d.role === 'elder') ? (
            <ListRow dense icon="link" title="어르신 폰 연결" onPress={() => router.push('/guardian/connect')} />
          ) : null}
        </Group>
        {msg ? <ErrorText>{msg}</ErrorText> : null}

        <ChoiceSheet
          visible={sheet === 'unchanged'}
          title="약 칸이 그대로일 때"
          onClose={() => setSheet(null)}
          options={UNCHANGED_OPTIONS.map((o) => ({ key: o.key, title: o.title, detail: o.detail }))}
          value={cur.unchanged_mode}
          onPick={(k) => (setSheet(null), void put({ unchanged_mode: k as UnchangedMode }))}
        />
        <ChoiceSheet
          visible={sheet === 'retention'}
          title="사진 보관 기간"
          onClose={() => setSheet(null)}
          options={RETENTION_OPTIONS.map((d) => ({ key: `${d}`, title: `${d}일${d === 90 ? ' (기본)' : ''}` }))}
          value={`${cur.photo_retention_days}`}
          onPick={(k) => (setSheet(null), void put({ photo_retention_days: Number(k) }))}
        />
      </GScreen>
      {/* 입력이 있는 시트는 화면 안(스크롤 밖)에 띄운다. Modal 은 별도 창이라 키보드 높이를 알 수 없다 (T-FE22a) */}
      {sheet === 'name' ? (
        <NameSheet
          value={cur.elder_display_name}
          onCancel={() => setSheet(null)}
          onSave={async (name) => {
            if (await put({ elder_display_name: name })) setSheet(null);
          }}
        />
      ) : null}
    </View>
  );
}

/** 작은 섹션 제목 + 구분선 목록 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <GText variant="label" color={C.sub} accessibilityRole="header">
        {title}
      </GText>
      <ListGroup style={{ marginTop: 0 }}>{children}</ListGroup>
    </View>
  );
}

/** 행 오른쪽의 현재 값 */
function Value({ children }: { children: ReactNode }) {
  return (
    <GText variant="body" color={C.primaryStrong} style={{ fontWeight: '700', maxWidth: 170, textAlign: 'right' }} numberOfLines={2}>
      {children}
    </GText>
  );
}

/** 아래에서 올라오는 선택 시트 (입력 없음) */
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <GText variant="section" accessibilityRole="header">
          {title}
        </GText>
        {children}
      </View>
    </Modal>
  );
}

/**
 * 입력이 있는 시트. 화면 안에 겹쳐 띄우고, 키보드가 가리는 만큼 아래 여백을 줘서 시트가 키보드 바로 위에 오게 한다 (T-FE22a).
 * Android 뒤로 가기는 시트를 닫는다
 */
function InScreenSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const kb = useKeyboardOverlap();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true));
    return () => sub.remove();
  }, [onClose]);
  return (
    <View ref={kb.ref} style={[StyleSheet.absoluteFill, { paddingBottom: kb.overlap }]} accessibilityViewIsModal>
      <Pressable style={styles.scrim} accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 16 }]}>
        <GText variant="section" accessibilityRole="header">
          {title}
        </GText>
        {children}
      </View>
    </View>
  );
}

function NameSheet({ value, onCancel, onSave }: { value: string; onCancel: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <InScreenSheet title="어르신 호칭" onClose={onCancel}>
      <GField label="어르신을 뭐라고 부르세요?" value={name} onChangeText={setName} placeholder="예: 어머니" hint="어르신 화면의 말은 이 호칭으로 나와요." />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <GButton variant="secondary" label="취소" onPress={onCancel} />
        </View>
        <View style={{ flex: 2 }}>
          <GButton
            icon="check"
            label="호칭 저장"
            busy={busy}
            disabled={!name.trim() || name.trim() === value}
            onPress={async () => {
              setBusy(true);
              await onSave(name.trim());
              setBusy(false);
            }}
          />
        </View>
      </View>
    </InScreenSheet>
  );
}

function ChoiceSheet({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { key: string; title: string; detail?: string }[];
  value: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ListGroup style={{ marginTop: 0 }}>
        {options.map((o) => (
          <RadioRow key={o.key} selected={o.key === value} title={o.title} detail={o.detail} onPress={() => onPick(o.key)} />
        ))}
      </ListGroup>
      <GButton variant="secondary" label="닫기" onPress={onClose} />
    </Sheet>
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

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 52 },
  scrim: { flex: 1, backgroundColor: 'rgba(11,31,51,0.45)' },
  sheet: {
    backgroundColor: C.card,
    paddingHorizontal: guardian.space.gutter,
    paddingTop: 20,
    gap: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
