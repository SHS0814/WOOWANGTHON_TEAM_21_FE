import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, type PairingCode } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { colors } from '@/theme';

/**
 * G1 연결 (R-008 C1, backend.md 3.1~3.2).
 * 가족 만들기와 호칭 입력 → 이 폰에 QR 표시 → 어르신 폰으로 스캔 → 어르신 폰에서 동의(E1).
 * 실제 서버 없이 화면만 있다. 코드는 모의 값이다.
 */
export default function Connect() {
  const [elder, setElder] = useState('');
  const [me, setMe] = useState('');
  const [code, setCode] = useState<PairingCode | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    await api.createFamily({ elder_display_name: elder.trim(), guardian_display_name: me.trim() });
    setCode(await api.createPairingCode());
    setBusy(false);
  };

  if (code) {
    const until = new Date(code.expires_at);
    return (
      <Screen scroll footer={<BigButton size="guardian" label="연결 끝났어요" onPress={() => router.replace('/guardian')} />}>
        <T variant="title">어르신 폰에 앱을 설치하고, 이 QR을 어르신 폰으로 찍어주세요</T>
        {/* QR 그림은 실제 서버 연동 때 붙인다. 지금은 모의 코드 값을 그대로 보인다 */}
        <View style={styles.qr} accessibilityLabel="연결용 QR 자리">
          <T variant="small">QR 자리 (모의 코드)</T>
          <T variant="small" style={{ color: colors.subtle }}>
            {code.qr}
          </T>
        </View>
        <T>QR이 안 되면 이 숫자를 넣어주세요</T>
        <T variant="title" style={styles.short}>
          {code.short_code}
        </T>
        <T variant="small" style={{ color: colors.subtle }}>
          {until.getHours()}시 {`${until.getMinutes()}`.padStart(2, '0')}분까지 쓸 수 있어요. 한 번만 쓸 수 있어요.
        </T>
        <T variant="small" style={{ color: colors.subtle }}>
          연결되면 어르신 폰에 동의 화면이 나와요.
        </T>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={<BigButton size="guardian" label="가족 만들기" onPress={create} busy={busy} disabled={!elder.trim() || !me.trim()} />}
    >
      <T variant="title">어르신 폰과 연결해요</T>
      <Field label="어르신을 뭐라고 부르세요?" value={elder} onChangeText={setElder} placeholder="예: 어머니" />
      <Field label="어르신 화면에 보일 내 이름" value={me} onChangeText={setMe} placeholder="예: 민수" />
      <T variant="small" style={{ color: colors.subtle }}>
        어르신 화면의 말은 이 호칭으로 나와요. 나중에 설정에서 바꿀 수 있어요.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qr: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderWidth: 4,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  short: { fontSize: 48, letterSpacing: 8, textAlign: 'center', lineHeight: 60 },
});
