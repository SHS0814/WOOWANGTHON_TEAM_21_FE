import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api';

/** 상태 화면을 다시 읽는 주기. 서버 반영 지연(최대 1분)의 절반 */
export const POLL_MS = 30_000;

/**
 * api 호출 결과를 읽고, 화면 복귀나 데이터 변경 때 다시 읽는다.
 * pollMs: 화면이 보이는 동안 주기적으로 다시 읽는다. 서버의 상태 반영(무응답 인계 등)은
 * 1분 예약 작업이 하므로 최대 1분 늦다 (api.md 1.6, R-019). 다른 기기에서 생긴 변화도 이걸로 받는다
 */
export function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[] = [], opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const reload = useCallback(() => {
    let alive = true;
    fetchRef.current().then(
      (v) => {
        if (!alive) return;
        setData(v);
        setError(undefined);
      },
      (e) => alive && setError(e),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(reload);
  const { pollMs } = opts;
  useFocusEffect(
    useCallback(() => {
      if (!pollMs) return;
      const t = setInterval(() => void reload(), pollMs);
      return () => clearInterval(t);
    }, [pollMs, reload]),
  );
  useEffect(() => api.subscribe(() => void reload()), [reload]);
  // 앱이 백그라운드에서 앞으로 오면 다시 읽는다 (일정 변경·서버 반영을 바로 받으려고, R-032 Q-012)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void reload());
    return () => sub.remove();
  }, [reload]);

  return { data, error, reload };
}
