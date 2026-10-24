import { router } from 'expo-router';

import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useRole } from '@/lib/role';

/** 첫 실행 역할 선택. 고른 뒤에는 이 폰의 역할이 고정된다 (R-008 1절) */
export default function RoleSelect() {
  const { setRole } = useRole();
  return (
    <Screen
      center
      footer={
        <>
          <BigButton
            label="어르신 폰으로 쓰기"
            onPress={async () => {
              await setRole('elder');
              router.replace('/elder');
            }}
          />
          <BigButton
            label="보호자 폰으로 쓰기"
            variant="secondary"
            onPress={async () => {
              await setRole('guardian');
              router.replace('/guardian');
            }}
          />
        </>
      }
    >
      <T variant="elderTitle">이 폰을 누가 쓰나요?</T>
      <T variant="elderBody">처음 한 번만 골라요. 보통은 보호자가 대신 골라 드려요.</T>
    </Screen>
  );
}
