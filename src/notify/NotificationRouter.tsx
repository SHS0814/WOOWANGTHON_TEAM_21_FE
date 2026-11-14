// 알림을 눌렀을 때 화면 이동.
// - 어르신 복약 알림(로컬) → E4 (오늘 건) 또는 어르신 홈 (내일 이후 예약분, 홈이 열린 건을 E4 로 보여줌, R-022)
// - 보호자 인계 푸시 {type:"handoff", handoff_id} → G5 (api.md 4.3)
import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { api, DEMO_BUILD } from '@/api';
import { useRole } from '@/lib/role';
import { Notifications } from '@/notify/module';

export function NotificationRouter() {
  const last = Notifications.useLastNotificationResponse();
  const { role, loading } = useRole();
  // 앱이 꺼진 상태에서 알림으로 열리면 첫 화면(/)이 역할 화면으로 Redirect 한다.
  // 그 전에 이동하면 Redirect 가 그 위에 홈을 다시 쌓으므로, 역할 화면에 들어온 뒤에 이동한다 (T-FE11)
  const area = useSegments()[0];

  const { setRole } = useRole();

  useEffect(() => {
    // 시연용 빌드(한 폰에 두 역할): 어르신 화면에서 보호자 인계 알림을 누르면 보호자 화면으로 바꾼다.
    // 역할이 바뀌면 이 효과가 다시 돌아 아래에서 인계 상세로 간다
    if (DEMO_BUILD && api.demo && last && !loading && role === 'elder') {
      const d = (last.notification.request.content.data ?? {}) as Record<string, unknown>;
      if (d.type === 'handoff' && last.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        void api.demo.switchTo('guardian').then(async (ok) => {
          if (!ok) return;
          await setRole('guardian');
          router.replace('/guardian');
        });
        return;
      }
    }
    if (!last || loading || !role || area !== role) return;
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
  }, [last, role, loading, area, setRole]);

  return null;
}
