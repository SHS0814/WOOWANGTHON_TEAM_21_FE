import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { Icon } from '@/components/guardian/Icon';
import { useRole } from '@/lib/role';
import { guardian } from '@/theme';

/**
 * 처음 설정 화면(역할을 고른 직후)의 뒤로 가기.
 * 돌아갈 화면이 있으면 그 화면으로, 없으면 역할을 지우고 "이 폰을 누가 쓰나요?"로 간다.
 */
export function useBackToRole() {
  const { setRole } = useRole();
  return async () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    await setRole(null);
    router.replace('/role');
  };
}

/** 왼쪽 위 "←" 버튼 (Android 기본 뒤로 가기와 같은 모양). label 을 주면 글자도 함께 보인다 (어르신 화면용 큰 글씨) */
export function BackButton({ onPress, label, color = guardian.color.primary }: { onPress: () => void; label?: string; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        minWidth: 48,
        minHeight: 48,
        gap: 6,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Icon name="arrowLeft" size={26} color={color} strokeWidth={2.2} />
      {label ? <Text style={{ fontSize: 22, fontWeight: '700', color }}>{label}</Text> : null}
    </Pressable>
  );
}
