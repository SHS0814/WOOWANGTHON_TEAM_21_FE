// 기기 토큰 보관 (api.md 1.2). 네이티브는 expo-secure-store, 웹(개발 확인용)은 localStorage.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'woowang.device-token';

export async function loadToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, token);
  else await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // 지울 게 없으면 무시
  }
}

// 시연용 빌드: 한 폰이 같은 가족의 보호자 기기이자 어르신 기기다. 역할별 토큰을 따로 두고, 쓰는 쪽 토큰을 위의 KEY 에 넣는다
const roleKey = (role: 'elder' | 'guardian') => `${KEY}.${role}`;

export async function loadRoleToken(role: 'elder' | 'guardian'): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(roleKey(role)) ?? null;
    return await SecureStore.getItemAsync(roleKey(role));
  } catch {
    return null;
  }
}

export async function saveRoleToken(role: 'elder' | 'guardian', token: string): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(roleKey(role), token);
  else await SecureStore.setItemAsync(roleKey(role), token);
}

export async function clearRoleTokens(): Promise<void> {
  for (const role of ['elder', 'guardian'] as const) {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.removeItem(roleKey(role));
      else await SecureStore.deleteItemAsync(roleKey(role));
    } catch {
      // 지울 게 없으면 무시
    }
  }
}
