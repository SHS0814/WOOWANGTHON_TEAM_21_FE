import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { api, type Schedule } from '@/api';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { syncElderNotifications } from '@/notify/elderSchedule';
import { reportNotificationStatus } from '@/notify/statusReport';

/** 어르신 화면이 떠 있는 동안 서버 상태에 맞춰 로컬 알림을 다시 맞춘다 (backend.md 6장: 앱이 다시 열리면 서버 상태로 재설정) */
export function ElderNotificationSync() {
  const { data: me } = useApiData(() => api.me().catch(() => null));
  const ok = !!me && !me.consent_required;
  const { data: today } = useApiData(() => (ok ? api.today().catch(() => null) : Promise.resolve(null)), [ok], { pollMs: POLL_MS });
  // 일정도 오늘 목록과 같은 주기로 읽는다. updated_at 이 바뀌었을 때만 7일치를 다시 맞춘다 (R-032 Q-012)
  const { data: fetched } = useApiData(() => (ok ? api.schedule().catch(() => null) : Promise.resolve(null)), [ok], { pollMs: POLL_MS });
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  useEffect(() => {
    if (fetched && (!schedule || fetched.updated_at !== schedule.updated_at || fetched.pillbox_id !== schedule.pillbox_id)) setSchedule(fetched);
  }, [fetched, schedule]);

  useEffect(() => {
    if (me && today && schedule)
      void syncElderNotifications(today, schedule, me).catch((e) => {
        if (__DEV__) console.warn('[notify] 복약 알림 예약 실패', e);
      });
  }, [me, today, schedule]);

  // 알림 준비 상태 보고: 앱 시작(이 화면이 처음 뜰 때)과 앱이 앞으로 올 때 (3.29, R-032)
  useEffect(() => {
    void reportNotificationStatus();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void reportNotificationStatus());
    return () => sub.remove();
  }, []);

  return null;
}
