import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Role } from '@/api';

// 이 기기의 역할. 기기마다 한 번 고른다 (R-008 1절)
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

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setRoleState(v === 'elder' || v === 'guardian' ? v : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setRole = useCallback(async (r: Role | null) => {
    setRoleState(r);
    try {
      if (r) await AsyncStorage.setItem(KEY, r);
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // 저장 실패 시에도 이번 실행에서는 역할이 유지된다
    }
  }, []);

  return <Ctx.Provider value={{ role, loading, setRole }}>{children}</Ctx.Provider>;
}

export function useRole() {
  return useContext(Ctx);
}
