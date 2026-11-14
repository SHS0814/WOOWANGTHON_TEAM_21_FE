// 어르신 폰의 "복약 시각이 바뀜" 처리.
// 어르신 폰의 복약 알람은 폰이 스스로 예약하는 로컬 알람이라, 보호자가 시각을 바꿔도 앱을 열기 전에는 모른다.
// 서버가 시각 저장 때 보내는 데이터 전용 FCM(화면에 보이지 않음)을 받아, 앱이 꺼져 있어도 일정을 다시 읽고 알람을 다시 맞춘다.
// expo-notifications 의 백그라운드 작업(expo-task-manager)으로 돈다. 푸시가 닿지 않아도 앱을 열면 다시 맞춰진다.
import { Platform } from 'react-native';

import { api } from '@/api';
import { syncElderNotifications } from '@/notify/elderSchedule';
import { notificationsSupported } from '@/notify/channels';
import { Notifications } from '@/notify/module';

const TASK = 'woowang-elder-schedule-changed';

/** 서버 상태를 읽어 어르신 알람을 다시 맞춘다. 어르신 기기가 아니거나 동의 전이면 아무것도 하지 않는다 */
async function resyncElderAlarms(): Promise<void> {
  if (!(await api.hasToken())) return;
  const me = await api.me();
  if (me.device.role !== 'elder' || me.consent_required) return;
  const [today, schedule] = await Promise.all([api.today(), api.schedule()]);
  await syncElderNotifications(today, schedule, me);
}

/**
 * 앱이 시작될 때(백그라운드로 깨어날 때 포함) 모듈 범위에서 한 번 부른다.
 * 작업 정의는 JS 번들이 불릴 때마다 다시 해야 한다 (expo-task-manager).
 */
export function setupElderScheduleTask(): void {
  if (Platform.OS !== 'android' || !notificationsSupported) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
    TaskManager.defineTask(TASK, async () => {
      // 보호자 폰에도 인계 푸시가 올 때 이 작업이 불린다. 그때는 resyncElderAlarms 가 역할을 보고 그냥 끝낸다
      try {
        await resyncElderAlarms();
      } catch (e) {
        if (__DEV__) console.warn('[push] 일정 변경 처리 실패', String(e));
      }
    });
    void Notifications.registerTaskAsync(TASK).catch(() => {});
  } catch (e) {
    if (__DEV__) console.warn('[push] 백그라운드 작업을 등록하지 못함', String(e));
  }
}
