import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, DEMO_BUILD, type LocalPhoto } from '@/api';
import { DemoPhotoPicker } from '@/components/DemoPhotoPicker';
import { GButton, GScreen, GText } from '@/components/guardian/ui';
import { useMe } from '@/lib/useMe';
import { guardian } from '@/theme';

const C = guardian.color;

interface Props {
  title: string;
  description?: string;
  /** 제목 위에 두는 것 (처음 설정 단계 표시 등) */
  top?: ReactNode;
  /** 가이드 틀 가로:세로 비율. 약통 배열에서 계산한다 */
  aspect: number;
  onCapture: (photo: LocalPhoto) => void;
  /** 시연용 가족일 때 카메라 대신 샘플 사진을 고를 수 있게 한다 (약통 등록에서만 쓴다) */
  allowSample?: boolean;
}

/**
 * 보호자 화면의 약통 촬영 (G2 약통 등록, G7 약통 채우기).
 * 다른 보호자 화면과 같은 틀(상단 제목 줄, 흰 바탕, 아래 큰 버튼) 안에 카메라를 둔다.
 * 어르신 촬영(E5)은 전체 화면인 PillboxCamera 를 그대로 쓴다.
 */
export function PillboxShot({ title, description, top, aspect, onCapture, allowSample }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const { data: me } = useMe();
  // 시연 가족이면 카메라 대신 미리 찍어 둔 약통 사진도 고를 수 있다 (판독은 똑같이 실제 서버가 한다)
  // 시연용 빌드는 사진을 찍는 모든 보호자 화면에서, 그 밖에는 allowSample 을 준 화면에서만
  const demo = (DEMO_BUILD || !!allowSample) && api.mode !== 'mock' && !!me && me.family.is_demo && me.server.demo_mode;
  const mock = api.mode === 'mock';
  const granted = !!permission?.granted;

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

  const footer = granted ? (
    // 실제 서버는 사진 없는 업로드를 받지 않으므로 카메라가 준비될 때까지 기다린다
    <GButton label="사진 찍기" icon="camera" busy={busy} disabled={!ready && !mock} onPress={shoot} />
  ) : permission?.canAskAgain ? (
    <GButton label="카메라 켜기" icon="camera" onPress={requestPermission} />
  ) : mock ? (
    <GButton label="카메라 없이 계속 (모의 사진)" onPress={() => capture(null)} />
  ) : undefined;

  return (
    <GScreen footer={footer}>
      {top}
      <View style={{ gap: 6 }}>
        <GText variant="title">{title}</GText>
        {description ? <GText color={C.sub}>{description}</GText> : null}
      </View>
      <View style={styles.box}>
        {granted ? (
          <>
            <CameraView ref={ref} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
            <View style={[styles.guide, { aspectRatio: aspect }]} accessibilityLabel="약통을 이 틀에 맞춰 주세요">
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>
          </>
        ) : (
          <GText color="#FFFFFF" style={{ textAlign: 'center', paddingHorizontal: 24 }}>
            {permission && !permission.canAskAgain && !mock ? '폰 설정에서 카메라를 허용해 주세요.' : '약통 사진을 찍으려면 카메라를 써야 해요.'}
          </GText>
        )}
      </View>
      {granted && !ready && !mock ? (
        <GText variant="sub" color={C.sub}>
          카메라를 준비하고 있어요
        </GText>
      ) : null}
      {demo ? <GButton variant="ghost" icon="image" label="샘플 사진 사용" onPress={() => setPicking(true)} /> : null}
      {demo ? (
        <DemoPhotoPicker
          visible={picking}
          onClose={() => setPicking(false)}
          onPick={(uri) => {
            setPicking(false);
            capture(uri);
          }}
        />
      ) : null}
    </GScreen>
  );
}

const K = 28;
const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  guide: { width: '90%', maxHeight: '90%' },
  corner: { position: 'absolute', width: K, height: K, borderColor: '#FFE25C' },
  tl: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5 },
  tr: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5 },
  br: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5 },
});
