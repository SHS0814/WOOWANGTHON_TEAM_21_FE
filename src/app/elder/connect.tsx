import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type ScrollViewInstance, type TextInputInstance } from 'react-native';

import { api, isApiError, type PairRequest } from '@/api';
import { BackButton, useBackToRole } from '@/components/BackButton';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { codeFromPayload } from '@/lib/pairCode';
import { colors } from '@/theme';

/**
 * E2 연결. 보호자 폰에 뜬 QR을 이 폰(어르신 폰)으로 찍는다 (R-008 C1, backend.md 3.2).
 * 보통 보호자가 어르신 폰을 들고 대신 찍는다. 예비 수단으로 6자리 숫자 입력.
 */
export default function Connect() {
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const pairing = useRef(false);
  const backToRole = useBackToRole();
  // 키보드가 뜨면 숫자 입력칸과 "숫자로 연결" 버튼이 키보드 위에 보이게 맨 아래로 스크롤한다 (T-FE23, Android 15+)
  const scroll = useRef<ScrollViewInstance>(null);
  const input = useRef<TextInputInstance>(null);
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      if (input.current?.isFocused()) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
    });
    return () => sub.remove();
  }, []);

  const pair = async (req: PairRequest) => {
    if (pairing.current) return;
    pairing.current = true;
    try {
      await api.pair(req);
      router.replace('/elder/consent');
    } catch (e) {
      // 보호자가 대신 하는 화면이라 이유를 알려준다
      setError(
        isApiError(e, 'code_expired') || isApiError(e, 'code_used')
          ? '코드가 만료됐어요. 보호자 폰에서 새 코드를 받아 주세요.'
          : isApiError(e, 'network_error')
            ? '서버에 연결하지 못했어요.'
            : '연결하지 못했어요. 코드를 다시 확인해 주세요.',
      );
      pairing.current = false;
    }
  };

  return (
    <Screen scroll keyboardAware scrollRef={scroll}>
      <BackButton label="뒤로" color={colors.primary} onPress={backToRole} />
      <T variant="elderTitle">보호자 폰에 뜬 QR을 이 폰으로 찍어주세요</T>
      {permission?.granted ? (
        <View style={styles.scanner}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const qrCode = codeFromPayload(data);
              if (qrCode) void pair({ code: qrCode, platform });
            }}
          />
        </View>
      ) : (
        <BigButton label="카메라 켜기" onPress={requestPermission} />
      )}
      <T variant="elderBody">QR이 안 되면 보호자 폰에 보이는 6자리 숫자를 넣어주세요.</T>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="000000"
        accessibilityLabel="6자리 연결 코드"
        style={styles.input}
      />
      <BigButton label="숫자로 연결" variant="secondary" disabled={code.length !== 6} onPress={() => pair({ short_code: code, platform })} />
      {error ? <T variant="elderBody" style={{ color: colors.attention }}>{error}</T> : null}
      {api.mode === 'mock' ? (
        <Pressable accessibilityRole="button" onPress={() => pair({ code: 'mock', platform })} style={{ padding: 12 }}>
          <Text style={styles.mock}>개발용: 모의 연결 (실제 서버 아님)</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const platform = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;

const styles = StyleSheet.create({
  scanner: { width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  input: {
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 40,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 12,
    color: colors.text,
  },
  mock: { fontSize: 18, color: colors.mockBg, textDecorationLine: 'underline', textAlign: 'center' },
});
