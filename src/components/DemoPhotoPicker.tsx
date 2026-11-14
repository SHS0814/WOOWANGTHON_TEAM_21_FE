import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { demoGroups, demoPhotoUri, type DemoPhoto } from '@/lib/demoPhotos';
import { colors } from '@/theme';

/**
 * 시연용 약통 사진 고르기 (시연 가족에서만). 고른 사진은 카메라로 찍은 사진과 똑같이 서버에 올라가 실제로 판독된다.
 * 어르신·보호자 촬영 화면이 함께 쓴다
 */
export function DemoPhotoPicker({
  visible,
  cols,
  onClose,
  onPick,
}: {
  visible: boolean;
  /** 등록된 약통의 칸 수. 주면 같은 약통 사진만 보여 준다 (다른 약통 사진은 판독이 '애매'로 나온다) */
  cols?: number;
  onClose: () => void;
  onPick: (uri: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // 두 줄로 놓는다. 사진은 원래 크기가 커서 크기를 숫자로 정해 준다 (비율만 주면 원래 크기로 그려진다)
  const { width } = useWindowDimensions();
  const cardW = Math.floor((width - PAD * 2 - GAP) / 2);
  const thumbW = cardW - CARD_PAD * 2 - 4;

  const pick = async (p: DemoPhoto) => {
    setBusy(p.key);
    setFailed(false);
    try {
      onPick(await demoPhotoUri(p.module));
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            샘플 사진 고르기
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.close} hitSlop={8}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>시연용이에요. 약통이 없어도 미리 찍어 둔 사진으로 해 볼 수 있어요. 고른 사진은 실제 AI가 판독해요.</Text>
        {failed ? <Text style={styles.error}>사진을 준비하지 못했어요. 다시 눌러 주세요.</Text> : null}
        <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 12 }}>
          {demoGroups(new Date(), cols).map((g) => (
            <View key={g.title} style={{ gap: 8 }}>
              <Text style={styles.group}>{g.title}</Text>
              <Text style={styles.groupNote}>{g.note}</Text>
              <View style={styles.grid}>
                {g.photos.map((p) => (
                  <Pressable
                    key={p.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${g.title}, ${p.label}${p.hint ? `, ${p.hint}` : ''}`}
                    disabled={busy !== null}
                    onPress={() => void pick(p)}
                    style={({ pressed }) => [styles.card, { width: cardW }, p.hint ? styles.cardHint : null, pressed && { opacity: 0.7 }]}
                  >
                    <View>
                      <Image source={p.module} style={[styles.thumb, { width: thumbW, height: Math.round(thumbW * 0.75) }]} resizeMode="cover" />
                      {busy === p.key ? (
                        <View style={styles.busy}>
                          <ActivityIndicator color="#FFF" size="large" />
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.label}>{p.label}</Text>
                    {p.hint ? <Text style={styles.hint}>{p.hint}</Text> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** 촬영 화면에 올리는 "샘플 사진 고르기" 버튼 */
export function DemoPhotoButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="샘플 사진 고르기" onPress={onPress} style={({ pressed }) => [styles.open, pressed && { opacity: 0.7 }]}>
      <Text style={styles.openText}>샘플 사진 고르기 (시연용)</Text>
    </Pressable>
  );
}

const PAD = 16;
const GAP = 10;
const CARD_PAD = 8;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  close: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 20, fontWeight: '700', color: colors.text },
  note: { fontSize: 18, lineHeight: 26, color: colors.subtle },
  error: { fontSize: 18, color: colors.attention, fontWeight: '700' },
  group: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8 },
  groupNote: { fontSize: 17, lineHeight: 24, color: colors.subtle },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { borderWidth: 2, borderColor: '#C9CED6', borderRadius: 12, padding: 8, gap: 4 },
  cardHint: { borderColor: colors.mockBg },
  thumb: { borderRadius: 8, backgroundColor: colors.secondaryBg },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 19, fontWeight: '700', color: colors.text },
  hint: { fontSize: 16, lineHeight: 22, color: colors.mockBg, fontWeight: '700' },
  open: { backgroundColor: colors.mockBg, borderRadius: 24, minHeight: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  openText: { color: colors.mockText, fontSize: 20, fontWeight: '700' },
});
