// 임시 타입. DOCS 저장소 docs/design/backend.md 4장(데이터 모델)·10장(API 초안) 기준.
// docs/design/api.md(API 계약서)가 나오면 이 파일을 그 타입으로 교체한다.
// 화면 코드는 이 파일의 타입과 src/api/index.ts 의 `api` 만 사용한다.

export type Role = 'elder' | 'guardian';

export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'bedtime';

/** backend.md 6장 상태 흐름 */
export type DoseState =
  | 'scheduled'
  | 'asked'
  | 'reading'
  | 'retake_requested'
  | 'reminded'
  | 'handed_off'
  | 'done';

export type DoseOutcome = 'taken' | 'not_taken' | 'acknowledged' | null;

export type HandoffReason = 'no_response' | 'unclear' | 'unchanged' | 'double_suspected';

export type Verdict = 'taken' | 'not_taken';

/** R-009: 칸이 그대로일 때 처리 방식. remind = 1회 안내 후 재촬영(기본), handoff = 바로 인계 */
export type UnchangedPolicy = 'remind' | 'handoff';

export type CellState = 'empty' | 'full' | 'unclear';

/** backend.md 4.1 pillboxes.layout */
export interface PillboxLayout {
  rows: number;
  cols: number;
  row_labels: string[];
  col_labels: string[];
  cells: { id: string; row: number; col: number }[];
}

export interface Pillbox {
  id: string;
  layout: PillboxLayout;
  registered_photo_uri: string | null;
  confirmed_at: string | null;
}

export interface ScheduleSlot {
  id: string;
  /** 0 = 월 ... 6 = 일 */
  weekday: number;
  time_of_day: TimeOfDay;
  /** "HH:MM" (Asia/Seoul) */
  dose_time: string;
  cell_id: string;
}

/** 판독한 칸 하나. confidence 는 서버가 받지만 보호자 화면에 숫자로 보이지 않는다 (R-008 C5) */
export interface CellReading {
  cell_id: string;
  state: CellState;
  confidence: number;
}

export interface Reading {
  id: string;
  provider: string;
  model: string;
  /** true 이면 화면에 "모의 판독" 표시 (헌장 6장) */
  is_mock: boolean;
  cells: CellReading[];
  /** 서버가 기대 상태와 비교해서 보호자가 봐야 한다고 표시한 칸 (애매한 칸, 기대와 다른 칸) */
  flagged_cell_ids: string[];
  created_at: string;
}

export interface Photo {
  id: string;
  /** 로컬 모의 구현에서는 기기 파일 URI. 촬영이 불가능한 환경에서는 null */
  uri: string | null;
  taken_at: string;
}

export interface Handoff {
  id: string;
  dose_event_id: string;
  reason: HandoffReason;
  notified_at: string;
  verdict: Verdict | null;
  verdict_at: string | null;
  acknowledged_at: string | null;
}

export interface DoseEvent {
  id: string;
  slot_id: string;
  time_of_day: TimeOfDay;
  cell_id: string;
  scheduled_at: string;
  state: DoseState;
  outcome: DoseOutcome;
  resolved_at: string | null;
  /** "약 드실 시간이에요" 1회 안내를 한 시각 (칸 그대로, 안내 모드) */
  reminded_at: string | null;
  /** 재질문 횟수 (0~2) */
  reask_count: number;
  photos: Photo[];
  readings: Reading[];
  handoff: Handoff | null;
  /** 개발용 시뮬레이션으로 연 복약 건이면 true. 화면에 "시뮬레이션" 표시 */
  simulated: boolean;
}

export interface Family {
  id: string;
  /** 어르신 호칭 (예: 보호자가 입력한 "어머니") */
  elder_display_name: string;
  /** 보호자 이름 (예: 보호자가 입력한 "민수") */
  guardian_display_name: string;
  consent_at: string | null;
}

/** GET/PUT /settings */
export interface Settings {
  summary_push_enabled: boolean;
  summary_push_time: string;
  photo_retention_days: number;
  unchanged_policy: UnchangedPolicy;
}

/** 서버 설정에서 내려받는 인계 타이밍 (R-007 C5: 앱에 숫자를 하드코딩하지 않는다) */
export interface ServerConfig {
  reask_offsets_min: number[];
  no_response_handoff_min: number;
  unchanged_retake_window_min: number;
  max_unclear_retakes: number;
  /** 판독에 외부 AI 서비스(예: Claude API)를 쓰면 true → 동의 화면에 명시 (R-008 C4) */
  photo_sent_to_external_ai: boolean;
}

/** 사진 업로드 후 서버가 정한 다음 상태. 어르신 화면 분기에 사용 */
export type UploadResult =
  | { next: 'done'; event: DoseEvent }
  | { next: 'retake_requested'; event: DoseEvent }
  | { next: 'reminded'; event: DoseEvent }
  | { next: 'handed_off'; event: DoseEvent; reason: HandoffReason };

export interface PillboxProposal {
  layout: PillboxLayout;
  is_mock: boolean;
}

export interface RefillStatus {
  last_refill_at: string | null;
  remaining_cells: number;
  total_cells: number;
  /** 남은 칸이 다 떨어지는 마지막 복약 칸. 예: { weekday: 3, time_of_day: 'evening' } */
  last_covered: { weekday: number; time_of_day: TimeOfDay } | null;
  is_mock: boolean;
}

export interface DaySummary {
  date: string;
  total: number;
  taken: number;
  handed_off: number;
  pending: number;
}
