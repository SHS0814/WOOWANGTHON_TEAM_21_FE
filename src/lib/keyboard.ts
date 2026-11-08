import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, type ViewInstance } from 'react-native';

/**
 * 키보드가 이 View 의 아래쪽을 얼마나 가리는지 (dp). 그만큼 아래 여백을 주면 입력칸·버튼이 키보드 위로 올라온다 (T-FE22a).
 * Android 15+ 는 화면이 상태바·내비게이션바 뒤까지 그려져(edge-to-edge) 키보드가 떠도 창이 줄지 않는다.
 * 창이 실제로 줄어드는 기기에서는 겹침이 0 이 되어 여백이 생기지 않는다.
 * 키보드 이벤트는 메인 창에서만 오므로, 입력이 있는 시트는 Modal(별도 창) 대신 화면 안에 띄운다.
 * 보호자 화면(GScreen, T-FE22a)과 어르신 연결 화면(Screen keyboardAware, T-FE23)이 함께 쓴다
 */
export function useKeyboardOverlap() {
  const ref = useRef<ViewInstance>(null);
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const { screenY, height } = e.endCoordinates;
      const top = screenY > 0 ? screenY : Dimensions.get('screen').height - height;
      const node = ref.current;
      if (!node) return setOverlap(height);
      node.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, Math.round(y + h - top))));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return { ref, overlap };
}
