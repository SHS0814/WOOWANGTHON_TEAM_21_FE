import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { api, CREATE_DEMO_FAMILY, guardianMessage, type PairingCode } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useApiData } from '@/lib/useApiData';
import { colors } from '@/theme';

const platform = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;

/**
 * G1 연결 (R-008 C1, api.md 3.2~3.3).
 * 가족 만들기와 호칭 입력 → 이 폰에 QR 표시 → 어르신 폰으로 스캔 → 어르신 폰에서 동의(E1).
 * 이미 가족이 있으면(설정에서 "어르신 폰 다시 연결") 바로 새 코드를 발급한다.
 */
export default function Connect() {
  const { data: hasToken } = useApiData(() => api.hasToken());
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
    if (hasToken && !code) void issue();
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
          {until.getHours()}시 {`${until.getMinutes()}`.padStart(2, '0')}분까지, 한 번만 쓸 수 있어요.
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  qr: { alignSelf: 'center', padding: 16, backgroundColor: '#FFF', borderWidth: 2, borderColor: colors.border, borderRadius: 12 },
  short: { fontSize: 48, letterSpacing: 8, textAlign: 'center', lineHeight: 60 },
});
