import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, GUTTER } from '@/theme';

interface Props {
  children: ReactNode;
  /** 화면 하단에 고정되는 행동 영역 (어르신 화면은 버튼 하나) */
  footer?: ReactNode;
  scroll?: boolean;
  center?: boolean;
}

export function Screen({ children, footer, scroll, center }: Props) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, center && styles.center]}>{children}</ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, center && styles.center]}>{children}</View>
  );
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  content: { padding: GUTTER, gap: 20, flexGrow: 1 },
  center: { justifyContent: 'center' },
  footer: { paddingHorizontal: GUTTER, gap: 12 },
});
