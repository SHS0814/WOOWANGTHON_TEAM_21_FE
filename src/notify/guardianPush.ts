// 보호자 폰 푸시 (api.md 3.9, 4.3, R-039). 서버가 FCM 으로 직접 보내므로 Android 기기 FCM 토큰을 받아
// PUT /devices/me/push-token 으로 등록한다. iOS 는 푸시를 지원하지 않는다 (R-039): 토큰을 보내지 않고 넘어간다.
// Firebase 설정(google-services.json) 없이 만든 빌드에서는 토큰을 받을 수 없다 (app.config.js, README)
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api, DEMO_BUILD } from '@/api';
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

/**
 * 알림창에 남아 있는 인계 알림 가운데 이미 끝난(판정된) 것을 지운다. 보호자 홈이 열려 있는 인계 목록을 읽을 때마다 부른다.
 * 다른 보호자가 판정한 건도 이 폰이 목록을 다시 읽으면 지워진다. 요약 알림 같은 다른 알림은 건드리지 않는다.
 * 알림 내용을 읽을 수 없는 알림(앱이 꺼져 있을 때 시스템이 직접 띄운 것)은 열려 있는 인계가 하나도 없을 때만 지운다.
 * 시연용 빌드는 한 폰에 어르신 역할도 있어 '화면에 띄우기' 복약 알림이 같은 모양(내용 없음)으로 떠 있을 수 있으므로 그런 알림은 지우지 않는다
 */
export async function clearResolvedHandoffNotifications(openHandoffIds: string[]): Promise<void> {
  if (!notificationsSupported) return;
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) {
      const data = (n.request.content.data ?? {}) as Record<string, unknown>;
      const type = typeof data.type === 'string' ? data.type : null;
      const id = typeof data.handoff_id === 'string' ? data.handoff_id : null;
      const resolved = type === 'handoff' && id ? !openHandoffIds.includes(id) : type === null && openHandoffIds.length === 0 && !DEMO_BUILD;
      if (resolved) await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  } catch (e) {
    if (__DEV__) console.warn('[push] 끝난 인계 알림을 지우지 못함', String(e));
  }
}
