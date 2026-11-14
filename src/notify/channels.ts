// 알림 공통 설정 (api.md 4.3, UI 설계 4장). 웹에서는 알림을 쓰지 않는다
import { Platform } from 'react-native';

import { Notifications, notificationsSupported } from '@/notify/module';

/** 어르신 복약 질문. 높은 중요도 + 알람음 (Android). full-screen intent 는 개발 빌드 + 네이티브 모듈이 필요해서 이번엔 없다 */
export const DOSE_CHANNEL = 'dose-ask-quiet';
/**
 * 보호자 인계·요약 푸시. 서버(FCM, T-BE7)가 android.notification.channel_id 로 이 id 를 보낸다 (R-039).
 * app.json expo-notifications defaultChannel 도 같은 값이라, 서버가 채널을 안 적어도 이 채널로 온다
 */
export const GUARDIAN_CHANNEL = 'guardian-quiet';

export { notificationsSupported };

let ready: Promise<void> | null = null;

/**
 * 앱 시작 때 한 번. 앱이 앞에 있을 때도 배너를 보여준다.
 * 알림은 소리 없이 진동과 화면으로만 알린다 (사용자 결정 2026-11-14). Android 는 한 번 만든 채널의 소리를 바꿀 수 없어서
 * 소리 없는 채널을 새 이름으로 만든다
 */
export function setupNotifications(): Promise<void> {
  if (!notificationsSupported) return Promise.resolve();
  ready ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      // Android 13+ 는 권한 요청 전에 채널이 있어야 한다
      await Notifications.setNotificationChannelAsync(DOSE_CHANNEL, {
        name: '복약 시간',
        description: '약 드실 시간에 어르신께 여쭤봐요',
        importance: Notifications.AndroidImportance.MAX,
        sound: null,
        enableVibrate: true,
        vibrationPattern: [0, 800, 400, 800],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync(GUARDIAN_CHANNEL, {
        name: '확인이 필요한 일',
        description: '어르신 약 확인이 필요할 때 알려드려요',
        importance: Notifications.AndroidImportance.HIGH,
        sound: null,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  })().catch((e) => {
    if (__DEV__) console.warn('[notify] 채널 설정 실패', e);
    ready = null;
  });
  return ready ?? Promise.resolve();
}

let asking: Promise<boolean> | null = null;
let askedThisSession = false;

/**
 * 알림 권한. 이미 정했으면 다시 묻지 않는다.
 * 자동으로 묻는 것은 한 실행에 한 번뿐이다 (동의 화면과 알림 동기화가 동시에 물어 창이 두 번 뜨는 것을 막음).
 * 거부된 뒤에는 안내 화면의 [설정 열기]로만 다시 묻는다 (R-028 N24)
 */
export function ensurePermission(): Promise<boolean> {
  asking ??= askOnce().finally(() => {
    asking = null;
  });
  return asking;
}

async function askOnce(): Promise<boolean> {
  if (!notificationsSupported) return false;
  await setupNotifications();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (askedThisSession || !cur.canAskAgain) return false;
  askedThisSession = true;
  const res = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  if (__DEV__ && !res.granted) console.warn('[notify] 알림 권한 없음', res.status);
  return res.granted;
}
