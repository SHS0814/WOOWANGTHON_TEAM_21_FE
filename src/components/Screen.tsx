import type { ReactNode, Ref } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardOverlap } from '@/lib/keyboard';
import { colors, GUTTER } from '@/theme';

interface Props {
  children: ReactNode;
  /** 화면 하단에 고정되는 행동 영역 (어르신 화면은 버튼 하나) */
  footer?: ReactNode;
  /** 화면 맨 위에 고정되는 줄 (어르신 대기 홈의 '나가기') */
  header?: ReactNode;
  scroll?: boolean;
  center?: boolean;
  /**
   * 입력칸이 있는 화면만 켠다 (T-FE23, 지금은 E2 연결 화면 하나). 키보드가 화면 아래를 가리는 만큼 아래 여백을 줘서
   * 내용이 키보드 위로 올라오게 한다. 끄면(기본) 예전과 똑같이 동작한다
   */
  keyboardAware?: boolean;
  /** keyboardAware 화면에서 입력칸이 보이게 스크롤할 때 */
  scrollRef?: Ref<ScrollViewInstance>;
}

/** 하단 버튼과 폰의 내비게이션 버튼(뒤로·홈) 사이 간격. 붙어 있으면 같이 눌릴 수 있다 */
const FOOTER_GAP = 28;

export function Screen({ keyboardAware, ...props }: Props) {
  return keyboardAware ? <KeyboardScreen {...props} /> : <PlainScreen {...props} />;
}

/** 기본 화면 (T-FE23 이전과 같은 코드) */
function PlainScreen({ children, footer, header, scroll, center }: Omit<Props, 'keyboardAware'>) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, center && styles.center]}>{children}</ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, center && styles.center]}>{children}</View>
  );
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + FOOTER_GAP }]}>
      {header ? <View style={styles.header}>{header}</View> : null}
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

/** 키보드를 피하는 화면. 키보드가 없을 때 모습은 기본 화면과 같다 */
function KeyboardScreen({ children, footer, scroll, center, scrollRef }: Omit<Props, 'keyboardAware'>) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardOverlap();
  const body = scroll ? (
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, center && styles.center]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, center && styles.center]}>{children}</View>
  );
  return (
    <View ref={kb.ref} style={[styles.root, { paddingBottom: kb.overlap > 0 ? kb.overlap : insets.bottom + FOOTER_GAP }]}>
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
  header: { paddingHorizontal: GUTTER, paddingTop: 8 },
});
