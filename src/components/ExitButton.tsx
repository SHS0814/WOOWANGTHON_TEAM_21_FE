import { BackHandler, Platform, Pressable, StyleSheet } from 'react-native';

import { T } from '@/components/Text';

/**
 * 어르신 화면 맨 위의 "✕ 나가기". 앱을 닫고 폰 화면(잠겨 있었으면 잠금 화면)으로 돌아간다.
 * 약 시간 알림과 재질문은 그대로 울리고, 응답이 없으면 서버 규칙대로 보호자에게 넘어간다.
 * 앱을 스스로 닫을 수 있는 Android 에서만 보인다
 */
export function ExitButton() {
  if (Platform.OS !== 'android') return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="나가기"
      accessibilityHint="앱을 닫아요. 약 시간이 되면 다시 알려드려요"
      onPress={() => BackHandler.exitApp()}
      style={({ pressed }) => [styles.exit, pressed && { opacity: 0.7 }]}
    >
      <T variant="elderBody" style={styles.exitText}>
        ✕ 나가기
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  exit: {
    alignSelf: 'flex-end',
    minHeight: 60,
    paddingHorizontal: 20,
    borderRadius: 30,
    // 빨강: 흰 글자와 대비 6.5:1
    backgroundColor: '#B3261E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitText: { color: '#FFFFFF', fontWeight: '700' },
});
