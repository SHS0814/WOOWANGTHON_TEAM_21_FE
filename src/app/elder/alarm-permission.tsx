import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { elderSetupNeeds, fixNextSetup, needsAnySetup, type SetupNeeds } from '@/notify/elderSetup';
import { reportNotificationStatus } from '@/notify/statusReport';

/**
 * 알림 준비 안내 (R-025 1번, R-028 N24). 어르신 폰 연결·동의 직후, 켜야 할 것이 있을 때만 나온다.
 * - 알림 권한이 거부됐으면 알림 허용
 * - Android 정확한 알람 권한이 없으면 "알람 및 리마인더"
 * 보호자가 어르신 폰을 들고 대신 켠다는 전제의 문구다. 행동은 [설정 열기] 하나 (남은 것을 하나씩 연다).
 * 모두 켜지면 자동으로 어르신 홈으로 넘어간다
 */
export default function AlarmPermission() {
  const [needs, setNeeds] = useState<SetupNeeds | null>(null);

  const check = useCallback(async () => {
    // 권한 안내·설정 화면에서 돌아온 직후에도 서버에 보고한다 (3.29, R-032)
    void reportNotificationStatus();
    const n = await elderSetupNeeds();
    if (!needsAnySetup(n)) router.replace('/elder');
    else setNeeds(n);
  }, []);

  // 설정에서 돌아왔을 때(앱이 다시 앞으로 올 때) 다시 확인한다
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => sub.remove();
  }, [check]);

  if (!needs) return null;
  const both = needs.notifications && needs.exactAlarm;

  return (
    <Screen scroll footer={<BigButton label="설정 열기" onPress={() => void fixNextSetup(needs).then(check)} />}>
      <T variant="elderTitle">보호자께: 약 알림이 제시간에 울리게 해 주세요</T>
      {needs.notifications ? (
        <T variant="elderBody">{both ? '1. ' : ''}이 앱의 알림을 허용해 주세요. 꺼져 있으면 약 알림이 뜨지 않아요.</T>
      ) : null}
      {needs.exactAlarm ? (
        <T variant="elderBody">
          {both ? '2. ' : ''}이 폰 설정에서 이 앱의 "알람 및 리마인더"를 켜 주세요. 꺼져 있으면 약 알림이 몇 분 늦게 울릴 수 있어요.
        </T>
      ) : null}
      <T variant="elderBody">[설정 열기]를 누르고 켠 뒤 돌아오면 {both ? '다음 것으로' : '자동으로'} 넘어가요.</T>
    </Screen>
  );
}
