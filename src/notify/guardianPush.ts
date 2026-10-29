// 보호자 폰 푸시 (api.md 3.9, 4.3, R-039). 서버가 FCM 으로 직접 보내므로 Android 기기 FCM 토큰을 받아
// PUT /devices/me/push-token 으로 등록한다. iOS 는 푸시를 지원하지 않는다 (R-039): 토큰을 보내지 않고 넘어간다.
// Firebase 설정(google-services.json) 없이 만든 빌드에서는 토큰을 받을 수 없다 (app.config.js, README)
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api } from '@/api';
import { ensurePermission, notificationsSupported } from '@/notify/channels';
import { Notifications } from '@/notify/module';

export type PushStatus = 'unknown' | 'registered' | 'denied' | 'unsupported' | 'no_firebase' | 'failed';

let status: PushStatus = 'unknown';
const listeners = new Set<() => void>();

export function pushStatus() {
  return status;
}

export function onPushStatus(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

function set(s: PushStatus) {
  status = s;
  listeners.forEach((l) => l());
}

function firebaseConfigured(): boolean {
  const extra = Constants.expoConfig?.extra as { firebaseConfigured?: boolean } | undefined;
  return extra?.firebaseConfigured === true;
}

let inFlight: Promise<PushStatus> | null = null;

/** 보호자 앱이 열릴 때 한 번. 실패해도 앱은 그대로 쓴다 (인계는 G4 목록에서도 보인다) */
export function registerGuardianPush(): Promise<PushStatus> {
  inFlight ??= register().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function register(): Promise<PushStatus> {
  if (Platform.OS !== 'android' || !notificationsSupported) return (set('unsupported'), status);
  if (!firebaseConfigured()) return (set('no_firebase'), status);
  if (!(await ensurePermission())) return (set('denied'), status);
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    await send(token.data);
  } catch (e) {
    // 네트워크 문제나 Google Play 서비스 없음. 다음에 앱을 열 때 다시 시도한다
    if (__DEV__) console.warn('[push] FCM 토큰 등록 실패', String(e));
    set('failed');
  }
  return status;
}

async function send(token: unknown) {
  if (typeof token !== 'string' || !token) throw new Error('FCM 토큰 없음');
  await api.putPushToken(token);
  set('registered');
}

/** FCM 토큰이 바뀌면 새 토큰을 다시 등록한다 */
export function watchPushToken(): () => void {
  if (Platform.OS !== 'android' || !notificationsSupported) return () => {};
  const sub = Notifications.addPushTokenListener((t) => {
    void api.hasToken().then((has) => {
      if (!has) return;
      send(t.data).catch(() => set('failed'));
    });
  });
  return () => sub.remove();
}
