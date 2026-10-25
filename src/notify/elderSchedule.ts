// 어르신 폰 로컬 알림 (MVP #1 "앱이 물어보기", backend.md 2·6장, R-007 C5).
// - 오늘: 서버가 준 ask_times(복약 시각, 재질문1, 재질문2)를 그대로 쓴다
// - 내일부터: GET /schedule + GET /me 의 timing 으로 며칠치를 미리 예약한다 (오프라인 대비)
// - 사진을 올렸거나 끝난 건(asked·scheduled 가 아닌 건)의 남은 알림은 취소한다
// 숫자(재질문 간격)는 앱에 두지 않는다. 모두 서버 값이다
import { Platform } from 'react-native';

import type { DoseEvent, Me, Schedule, TodayResponse } from '@/api';
import { doseName } from '@/lib/doseLabel';
import { dateKey, mondayIndex, TIME_OF_DAY_LABELS } from '@/lib/time';
import { DOSE_CHANNEL, ensurePermission, notificationsSupported } from '@/notify/channels';
import { Notifications } from '@/notify/module';

/** 이 앱이 만든 복약 알림 식별자 접두어. 다른 알림은 건드리지 않는다 */
const PREFIX = 'dose:';
/** 미리 예약하는 날 수 (오늘 제외). iOS 는 예약 알림이 64개까지라 그 안에 들게 줄인다 */
const DAYS_AHEAD = 3;
const IOS_PENDING_LIMIT = 60;

export interface DoseNotificationData {
  type: 'dose_ask';
  /** 오늘 건이면 복약 건 id. 내일 이후는 아직 건이 없어서 null → 누르면 어르신 홈(열린 건을 E4 로 보여줌, R-022) */
  event_id: string | null;
  [key: string]: unknown;
}

interface Planned {
  id: string;
  at: Date;
  title: string;
  body: string;
  data: DoseNotificationData;
}

function texts(elder: string, name: string, reask: boolean, simulated: boolean) {
  // 앱 템플릿 문구 (backend.md 7장). 재질문은 "다시 여쭤봐요". 시뮬레이션이면 표시한다 (헌장 6장)
  const sim = simulated ? '[시뮬레이션] ' : '';
  return {
    title: `${sim}${reask ? '다시 여쭤봐요' : `${name} 약 드실 시간이에요`}`,
    body: `${elder}, ${name} 약 드시고 약통 사진 한 장 찍어주실래요?`,
  };
}

/** 오늘 건: 아직 물어보는 중(scheduled·asked)인 건만. 그 밖의 상태면 남은 재질문은 없다 */
function planToday(ev: DoseEvent, elder: string, now: number): Planned[] {
  if (ev.carried_over || (ev.state !== 'scheduled' && ev.state !== 'asked')) return [];
  const name = doseName(ev);
  return ev.ask_times
    .map((t, i) => ({ t: new Date(t), i }))
    .filter(({ t }) => t.getTime() > now)
    .map(({ t, i }) => ({
      id: `${PREFIX}${ev.id}:${i}`,
      at: t,
      ...texts(elder, name, i > 0, ev.is_simulated),
      data: { type: 'dose_ask', event_id: ev.id },
    }));
}

/** 내일부터: 일정과 서버 timing 으로 계산 (오늘 건은 서버가 만든 것을 쓴다) */
function planAhead(schedule: Schedule, me: Me, elder: string, now: Date): Planned[] {
  const offsets = [0, ...me.server.timing.reask_offsets_min];
  const out: Planned[] = [];
  for (let d = 1; d <= DAYS_AHEAD; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    const wd = mondayIndex(day);
    for (const slot of schedule.slots.filter((s) => s.weekday === wd)) {
      const [h, m] = slot.dose_time.split(':').map(Number);
      const base = new Date(day);
      base.setHours(h, m, 0, 0);
      const name = TIME_OF_DAY_LABELS[slot.time_of_day];
      offsets.forEach((off, i) => {
        out.push({
          id: `${PREFIX}${slot.id}@${dateKey(day)}:${i}`,
          at: new Date(base.getTime() + off * 60_000),
          ...texts(elder, name, i > 0, false),
          data: { type: 'dose_ask', event_id: null },
        });
      });
    }
  }
  return out;
}

let running: Promise<void> | null = null;
let pendingArgs: [TodayResponse, Schedule, Me] | null = null;

/**
 * 서버 상태에 맞춰 예약 알림을 다시 맞춘다. 오늘 상태가 바뀔 때마다(사진 업로드, 인계, 주기 갱신) 부른다.
 * 겹쳐 불리면 마지막 값으로 한 번 더 돈다
 */
export async function syncElderNotifications(today: TodayResponse, schedule: Schedule, me: Me): Promise<void> {
  if (!notificationsSupported) return;
  pendingArgs = [today, schedule, me];
  if (running) return running;
  running = (async () => {
    while (pendingArgs) {
      const [t, s, m] = pendingArgs;
      pendingArgs = null;
      await syncOnce(t, s, m);
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(today: TodayResponse, schedule: Schedule, me: Me) {
  if (!(await ensurePermission())) return;
  const now = new Date();
  const elder = me.family.elder_display_name;
  let wanted = [...today.items.flatMap((ev) => planToday(ev, elder, now.getTime())), ...planAhead(schedule, me, elder, now)]
    .filter((p) => p.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (Platform.OS === 'ios') wanted = wanted.slice(0, IOS_PENDING_LIMIT);

  const existing = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith(PREFIX));
  const wantedIds = new Set(wanted.map((w) => w.id));
  // 끝난 건·바뀐 일정의 알림 취소 (사진을 올리면 남은 재질문이 여기서 지워진다)
  await Promise.all(existing.filter((n) => !wantedIds.has(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  // 같은 식별자로 다시 예약하면 덮어쓴다 → 시각이 바뀐 건(일정 변경, 시연 트리거)도 맞춰진다
  for (const p of wanted) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.title,
        body: p.body,
        data: p.data,
        sound: 'default',
        // iOS: 집중 모드에서도 보이는 시간 민감 알림 (entitlement 필요, README 참고)
        interruptionLevel: 'timeSensitive',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.at,
        channelId: DOSE_CHANNEL,
        // 복약 알림이라 정시 전달을 요청한다. 정확한 알람 권한이 없으면 bestEffort 로 내려간다
        delivery: 'alarmClock',
      },
    });
  }
}

/** 연결 해제·역할 변경 때 이 앱의 복약 알림을 모두 지운다 */
export async function clearElderNotifications(): Promise<void> {
  if (!notificationsSupported) return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}
