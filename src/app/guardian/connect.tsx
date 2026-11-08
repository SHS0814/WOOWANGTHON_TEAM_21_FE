import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { api, CREATE_DEMO_FAMILY, guardianMessage, isApiError, type PairingCode } from '@/api';
import { MOCK_INVITE_CODE } from '@/api/mock';
import { BrandMark } from '@/components/guardian/Brand';
import { Card, ErrorText, GButton, GField, GScreen, GText, MockTag, Notice, StatusChip } from '@/components/guardian/ui';
import { isElderShortCode, normalizeInviteCode } from '@/lib/pairCode';
import { spokenTime } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { registerGuardianPush } from '@/notify/guardianPush';
import { guardian } from '@/theme';

const C = guardian.color;

const platform = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;

/**
 * G1 연결 (R-008 C1, api.md 3.2~3.3).
 * 가족 만들기와 호칭 입력 → 이 폰에 QR 표시 → 어르신 폰으로 스캔 → 어르신 폰에서 동의(E1).
 * 이미 가족이 있으면(설정에서 "어르신 폰 다시 연결") 바로 새 코드를 발급한다.
 * 초대 코드가 있으면 가족을 만들지 않고 그 가족에 합류한다 (JoinFamily).
 */
export default function Connect() {
  const { data: hasToken, reload: reloadToken } = useApiData(() => api.hasToken());
  const [joining, setJoining] = useState(false);
  const [elder, setElder] = useState('');
  const [me, setMe] = useState('');
  const [code, setCode] = useState<PairingCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const issue = async () => {
    try {
      setCode(await api.createPairingCode('elder'));
    } catch (e) {
      setError(guardianMessage(e));
    }
  };

  useEffect(() => {
    // 합류 중에 토큰이 생겨도 어르신 코드를 발급하지 않는다. 발급하면 그 가족의 이전 코드가 무효가 된다 (3.3)
    if (hasToken && !code && !joining) void issue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await api.createFamily({
        elder_display_name: elder.trim(),
        guardian_display_name: me.trim(),
        platform,
        ...(CREATE_DEMO_FAMILY ? { is_demo: true } : {}),
      });
      await issue();
    } catch (e) {
      setError(guardianMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (hasToken === undefined) return null;

  if (joining) return <JoinFamily onBack={() => setJoining(false)} onTokenCleared={reloadToken} />;

  if (code) {
    const until = new Date(code.expires_at);
    return (
      <GScreen footer={<GButton label="연결 끝났어요" icon="check" onPress={() => router.replace('/guardian')} />}>
        <Steps current={2} />
        <GText variant="title">어르신 폰에 앱을 설치하고, 이 QR을 어르신 폰으로 찍어주세요</GText>
        <Card style={{ alignItems: 'center' }}>
          <View style={styles.qr} accessible accessibilityLabel="연결용 QR">
            <QRCode value={code.qr_payload} size={220} />
          </View>
          {code.short_code ? (
            <View style={{ alignItems: 'center', gap: 4, alignSelf: 'stretch', borderTopWidth: 1, borderColor: C.divider, paddingTop: 12 }}>
              <GText variant="sub" color={C.sub}>
                QR이 안 되면 이 숫자를 넣어주세요
              </GText>
              <Text style={styles.short} accessibilityLabel={`연결 숫자 ${code.short_code.split('').join(' ')}`}>
                {code.short_code}
              </Text>
            </View>
          ) : null}
          <StatusChip tone="neutral" icon="clock" label={`${spokenTime(until)}까지, 한 번만 쓸 수 있어요.`} />
        </Card>
        <GButton variant="ghost" icon="refresh" label="새 코드 받기" onPress={issue} />
        <Notice tone="info" icon="shield">
          연결되면 어르신 폰에 동의 화면이 나와요.
        </Notice>
      </GScreen>
    );
  }

  if (hasToken) {
    return (
      <GScreen center>
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={C.primary} />
            <GText>코드를 받고 있어요</GText>
          </View>
        )}
      </GScreen>
    );
  }

  return (
    <GScreen footer={<GButton label="가족 만들기" busy={busy} disabled={!elder.trim() || !me.trim()} onPress={create} />}>
      <View style={{ gap: 12 }}>
        <BrandMark size={52} />
        <GText variant="title">어르신 폰과 연결해요</GText>
        <GText color={C.sub}>보호자 폰에서 가족을 만들고, 어르신 폰으로 QR을 찍으면 연결돼요.</GText>
      </View>
      <Steps current={1} />
      <Card>
        <GField label="어르신을 뭐라고 부르세요?" value={elder} onChangeText={setElder} placeholder="예: 어머니" />
        <GField label="어르신 화면에 보일 내 이름" value={me} onChangeText={setMe} placeholder="예: 민수" />
        <GText variant="sub" color={C.sub}>
          어르신 화면의 말은 이 호칭으로 나와요. 어르신 호칭은 나중에 설정에서 바꿀 수 있어요.
        </GText>
      </Card>
      {CREATE_DEMO_FAMILY ? <MockTag label="시연용 가족으로 만들어요 (is_demo)" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Card padded={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="초대 코드가 있어요"
          accessibilityHint="다른 보호자가 만든 가족에 합류해요"
          onPress={() => setJoining(true)}
          style={({ pressed }) => [styles.joinRow, pressed && { backgroundColor: C.neutralSoft }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <GText variant="bodyStrong">초대 코드가 있어요</GText>
            <GText variant="sub" color={C.sub}>
              다른 보호자가 이미 가족을 만들었다면 합류해요
            </GText>
          </View>
          <GText variant="label" color={C.primaryStrong}>
            합류 ›
          </GText>
        </Pressable>
      </Card>
    </GScreen>
  );
}

/** 연결 단계 표시: 1 가족 만들기 → 2 QR 연결 → 3 어르신 동의 */
function Steps({ current }: { current: 1 | 2 }) {
  const steps = ['가족 만들기', 'QR로 연결', '어르신 동의'];
  return (
    <View style={styles.steps} accessible accessibilityLabel={`3단계 중 ${current}단계: ${steps[current - 1]}`}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const on = n === current;
        return (
          <View key={label} style={styles.step}>
            <View style={[styles.stepDot, (on || done) && { backgroundColor: C.primary, borderColor: C.primary }]}>
              <Text style={[styles.stepNum, (on || done) && { color: C.onPrimary }]}>{done ? '✓' : n}</Text>
            </View>
            <Text style={[styles.stepLabel, on && { color: C.text, fontWeight: '700' }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** 이미 있는 가족에 보호자로 합류 (api.md 3.4). 초대 코드는 처음 보호자가 공유한 긴 코드나 링크다 */
function JoinFamily({ onBack, onTokenCleared }: { onBack: () => void; onTokenCleared: () => void }) {
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    const code = normalizeInviteCode(input);
    setError('');
    // 서버에 보내면 실패 횟수(3.4 시도 제한)만 쌓인다
    if (isElderShortCode(code)) {
      setError('6자리 숫자는 어르신 폰 연결용이에요. 처음 보호자에게 보호자 초대 코드를 받아 주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.pair({ code, display_name: name.trim(), platform });
      // 코드 종류는 서버가 정한다. 어르신 코드였으면 어르신 기기로 연결됐으므로 이 보호자 화면에서 쓰지 않는다
      if (res.device.role !== 'guardian') {
        await api.forgetToken();
        onTokenCleared();
        setError('어르신 폰 연결용 코드였어요. 이 코드로 어르신 폰 연결이 풀렸을 수 있으니 처음 보호자에게 알려 주세요.');
        return;
      }
      // 보호자 레이아웃의 등록 시도는 토큰 저장보다 먼저 돌 수 있어 여기서 직접 부른다
      void registerGuardianPush();
      router.replace('/guardian');
    } catch (e) {
      setError(joinMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <GScreen
      footer={
        <>
          <GButton label="합류하기" busy={busy} disabled={!normalizeInviteCode(input) || !name.trim()} onPress={join} />
          <GButton variant="ghost" label="가족 만들기로 돌아가기" disabled={busy} onPress={onBack} />
        </>
      }
    >
      <Stack.Screen options={{ title: '보호자로 합류' }} />
      <View style={{ gap: 6 }}>
        <GText variant="title">초대 코드로 가족에 합류해요</GText>
        <GText color={C.sub}>처음 보호자에게 받은 보호자 초대 코드를 넣어 주세요.</GText>
      </View>
      <Card>
        <GField label="초대 코드" value={input} onChangeText={setInput} placeholder="받은 코드나 링크를 붙여넣기" verbatim />
        <GField label="어르신 화면에 보일 내 이름" value={name} onChangeText={setName} placeholder="예: 민지" />
      </Card>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {api.mode === 'mock' ? (
        <Pressable accessibilityRole="button" onPress={() => setInput(MOCK_INVITE_CODE)} style={styles.mockBtn}>
          <MockTag label="개발용: 모의 초대 코드 넣기 (실제 서버 아님)" />
        </Pressable>
      ) : null}
    </GScreen>
  );
}

function joinMessage(e: unknown): string {
  // 초대 코드는 처음 보호자가 만든다. 공통 문구의 "보호자 폰에서" 대신 누구에게 받을지 알려준다
  if (isApiError(e, 'code_expired')) return '코드가 만료됐어요. 처음 보호자에게 새 코드를 받아 주세요.';
  if (isApiError(e, 'code_used')) return '이미 쓴 코드예요. 처음 보호자에게 새 코드를 받아 주세요.';
  return guardianMessage(e);
}

const styles = StyleSheet.create({
  qr: { padding: 12, backgroundColor: '#FFF', borderRadius: 12 },
  short: { fontSize: 44, letterSpacing: 8, textAlign: 'center', lineHeight: 54, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 64 },
  mockBtn: { minHeight: 48, justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#C5CEDA',
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 16, fontWeight: '800', color: C.sub },
  stepLabel: { fontSize: 16, color: C.sub, textAlign: 'center' },
});
