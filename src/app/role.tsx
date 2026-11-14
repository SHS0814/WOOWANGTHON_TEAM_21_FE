import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/components/guardian/Brand';
import { Icon, type IconName } from '@/components/guardian/Icon';
import { api, DEMO_BUILD, guardianMessage } from '@/api';
import { ErrorText, GText, IconBubble } from '@/components/guardian/ui';
import { useRole } from '@/lib/role';
import { guardian } from '@/theme';

const C = guardian.color;

/**
 * 첫 실행 역할 선택. 고른 뒤에는 이 폰의 역할이 고정된다 (R-008 1절).
 * 처음 설정 화면이라 보호자 화면과 같은 모습을 쓴다 (R-047). 어르신 폰으로 넘어간 뒤의 화면은 그대로다
 */
export default function RoleSelect() {
  const { setRole } = useRole();
  const insets = useSafeAreaInsets();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  // 시연용 빌드: 시연 가족을 만들고 이 폰을 보호자·어르신 기기로 모두 연결한 뒤 보호자 화면에서 시작한다
  const startDemo = async () => {
    if (!api.demo || starting) return;
    setStarting(true);
    setError('');
    try {
      await api.demo.start('어머니', '아들');
      await setRole('guardian');
      router.replace('/guardian');
    } catch (e) {
      setError(guardianMessage(e));
    } finally {
      setStarting(false);
    }
  };
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <View style={styles.top}>
        <Brand tagline="약 드실 시간에 앱이 대신 여쭤보고, 확인이 필요할 때만 보호자에게 알려드려요." />
      </View>
      <View>
        <View style={{ gap: 4, marginBottom: 8 }}>
          <GText variant="title">이 폰을 누가 쓰나요?</GText>
          <GText color={C.sub}>처음 한 번만 골라요. 보통은 보호자가 대신 골라 드려요.</GText>
        </View>
        {DEMO_BUILD ? (
          <>
            <RoleCard
              icon="smartphone"
              title={starting ? '시연을 준비하고 있어요…' : '이 폰 하나로 시연하기'}
              detail="연결을 건너뛰고, 위쪽 띠에서 어르신·보호자 화면을 오가요. 샘플 사진을 쓸 수 있어요."
              onPress={startDemo}
            />
            {error ? <ErrorText>{error}</ErrorText> : null}
          </>
        ) : null}
        <RoleCard
          icon="user"
          title="어르신 폰으로 쓰기"
          detail="약 드실 시간에 질문을 받고 약통 사진을 찍어요."
          onPress={async () => {
            await setRole('elder');
            router.replace('/elder');
          }}
        />
        <RoleCard
          icon="users"
          title="보호자 폰으로 쓰기"
          detail="확인이 필요한 일만 알림으로 받고 기록을 봐요."
          onPress={async () => {
            await setRole('guardian');
            router.replace('/guardian');
          }}
        />
      </View>
    </View>
  );
}

/** 고르는 줄. 상자 대신 위아래 구분선으로 나눈다 (T-FE15) */
function RoleCard({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.neutralSoft }]}
    >
      <IconBubble name={icon} tone="info" size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <GText variant="section" style={{ fontSize: 21, lineHeight: 28 }}>
          {title}
        </GText>
        <GText variant="sub" color={C.sub}>
          {detail}
        </GText>
      </View>
      <Icon name="chevronRight" size={24} color={C.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: guardian.space.gutter, paddingTop: 24, justifyContent: 'space-between', gap: 24 },
  top: { flex: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 96,
    paddingVertical: 18,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
});
