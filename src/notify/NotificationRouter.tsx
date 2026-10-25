// 알림을 눌렀을 때 화면 이동.
// - 어르신 복약 알림(로컬) → E4 (오늘 건) 또는 어르신 홈 (내일 이후 예약분, 홈이 열린 건을 E4 로 보여줌, R-022)
// - 보호자 인계 푸시 {type:"handoff", handoff_id} → G5 (api.md 4.3)
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useRole } from '@/lib/role';
import { Notifications } from '@/notify/module';

export function NotificationRouter() {
  const last = Notifications.useLastNotificationResponse();
  const { role, loading } = useRole();

  useEffect(() => {
    if (!last || loading || !role) return;
    if (last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = (last.notification.request.content.data ?? {}) as Record<string, unknown>;
    if (role === 'elder' && data.type === 'dose_ask') {
      const id = typeof data.event_id === 'string' ? data.event_id : null;
      if (id) router.push({ pathname: '/elder/ask/[id]', params: { id } });
      else router.replace('/elder');
    } else if (role === 'guardian' && data.type === 'handoff' && typeof data.handoff_id === 'string') {
      router.push({ pathname: '/guardian/handoff/[id]', params: { id: data.handoff_id } });
    } else if (role === 'guardian' && data.type === 'summary') {
      router.push('/guardian/records');
    } else if (role === 'guardian' && data.type === 'guardian_joined') {
      router.push('/guardian/settings');
    }
    // 같은 알림으로 두 번 이동하지 않게 지운다
    void Notifications.clearLastNotificationResponseAsync();
  }, [last, role, loading]);

  return null;
}
