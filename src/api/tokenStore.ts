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
