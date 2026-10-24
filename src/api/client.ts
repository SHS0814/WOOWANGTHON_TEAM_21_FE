// 데이터 접근 인터페이스. 실제 서버 구현(HTTP)과 모의 구현(mock.ts)이 같은 모양을 따른다.
// 경로 주석은 backend.md 10장 API 초안 기준.
import type {
  DaySummary,
  DoseEvent,
  Family,
  Handoff,
  Pillbox,
  PillboxLayout,
  PillboxProposal,
  RefillStatus,
  ScheduleSlot,
  ServerConfig,
  Settings,
  UploadResult,
  Verdict,
} from './types';

/** 개발용 모의 판독 시나리오 (R-008 5절) */
export type MockScenario = 'normal' | 'unclear' | 'unchanged' | 'double_suspected';

export interface PairingCode {
  qr: string;
  short_code: string;
  expires_at: string;
}

export interface DevTools {
  getScenario(): MockScenario;
  setScenario(s: MockScenario): void;
  /** "지금 약 시간" 시뮬레이션. 다음 복약 건을 asked 로 열고 돌려준다. 남은 건이 없으면 null */
  simulateDoseTime(): Promise<DoseEvent | null>;
  /** 열려 있는 복약 건에 재질문 1회를 시뮬레이션한다. 2회를 넘으면 무응답 인계 */
  simulateNoResponseStep(): Promise<DoseEvent | null>;
  /** 모의 데이터 전체 초기화 */
  reset(): Promise<void>;
}

export interface Api {
  /** true 이면 모의 구현. 화면 상단에 "모의 판독 (실제 AI 아님)" 띠를 띄운다 */
  readonly isMock: boolean;
  /** 데이터가 바뀌면 호출된다. 반환값은 구독 해제 함수 */
  subscribe(listener: () => void): () => void;

  /** GET /config (가정) */
  getConfig(): Promise<ServerConfig>;

  // 가족·짝짓기 (backend.md 3장, R-008 C1)
  getFamily(): Promise<Family | null>;
  /** POST /families */
  createFamily(input: { elder_display_name: string; guardian_display_name: string }): Promise<Family>;
  /** POST /pairing-codes (kind=elder) */
  createPairingCode(): Promise<PairingCode>;
  /** POST /pair (어르신 폰이 QR 값 또는 6자리 코드로 호출) */
  pair(code: string): Promise<Family>;
  /** POST /consent */
  consent(): Promise<void>;
  /** DELETE /devices/{id} */
  unpair(): Promise<void>;

  // 약통·일정
  getPillbox(): Promise<Pillbox | null>;
  /** POST /pillboxes/detect */
  detectPillbox(photoUri: string | null): Promise<PillboxProposal>;
  /** POST /pillboxes */
  savePillbox(layout: PillboxLayout, photoUri: string | null): Promise<Pillbox>;
  getSchedule(): Promise<ScheduleSlot[]>;
  /** PUT /schedule. 시간대별 복약 시각만 바꾼다 */
  saveDoseTimes(times: Partial<Record<ScheduleSlot['time_of_day'], string>>): Promise<ScheduleSlot[]>;

  // 복약 건
  /** GET /dose-events/today */
  getToday(): Promise<DoseEvent[]>;
  getEvent(id: string): Promise<DoseEvent | null>;
  /** POST /dose-events/{id}/photo. 서버가 판독하고 다음 상태를 정한다 */
  uploadPhoto(eventId: string, photoUri: string | null): Promise<UploadResult>;

  // 인계 (보호자)
  getOpenHandoffs(): Promise<DoseEvent[]>;
  /** POST /handoffs/{id}/verdict */
  submitVerdict(handoffId: string, verdict: Verdict): Promise<Handoff>;
  /** 판정이 필요 없는 인계 건을 확인 처리 (outcome = acknowledged) */
  acknowledgeHandoff(handoffId: string): Promise<Handoff>;

  // 리필 (R-007 C1, R-008 C3)
  getRefillStatus(): Promise<RefillStatus>;
  /** POST /refills (채운 약통 사진과 함께) */
  createRefill(photoUri: string | null): Promise<RefillStatus>;

  // 요약·설정
  /** GET /summaries (최근 7일) */
  getWeekSummary(): Promise<DaySummary[]>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  updateNames(input: { elder_display_name?: string; guardian_display_name?: string }): Promise<Family>;

  /** 모의 구현에서만 존재 */
  readonly dev?: DevTools;
}
