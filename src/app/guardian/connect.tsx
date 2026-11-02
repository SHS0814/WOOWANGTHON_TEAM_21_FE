import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { api, CREATE_DEMO_FAMILY, guardianMessage, isApiError, type PairingCode } from '@/api';
import { MOCK_INVITE_CODE } from '@/api/mock';
import { BigButton } from '@/components/BigButton';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { isElderShortCode, normalizeInviteCode } from '@/lib/pairCode';
import { spokenTime } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { registerGuardianPush } from '@/notify/guardianPush';
import { colors } from '@/theme';

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
      <Screen scroll footer={<BigButton size="guardian" label="연결 끝났어요" onPress={() => router.replace('/guardian')} />}>
        <T variant="title">어르신 폰에 앱을 설치하고, 이 QR을 어르신 폰으로 찍어주세요</T>
        <View style={styles.qr} accessibilityLabel="연결용 QR">
          <QRCode value={code.qr_payload} size={240} />
        </View>
        {code.short_code ? (
          <>
            <T>QR이 안 되면 이 숫자를 넣어주세요</T>
            <T variant="title" style={styles.short}>
              {code.short_code}
            </T>
          </>
        ) : null}
        <T variant="small" style={{ color: colors.subtle }}>
          {spokenTime(until)}까지, 한 번만 쓸 수 있어요.
        </T>
        <BigButton size="guardian" variant="secondary" label="새 코드 받기" onPress={issue} />
        <T variant="small" style={{ color: colors.subtle }}>
          연결되면 어르신 폰에 동의 화면이 나와요.
        </T>
      </Screen>
    );
  }

  if (hasToken) {
    return (
      <Screen center>
        <T>{error || '코드를 받고 있어요'}</T>
      </Screen>
    );
  }

  return (
    <Screen scroll footer={<BigButton size="guardian" label="가족 만들기" onPress={create} busy={busy} disabled={!elder.trim() || !me.trim()} />}>
      <T variant="title">어르신 폰과 연결해요</T>
      <Field label="어르신을 뭐라고 부르세요?" value={elder} onChangeText={setElder} placeholder="예: 어머니" />
      <Field label="어르신 화면에 보일 내 이름" value={me} onChangeText={setMe} placeholder="예: 민수" />
      <T variant="small" style={{ color: colors.subtle }}>
        어르신 화면의 말은 이 호칭으로 나와요. 어르신 호칭은 나중에 설정에서 바꿀 수 있어요.
      </T>
      {CREATE_DEMO_FAMILY ? <T variant="small" style={{ color: colors.mockBg }}>시연용 가족으로 만들어요 (is_demo)</T> : null}
      {error ? <T style={{ color: colors.attention }}>{error}</T> : null}
      <BigButton size="guardian" variant="secondary" label="초대 코드가 있어요" onPress={() => setJoining(true)} />
    </Screen>
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
    <Screen
      scroll
      footer={
        <>
          <BigButton size="guardian" label="합류하기" onPress={join} busy={busy} disabled={!normalizeInviteCode(input) || !name.trim()} />
          <BigButton size="guardian" variant="secondary" label="가족 만들기로 돌아가기" onPress={onBack} disabled={busy} />
        </>
      }
    >
      <Stack.Screen options={{ title: '보호자로 합류' }} />
      <T variant="title">초대 코드로 가족에 합류해요</T>
      <Field label="초대 코드" value={input} onChangeText={setInput} placeholder="받은 코드나 링크를 붙여넣기" verbatim />
      <Field label="어르신 화면에 보일 내 이름" value={name} onChangeText={setName} placeholder="예: 민지" />
      {error ? <T style={{ color: colors.attention }}>{error}</T> : null}
      {api.mode === 'mock' ? (
        <Pressable accessibilityRole="button" onPress={() => setInput(MOCK_INVITE_CODE)} style={{ padding: 12 }}>
          <Text style={styles.mock}>개발용: 모의 초대 코드 넣기 (실제 서버 아님)</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function joinMessage(e: unknown): string {
  // 초대 코드는 처음 보호자가 만든다. 공통 문구의 "보호자 폰에서" 대신 누구에게 받을지 알려준다
  if (isApiError(e, 'code_expired')) return '코드가 만료됐어요. 처음 보호자에게 새 코드를 받아 주세요.';
  if (isApiError(e, 'code_used')) return '이미 쓴 코드예요. 처음 보호자에게 새 코드를 받아 주세요.';
  return guardianMessage(e);
}

const styles = StyleSheet.create({
  qr: { alignSelf: 'center', padding: 16, backgroundColor: '#FFF', borderWidth: 2, borderColor: colors.border, borderRadius: 12 },
  short: { fontSize: 48, letterSpacing: 8, textAlign: 'center', lineHeight: 60 },
  mock: { fontSize: 18, color: colors.mockBg, textDecorationLine: 'underline', textAlign: 'center' },
});
