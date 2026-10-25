import { useEffect } from 'react';

import { api } from '@/api';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { syncElderNotifications } from '@/notify/elderSchedule';

/** 어르신 화면이 떠 있는 동안 서버 상태에 맞춰 로컬 알림을 다시 맞춘다 (backend.md 6장: 앱이 다시 열리면 서버 상태로 재설정) */
export function ElderNotificationSync() {
  const { data: me } = useApiData(() => api.me().catch(() => null));
  const ok = !!me && !me.consent_required;
  const { data: today } = useApiData(() => (ok ? api.today().catch(() => null) : Promise.resolve(null)), [ok], { pollMs: POLL_MS });
  const { data: schedule } = useApiData(() => (ok ? api.schedule().catch(() => null) : Promise.resolve(null)), [ok]);

  useEffect(() => {
    if (me && today && schedule)
      void syncElderNotifications(today, schedule, me).catch((e) => {
        if (__DEV__) console.warn('[notify] 복약 알림 예약 실패', e);
      });
  }, [me, today, schedule]);

  return null;
}
