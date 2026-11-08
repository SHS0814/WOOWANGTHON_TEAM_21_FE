// 모의 서버. 실제 서버·AI 없이 화면 흐름을 확인하기 위한 것이다.
// 응답 모양은 api.md 를 따르고, 상태 전이는 backend.md 5·6·7장, R-006, R-007 C3, R-009, R-010 을 흉내 낸다.
// 판독 결과는 개발용 시나리오 스위치로 정해진다 → 모든 Reading 은 is_mock = true (헌장 6장).
// 칸 위치(bbox)는 모의 판독에서 알 수 없으므로 항상 null 이다 → G5 는 격자 그림으로 강조한다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Api, MockDevTools } from './client';
import { ApiError } from './errors';
import { MOCK_SEED } from './mockSeed';
import type {
  Attention,
  CellResult,
  CellState,
  Classification,
  ConsentRequest,
  CreateFamilyRequest,
  Device,
  DoseEvent,
  DoseEventQuery,
  ExpectedState,
  Handoff,
  HandoffListItem,
  HandoffReason,
  Layout,
  LocalPhoto,
  Me,
  MockScenario,
  NotificationStatus,
  NotificationStatusReport,
  PairRequest,
  PersonRef,
  Photo,
  Pillbox,
  PillboxCurrent,
  Reading,
  Refill,
  Role,
  Settings,
  Slot,
  SlotInput,
  Summary,
  SummaryPeriod,
  TimeOfDay,
  TodayResponse,
  UploadResponse,
  Verdict,
} from './types';

const STORAGE_KEY = 'woowang.mock-store.v2';
const MOCK_MODEL = 'mock-v1';
const READ_DELAY_MS = 1800;
/** 복약 시각 60분 전부터 사진을 받는다 (3.18, R-010 13번) */
const EARLY_PHOTO_MIN = 60;
/** 전날 끝나지 않은 건을 오늘 목록에 남기는 시간 (3.17, R-021 Q-007) */
const CARRY_OVER_HOURS = 6;

// R-006 확정값. 실제로는 서버의 GET /me server.timing 에서 내려온다 (R-007 C5)
const TIMING = { reask_offsets_min: [10, 20], no_response_handoff_min: 30, retake_wait_min: 15 };

// backend.md 7.2
const ALLOWED_VERDICTS: Record<HandoffReason, Verdict[]> = {
  no_response: ['taken', 'not_taken', 'acknowledged'],
  unclear: ['taken', 'not_taken'],
  unchanged: ['taken', 'not_taken', 'acknowledged'],
  double_suspected: ['taken', 'not_taken', 'acknowledged'],
  refill_unconfirmed: ['refilled', 'not_refilled'],
  refill_overdue: ['taken', 'not_taken', 'acknowledged'],
};

interface StoredHandoff {
  id: string;
  event_id: string;
  reason: HandoffReason;
  notified_at: string;
  verdict: Verdict | null;
  verdict_by: PersonRef | null;
  verdict_at: string | null;
  late_photo: boolean;
}

interface Store {
  family: { id: string; elder_display_name: string; is_demo: boolean } | null;
  guardian: Device | null;
  elder: Device | null;
  /** kind 가 없으면 이전에 저장된 어르신 코드 */
  pairingCodes: { kind?: 'elder' | 'guardian'; code: string; short_code: string; expires_at: string }[];
  pillbox: Pillbox | null;
  slots: Slot[];
  scheduleUpdatedAt: string | null;
  settings: Omit<Settings, 'elder_display_name'>;
  refills: Refill[];
  eventsDate: string;
  events: DoseEvent[];
  readings: Record<string, Reading[]>;
  handoffs: StoredHandoff[];
  uploads: Record<string, UploadResponse>;
  mismatch: PillboxCurrent['pillbox_mismatch'];
  /** 3.28: 다음 복약 사진 1장의 판독 결과. 쓰고 나면 지운다. 없으면 정상 */
  nextScenario: MockScenario | null;
  seq: number;
}

/** 모의 서버의 보호자 초대 코드. 앱에 초대 코드를 만드는 화면이 없어 이 값으로 합류를 확인한다 */
export const MOCK_INVITE_CODE = 'mock-invite';

function initialStore(): Store {
  return {
    family: null,
    guardian: null,
    elder: null,
    pairingCodes: [],
    pillbox: null,
    slots: [],
    scheduleUpdatedAt: null,
    settings: { summary_push_enabled: false, summary_push_time: '21:00', photo_retention_days: 90, unchanged_mode: 'remind_then_retake' },
    refills: [],
    eventsDate: '',
    events: [],
    readings: {},
    handoffs: [],
    uploads: {},
    mismatch: { detected: false, cell_ids: [], reading_id: null, detected_at: null },
    nextScenario: null,
    seq: 1,
  };
}

// ---- 시간 도우미 (서울 시간 오프셋 표기, 1.3) ----

function iso(d: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds(),
  )}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

function dateKey(d: Date): string {
  return iso(d).slice(0, 10);
}

function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function addMin(at: string, min: number): string {
  return iso(new Date(new Date(at).getTime() + min * 60_000));
}

function atTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function weekMinutes(s: { weekday: number; dose_time: string }): number {
  const [h, m] = s.dose_time.split(':').map(Number);
  return s.weekday * 1440 + h * 60 + m;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 화면이 내부 객체를 공유하지 않도록 복사해서 돌려준다 (실제 서버 응답과 같은 성질) */
function copy<T>(v: T): T {
  return v === null || v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** "YYYY-MM-DD" (기기 시간대) 의 낮 12시 */
function dayOfKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function addDays(key: string, n: number): string {
  const d = dayOfKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

function daysBetween(from: string, to: string): number {
  return Math.round((dayOfKey(to).getTime() - dayOfKey(from).getTime()) / 86_400_000);
}

/** 날짜·칸으로 정해지는 0~1 값. 모의 지난 기록이 열 때마다 같게 나오도록 */
function seeded(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

/** 모의 지난 기록이 시작되는 날 (오늘부터 며칠 전). 1년 보기와 전체 보기가 달라지게 1년보다 짧게 둔다 */
const MOCK_HISTORY_DAYS = 75;

type PastEvent = DoseEvent & { refill_unconfirmed: boolean };

function timeOfDayFromLabel(label: string): TimeOfDay | null {
  if (label.includes('아침')) return 'morning';
  if (label.includes('점심')) return 'noon';
  if (label.includes('저녁')) return 'evening';
  if (label.includes('취침') || label.includes('자기')) return 'bedtime';
  return null;
}

function defaultLayout(): Layout {
  const { row_labels, col_labels } = MOCK_SEED.pillbox;
  const cells = [];
  for (let c = 0; c < col_labels.length; c++) for (let r = 0; r < row_labels.length; r++) cells.push({ id: `r${r}c${c}`, row: r, col: c });
  return { rows: row_labels.length, cols: col_labels.length, row_labels: [...row_labels], col_labels: [...col_labels], cells };
}

class MockApi implements Api {
  readonly mode = 'mock' as const;
  private s: Store = initialStore();
  private loaded: Promise<void>;
  private listeners = new Set<() => void>();
  private authListeners = new Set<() => void>();
  private role: Role | null = null;

  constructor() {
    this.loaded = this.load();
  }

  private async load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) this.s = { ...initialStore(), ...(JSON.parse(raw) as Partial<Store>) };
    } catch {
      // 저장소를 못 읽으면 초기값으로 시작한다
    }
  }

  private async ready(): Promise<Store> {
    await this.loaded;
    this.rollDay();
    return this.s;
  }

  private async commit() {
    this.listeners.forEach((l) => l());
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.s));
    } catch {
      // 저장 실패는 모의 구현에서 무시한다
    }
  }

  private id(prefix: string) {
    return `${prefix}-${this.s.seq++}`;
  }

  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  onAuthLost(l: () => void) {
    this.authListeners.add(l);
    return () => void this.authListeners.delete(l);
  }

  // ---- 인증 흉내: 지금 역할의 기기가 있으면 토큰이 있는 것으로 본다 ----

  private myDevice(): Device | null {
    return this.role === 'elder' ? this.s.elder : this.role === 'guardian' ? this.s.guardian : null;
  }

  private async auth(role?: Role): Promise<{ s: Store; me: Device }> {
    const s = await this.ready();
    const me = this.myDevice();
    if (!me || !s.family) throw new ApiError(401, 'unauthorized', '모의: 이 역할의 기기가 없음');
    if (role && me.role !== role) throw new ApiError(403, 'forbidden_role', '모의: 역할이 맞지 않음');
    if (me.role === 'elder' && !me.consent_at) throw new ApiError(403, 'consent_required', '모의: 동의 전');
    return { s, me };
  }

  async hasToken() {
    await this.ready();
    return !!this.myDevice();
  }

  async forgetToken() {
    if (this.role === 'elder') this.s.elder = null;
    if (this.role === 'guardian') this.s.guardian = null;
    await this.commit();
  }

  private guardians(): PersonRef[] {
    return this.s.guardian ? [{ device_id: this.s.guardian.id, display_name: this.s.guardian.display_name }] : [];
  }

  private newDevice(role: Role, name: string): Device {
    return { id: this.id(`d-${role}`), role, display_name: name, platform: null, paired_at: iso(new Date()), consent_at: null, last_seen_at: null, is_me: true, notification_status: null };
  }

  // ---- 3.1 ~ 3.9 ----

  async health() {
    return { status: 'ok' as const, version: 'mock', time: iso(new Date()), reader: { layout: 'mock', cells: 'mock', is_mock: true } };
  }

  async createFamily(req: CreateFamilyRequest) {
    const s = await this.ready();
    s.family = { id: this.id('family'), elder_display_name: req.elder_display_name, is_demo: true };
    s.guardian = this.newDevice('guardian', req.guardian_display_name);
    await this.commit();
    return { family_id: s.family.id, token: 'mock-token', device: copy(s.guardian) };
  }

  async createPairingCode(kind: 'elder' | 'guardian') {
    const { s } = await this.auth('guardian');
    const short = `${Math.floor(100000 + Math.random() * 900000)}`;
    const code = `mock${short}`;
    const expires_at = addMin(iso(new Date()), kind === 'elder' ? 10 : 24 * 60);
    s.pairingCodes = [{ kind, code, short_code: short, expires_at }];
    await this.commit();
    return { kind, code, short_code: kind === 'elder' ? short : null, expires_at, qr_payload: `woowang://pair?code=${code}` };
  }

  async pair(req: PairRequest) {
    const s = await this.ready();
    const given = 'code' in req ? req.code : req.short_code;
    // 모의 서버에서 오류 화면을 확인하는 코드 (3.4 오류)
    if (given === 'mock-expired') throw new ApiError(410, 'code_expired', '모의: 만료된 코드');
    if (given === 'mock-used') throw new ApiError(410, 'code_used', '모의: 이미 쓴 코드');
    if (given === 'mock-limit') throw new ApiError(429, 'rate_limited', '모의: 시도 제한');
    const issued = s.pairingCodes.find((c) => c.code === given || (c.kind !== 'guardian' && c.short_code === given));
    if (given === MOCK_INVITE_CODE || issued?.kind === 'guardian') return this.pairGuardian(req);
    const ok = given === 'mock' || given === 'mock-elder' || !!issued;
    if (!ok) throw new ApiError(400, 'code_invalid', '모의: 없는 코드');
    // 같은 기기에서 보호자 흐름을 거치지 않았으면 모의 가족(약통·일정 포함)으로 연결한다
    if (!s.family) this.seedFamily();
    s.pairingCodes = [];
    s.elder = this.newDevice('elder', s.family!.elder_display_name);
    await this.commit();
    return {
      token: 'mock-token',
      device: copy(s.elder),
      family: { id: s.family!.id, elder_display_name: s.family!.elder_display_name, guardians: this.guardians() },
      consent_required: true,
    };
  }

  /** 3.4 보호자 합류. 모의 서버는 보호자 칸이 하나라 그 자리를 합류한 보호자로 바꾼다 */
  private async pairGuardian(req: PairRequest) {
    const s = this.s;
    const name = 'display_name' in req ? req.display_name : undefined;
    if (!name) throw new ApiError(422, 'validation_error', '모의: 보호자 초대에는 이름이 필요함');
    if (!s.family) this.seedFamily();
    s.pairingCodes = s.pairingCodes.filter((c) => c.kind !== 'guardian');
    s.guardian = this.newDevice('guardian', name);
    await this.commit();
    return {
      token: 'mock-token',
      device: copy(s.guardian),
      family: { id: s.family!.id, elder_display_name: s.family!.elder_display_name, guardians: this.guardians() },
      consent_required: false,
    };
  }

  private seedFamily() {
    const s = this.s;
    s.family = { id: this.id('family'), elder_display_name: MOCK_SEED.family.elder_display_name, is_demo: true };
    s.guardian = { ...this.newDevice('guardian', MOCK_SEED.family.guardian_display_name), is_me: false };
    const layout = defaultLayout();
    s.pillbox = { id: this.id('pb'), layout, registered_photo_id: '', confirmed_at: iso(new Date()), active: true };
    s.slots = layout.cells.map((c) => {
      const tod = timeOfDayFromLabel(layout.row_labels[c.row]) ?? 'evening';
      return { id: this.id('s'), weekday: c.col, time_of_day: tod, dose_time: MOCK_SEED.dose_times[tod], cell_id: c.id };
    });
    s.refills = [this.makeRefill(null, 'registration')];
    s.eventsDate = '';
  }

  async consent(req: ConsentRequest) {
    await this.ready();
    const me = this.myDevice();
    if (!me || me.role !== 'elder') throw new ApiError(403, 'forbidden_role', '모의');
    if (!req.ai_external_transfer_shown && this.serverInfo().ai_external_transfer) throw new ApiError(422, 'consent_incomplete', '모의');
    me.consent_at = iso(new Date());
    await this.commit();
    return { consent_at: me.consent_at };
  }

  private serverInfo(): Me['server'] {
    return {
      timezone: 'Asia/Seoul',
      timing: TIMING,
      reader_is_mock: true,
      // 모델이 아직 정해지지 않았다. 외부 전송 가능성을 숨기지 않도록 모의에서는 true 로 둔다
      ai_external_transfer: true,
      consent_text_version: 'v1',
      demo_mode: true,
    };
  }

  async me(): Promise<Me> {
    const s = await this.ready();
    const me = this.myDevice();
    if (!me || !s.family) throw new ApiError(401, 'unauthorized', '모의');
    return copy({
      device: me,
      consent_required: me.role === 'elder' && !me.consent_at,
      family: {
        id: s.family.id,
        elder_display_name: s.family.elder_display_name,
        guardians: this.guardians(),
        has_pillbox: !!s.pillbox,
        has_schedule: s.slots.length > 0,
        is_demo: s.family.is_demo,
      },
      server: this.serverInfo(),
    });
  }

  async devices() {
    const { s, me } = await this.auth('guardian');
    return copy([s.guardian, s.elder].filter((d): d is Device => !!d).map((d) => ({ ...d, is_me: d.id === me.id })));
  }

  async deleteDevice(id: string) {
    const { s } = await this.auth('guardian');
    if (s.elder?.id === id) s.elder = null;
    else if (s.guardian?.id === id) throw new ApiError(409, 'last_guardian', '모의: 마지막 보호자');
    else throw new ApiError(404, 'not_found', '모의');
    await this.commit();
  }

  /** 3.29: 동의 전에도 받는다. ready 는 서버가 계산한다 */
  async putNotificationStatus(report: NotificationStatusReport): Promise<NotificationStatus> {
    await this.ready();
    const me = this.myDevice();
    if (!me) throw new ApiError(401, 'unauthorized', '모의');
    me.notification_status = {
      ...report,
      ready: report.notifications_allowed && report.exact_alarm_allowed !== false,
      reported_at: iso(new Date()),
    };
    await this.commit();
    return copy(me.notification_status);
  }

  async putPushToken() {
    // 모의 구현은 푸시를 보내지 않는다
  }

  // ---- 3.10 ~ 3.16 약통·일정·리필 ----

  private photoOf(local: LocalPhoto | null): Photo {
    // 모의 사진 URL 은 기기 안의 파일 경로다. 카메라가 없으면 빈 문자열 → 화면은 "사진 없음"
    return { id: this.id('p'), taken_at: local?.taken_at ?? iso(new Date()), url: local?.uri ?? '', url_expires_at: addMin(iso(new Date()), 60 * 24 * 365) };
  }

  async detectPillbox(photo: LocalPhoto) {
    await this.auth('guardian');
    await delay(1200);
    const layout = defaultLayout();
    return {
      photo: this.photoOf(photo),
      proposal: { layout, suggested_time_of_day: layout.row_labels.map(timeOfDayFromLabel), uncertain: false },
      is_mock: true,
      provider: 'mock',
      model: MOCK_MODEL,
    };
  }

  /** 기준선 판독. 시나리오가 "애매"이면 한 칸을 애매하게 돌려서 기준선 확인 화면을 볼 수 있게 한다 */
  private makeRefill(photo: LocalPhoto | null, source: Refill['source']): Refill {
    const layout = this.s.pillbox!.layout;
    const unclearOne = this.s.nextScenario === 'unclear';
    const cells: CellResult[] = layout.cells.map((c, i) => ({
      cell_id: c.id,
      ai_state: unclearOne && i === 0 ? 'unclear' : 'full',
      expected: null,
      attention: unclearOne && i === 0 ? 'unclear' : null,
      bbox: null,
    }));
    const p = this.photoOf(photo);
    return {
      id: this.id('rf'),
      pillbox_id: this.s.pillbox!.id,
      filled_at: iso(new Date()),
      filled_by: this.guardians()[0] ?? null,
      source,
      baseline_reading: { id: this.id('rd'), photo: p, is_mock: true, provider: 'mock', model: MOCK_MODEL, created_at: iso(new Date()), target_cell_id: null, classification: null, cells },
      baseline_cells: cells.map((c) => ({ cell_id: c.cell_id, state: 'full', edited: false })),
      needs_review: unclearOne,
    };
  }

  async createPillbox(req: { photo_id: string; layout: Layout }) {
    const { s } = await this.auth('guardian');
    await delay(800);
    s.pillbox = { id: this.id('pb'), layout: req.layout, registered_photo_id: req.photo_id, confirmed_at: iso(new Date()), active: true };
    // 3.11: 새 약통을 확정하면 기존 일정은 지워진다
    s.slots = [];
    s.scheduleUpdatedAt = iso(new Date());
    const refill = this.makeRefill(null, 'registration');
    s.refills.push(refill);
    s.mismatch = { detected: false, cell_ids: [], reading_id: null, detected_at: null };
    s.eventsDate = '';
    this.rollDay();
    await this.commit();
    return copy({ pillbox: s.pillbox, refill });
  }

  async currentPillbox(): Promise<PillboxCurrent> {
    const { s } = await this.auth('guardian');
    if (!s.pillbox) throw new ApiError(404, 'pillbox_required', '모의: 약통 없음');
    const now = new Date();
    const wd = mondayIndex(now);
    const taken = new Set(s.events.filter((e) => e.outcome === 'taken').map((e) => e.slot.cell_id));
    // 모의 계산: 주간 약통을 월요일에 채웠다고 보고, 오늘 아직 안 드신 칸과 이후 칸을 남은 칸으로 센다
    const remaining = s.slots
      .slice()
      .sort((a, b) => weekMinutes(a) - weekMinutes(b))
      .filter((slot) => slot.weekday > wd || (slot.weekday === wd && !taken.has(slot.cell_id)));
    const last = remaining[remaining.length - 1];
    const perDay = Math.max(0, ...[0, 1, 2, 3, 4, 5, 6].map((d) => s.slots.filter((x) => x.weekday === d).length));
    const threshold = perDay * 2;
    const coveredDate = last ? new Date(now.getTime() + (last.weekday - wd) * 86_400_000) : null;
    return copy({
      pillbox: s.pillbox,
      last_refill: s.refills[s.refills.length - 1] ?? null,
      refill_status: {
        remaining_cells: remaining.length,
        covered_until: last && coveredDate ? { date: dateKey(coveredDate), weekday: last.weekday, time_of_day: last.time_of_day, dose_time: last.dose_time } : null,
        needs_refill: remaining.length <= threshold,
        threshold_cells: threshold,
      },
      pillbox_mismatch: s.mismatch,
    });
  }

  async schedule() {
    const { s } = await this.auth();
    return copy({ pillbox_id: s.pillbox?.id ?? null, slots: s.slots, updated_at: s.scheduleUpdatedAt });
  }

  async putSchedule(slots: SlotInput[]) {
    const { s } = await this.auth('guardian');
    if (!s.pillbox) throw new ApiError(409, 'pillbox_required', '모의');
    const cellIds = new Set(s.pillbox.layout.cells.map((c) => c.id));
    const seen = new Set<string>();
    for (const x of slots) {
      const key = `${x.weekday}-${x.time_of_day}`;
      if (!cellIds.has(x.cell_id) || seen.has(x.cell_id) || seen.has(key)) throw new ApiError(422, 'validation_error', '모의: 칸 중복 또는 없는 칸');
      seen.add(x.cell_id);
      seen.add(key);
    }
    s.slots = slots.map((x) => ({ ...x, id: this.id('s') }));
    s.scheduleUpdatedAt = iso(new Date());
    // 3.14: 오늘 남은 scheduled 건은 새 일정으로 다시 만든다. 이미 물어본 건은 그대로 둔다
    const started = s.events.filter((e) => e.state !== 'scheduled');
    s.events = started;
    this.addTodayEvents(new Set(started.map((e) => e.slot.cell_id)), true);
    await this.commit();
    return this.schedule();
  }

  async createRefill(photo: LocalPhoto) {
    const { s } = await this.auth('guardian');
    if (!s.pillbox) throw new ApiError(409, 'pillbox_required', '모의');
    await delay(1200);
    const refill = this.makeRefill(photo, 'guardian_photo');
    s.refills.push(refill);
    s.mismatch = { detected: false, cell_ids: [], reading_id: null, detected_at: null };
    await this.commit();
    return copy(refill);
  }

  async updateBaseline(refillId: string, cells: { cell_id: string; state: 'full' | 'empty' }[]) {
    const { s } = await this.auth('guardian');
    const latest = s.refills[s.refills.length - 1];
    if (!latest || latest.id !== refillId) throw new ApiError(409, 'refill_not_latest', '모의');
    for (const c of cells) {
      const b = latest.baseline_cells.find((x) => x.cell_id === c.cell_id);
      if (b) Object.assign(b, { state: c.state, edited: true });
    }
    const flagged = latest.baseline_reading.cells.filter((c) => c.attention).map((c) => c.cell_id);
    latest.needs_review = flagged.some((id) => !latest.baseline_cells.find((b) => b.cell_id === id)?.edited);
    await this.commit();
    return copy(latest);
  }

  // ---- 3.17 ~ 3.19 복약 건 ----

  /** 날짜가 바뀌면 오늘 일정으로 복약 건을 새로 만든다 (backend.md 9장) */
  private rollDay() {
    const key = dateKey(new Date());
    if (this.s.eventsDate === key) return;
    this.s.eventsDate = key;
    // 3.17 (R-021 Q-007): 전날 끝나지 않은 건은 예정 시각 후 6시간 안이면 오늘 목록 앞쪽에 남긴다
    const carried = this.s.events.filter((e) => this.isCarryable(e));
    carried.forEach((e) => (e.carried_over = true));
    const keep = new Set(carried.map((e) => e.id));
    this.s.events = carried;
    this.s.handoffs = this.s.handoffs.filter((h) => keep.has(h.event_id));
    this.s.readings = Object.fromEntries(Object.entries(this.s.readings).filter(([id]) => keep.has(id)));
    this.addTodayEvents(new Set());
  }

  private isCarryable(e: DoseEvent): boolean {
    if (Date.now() - new Date(e.scheduled_at).getTime() > CARRY_OVER_HOURS * 3_600_000) return false;
    if (['asked', 'retake_requested', 'reminded'].includes(e.state)) return true;
    const h = this.s.handoffs.find((x) => x.event_id === e.id);
    return e.state === 'handed_off' && h?.reason === 'no_response' && e.photos.length === 0;
  }

  /** onlyLater: 일정 저장 때는 저장 시각보다 이른 오늘 칸을 만들지 않는다 (3.14, R-021 Q-001) */
  private addTodayEvents(skipCells: Set<string>, onlyLater = false) {
    const today = new Date();
    const wd = mondayIndex(today);
    for (const slot of this.s.slots.filter((x) => x.weekday === wd && !skipCells.has(x.cell_id))) {
      if (onlyLater && atTime(today, slot.dose_time).getTime() < today.getTime()) continue;
      const at = iso(atTime(today, slot.dose_time));
      this.s.events.push(
        this.withTimes({
          id: this.id('ev'),
          date: dateKey(today),
          slot: copy(slot),
          scheduled_at: at,
          state: 'scheduled',
          outcome: null,
          outcome_source: null,
          decided_by: null,
          taken_at: null,
          resolved_at: null,
          elder_status: 'upcoming',
          ask_times: [],
          handoff_at: at,
          retake_deadline_at: null,
          photos: [],
          is_mock: false,
          is_simulated: false,
          carried_over: false,
          reminded_at: null,
          latest_reading: null,
          handoff: null,
        }),
      );
    }
    // 전날 건(carried_over)이 앞쪽에 온다
    this.s.events.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  private withTimes(ev: DoseEvent): DoseEvent {
    ev.ask_times = [ev.scheduled_at, ...TIMING.reask_offsets_min.map((m) => addMin(ev.scheduled_at, m))];
    ev.handoff_at = addMin(ev.scheduled_at, TIMING.no_response_handoff_min);
    return ev;
  }

  private elderStatus(ev: DoseEvent): DoseEvent['elder_status'] {
    if (ev.outcome === 'taken') return 'recorded';
    // 늦은 정상 사진: 보호자 판정 전이거나 확인(acknowledged)이어도 어르신 기준으로는 기록 (R-021 Q-004)
    if (ev.taken_at && ev.outcome !== 'not_taken') return 'recorded';
    if (ev.state === 'scheduled') return 'upcoming';
    if (['asked', 'reading', 'retake_requested', 'reminded'].includes(ev.state)) return 'waiting';
    return 'no_record';
  }

  /** 역할에 맞는 형태로 내보낸다 (2.5: 어르신 응답에서는 latest_reading, handoff 가 null) */
  private view(ev: DoseEvent): DoseEvent {
    const out = copy(ev);
    out.elder_status = this.elderStatus(ev);
    const h = this.s.handoffs.find((x) => x.event_id === ev.id);
    const readings = this.s.readings[ev.id] ?? [];
    out.latest_reading = copy(readings[readings.length - 1] ?? null);
    out.handoff = h ? { id: h.id, reason: h.reason, notified_at: h.notified_at, verdict: h.verdict, verdict_at: h.verdict_at } : null;
    if (this.role === 'elder') {
      out.latest_reading = null;
      out.handoff = null;
      out.reminded_at = null;
    }
    return out;
  }

  async today(): Promise<TodayResponse> {
    const { s } = await this.auth();
    const next = s.events.find((e) => e.state === 'scheduled' || e.state === 'asked');
    return {
      date: s.eventsDate,
      items: s.events.map((e) => this.view(e)),
      open_handoff_count: this.role === 'guardian' ? s.handoffs.filter((h) => !h.verdict).length : null,
      // 아직 보고가 없으면 경고하지 않는다 (3.17)
      elder_notification_warning: this.role === 'guardian' ? s.elder?.notification_status?.ready === false : null,
      next_event: next ? { id: next.id, scheduled_at: next.scheduled_at, time_of_day: next.slot.time_of_day } : null,
    };
  }

  async doseEvents(from: string, to: string, query: DoseEventQuery = {}) {
    const { s } = await this.auth('guardian');
    const search = !!(query.filter || query.reason);
    // 3.19 (R-051): 검색이면 366일, 아니면 31일까지
    if (from > to || daysBetween(from, to) + 1 > (search ? 366 : 31)) throw new ApiError(422, 'validation_error', '모의: 기간');
    // 오늘 건은 저장된 상태, 지난 날은 날짜·칸으로 정해지는 모의 기록
    const today: PastEvent[] = s.events.filter((e) => e.date >= from && e.date <= to).map((e) => ({ ...this.view(e), refill_unconfirmed: false }));
    let items = [...this.pastEvents(from, to), ...today];
    const exceptional = (e: PastEvent) => !!e.handoff || e.refill_unconfirmed || e.outcome === 'not_taken';
    if (query.filter === 'exceptions') items = items.filter(exceptional);
    if (query.filter === 'handoff') items = items.filter((e) => !!e.handoff || e.refill_unconfirmed);
    if (query.filter === 'not_taken') items = items.filter((e) => e.outcome === 'not_taken');
    if (query.filter === 'taken') items = items.filter((e) => e.outcome === 'taken');
    // 리필 확인 요청(refill_unconfirmed)은 복약 건의 handoff 가 아니라 null 로 온다 (R-052 주의)
    if (query.reason) items = items.filter((e) => e.handoff?.reason === query.reason || (query.reason === 'refill_unconfirmed' && e.refill_unconfirmed));
    items.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at) * (query.order === 'desc' ? -1 : 1));
    return items.map(({ refill_unconfirmed: _r, ...e }) => copy(e as DoseEvent));
  }

  /** 모의 지난 기록 (어제까지). 일정이 바뀌어도 지금 일정으로 만든다. 오늘 목록에 남은 전날 건은 빼고 만든다 */
  private pastEvents(from: string, to: string): PastEvent[] {
    const s = this.s;
    const today = dateKey(new Date());
    const start = addDays(today, -MOCK_HISTORY_DAYS);
    const out: PastEvent[] = [];
    const guardian = s.guardian ? { device_id: s.guardian.id, display_name: s.guardian.display_name } : null;
    for (let key = from < start ? start : from; key <= to && key < today; key = addDays(key, 1)) {
      const day = dayOfKey(key);
      const slots = s.slots.filter((x) => x.weekday === mondayIndex(day)).sort((a, b) => a.dose_time.localeCompare(b.dose_time));
      slots.forEach((slot, i) => {
        if (s.events.some((e) => e.date === key && e.slot.cell_id === slot.cell_id)) return;
        const at = iso(atTime(day, slot.dose_time));
        const r = seeded(`${key}|${slot.cell_id}`);
        const id = `past-${key}-${slot.cell_id}`;
        const ev: PastEvent = this.withTimes({
          id,
          date: key,
          slot: copy(slot),
          scheduled_at: at,
          state: 'done',
          outcome: 'taken',
          outcome_source: 'ai',
          decided_by: null,
          taken_at: addMin(at, Math.round(r * 1000) % 15),
          resolved_at: null,
          elder_status: 'recorded',
          ask_times: [],
          handoff_at: at,
          retake_deadline_at: null,
          photos: [],
          is_mock: true,
          is_simulated: false,
          carried_over: false,
          reminded_at: null,
          latest_reading: null,
          handoff: null,
        }) as PastEvent;
        ev.resolved_at = ev.taken_at;
        ev.refill_unconfirmed = i === 0 && day.getDate() % 9 === 0;
        // 대부분 정상, 가끔 인계 (무응답 → 드심/안 드심, 애매 → 드심, 칸 그대로 → 확인함)
        const handoff = (reason: HandoffReason, verdict: 'taken' | 'not_taken' | 'acknowledged') => {
          const verdictAt = addMin(at, 45);
          ev.state = 'handed_off';
          ev.outcome = verdict;
          ev.outcome_source = 'guardian';
          ev.decided_by = guardian;
          ev.taken_at = verdict === 'taken' ? verdictAt : null;
          ev.resolved_at = verdictAt;
          ev.elder_status = verdict === 'taken' ? 'recorded' : 'no_record';
          ev.handoff = { id: `past-h-${key}-${slot.cell_id}`, reason, notified_at: addMin(at, TIMING.no_response_handoff_min), verdict, verdict_at: verdictAt };
        };
        if (r >= 0.97) handoff('no_response', 'not_taken');
        else if (r >= 0.93) handoff('unchanged', 'acknowledged');
        else if (r >= 0.88) handoff('unclear', 'taken');
        else if (r >= 0.83) handoff('no_response', 'taken');
        out.push(ev);
      });
    }
    return out;
  }

  /** backend.md 5.2 기대 상태 계산 (모의: 기준선은 모두 찬 칸, 지난 날 칸은 드셨다고 본다) */
  private expectedFor(target: DoseEvent): Map<string, ExpectedState> {
    const order = this.s.slots.slice().sort((a, b) => weekMinutes(a) - weekMinutes(b));
    const t = order.findIndex((x) => x.cell_id === target.slot.cell_id);
    const byCell = new Map(this.s.events.map((e) => [e.slot.cell_id, e]));
    const out = new Map<string, ExpectedState>();
    order.forEach((slot, i) => {
      if (i > t) return out.set(slot.cell_id, 'full');
      if (i === t) return out.set(slot.cell_id, 'empty');
      const ev = byCell.get(slot.cell_id);
      // 오늘 놓친 칸(인계, 안 드심, 확인)은 비교 제외 (C2, 5.3)
      if (ev && ev.outcome !== 'taken') return out.set(slot.cell_id, 'ignored');
      return out.set(slot.cell_id, 'empty');
    });
    return out;
  }

  private mockReading(ev: DoseEvent, photo: Photo): Reading {
    const expected = this.expectedFor(ev);
    const target = ev.slot.cell_id;
    const order = [...expected.keys()];
    const nextCell = order[order.indexOf(target) + 1];
    const sc = this.s.nextScenario ?? 'normal';
    this.s.nextScenario = null;
    const cells: CellResult[] = order.map((cellId) => {
      const exp = expected.get(cellId)!;
      let ai: CellState = exp === 'ignored' ? 'full' : exp;
      if (cellId === target) ai = sc === 'unclear' ? 'unclear' : sc === 'unchanged' ? 'full' : 'empty';
      if (sc === 'double_suspected' && cellId === nextCell) ai = 'empty';
      let attention: Attention | null = null;
      if (ai === 'unclear') attention = 'unclear';
      else if (exp === 'full' && ai === 'empty') attention = 'unexpected_empty';
      else if (exp === 'empty' && ai === 'full') attention = 'unexpected_full';
      return { cell_id: cellId, ai_state: ai, expected: exp, attention, bbox: null };
    });
    const targetCell = cells.find((c) => c.cell_id === target)!;
    let classification: Classification = 'normal';
    if (targetCell.ai_state === 'unclear') classification = 'unclear';
    else if (cells.some((c) => c.attention === 'unexpected_empty')) classification = 'double_suspected';
    else if (targetCell.ai_state === 'full') classification = 'unchanged';
    return { id: this.id('rd'), photo, is_mock: true, provider: 'mock', model: MOCK_MODEL, created_at: iso(new Date()), target_cell_id: target, classification, cells };
  }

  private handOff(ev: DoseEvent, reason: HandoffReason) {
    ev.state = 'handed_off';
    ev.retake_deadline_at = null;
    this.s.handoffs.push({ id: this.id('h'), event_id: ev.id, reason, notified_at: iso(new Date()), verdict: null, verdict_by: null, verdict_at: null, late_photo: false });
  }

  async uploadDosePhoto(eventId: string, local: LocalPhoto, clientUploadId: string): Promise<UploadResponse> {
    const { s } = await this.auth('elder');
    if (s.uploads[clientUploadId]) return copy(s.uploads[clientUploadId]);
    const ev = s.events.find((e) => e.id === eventId);
    if (!ev) throw new ApiError(404, 'not_found', '모의');
    const h = s.handoffs.find((x) => x.event_id === ev.id);
    const now = Date.now();
    const latePhoto = ev.state === 'handed_off' && h?.reason === 'no_response' && !h.verdict;
    const early = ev.state === 'scheduled' && now >= new Date(ev.scheduled_at).getTime() - EARLY_PHOTO_MIN * 60_000;
    if (ev.state === 'reading') throw new ApiError(409, 'reading_in_progress', '모의');
    if (!(['asked', 'retake_requested', 'reminded'].includes(ev.state) || latePhoto || early)) throw new ApiError(409, 'event_not_open', '모의');

    const prevState = ev.state;
    ev.state = 'reading';
    const photo = this.photoOf(local);
    ev.photos.push(photo);
    ev.is_mock = true;
    await this.commit();
    await delay(READ_DELAY_MS);

    const reading = this.mockReading(ev, photo);
    const all = (s.readings[ev.id] ??= []);
    all.push(reading);
    const past = all.slice(0, -1);
    const late = now > new Date(ev.handoff_at).getTime();
    const mismatch = reading.cells.filter((c) => c.cell_id !== reading.target_cell_id && c.attention).map((c) => c.cell_id);
    s.mismatch = mismatch.length
      ? { detected: true, cell_ids: mismatch, reading_id: reading.id, detected_at: reading.created_at }
      : { detected: false, cell_ids: [], reading_id: null, detected_at: null };

    let result: UploadResponse['result'];
    if (latePhoto && h) {
      // 늦은 사진: 인계 건은 열어 두고 사진만 붙인다. 다시 알리지 않는다 (3.18)
      h.late_photo = true;
      ev.state = 'handed_off';
      // 정상이면 어르신 기준 기록으로 본다. 판정은 보호자가 한다 (R-021 Q-004)
      if (reading.classification === 'normal') ev.taken_at = photo.taken_at;
      result = reading.classification === 'normal' ? 'recorded' : 'guardian_notified';
    } else if (reading.classification === 'normal') {
      ev.state = 'done';
      ev.outcome = 'taken';
      ev.outcome_source = 'ai';
      ev.taken_at = photo.taken_at;
      ev.resolved_at = iso(new Date());
      result = 'recorded';
    } else if (reading.classification === 'unclear') {
      // 다시 찍어 달라는 요청은 종류와 관계없이 건당 1회 (R-021 Q-005). 두 번째 사진이 있으면 이미 요청한 것이다
      if (!late && past.length === 0) {
        ev.state = 'retake_requested';
        ev.retake_deadline_at = addMin(iso(new Date()), TIMING.retake_wait_min);
        result = 'retake';
      } else {
        this.handOff(ev, 'unclear');
        result = 'guardian_notified';
      }
    } else if (reading.classification === 'unchanged') {
      // R-009 설정 + R-007 C3: 복약 시간(+30분) 안이고, 안내 모드이고, 아직 안내하지 않았을 때만 1회 안내
      const firstTime = prevState !== 'reminded' && past.length === 0;
      if (s.settings.unchanged_mode === 'remind_then_retake' && firstTime && !late) {
        ev.state = 'reminded';
        ev.reminded_at = iso(new Date());
        ev.retake_deadline_at = addMin(iso(new Date()), TIMING.retake_wait_min);
        result = 'remind_retake';
      } else {
        this.handOff(ev, 'unchanged');
        result = 'guardian_notified';
      }
    } else {
      this.handOff(ev, 'double_suspected');
      result = 'guardian_notified';
    }
    const res: UploadResponse = { result, dose_event: this.view(ev), is_mock: true };
    s.uploads[clientUploadId] = res;
    await this.commit();
    return copy(res);
  }

  // ---- 3.20 ~ 3.23 인계·사진 ----

  private handoffItem(h: StoredHandoff): HandoffListItem {
    const ev = this.s.events.find((e) => e.id === h.event_id)!;
    const { event_id: _eventId, ...rest } = h;
    return copy({ ...rest, allowed_verdicts: ALLOWED_VERDICTS[h.reason], dose_event: this.view(ev) });
  }

  async handoffs(status: 'open' | 'closed' | 'all' = 'open') {
    const { s } = await this.auth('guardian');
    return s.handoffs
      .filter((h) => status === 'all' || (status === 'open') === !h.verdict)
      .sort((a, b) => Number(!!a.verdict) - Number(!!b.verdict) || b.notified_at.localeCompare(a.notified_at))
      .map((h) => this.handoffItem(h));
  }

  async handoff(id: string): Promise<Handoff> {
    const { s } = await this.auth('guardian');
    const h = s.handoffs.find((x) => x.id === id);
    if (!h && id.startsWith('past-h-')) {
      // 모의 지난 기록의 인계 (이미 판정됨, 사진 없음)
      const key = id.slice('past-h-'.length, 'past-h-'.length + 10);
      const ev = this.pastEvents(key, key).find((e) => e.handoff?.id === id);
      if (!ev || !ev.handoff) throw new ApiError(404, 'not_found', '모의');
      const { refill_unconfirmed: _r, ...dose_event } = ev;
      return copy({
        id,
        reason: ev.handoff.reason,
        notified_at: ev.handoff.notified_at,
        verdict: ev.handoff.verdict,
        verdict_by: ev.decided_by,
        verdict_at: ev.handoff.verdict_at,
        allowed_verdicts: ALLOWED_VERDICTS[ev.handoff.reason],
        late_photo: false,
        dose_event,
        readings: [],
        layout: s.pillbox!.layout,
      });
    }
    if (!h) throw new ApiError(404, 'not_found', '모의');
    return { ...this.handoffItem(h), readings: copy(s.readings[h.event_id] ?? []), layout: copy(s.pillbox!.layout) };
  }

  async verdict(handoffId: string, verdict: Verdict) {
    const { s, me } = await this.auth('guardian');
    const h = s.handoffs.find((x) => x.id === handoffId);
    if (!h) throw new ApiError(404, 'not_found', '모의');
    if (h.verdict) throw new ApiError(409, 'handoff_already_resolved', '모의', { verdict: h.verdict, verdict_by: h.verdict_by });
    if (!ALLOWED_VERDICTS[h.reason].includes(verdict)) throw new ApiError(422, 'verdict_not_allowed', '모의');
    const by = { device_id: me.id, display_name: me.display_name };
    h.verdict = verdict;
    h.verdict_by = by;
    h.verdict_at = iso(new Date());
    const ev = s.events.find((e) => e.id === h.event_id)!;
    if (verdict === 'taken' || verdict === 'not_taken' || verdict === 'acknowledged') {
      ev.state = 'done';
      ev.outcome = verdict;
      ev.outcome_source = 'guardian';
      ev.decided_by = by;
      ev.resolved_at = h.verdict_at;
      // 늦은 사진 시각이 있으면 그 시각, 없으면 판정 시각. 안 드심이면 기록 없음 (2.5)
      if (verdict === 'taken') ev.taken_at = ev.taken_at ?? h.verdict_at;
      if (verdict === 'not_taken') ev.taken_at = null;
    }
    await this.commit();
    return this.handoff(handoffId);
  }

  async photo(id: string) {
    const { s } = await this.auth();
    const all = [...s.events.flatMap((e) => e.photos), ...s.refills.map((r) => r.baseline_reading.photo)];
    const p = all.find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'not_found', '모의');
    return copy(p);
  }

  // ---- 3.25 ~ 3.27 ----

  async summaries(period: SummaryPeriod, from?: string, to?: string): Promise<Summary[]> {
    await this.auth('guardian');
    const todayKey = dateKey(new Date());
    const start = addDays(todayKey, -MOCK_HISTORY_DAYS);
    if (period === 'total') {
      // 3.25 period=total: 첫 복약 건 날짜부터 오늘까지 합계 한 항목
      const days = this.daySummaries(start, todayKey);
      return [{ ...this.sumOf(days, 'total'), period_start: start, period_end: todayKey }];
    }
    if (period === 'day') {
      const f = from ?? addDays(todayKey, -6);
      const t = to ?? todayKey;
      if (f > t || daysBetween(f, t) + 1 > 366) throw new ApiError(422, 'validation_error', '모의: 기간');
      return this.daySummaries(f, t);
    }
    // 주간: 이번 주 (월~오늘)
    const monday = addDays(todayKey, -mondayIndex(new Date()));
    const week = this.daySummaries(monday, todayKey);
    return [{ ...this.sumOf(week, 'week'), period_start: monday, period_end: addDays(monday, 6) }];
  }

  private emptyReasons(): Summary['handoffs_by_reason'] {
    return { no_response: 0, unclear: 0, unchanged: 0, double_suspected: 0, refill_unconfirmed: 0, refill_overdue: 0 };
  }

  /** 하루 요약들 (오늘은 실시간 상태, 지난 날은 모의 지난 기록으로 계산). 오늘 뒤 날짜는 없다 */
  private daySummaries(from: string, to: string): Summary[] {
    const todayKey = dateKey(new Date());
    const past = this.pastEvents(from, to);
    const out: Summary[] = [];
    for (let key = from; key <= to && key <= todayKey; key = addDays(key, 1)) {
      if (key === todayKey) {
        out.push(this.todaySummary());
        continue;
      }
      const ev = past.filter((e) => e.date === key);
      const byReason = this.emptyReasons();
      ev.forEach((e) => {
        if (e.handoff) byReason[e.handoff.reason] += 1;
        if (e.refill_unconfirmed) byReason.refill_unconfirmed += 1;
      });
      const counts = {
        scheduled: ev.length,
        taken_ai: ev.filter((e) => e.outcome === 'taken' && e.outcome_source === 'ai').length,
        taken_guardian: ev.filter((e) => e.outcome === 'taken' && e.outcome_source === 'guardian').length,
        not_taken: ev.filter((e) => e.outcome === 'not_taken').length,
        acknowledged: ev.filter((e) => e.outcome === 'acknowledged').length,
        open_handoffs: 0,
        pending: 0,
      };
      out.push({
        period: 'day',
        period_start: key,
        period_end: key,
        final: true,
        counts,
        handoffs_by_reason: byReason,
        all_normal: counts.scheduled > 0 && counts.taken_ai === counts.scheduled,
        refill: null,
        includes_mock: counts.scheduled > 0,
        includes_simulated: false,
        pillbox_mismatch: false,
      });
    }
    return out;
  }

  private todaySummary(): Summary {
    const s = this.s;
    const ev = s.events;
    const byReason = this.emptyReasons();
    s.handoffs.forEach((h) => (byReason[h.reason] += 1));
    const counts = {
      scheduled: ev.length,
      taken_ai: ev.filter((e) => e.outcome === 'taken' && e.outcome_source === 'ai').length,
      taken_guardian: ev.filter((e) => e.outcome === 'taken' && e.outcome_source === 'guardian').length,
      not_taken: ev.filter((e) => e.outcome === 'not_taken').length,
      acknowledged: ev.filter((e) => e.outcome === 'acknowledged').length,
      open_handoffs: s.handoffs.filter((h) => !h.verdict).length,
      pending: ev.filter((e) => e.state !== 'done' && e.state !== 'handed_off').length,
    };
    return {
      period: 'day',
      period_start: s.eventsDate,
      period_end: s.eventsDate,
      final: false,
      counts,
      handoffs_by_reason: byReason,
      all_normal: counts.scheduled > 0 && counts.taken_ai === counts.scheduled && counts.open_handoffs === 0,
      refill: null,
      includes_mock: true,
      includes_simulated: ev.some((e) => e.is_simulated),
      pillbox_mismatch: s.mismatch.detected,
    };
  }

  private sumOf(days: Summary[], period: SummaryPeriod): Summary {
    const sum = (k: keyof Summary['counts']) => days.reduce((n, d) => n + d.counts[k], 0);
    const byReason = this.emptyReasons();
    days.forEach((d) => (Object.keys(byReason) as HandoffReason[]).forEach((r) => (byReason[r] += d.handoffs_by_reason[r] ?? 0)));
    const last = days[days.length - 1];
    return {
      period,
      period_start: days[0]?.period_start ?? '',
      period_end: last?.period_end ?? '',
      final: false,
      counts: {
        scheduled: sum('scheduled'),
        taken_ai: sum('taken_ai'),
        taken_guardian: sum('taken_guardian'),
        not_taken: sum('not_taken'),
        acknowledged: sum('acknowledged'),
        open_handoffs: sum('open_handoffs'),
        pending: sum('pending'),
      },
      handoffs_by_reason: byReason,
      all_normal: days.length > 0 && days.every((d) => d.all_normal || d.counts.scheduled === 0) && days.some((d) => d.all_normal),
      refill: null,
      includes_mock: days.some((d) => d.includes_mock),
      includes_simulated: days.some((d) => d.includes_simulated),
      pillbox_mismatch: days.some((d) => d.pillbox_mismatch),
    };
  }

  async settings(): Promise<Settings> {
    const { s } = await this.auth('guardian');
    return copy({ elder_display_name: s.family!.elder_display_name, ...s.settings });
  }

  async putSettings(patch: Partial<Settings>) {
    const { s } = await this.auth('guardian');
    const { elder_display_name, ...rest } = patch;
    if (elder_display_name !== undefined) {
      s.family!.elder_display_name = elder_display_name;
      if (s.elder) s.elder.display_name = elder_display_name;
    }
    s.settings = { ...s.settings, ...rest };
    await this.commit();
    return this.settings();
  }

  async simulateDose(slotId: string) {
    const { s } = await this.auth();
    const slot = s.slots.find((x) => x.id === slotId);
    if (!slot) throw new ApiError(404, 'not_found', '모의');
    if (slot.weekday !== mondayIndex(new Date())) throw new ApiError(422, 'validation_error', '모의: 오늘 요일 칸이 아님');
    let ev = s.events.find((e) => e.slot.id === slotId);
    if (ev && ev.state !== 'scheduled') throw new ApiError(409, 'event_already_started', '모의');
    if (!ev) {
      this.addTodayEvents(new Set(s.events.map((e) => e.slot.cell_id)));
      ev = s.events.find((e) => e.slot.id === slotId)!;
    }
    ev.scheduled_at = iso(new Date());
    this.withTimes(ev);
    ev.is_simulated = true;
    ev.state = 'asked';
    await this.commit();
    return this.view(ev);
  }

  async setMockScenario(scenario: MockScenario | null) {
    await this.auth();
    this.s.nextScenario = scenario;
    await this.commit();
    return { scenario, applies_to: 'next_dose_photo' as const, is_mock: true };
  }

  // ---- 개발용 ----

  readonly dev: MockDevTools = {
    setActingRole: (role) => {
      this.role = role;
      this.listeners.forEach((l) => l());
    },
    advanceTime: async () => {
      const s = await this.ready();
      const ev = s.events.find((e) => ['asked', 'reminded', 'retake_requested'].includes(e.state));
      if (!ev) return null;
      // 다음 기한이 방금 지나간 것처럼 이 건의 시각들을 앞으로 당긴다
      const now = Date.now();
      const marks = ev.state === 'asked' ? [...ev.ask_times.slice(1), ev.handoff_at] : [ev.retake_deadline_at!];
      const next = marks.map((m) => new Date(m).getTime()).find((t) => t > now);
      const shiftMin = next ? Math.ceil((next - now) / 60_000) + 1 : 0;
      const shift = (at: string) => addMin(at, -shiftMin);
      ev.scheduled_at = shift(ev.scheduled_at);
      ev.ask_times = ev.ask_times.map(shift);
      ev.handoff_at = shift(ev.handoff_at);
      if (ev.retake_deadline_at) ev.retake_deadline_at = shift(ev.retake_deadline_at);
      const t = Date.now();
      if (ev.state === 'asked' && t > new Date(ev.handoff_at).getTime()) this.handOff(ev, 'no_response');
      else if (ev.state === 'reminded' && t > new Date(ev.retake_deadline_at!).getTime()) this.handOff(ev, 'unchanged');
      else if (ev.state === 'retake_requested' && t > new Date(ev.retake_deadline_at!).getTime()) this.handOff(ev, 'unclear');
      await this.commit();
      return this.view(ev);
    },
    addCarriedOver: async () => {
      const s = await this.ready();
      const yesterday = new Date(Date.now() - 86_400_000);
      const slots = s.slots.filter((x) => x.weekday === mondayIndex(yesterday)).sort((a, b) => b.dose_time.localeCompare(a.dose_time));
      const slot = slots[0];
      if (!slot) return null;
      // 모의: 예정 시각은 6시간 창 안에 들도록 두 시간 전으로 두고, 날짜는 어제로 둔다
      const at = addMin(iso(new Date()), -120);
      const ev = this.withTimes({
        id: this.id('ev'),
        date: dateKey(yesterday),
        slot: copy(slot),
        scheduled_at: at,
        state: 'asked',
        outcome: null,
        outcome_source: null,
        decided_by: null,
        taken_at: null,
        resolved_at: null,
        elder_status: 'waiting',
        ask_times: [],
        handoff_at: at,
        retake_deadline_at: null,
        photos: [],
        is_mock: false,
        is_simulated: true,
        carried_over: true,
        reminded_at: null,
        latest_reading: null,
        handoff: null,
      });
      this.handOff(ev, 'no_response');
      s.events.unshift(ev);
      await this.commit();
      return this.view(ev);
    },
    resetToday: async () => {
      await this.ready();
      this.s.eventsDate = '';
      this.rollDay();
      await this.commit();
    },
  };
}

export function createMockApi(): Api {
  return new MockApi();
}
