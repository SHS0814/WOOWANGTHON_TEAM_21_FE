// 정확한 알람 권한 (Android 12+, SCHEDULE_EXACT_ALARM). Android 14 부터 기본 거부라,
// 없으면 복약 알림이 몇 분 늦게 울릴 수 있다 (README 알림 절, R-025 1번)
import { Platform } from 'react-native';

import { Notifications, notificationsSupported } from '@/notify/module';

/** 권한 안내 화면을 보여줘야 하는지. Android 가 아니거나 알림을 쓸 수 없는 환경이면 false */
export async function needsExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !notificationsSupported) return false;
  try {
    return !(await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** 시스템 설정 화면(알람 및 리마인더)을 연다. 돌아오면 권한이 켜졌는지 돌려준다 */
export async function openExactAlarmSettings(): Promise<boolean> {
  if (Platform.OS !== 'android' || !notificationsSupported) return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
