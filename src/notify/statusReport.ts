// 어르신 폰 알림 준비 상태를 서버에 보고한다 (api.md 3.29, R-032).
// 정확한 알람 권한이 없으면 Android 알림이 최대 1시간 늦어 거짓 무응답 인계가 생길 수 있어서, 보호자에게 알리려는 것이다.
// 보내는 때: 앱 시작, 앱이 앞으로 올 때, 권한 안내·설정 화면에서 돌아온 직후
import { Platform } from 'react-native';

import { api, type NotificationStatusReport } from '@/api';
import { Notifications, notificationsSupported } from '@/notify/module';

/** 정확한 알람 권한은 Android 12(API 31)부터 있다 */
const EXACT_ALARM_MIN_API = 31;

/** 지금 기기의 상태. 알림 모듈을 못 쓰는 환경(웹, Expo Go Android)이면 확인할 수 없어서 null */
export async function currentNotificationStatus(): Promise<NotificationStatusReport | null> {
  if (!notificationsSupported) return null;
  try {
    const notifications_allowed = (await Notifications.getPermissionsAsync()).granted;
    let exact_alarm_allowed: boolean | null = null;
    if (Platform.OS === 'android' && Number(Platform.Version) >= EXACT_ALARM_MIN_API) {
      exact_alarm_allowed = (await Notifications.getExactAlarmPermissionsAsync()).granted;
    }
    return { notifications_allowed, exact_alarm_allowed };
  } catch {
    return null;
  }
}

let inFlight: Promise<void> | null = null;

/** 보고한다. 토큰이 없거나 실패하면 조용히 넘어간다 (다음 시점에 다시 보낸다) */
export function reportNotificationStatus(): Promise<void> {
  inFlight ??= (async () => {
    if (!(await api.hasToken())) return;
    const status = await currentNotificationStatus();
    if (!status) return;
    await api.putNotificationStatus(status);
  })()
    .catch((e) => {
      if (__DEV__) console.warn('[notify] 알림 상태 보고 실패', e);
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
