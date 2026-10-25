// 어르신 폰 알림 준비 상태. 연결·동의 직후 안내 화면(elder/alarm-permission)이 쓴다.
// - 알림 권한: 거부되면 복약 알림이 아예 안 뜬다 (R-028 N24)
// - 정확한 알람 권한 (Android 12+, SCHEDULE_EXACT_ALARM): Android 14 부터 기본 거부라, 없으면 몇 분 늦게 울릴 수 있다 (R-025 1번)
import { Linking, Platform } from 'react-native';

import { ensurePermission } from '@/notify/channels';
import { Notifications, notificationsSupported } from '@/notify/module';

export interface SetupNeeds {
  notifications: boolean;
  exactAlarm: boolean;
}

/** 무엇을 켜야 하는지. 알림을 쓸 수 없는 환경(웹, Expo Go Android)이면 둘 다 false */
export async function elderSetupNeeds(): Promise<SetupNeeds> {
  if (!notificationsSupported) return { notifications: false, exactAlarm: false };
  let notifications = false;
  let exactAlarm = false;
  try {
    notifications = !(await Notifications.getPermissionsAsync()).granted;
  } catch {
    // 확인할 수 없으면 묻지 않는다
  }
  if (Platform.OS === 'android') {
    try {
      exactAlarm = !(await Notifications.getExactAlarmPermissionsAsync()).granted;
    } catch {
      // 위와 같음
    }
  }
  return { notifications, exactAlarm };
}

export function needsAnySetup(n: SetupNeeds): boolean {
  return n.notifications || n.exactAlarm;
}

/** 동의 직후: 알림 권한을 먼저 한 번 물어본 뒤, 남은 준비가 있는지 돌려준다 */
export async function askThenCheckSetup(): Promise<SetupNeeds> {
  if (notificationsSupported) await ensurePermission().catch(() => false);
  return elderSetupNeeds();
}

/**
 * [설정 열기] 한 번에 남은 것 하나를 처리한다. 알림 권한이 먼저다.
 * 알림 권한은 다시 물을 수 있으면 시스템 창으로 묻고, 그래도 허용되지 않으면 이 앱의 설정 화면으로 보낸다
 */
export async function fixNextSetup(n: SetupNeeds): Promise<void> {
  if (n.notifications) {
    const cur = await Notifications.getPermissionsAsync();
    // Android 는 두 번 거부하면 창을 더 띄우지 않는데 canAskAgain 이 true 로 남기도 한다 → 허용되지 않으면 설정 화면으로
    const res = cur.canAskAgain ? await Notifications.requestPermissionsAsync() : cur;
    if (!res.granted) await Linking.openSettings();
    return;
  }
  if (n.exactAlarm) await Notifications.requestExactAlarmPermissionsAsync().catch(() => undefined);
}
