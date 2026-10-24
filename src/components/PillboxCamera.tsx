import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { colors } from '@/theme';

interface Props {
  instruction: string;
  /** 가이드 틀 가로:세로 비율. 약통 배열(열/행)에서 계산한다 */
  aspect: number;
  onCapture: (uri: string | null) => void;
  size?: 'elder' | 'guardian';
}

/** 약통 촬영 화면 (E5, G2, G7 공용). 가이드 틀과 아주 큰 셔터 하나 */
export function PillboxCamera({ instruction, aspect, onCapture, size = 'elder' }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const big = size === 'elder';

  const shoot = async () => {
    setBusy(true);
    try {
      const pic = ready ? await ref.current?.takePictureAsync({ quality: 0.6 }) : undefined;
      onCapture(pic?.uri ?? null);
    } catch {
      // 촬영이 안 되는 환경(시뮬레이터 등)에서는 사진 없이 진행한다. 모의 구현에서만 의미가 있다
      onCapture(null);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    // 모의 구현에서는 카메라가 없어도 흐름을 확인할 수 있게 한다
    const canSkip = api.isMock;
    return (
      <View style={[styles.permission, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.permText, { fontSize: big ? 30 : 22 }]}>약통 사진을 찍으려면 카메라를 써야 해요.</Text>
        {permission.canAskAgain ? (
          <BigButton label="카메라 켜기" onPress={requestPermission} size={size} />
        ) : canSkip ? null : (
          <Text style={styles.permText}>설정에서 카메라를 허용해 주세요.</Text>
        )}
        {canSkip ? (
          <Pressable onPress={() => onCapture(null)} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipText}>개발용: 카메라 없이 계속 (모의 사진)</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={ref} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={[styles.instruction, { fontSize: big ? 32 : 24 }]}>{instruction}</Text>
        <View style={[styles.guide, { aspectRatio: aspect }]} accessibilityLabel="약통을 이 틀에 맞춰 주세요">
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <View style={{ paddingBottom: insets.bottom + 24, alignItems: 'center', alignSelf: 'stretch' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진 찍기"
            disabled={busy}
            onPress={shoot}
            style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.shutterText}>{busy ? '…' : '찍기'}</Text>
          </Pressable>
          {Platform.OS === 'web' || !ready ? (
            <Text style={styles.hint}>{api.isMock ? '카메라가 준비되지 않으면 사진 없이 진행해요 (모의)' : ''}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const C = 36;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 },
  instruction: {
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
    textShadowColor: '#000',
    textShadowRadius: 6,
  },
  guide: { width: '92%' },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#FFE25C' },
  tl: { top: 0, left: 0, borderTopWidth: 6, borderLeftWidth: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 6, borderRightWidth: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 6, borderLeftWidth: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: 6, borderRightWidth: 6 },
  shutter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFF',
    borderWidth: 8,
    borderColor: '#FFE25C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterText: { fontSize: 32, fontWeight: '800', color: colors.text },
  hint: { color: '#FFF', fontSize: 16, marginTop: 8, textAlign: 'center' },
  permission: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center', gap: 24 },
  permText: { fontSize: 22, color: colors.text, textAlign: 'center', lineHeight: 36 },
  skip: { alignSelf: 'center', padding: 12 },
  skipText: { fontSize: 18, color: colors.mockBg, textDecorationLine: 'underline' },
});
