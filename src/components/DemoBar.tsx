import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { demoBarHidden, onDemoBarHidden } from '@/lib/demoBar';
import { useRole } from '@/lib/role';
import { colors } from '@/theme';

/**
 * 시연용 빌드에서만 모든 화면 맨 위에 보이는 띠. 한 폰에서 어르신 화면과 보호자 화면을 오간다.
 * 배포용 빌드에는 그리지 않는다 (app/_layout 이 DEMO_BUILD 일 때만 넣는다)
 */
export function DemoBar() {
  const { role, setRole } = useRole();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(demoBarHidden());
  useEffect(() => onDemoBarHidden(() => setHidden(demoBarHidden())), []);

  useEffect(() => {
    let alive = true;
    const check = () => void api.demo?.ready().then((r) => alive && setReady(r));
    check();
    const off = api.subscribe(check);
    return () => {
      alive = false;
      off();
    };
  }, [role]);

  const other = role === 'elder' ? 'guardian' : 'elder';
  const switchRole = async () => {
    if (!api.demo || busy) return;
    setBusy(true);
    try {
      if (!(await api.demo.switchTo(other))) return;
      await setRole(other);
      if (router.canDismiss()) router.dismissAll();
      router.replace(other === 'elder' ? '/elder' : '/guardian');
    } finally {
      setBusy(false);
    }
  };

  // 시연 도구에서 띠를 숨겼으면 그리지 않는다 (역할은 시연 도구에서 바꾼다)
  if (hidden) return null;

  return (
    <View style={styles.bar} accessibilityRole="header">
      <Text style={styles.text} numberOfLines={1}>
        시연용{role ? ` · ${role === 'elder' ? '어르신 화면' : '보호자 화면'}` : ''}
      </Text>
      {role && ready ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={other === 'elder' ? '어르신 화면으로 바꾸기' : '보호자 화면으로 바꾸기'}
          onPress={switchRole}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
          hitSlop={6}
        >
          <Text style={styles.btnText}>{other === 'elder' ? '어르신으로' : '보호자로'}</Text>
        </Pressable>
      ) : null}
      {role ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="시연 도구 열기"
          onPress={() => router.push('/dev')}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
          hitSlop={6}
        >
          <Text style={styles.btnText}>도구</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.mockBg, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { color: colors.mockText, fontSize: 16, fontWeight: '700', flex: 1 },
  btn: { borderWidth: 1.5, borderColor: colors.mockText, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, minHeight: 34, justifyContent: 'center' },
  btnText: { color: colors.mockText, fontSize: 16, fontWeight: '700' },
});
