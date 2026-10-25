import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { needsExactAlarmPermission, openExactAlarmSettings } from '@/notify/exactAlarm';

/**
 * 정확한 알람 권한 안내 (R-025 1번). 어르신 폰 연결·동의 직후, 권한이 없을 때만 나온다.
 * 보호자가 어르신 폰을 들고 대신 켠다는 전제의 문구다. 행동은 [설정 열기] 하나.
 * 권한이 켜지면 자동으로 어르신 홈으로 넘어간다
 */
export default function AlarmPermission() {
  const next = useCallback(() => router.replace('/elder'), []);

  // 설정에서 돌아왔을 때(앱이 다시 앞으로 올 때) 다시 확인한다
  useEffect(() => {
    const check = () => void needsExactAlarmPermission().then((need) => !need && next());
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [next]);

  return (
    <Screen
      scroll
      footer={<BigButton label="설정 열기" onPress={() => void openExactAlarmSettings().then((ok) => ok && next())} />}
    >
      <T variant="elderTitle">보호자께: 약 알림이 제시간에 울리게 해 주세요</T>
      <T variant="elderBody">이 폰 설정에서 이 앱의 "알람 및 리마인더"를 켜 주세요.</T>
      <T variant="elderBody">꺼져 있으면 약 알림이 몇 분 늦게 울릴 수 있어요.</T>
      <T variant="elderBody">[설정 열기]를 누르고 스위치를 켠 뒤 돌아오면 자동으로 넘어가요.</T>
    </Screen>
  );
}
