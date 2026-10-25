// 보호자 폰 푸시 (api.md 3.9, 4.3). Expo 푸시 토큰을 받아 PUT /devices/me/push-token 으로 등록한다.
// Expo Go(Android, SDK 53+)에서는 원격 푸시를 받을 수 없고, EAS 프로젝트 id 가 있어야 토큰을 받는다 (README)
import Constants from 'expo-constants';

import { api } from '@/api';
import { ensurePermission, notificationsSupported } from '@/notify/channels';
import { Notifications } from '@/notify/module';

export type PushStatus = 'unknown' | 'registered' | 'denied' | 'unsupported' | 'no_project' | 'failed';

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

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
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
  if (!notificationsSupported) return (set('unsupported'), status);
  if (!(await ensurePermission())) return (set('denied'), status);
  const id = projectId();
  if (!id) return (set('no_project'), status);
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.putPushToken(token.data);
    set('registered');
  } catch {
    // Expo Go(Android)나 네트워크 문제. 다음에 앱을 열 때 다시 시도한다
    set('failed');
  }
  return status;
}

/** 토큰이 바뀌면 다시 등록한다 */
export function watchPushToken(): () => void {
  if (!notificationsSupported) return () => {};
  const sub = Notifications.addPushTokenListener(() => void registerGuardianPush());
  return () => sub.remove();
}
