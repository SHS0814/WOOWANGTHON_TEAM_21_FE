import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/api';

/** api 호출 결과를 읽고, 화면 복귀나 데이터 변경 때 다시 읽는다 */
export function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
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
  useEffect(() => api.subscribe(() => void reload()), [reload]);

  return { data, error, reload };
}
