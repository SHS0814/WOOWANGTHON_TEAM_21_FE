// expo-notifications 를 조심해서 불러온다.
// Expo Go(Android, 58.0.5)에는 이 패키지가 요구하는 네이티브 모듈(ExpoTopicSubscriptionModule)이 없어서
// 일반 import 만으로 앱 전체가 멈춘다. 불러오지 못하면 알림 없이 앱을 계속 쓴다 (README: 개발 빌드 필요)
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

function load(): typeof NotificationsModule | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof NotificationsModule;
  } catch (e) {
    if (__DEV__) console.warn('[notify] expo-notifications 를 불러오지 못함 (알림 없이 계속)', String(e));
    return null;
  }
}

const loaded = load();

/** 알림을 쓸 수 있는 환경인지. false 면 아래 Notifications 를 부르지 않는다 */
export const notificationsSupported = loaded !== null;

/** notificationsSupported 가 true 일 때만 쓴다 */
export const Notifications = loaded as typeof NotificationsModule;
