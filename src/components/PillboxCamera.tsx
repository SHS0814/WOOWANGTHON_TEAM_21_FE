import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, DEMO_BUILD, type LocalPhoto } from '@/api';
import { BigButton } from '@/components/BigButton';
import { DemoPhotoButton, DemoPhotoPicker } from '@/components/DemoPhotoPicker';
import { useMe } from '@/lib/useMe';
import { colors } from '@/theme';

interface Props {
  instruction: string;
  /** 가이드 틀 가로:세로 비율. 약통 배열(열/행)에서 계산한다 */
  aspect: number;
  onCapture: (photo: LocalPhoto) => void;
  size?: 'elder' | 'guardian';
  /** 등록된 약통의 칸 수 (시연용 샘플 사진을 같은 약통 것만 보여 줄 때). 약통 등록 화면은 주지 않는다 */
  sampleCols?: number;
}

/** 약통 촬영 화면 (E5, G2, G7 공용). 가이드 틀과 아주 큰 셔터 하나 */
export function PillboxCamera({ instruction, aspect, onCapture, size = 'elder', sampleCols }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const big = size === 'elder';
  // 시연 가족이면 카메라 대신 미리 찍어 둔 약통 사진도 고를 수 있다 (판독은 똑같이 실제 서버가 한다)
  const { data: me } = useMe();
  // 어르신 화면의 샘플 사진은 시연용 빌드에서만 (배포용 빌드에는 시연 장치를 두지 않는다)
  const demo = DEMO_BUILD && api.mode !== 'mock' && !!me && me.family.is_demo && me.server.demo_mode;
  const [picking, setPicking] = useState(false);
  const picker = demo ? (
    <DemoPhotoPicker
      visible={picking}
      cols={sampleCols}
      onClose={() => setPicking(false)}
      onPick={(uri) => {
        setPicking(false);
        onCapture({ uri, taken_at: new Date().toISOString() });
      }}
    />
  ) : null;

  const capture = (uri: string | null) => onCapture({ uri, taken_at: new Date().toISOString() });

  const shoot = async () => {
    setBusy(true);
    try {
      const pic = ready ? await ref.current?.takePictureAsync({ quality: 0.6 }) : undefined;
      capture(pic?.uri ?? null);
    } catch {
      // 촬영이 안 되는 환경(시뮬레이터 등)에서는 사진 없이 진행한다. 실제 서버는 사진 없는 업로드를 거절한다
      capture(null);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    // 모의 구현에서는 카메라가 없어도 흐름을 확인할 수 있게 한다
    const canSkip = api.mode === 'mock';
    return (
      <View style={[styles.permission, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.permText, { fontSize: big ? 30 : 22 }]}>약통 사진을 찍으려면 카메라를 써야 해요.</Text>
        {permission.canAskAgain ? (
          <BigButton label="카메라 켜기" onPress={requestPermission} size={size} />
        ) : canSkip ? null : (
          <Text style={[styles.permText, { fontSize: big ? 30 : 22 }]}>설정에서 카메라를 허용해 주세요.</Text>
        )}
        {demo ? <DemoPhotoButton onPress={() => setPicking(true)} /> : null}
        {picker}
        {canSkip ? (
          <Pressable onPress={() => capture(null)} accessibilityRole="button" style={styles.skip}>
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
        <View style={{ alignSelf: 'stretch', gap: 10 }}>
          <Text style={[styles.instruction, { fontSize: big ? 32 : 24 }]}>{instruction}</Text>
          {demo ? <DemoPhotoButton onPress={() => setPicking(true)} /> : null}
        </View>
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
            // 실제 서버는 사진 없는 업로드를 받지 않으므로 카메라가 준비될 때까지 기다린다
            disabled={busy || (!ready && api.mode !== 'mock')}
            accessibilityState={{ disabled: busy || (!ready && api.mode !== 'mock') }}
            onPress={shoot}
            style={({ pressed }) => [styles.shutter, (pressed || (!ready && api.mode !== 'mock')) && { opacity: 0.5 }]}
          >
            <Text style={styles.shutterText}>{busy ? '…' : '찍기'}</Text>
          </Pressable>
          {Platform.OS === 'web' || !ready ? (
            <Text style={[styles.hint, { fontSize: big ? 28 : 18 }]}>{api.mode === 'mock' ? '카메라가 준비되지 않으면 사진 없이 진행해요 (모의)' : '카메라를 준비하고 있어요'}</Text>
          ) : null}
        </View>
      </View>
      {picker}
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
