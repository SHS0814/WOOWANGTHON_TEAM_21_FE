import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, type Role } from '@/api';

// 이 기기의 역할. 첫 실행 때 한 번 고른다 (R-008 1절). 토큰을 받은 뒤에는 서버의 device.role 과 같다
const KEY = 'woowang.device-role';

interface RoleState {
  role: Role | null;
  loading: boolean;
  setRole: (r: Role | null) => Promise<void>;
}

const Ctx = createContext<RoleState>({ role: null, loading: true, setRole: async () => {} });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((r: Role | null) => {
    // 모의 서버는 한 기기에서 두 역할을 흉내 내므로, 지금 역할을 알려준다
    api.dev?.setActingRole(r);
    setRoleState(r);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => apply(v === 'elder' || v === 'guardian' ? v : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apply]);

  const setRole = useCallback(
    async (r: Role | null) => {
      apply(r);
      try {
        if (r) await AsyncStorage.setItem(KEY, r);
        else await AsyncStorage.removeItem(KEY);
      } catch {
        // 저장 실패 시에도 이번 실행에서는 역할이 유지된다
      }
    },
    [apply],
  );

  // 5장: 401(토큰 없음·해제) → 저장된 토큰은 api 가 지웠다. 역할도 지우고 첫 화면으로
  useEffect(
    () =>
      api.onAuthLost(() => {
        void setRole(null);
        router.replace('/role');
      }),
    [setRole],
  );

  return <Ctx.Provider value={{ role, loading, setRole }}>{children}</Ctx.Provider>;
}

export function useRole() {
  return useContext(Ctx);
}
