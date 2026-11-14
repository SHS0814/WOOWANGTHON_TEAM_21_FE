// 시연용 빌드의 위쪽 띠를 숨길지. 숨겨도 시연 도구(어르신 홈의 날짜 길게 누르기, 보호자 설정의 '시연 도구')에서 역할을 바꿀 수 있다.
// 발표 자료용 화면을 찍을 때처럼 띠 없이 실제 서비스 화면 그대로 보고 싶을 때 쓴다. 화면 내용과 판독은 그대로다
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'woowang.demo.bar-hidden';
let hidden = false;
const listeners = new Set<() => void>();

void AsyncStorage.getItem(KEY)
  .then((v) => {
    hidden = v === '1';
    listeners.forEach((l) => l());
  })
  .catch(() => {});

export function demoBarHidden(): boolean {
  return hidden;
}

export function onDemoBarHidden(l: () => void): () => void {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export async function setDemoBarHidden(v: boolean): Promise<void> {
  hidden = v;
  listeners.forEach((l) => l());
  try {
    if (v) await AsyncStorage.setItem(KEY, '1');
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // 저장 실패 시에도 이번 실행에서는 유지된다
  }
}
