// 모의 구현. 실제 서버·AI 없이 화면 흐름을 확인하기 위한 것이다.
// 판독 결과는 개발용 시나리오 스위치로 정해진다 → 모든 Reading 은 is_mock = true (헌장 6장).
// 상태 전이 규칙은 backend.md 6·7장, R-006, R-007 C3, R-009 를 따른다. 실제로는 서버가 정한다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Api, DevTools, MockScenario, PairingCode } from './client';
import type {
  CellReading,
  DaySummary,
  DoseEvent,
  Family,
  Handoff,
  HandoffReason,
  Pillbox,
  PillboxLayout,
  RefillStatus,
  ScheduleSlot,
  ServerConfig,
  Settings,
  TimeOfDay,
  UploadResult,
} from './types';
import { MOCK_SEED } from './mockSeed';
import { mondayIndex } from '../lib/time';

const STORAGE_KEY = 'woowang.mock-store.v1';
const MOCK_PROVIDER = 'mock';
const MOCK_MODEL = 'mock-reader';

interface Store {
  family: Family | null;
  pillbox: Pillbox;
  schedule: ScheduleSlot[];
  settings: Settings;
  refills: { at: string; photo_uri: string | null }[];
  eventsDate: string;
  events: DoseEvent[];
  scenario: MockScenario;
  seq: number;
}

// R-006 확정값. 실제로는 서버 설정에서 내려받는다 (R-007 C5)
const CONFIG: ServerConfig = {
  reask_offsets_min: [10, 20],
  no_response_handoff_min: 30,
  unchanged_retake_window_min: 15,
  max_unclear_retakes: 1,
  // 모델이 아직 정해지지 않았다. 외부 전송 가능성을 숨기지 않도록 모의에서는 true 로 둔다
  photo_sent_to_external_ai: true,
};

const ROW_TIMES: TimeOfDay[] = ['morning', 'evening'];

function defaultLayout(): PillboxLayout {
  const rows = MOCK_SEED.pillbox.row_labels.length;
  const cols = MOCK_SEED.pillbox.col_labels.length;
  const cells = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) cells.push({ id: `r${r}c${c}`, row: r, col: c });
  return { rows, cols, row_labels: [...MOCK_SEED.pillbox.row_labels], col_labels: [...MOCK_SEED.pillbox.col_labels], cells };
}

function timeOfDayForRow(layout: PillboxLayout, row: number): TimeOfDay {
  const label = layout.row_labels[row] ?? '';
  if (label.includes('아침')) return 'morning';
  if (label.includes('점심')) return 'noon';
  if (label.includes('저녁')) return 'evening';
  if (label.includes('취침') || label.includes('자기')) return 'bedtime';
  return ROW_TIMES[row] ?? 'evening';
}

/** 약통 칸과 복약 시각을 잇는다. 열 = 요일, 행 = 시간대인 배열 기준 */
function buildSchedule(layout: PillboxLayout, times: Partial<Record<TimeOfDay, string>>): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  for (const cell of layout.cells) {
    const tod = timeOfDayForRow(layout, cell.row);
    slots.push({
      id: `slot-${cell.id}`,
      weekday: layout.cols === 7 ? cell.col : cell.col % 7,
      time_of_day: tod,
      dose_time: times[tod] ?? MOCK_SEED.dose_times[tod] ?? '19:00',
      cell_id: cell.id,
    });
  }
  return slots;
}

function dateKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function atTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function minutesOfWeek(weekday: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return weekday * 1440 + h * 60 + m;
}

function initialStore(): Store {
  const layout = defaultLayout();
  return {
    family: null,
    pillbox: { id: 'pillbox-1', layout, registered_photo_uri: null, confirmed_at: new Date().toISOString() },
    schedule: buildSchedule(layout, MOCK_SEED.dose_times),
    settings: {
      summary_push_enabled: false,
      summary_push_time: '21:00',
      photo_retention_days: 90,
      unchanged_policy: 'remind',
    },
    refills: [],
    eventsDate: '',
    events: [],
    scenario: 'normal',
    seq: 1,
  };
}

class MockApi implements Api {
  readonly isMock = true;
  private store: Store = initialStore();
  private loaded: Promise<void>;
  private listeners = new Set<() => void>();

  constructor() {
    this.loaded = this.load();
  }

  private async load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) this.store = { ...initialStore(), ...(JSON.parse(raw) as Partial<Store>) };
    } catch {
      // 저장소를 못 읽으면 초기값으로 시작한다
    }
  }

  private async ready(): Promise<Store> {
    await this.loaded;
    this.rollDay();
    return this.store;
  }

  private async commit() {
    this.listeners.forEach((l) => l());
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch {
      // 저장 실패는 모의 구현에서 무시한다
    }
  }

  private nextId(prefix: string) {
    return `${prefix}-${this.store.seq++}`;
  }

  /** 날짜가 바뀌면 오늘 일정으로 복약 건을 새로 만든다 (backend.md 9장 create_dose_events) */
  private rollDay() {
    const today = new Date();
    const key = dateKey(today);
    if (this.store.eventsDate === key) return;
    const wd = mondayIndex(today);
    this.store.eventsDate = key;
    this.store.events = this.store.schedule
      .filter((s) => s.weekday === wd)
      .sort((a, b) => a.dose_time.localeCompare(b.dose_time))
      .map((s) => ({
        id: this.nextId('dose'),
        slot_id: s.id,
        time_of_day: s.time_of_day,
        cell_id: s.cell_id,
        scheduled_at: atTime(today, s.dose_time).toISOString(),
        state: 'scheduled',
        outcome: null,
        resolved_at: null,
        reminded_at: null,
        reask_count: 0,
        photos: [],
        readings: [],
        handoff: null,
        simulated: false,
      }));
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getConfig() {
    return CONFIG;
  }

  // ---- 가족·짝짓기 ----

  async getFamily() {
    return copy((await this.ready()).family);
  }

  async createFamily(input: { elder_display_name: string; guardian_display_name: string }) {
    const s = await this.ready();
    s.family = { id: 'family-1', ...input, consent_at: null };
    await this.commit();
    return copy(s.family);
  }

  async createPairingCode(): Promise<PairingCode> {
    // 모의 코드. 실제로는 서버가 128비트 난수와 6자리 숫자를 발급한다 (backend.md 3.2)
    const short = `${Math.floor(100000 + Math.random() * 900000)}`;
    return {
      qr: `woowang-mock-pair:${short}`,
      short_code: short,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
  }

  async pair(_code: string) {
    const s = await this.ready();
    // 같은 기기에서 보호자 흐름을 거치지 않았으면 모의 가족으로 연결한다
    if (!s.family) s.family = { id: 'family-1', ...MOCK_SEED.family, consent_at: null };
    await this.commit();
    return copy(s.family);
  }

  async consent() {
    const s = await this.ready();
    if (s.family) s.family.consent_at = new Date().toISOString();
    await this.commit();
  }

  async unpair() {
    this.store = initialStore();
    await this.commit();
  }

  async updateNames(input: { elder_display_name?: string; guardian_display_name?: string }) {
    const s = await this.ready();
    if (!s.family) s.family = { id: 'family-1', ...MOCK_SEED.family, consent_at: null };
    Object.assign(s.family, input);
    await this.commit();
    return copy(s.family);
  }

  // ---- 약통·일정 ----

  async getPillbox() {
    return copy((await this.ready()).pillbox);
  }

  async detectPillbox(_photoUri: string | null) {
    await delay(1200);
    // 모의 구조 제안. 실제로는 AI가 사진에서 칸 배열을 추정한다
    return { layout: defaultLayout(), is_mock: true };
  }

  async savePillbox(layout: PillboxLayout, photoUri: string | null) {
    const s = await this.ready();
    const times: Partial<Record<TimeOfDay, string>> = {};
    for (const slot of s.schedule) times[slot.time_of_day] = slot.dose_time;
    s.pillbox = { id: this.nextId('pillbox'), layout, registered_photo_uri: photoUri, confirmed_at: new Date().toISOString() };
    s.schedule = buildSchedule(layout, times);
    // 등록 사진은 채운 약통 사진이라 리필 기준선이 된다 (R-008 C3)
    s.refills.push({ at: new Date().toISOString(), photo_uri: photoUri });
    s.eventsDate = '';
    this.rollDay();
    await this.commit();
    return copy(s.pillbox);
  }

  async getSchedule() {
    return copy((await this.ready()).schedule);
  }

  async saveDoseTimes(times: Partial<Record<TimeOfDay, string>>) {
    const s = await this.ready();
    s.schedule = s.schedule.map((slot) => (times[slot.time_of_day] ? { ...slot, dose_time: times[slot.time_of_day]! } : slot));
    // 아직 시작하지 않은 오늘 복약 건의 시각도 맞춘다
    const today = new Date();
    for (const ev of s.events) {
      const t = times[ev.time_of_day];
      if (t && ev.state === 'scheduled') ev.scheduled_at = atTime(today, t).toISOString();
    }
    await this.commit();
    return copy(s.schedule);
  }

  // ---- 복약 건 ----

  async getToday() {
    return copy((await this.ready()).events);
  }

  async getEvent(id: string) {
    return copy((await this.ready()).events.find((e) => e.id === id) ?? null);
  }

  private mockReading(ev: DoseEvent, scenario: MockScenario) {
    const s = this.store;
    const order = s.schedule
      .slice()
      .sort((a, b) => minutesOfWeek(a.weekday, a.dose_time) - minutesOfWeek(b.weekday, b.dose_time))
      .map((slot) => slot.cell_id);
    const t = order.indexOf(ev.cell_id);
    const cells: CellReading[] = order.map((cellId, i) => {
      if (i < t) return { cell_id: cellId, state: 'empty', confidence: 0.95 };
      if (i > t) return { cell_id: cellId, state: 'full', confidence: 0.95 };
      switch (scenario) {
        case 'normal':
        case 'double_suspected':
          return { cell_id: cellId, state: 'empty', confidence: 0.96 };
        case 'unclear':
          return { cell_id: cellId, state: 'unclear', confidence: 0.42 };
        case 'unchanged':
          return { cell_id: cellId, state: 'full', confidence: 0.94 };
      }
    });
    if (scenario === 'double_suspected') {
      // 기대상 차 있어야 할 다음 칸이 비어 있음
      const j = t + 1 < order.length ? t + 1 : -1;
      if (j >= 0) cells[j] = { cell_id: order[j], state: 'empty', confidence: 0.91 };
    }
    const flagged = cells
      .filter((c) => c.state === 'unclear' || (c.state === 'empty' && order.indexOf(c.cell_id) > t))
      .map((c) => c.cell_id);
    return {
      id: this.nextId('reading'),
      provider: MOCK_PROVIDER,
      model: MOCK_MODEL,
      is_mock: true,
      cells,
      flagged_cell_ids: flagged,
      created_at: new Date().toISOString(),
    };
  }

  private handOff(ev: DoseEvent, reason: HandoffReason) {
    ev.state = 'handed_off';
    ev.handoff = {
      id: this.nextId('handoff'),
      dose_event_id: ev.id,
      reason,
      notified_at: new Date().toISOString(),
      verdict: null,
      verdict_at: null,
      acknowledged_at: null,
    };
  }

  async uploadPhoto(eventId: string, photoUri: string | null): Promise<UploadResult> {
    const s = await this.ready();
    const ev = s.events.find((e) => e.id === eventId);
    if (!ev) throw new Error('복약 건을 찾을 수 없어요');
    const wasReminded = !!ev.reminded_at;
    ev.state = 'reading';
    ev.photos.push({ id: this.nextId('photo'), uri: photoUri, taken_at: new Date().toISOString() });
    await this.commit();

    await delay(1800);

    const reading = this.mockReading(ev, s.scenario);
    ev.readings.push(reading);
    const target = reading.cells.find((c) => c.cell_id === ev.cell_id)!;
    const unexpectedEmpty = reading.cells.some((c) => c.cell_id !== ev.cell_id && c.state === 'empty' && isFutureCell(s, c.cell_id, ev.cell_id));
    const anyUnclear = reading.cells.some((c) => c.state === 'unclear');
    const late = Date.now() > new Date(ev.scheduled_at).getTime() + CONFIG.no_response_handoff_min * 60_000;

    let result: UploadResult;
    if (unexpectedEmpty) {
      this.handOff(ev, 'double_suspected');
      result = { next: 'handed_off', event: ev, reason: 'double_suspected' };
    } else if (anyUnclear) {
      const unclearCount = ev.readings.filter((r) => r.cells.some((c) => c.state === 'unclear')).length;
      if (unclearCount <= CONFIG.max_unclear_retakes) {
        ev.state = 'retake_requested';
        result = { next: 'retake_requested', event: ev };
      } else {
        this.handOff(ev, 'unclear');
        result = { next: 'handed_off', event: ev, reason: 'unclear' };
      }
    } else if (target.state === 'full') {
      // R-009 설정 + R-007 C3: 복약 시간(+30분) 안이고, 안내 모드이고, 아직 안내하지 않았을 때만 1회 안내
      if (s.settings.unchanged_policy === 'remind' && !wasReminded && !late) {
        ev.state = 'reminded';
        ev.reminded_at = new Date().toISOString();
        result = { next: 'reminded', event: ev };
      } else {
        this.handOff(ev, 'unchanged');
        result = { next: 'handed_off', event: ev, reason: 'unchanged' };
      }
    } else {
      ev.state = 'done';
      ev.outcome = 'taken';
      ev.resolved_at = new Date().toISOString();
      result = { next: 'done', event: ev };
    }
    await this.commit();
    return copy(result);
  }

  // ---- 인계 ----

  async getOpenHandoffs() {
    const s = await this.ready();
    return copy(s.events.filter((e) => e.state === 'handed_off' && e.handoff && !e.handoff.verdict && !e.handoff.acknowledged_at));
  }

  private findHandoff(id: string): { ev: DoseEvent; h: Handoff } {
    const ev = this.store.events.find((e) => e.handoff?.id === id);
    if (!ev || !ev.handoff) throw new Error('인계 건을 찾을 수 없어요');
    return { ev, h: ev.handoff };
  }

  async submitVerdict(handoffId: string, verdict: 'taken' | 'not_taken') {
    await this.ready();
    const { ev, h } = this.findHandoff(handoffId);
    h.verdict = verdict;
    h.verdict_at = new Date().toISOString();
    ev.state = 'done';
    ev.outcome = verdict;
    ev.resolved_at = h.verdict_at;
    await this.commit();
    return copy(h);
  }

  async acknowledgeHandoff(handoffId: string) {
    await this.ready();
    const { ev, h } = this.findHandoff(handoffId);
    h.acknowledged_at = new Date().toISOString();
    ev.state = 'done';
    ev.outcome = 'acknowledged';
    ev.resolved_at = h.acknowledged_at;
    await this.commit();
    return copy(h);
  }

  // ---- 리필 ----

  async getRefillStatus(): Promise<RefillStatus> {
    const s = await this.ready();
    const wd = mondayIndex(new Date());
    const takenToday = new Set(s.events.filter((e) => e.outcome === 'taken').map((e) => e.cell_id));
    const ordered = s.schedule
      .slice()
      .sort((a, b) => minutesOfWeek(a.weekday, a.dose_time) - minutesOfWeek(b.weekday, b.dose_time));
    // 모의 계산: 주간 약통을 월요일에 채웠다고 보고, 오늘 아직 안 드신 칸과 이후 칸을 남은 칸으로 센다
    const remaining = ordered.filter((slot) => slot.weekday > wd || (slot.weekday === wd && !takenToday.has(slot.cell_id)));
    const last = remaining[remaining.length - 1];
    return {
      last_refill_at: s.refills[s.refills.length - 1]?.at ?? null,
      remaining_cells: remaining.length,
      total_cells: s.pillbox.layout.cells.length,
      last_covered: last ? { weekday: last.weekday, time_of_day: last.time_of_day } : null,
      is_mock: true,
    };
  }

  async createRefill(photoUri: string | null) {
    const s = await this.ready();
    s.refills.push({ at: new Date().toISOString(), photo_uri: photoUri });
    await this.commit();
    return this.getRefillStatus();
  }

  // ---- 요약·설정 ----

  async getWeekSummary(): Promise<DaySummary[]> {
    const s = await this.ready();
    const days: DaySummary[] = [];
    const perDay = s.schedule.filter((slot) => slot.weekday === 0).length;
    for (let i = 6; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // 지난 날은 모의 기록 (모두 정상)
      days.push({ date: dateKey(d), total: perDay, taken: perDay, handed_off: 0, pending: 0 });
    }
    const ev = s.events;
    days.push({
      date: s.eventsDate,
      total: ev.length,
      taken: ev.filter((e) => e.outcome === 'taken').length,
      handed_off: ev.filter((e) => e.handoff).length,
      pending: ev.filter((e) => e.state !== 'done' && !e.handoff).length,
    });
    return days;
  }

  async getSettings() {
    return copy((await this.ready()).settings);
  }

  async updateSettings(patch: Partial<Settings>) {
    const s = await this.ready();
    s.settings = { ...s.settings, ...patch };
    await this.commit();
    return copy(s.settings);
  }

  // ---- 개발용 ----

  readonly dev: DevTools = {
    getScenario: () => this.store.scenario,
    setScenario: (scenario) => {
      this.store.scenario = scenario;
      void this.commit();
    },
    simulateDoseTime: async () => {
      const s = await this.ready();
      const open = s.events.find((e) => e.state !== 'done' && e.state !== 'handed_off' && e.state !== 'scheduled');
      const ev = open ?? s.events.find((e) => e.state === 'scheduled');
      if (!ev) return null;
      if (ev.state === 'scheduled') {
        ev.state = 'asked';
        // 시뮬레이션 시각을 지금으로 둔다 → +30분 창 계산이 지금 기준
        ev.scheduled_at = new Date().toISOString();
        ev.simulated = true;
      }
      await this.commit();
      return copy(ev);
    },
    simulateNoResponseStep: async () => {
      const s = await this.ready();
      const ev = s.events.find((e) => e.state === 'asked' || e.state === 'reminded');
      if (!ev) return null;
      if (ev.state === 'reminded') {
        // +15분 안에 재촬영 없음
        this.handOff(ev, 'unchanged');
      } else if (ev.reask_count < CONFIG.reask_offsets_min.length) {
        ev.reask_count += 1;
      } else {
        this.handOff(ev, 'no_response');
      }
      await this.commit();
      return copy(ev);
    },
    reset: async () => {
      // 오늘 복약 건만 다시 만든다. 가족·약통·일정·설정은 유지
      this.store.eventsDate = '';
      this.rollDay();
      await this.commit();
    },
  };
}

function isFutureCell(s: Store, cellId: string, targetCellId: string) {
  const slot = s.schedule.find((x) => x.cell_id === cellId);
  const target = s.schedule.find((x) => x.cell_id === targetCellId);
  if (!slot || !target) return false;
  return minutesOfWeek(slot.weekday, slot.dose_time) > minutesOfWeek(target.weekday, target.dose_time);
}

/** 화면이 내부 객체를 공유하지 않도록 복사해서 돌려준다 (실제 서버 응답과 같은 성질) */
function copy<T>(v: T): T {
  return v === null || v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function createMockApi(): Api {
  return new MockApi();
}
