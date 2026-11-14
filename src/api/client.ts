// 데이터 접근 인터페이스. 실제 서버 구현(http.ts)과 모의 구현(mock.ts)이 같은 모양을 따른다.
// 메서드 하나가 api.md 3장 엔드포인트 하나에 대응한다. 주석의 번호는 계약서 절 번호.
import type {
  ConsentRequest,
  CreateFamilyRequest,
  CreateFamilyResponse,
  DetectResponse,
  Device,
  DoseEvent,
  DoseEventQuery,
  Handoff,
  HandoffListItem,
  Health,
  Layout,
  LocalPhoto,
  Me,
  MockScenario,
  MockScenarioResponse,
  NotificationStatus,
  NotificationStatusReport,
  PairingCode,
  PairRequest,
  PairResponse,
  Photo,
  Pillbox,
  PillboxCurrent,
  Refill,
  Schedule,
  Settings,
  SlotInput,
  Summary,
  SummaryPeriod,
  TodayResponse,
  UploadResponse,
  Verdict,
} from './types';

/** 모의 구현에서만 있는 개발 도구. http 구현에서는 undefined */
export interface MockDevTools {
  /** 한 기기에서 두 역할을 확인하려고, 모의 서버가 지금 어느 역할로 응답할지 정한다 */
  setActingRole(role: 'elder' | 'guardian' | null): void;
  /** 열린 복약 건의 시간을 한 단계 흘려보낸다 (재질문 → 무응답 인계, 재촬영 대기 → 인계) */
  advanceTime(): Promise<DoseEvent | null>;
  /** 오늘 복약 건만 다시 만든다. 가족·약통·일정·설정은 유지 */
  resetToday(): Promise<void>;
  /** 어제 날짜의 끝나지 않은 복약 건(carried_over)을 하나 만든다. 자정을 기다리지 않고 Q-007 화면을 보려고 */
  addCarriedOver(): Promise<DoseEvent | null>;
}

export interface Api {
  /** 'mock' 이면 모의 서버. 화면에 모의 표시를 띄운다 */
  readonly mode: 'mock' | 'http';
  /** 데이터가 바뀌면 호출된다 (모의 구현 내부 변경, 쓰기 요청 성공). 반환값은 구독 해제 함수 */
  subscribe(listener: () => void): () => void;
  /** 토큰이 무효가 되면(401 unauthorized / token_revoked) 호출된다. 저장된 토큰은 이미 지워진 상태 */
  onAuthLost(listener: () => void): () => void;

  hasToken(): Promise<boolean>;
  /** 이 기기의 토큰만 지운다 (서버 요청 없음) */
  forgetToken(): Promise<void>;

  /** 3.1 */ health(): Promise<Health>;
  /** 3.2 성공하면 토큰을 저장한다 */ createFamily(req: CreateFamilyRequest): Promise<CreateFamilyResponse>;
  /** 3.3 */ createPairingCode(kind: 'elder' | 'guardian'): Promise<PairingCode>;
  /** 3.4 성공하면 토큰을 저장한다 */ pair(req: PairRequest): Promise<PairResponse>;
  /** 3.5 */ consent(req: ConsentRequest): Promise<{ consent_at: string }>;
  /** 3.6 */ me(): Promise<Me>;
  /** 3.7 */ devices(): Promise<Device[]>;
  /** 3.8 내 기기를 해제하면 토큰도 지운다 */ deleteDevice(id: string): Promise<void>;
  /** 3.9 */ putPushToken(pushToken: string | null): Promise<void>;
  /** 3.29 알림 준비 상태 보고 */ putNotificationStatus(report: NotificationStatusReport): Promise<NotificationStatus>;
  /** 3.10 */ detectPillbox(photo: LocalPhoto): Promise<DetectResponse>;
  /** 3.11 */ createPillbox(req: { photo_id: string; layout: Layout }): Promise<{ pillbox: Pillbox; refill: Refill }>;
  /** 3.12 약통이 없으면 ApiError(404, pillbox_required) */ currentPillbox(): Promise<PillboxCurrent>;
  /** 3.13 */ schedule(): Promise<Schedule>;
  /** 3.14 */ putSchedule(slots: SlotInput[]): Promise<Schedule>;
  /** 3.15 */ createRefill(photo: LocalPhoto): Promise<Refill>;
  /** 3.16 */ updateBaseline(refillId: string, cells: { cell_id: string; state: 'full' | 'empty' }[]): Promise<Refill>;
  /** 3.17 */ today(): Promise<TodayResponse>;
  /** 3.18 판독이 끝날 때까지 기다린다 */
  uploadDosePhoto(eventId: string, photo: LocalPhoto, clientUploadId: string): Promise<UploadResponse>;
  /** 3.19 기간 31일, 검색(filter·reason)이면 366일까지 (R-051) */ doseEvents(from: string, to: string, query?: DoseEventQuery): Promise<DoseEvent[]>;
  /** 3.20 */ handoffs(status?: 'open' | 'closed' | 'all'): Promise<HandoffListItem[]>;
  /** 3.21 */ handoff(id: string): Promise<Handoff>;
  /** 3.22 */ verdict(handoffId: string, verdict: Verdict): Promise<Handoff>;
  /** 3.23 */ photo(id: string): Promise<Photo>;
  /** 3.25 하루 요약 366일까지, total 은 전체 합계 한 항목 (R-051) */ summaries(period: SummaryPeriod, from?: string, to?: string): Promise<Summary[]>;
  /** 3.26 */ settings(): Promise<Settings>;
  /** 3.26 */ putSettings(patch: Partial<Settings>): Promise<Settings>;
  /** 3.27 시연 트리거. 데모 가족이 아니면 ApiError(404, not_found) */ simulateDose(slotId: string): Promise<DoseEvent>;
  /**
   * 시연 초기화 (POST /dev/reset). 이 데모 가족의 복약 기록·인계·복약 사진을 모두 지워 시연을 처음부터 다시 할 수 있게 한다.
   * 연결·약통·일정·설정은 남는다. 데모 가족이 아니면 ApiError(404, not_found)
   */
  resetDemo(): Promise<void>;
  /** 3.28 다음 복약 사진 1장의 모의 판독 결과. 데모 가족·mock 판독기가 아니면 ApiError(404, not_found) */
  setMockScenario(scenario: MockScenario | null): Promise<MockScenarioResponse>;

  readonly dev?: MockDevTools;
}
