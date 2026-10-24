// API 계약서 타입. DOCS 저장소 docs/design/api.md 2장(공통 객체)·3장(엔드포인트)을 그대로 옮겼다.
// 계약서가 바뀌면 이 파일만 고친다. 화면 코드는 이 파일의 타입과 src/api/index.ts 의 `api` 만 사용한다.
// 계약서 1.6: 클라이언트는 모르는 필드를 무시한다 → 여기 없는 필드가 와도 문제없다.

// ---- 2.1 열거형 ----
export type Role = 'elder' | 'guardian';
export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'bedtime';
export type CellState = 'empty' | 'full' | 'unclear';
export type ExpectedState = 'empty' | 'full' | 'ignored';
export type DoseState = 'scheduled' | 'asked' | 'reading' | 'retake_requested' | 'reminded' | 'handed_off' | 'done';
export type DoseOutcome = 'taken' | 'not_taken' | 'acknowledged';
export type HandoffReason = 'no_response' | 'unclear' | 'unchanged' | 'double_suspected' | 'refill_unconfirmed' | 'refill_overdue';
export type Verdict = 'taken' | 'not_taken' | 'acknowledged' | 'refilled' | 'not_refilled';
export type Classification = 'normal' | 'unclear' | 'unchanged' | 'double_suspected' | 'error';
export type UnchangedMode = 'remind_then_retake' | 'handoff_immediately';
export type Platform = 'android' | 'ios';
export type ElderStatus = 'upcoming' | 'waiting' | 'recorded' | 'no_record';
export type Attention = 'unclear' | 'low_confidence' | 'unexpected_empty' | 'unexpected_full';

// ---- 2.2 ~ 2.7 공통 객체 ----
export interface Layout {
  rows: number;
  cols: number;
  row_labels: string[];
  col_labels: string[];
  cells: { id: string; row: number; col: number }[];
}

export interface Photo {
  id: string;
  taken_at: string;
  /** 서명 URL. 토큰 없이 <Image source>에 쓴다 */
  url: string;
  url_expires_at: string;
}

export interface CellResult {
  cell_id: string;
  ai_state: CellState;
  expected: ExpectedState | null;
  attention: Attention | null;
  /** 사진 안 칸 위치 [x, y, w, h], 0~1 비율. null 이면 격자 그림으로 대신 표시 */
  bbox: [number, number, number, number] | null;
}

export interface Reading {
  id: string;
  photo: Photo;
  /** true 이면 "모의 결과" 배지 필수 (헌장 6장) */
  is_mock: boolean;
  provider: 'mock' | 'claude' | 'ollama';
  model: string;
  created_at: string;
  target_cell_id: string | null;
  classification: Classification | null;
  cells: CellResult[];
}

export interface PersonRef {
  device_id: string;
  display_name: string;
}

export interface Slot {
  id: string;
  weekday: number;
  time_of_day: TimeOfDay;
  dose_time: string;
  cell_id: string;
}

export interface HandoffBrief {
  id: string;
  reason: HandoffReason;
  notified_at: string;
  verdict: Verdict | null;
  verdict_at: string | null;
}

export interface DoseEvent {
  id: string;
  date: string;
  slot: Slot;
  scheduled_at: string;
  state: DoseState;
  outcome: DoseOutcome | null;
  outcome_source: 'ai' | 'guardian' | null;
  decided_by: PersonRef | null;
  taken_at: string | null;
  resolved_at: string | null;
  elder_status: ElderStatus;
  /** [복약 시각, 재질문1, 재질문2]. 서버값 */
  ask_times: string[];
  handoff_at: string;
  retake_deadline_at: string | null;
  photos: Photo[];
  is_mock: boolean;
  /** 시연 트리거(3.27)로 앞당긴 건. true 이면 "시뮬레이션" 표시 */
  is_simulated: boolean;
  /** 보호자만. 어르신 응답에서는 항상 null */
  latest_reading: Reading | null;
  /** 보호자만. 어르신 응답에서는 항상 null */
  handoff: HandoffBrief | null;
}

export interface HandoffListItem {
  id: string;
  reason: HandoffReason;
  notified_at: string;
  verdict: Verdict | null;
  verdict_by: PersonRef | null;
  verdict_at: string | null;
  allowed_verdicts: Verdict[];
  late_photo: boolean;
  dose_event: DoseEvent;
}

export interface Handoff extends HandoffListItem {
  readings: Reading[];
  layout: Layout;
}

export interface Device {
  id: string;
  role: Role;
  display_name: string;
  platform: Platform | null;
  paired_at: string;
  consent_at: string | null;
  last_seen_at: string | null;
  is_me: boolean;
}

// ---- 3장 요청·응답 ----

export interface Health {
  status: 'ok';
  version: string;
  time: string;
  reader: { layout: string; cells: string; is_mock: boolean };
}

export interface CreateFamilyRequest {
  elder_display_name: string;
  guardian_display_name: string;
  platform: Platform | null;
  is_demo?: boolean;
}

export interface CreateFamilyResponse {
  family_id: string;
  token: string;
  device: Device;
}

export interface PairingCode {
  kind: 'elder' | 'guardian';
  code: string;
  short_code: string | null;
  expires_at: string;
  qr_payload: string;
}

export type PairRequest =
  | { code: string; platform: Platform | null; display_name?: string }
  | { short_code: string; platform: Platform | null };

export interface FamilyBrief {
  id: string;
  elder_display_name: string;
  guardians: PersonRef[];
}

export interface PairResponse {
  token: string;
  device: Device;
  family: FamilyBrief;
  consent_required: boolean;
}

export interface ConsentRequest {
  agreed: true;
  consent_text_version: string;
  ai_external_transfer_shown: boolean;
}

export interface ServerTiming {
  reask_offsets_min: number[];
  no_response_handoff_min: number;
  retake_wait_min: number;
}

export interface Me {
  device: Device;
  consent_required: boolean;
  family: FamilyBrief & { has_pillbox: boolean; has_schedule: boolean; is_demo: boolean };
  server: {
    timezone: string;
    timing: ServerTiming;
    /** true 이면 "모의 판독 (실제 AI 아님)" 띠 */
    reader_is_mock: boolean;
    /** true 이면 E1 에 외부 AI 전송 문구 (R-008 C4) */
    ai_external_transfer: boolean;
    consent_text_version: string;
    demo_mode: boolean;
  };
}

export interface DetectResponse {
  photo: Photo;
  proposal: {
    layout: Layout;
    suggested_time_of_day: (TimeOfDay | null)[];
    uncertain: boolean;
  };
  is_mock: boolean;
  provider: string;
  model: string;
}

export interface Pillbox {
  id: string;
  layout: Layout;
  registered_photo_id: string;
  confirmed_at: string;
  active: boolean;
}

export interface Refill {
  id: string;
  pillbox_id: string;
  filled_at: string;
  filled_by: PersonRef | null;
  source: 'registration' | 'guardian_photo' | 'refill_check';
  baseline_reading: Reading;
  baseline_cells: { cell_id: string; state: 'full' | 'empty'; edited: boolean }[];
  needs_review: boolean;
}

export interface CoveredUntil {
  date: string;
  weekday: number;
  time_of_day: TimeOfDay;
  dose_time: string;
}

export interface PillboxCurrent {
  pillbox: Pillbox;
  last_refill: Refill | null;
  refill_status: {
    remaining_cells: number;
    covered_until: CoveredUntil | null;
    needs_refill: boolean;
    threshold_cells: number;
  };
  pillbox_mismatch: {
    detected: boolean;
    cell_ids: string[];
    reading_id: string | null;
    detected_at: string | null;
  };
}

export interface Schedule {
  pillbox_id: string | null;
  slots: Slot[];
  updated_at: string | null;
}

export type SlotInput = Omit<Slot, 'id'>;

export interface TodayResponse {
  date: string;
  items: DoseEvent[];
  /** 보호자만. 어르신은 null */
  open_handoff_count: number | null;
  next_event: { id: string; scheduled_at: string; time_of_day: TimeOfDay } | null;
}

export type UploadResultKind = 'recorded' | 'retake' | 'remind_retake' | 'guardian_notified';

export interface UploadResponse {
  result: UploadResultKind;
  dose_event: DoseEvent;
  is_mock: boolean;
}

export interface Summary {
  period: 'day' | 'week';
  period_start: string;
  period_end: string;
  final: boolean;
  counts: {
    scheduled: number;
    taken_ai: number;
    taken_guardian: number;
    not_taken: number;
    acknowledged: number;
    open_handoffs: number;
    pending: number;
  };
  handoffs_by_reason: Record<HandoffReason, number>;
  all_normal: boolean;
  refill: { needs_refill: boolean; remaining_cells: number; covered_until: CoveredUntil | null } | null;
  includes_mock: boolean;
  includes_simulated: boolean;
  pillbox_mismatch: boolean;
}

export interface Settings {
  elder_display_name: string;
  summary_push_enabled: boolean;
  summary_push_time: string;
  photo_retention_days: number;
  unchanged_mode: UnchangedMode;
}

/** 앱이 찍은 사진 (업로드 전). uri 가 null 이면 모의 구현에서만 쓰는 "사진 없음" */
export interface LocalPhoto {
  uri: string | null;
  taken_at: string;
}

/** 1.5 오류 형식 */
export interface ErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}
