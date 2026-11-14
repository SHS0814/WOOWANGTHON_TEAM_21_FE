// 복약 시간에 질문 화면을 잠금 화면 위로 띄우는 방식 (Android 만, 개발·release 빌드).
// 어르신 폰을 연결할 때 보호자가 "알림으로만 받기 / 화면에 띄우기" 중에 고른다. 고른 값은 이 폰에만 저장한다.
// 네이티브 모듈(modules/woowang-fullscreen)이 없는 환경(웹, iOS, Expo Go)에서는 항상 알림 방식이다
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type AskMode = 'notification' | 'screen';

interface NativeFullScreen {
  canUseFullScreenIntent(): boolean;
  openFullScreenSettings(): void;
  schedule(id: string, atMs: number, title: string, body: string, url: string): void;
  cancel(id: string): void;
  cancelAll(): void;
  scheduledIds(): string[];
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeFullScreen>('WoowangFullScreen') : null;
const KEY = 'woowang.elder.askMode';

/** 이 폰에서 "화면에 띄우기"를 고를 수 있는지 */
export const fullScreenAvailable = native !== null;

/** 고른 적이 없으면 null */
export async function getAskMode(): Promise<AskMode | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'screen' || v === 'notification' ? v : null;
  } catch {
    return null;
  }
}

export async function setAskMode(mode: AskMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}

/** 연결 해제·역할 변경 때 */
export async function clearAskMode(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

/** Android 14 부터 "전체 화면 알림"을 설정에서 허용해야 한다 */
export function canUseFullScreen(): boolean {
  try {
    return native?.canUseFullScreenIntent() ?? false;
  } catch {
    return false;
  }
}

export function openFullScreenSettings(): void {
  try {
    native?.openFullScreenSettings();
  } catch {
    // 설정 화면을 못 열면 그대로 둔다. 알림 방식으로 계속 동작한다
  }
}

/** 지금 화면에 띄우는 방식으로 예약해야 하는지. 권한이 꺼져 있으면 알림 방식으로 내려간다 */
export async function screenModeActive(): Promise<boolean> {
  return native !== null && (await getAskMode()) === 'screen' && canUseFullScreen();
}

export interface ScreenAlarm {
  id: string;
  at: Date;
  title: string;
  body: string;
  /** 알람이 열 화면의 딥링크 */
  url: string;
}

const scheduledThisSession = new Map<string, string>();
const TEST_PREFIX = 'test:';

/**
 * 고른 직후 이 폰에서 정말 화면이 뜨는지 보호자가 한 번 시험해 볼 수 있게 한다 (제조사 절전 설정에 따라 다를 수 있음).
 * 복약 건이 아니므로 어르신 홈을 연다. 문구에 시험이라고 밝힌다
 */
export function scheduleTestAlarm(afterSec: number, url: string): boolean {
  if (!native) return false;
  try {
    native.schedule(`${TEST_PREFIX}${Date.now()}`, Date.now() + afterSec * 1000, '[시험] 화면에 띄우기 시험이에요', '약 시간이 되면 이렇게 화면이 열려요.', url);
    return true;
  } catch {
    return false;
  }
}

/** 예약된 화면 알람을 wanted 와 같게 맞춘다. 빈 목록이면 모두 지운다 */
export function syncScreenAlarms(wanted: ScreenAlarm[]): void {
  if (!native) return;
  const wantedIds = new Set(wanted.map((w) => w.id));
  const existing = new Set(native.scheduledIds());
  for (const id of existing) {
    // 시험 알람은 복약 예약과 별개라 여기서 지우지 않는다
    if (!wantedIds.has(id) && !id.startsWith(TEST_PREFIX)) {
      native.cancel(id);
      scheduledThisSession.delete(id);
    }
  }
  for (const w of wanted) {
    const sig = `${w.at.getTime()}|${w.title}|${w.body}|${w.url}`;
    if (existing.has(w.id) && scheduledThisSession.get(w.id) === sig) continue;
    scheduledThisSession.set(w.id, sig);
    native.schedule(w.id, w.at.getTime(), w.title, w.body, w.url);
  }
}

export function clearScreenAlarms(): void {
  if (!native) return;
  try {
    native.cancelAll();
  } catch {
    // 지우지 못해도 앱은 계속 쓴다
  }
  scheduledThisSession.clear();
}
