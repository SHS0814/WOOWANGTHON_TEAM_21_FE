// api.md 1.5 오류 형식과 5장 오류 코드.
// message 는 개발용이라 화면에 띄우지 않는다. 화면 문구는 아래 템플릿이나 각 화면이 정한다.

export type ErrorCode =
  | 'code_invalid'
  | 'unauthorized'
  | 'token_revoked'
  | 'forbidden_role'
  | 'consent_required'
  | 'signature_invalid'
  | 'signature_expired'
  | 'not_found'
  | 'pillbox_required'
  | 'last_guardian'
  | 'event_not_open'
  | 'event_already_started'
  | 'reading_in_progress'
  | 'handoff_already_resolved'
  | 'refill_not_latest'
  | 'code_expired'
  | 'code_used'
  | 'photo_expired'
  | 'photo_too_large'
  | 'unsupported_media'
  | 'validation_error'
  | 'consent_incomplete'
  | 'verdict_not_allowed'
  | 'rate_limited'
  | 'daily_reading_limit'
  | 'reading_failed'
  | 'internal_error'
  /** 앱 쪽 오류: 서버에 닿지 못함 */
  | 'network_error'
  /** 앱 쪽 오류: 올릴 사진이 없음 */
  | 'no_photo';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(e: unknown, code?: ErrorCode): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}

/** 보호자 화면에 보여줄 오류 문구. 어르신 화면은 이 문구를 쓰지 않는다 */
const GUARDIAN_MESSAGES: Partial<Record<ErrorCode, string>> = {
  code_invalid: '코드를 찾을 수 없어요. 다시 확인해 주세요.',
  code_expired: '코드가 만료됐어요. 보호자 폰에서 새 코드를 받아 주세요.',
  code_used: '이미 쓴 코드예요. 보호자 폰에서 새 코드를 받아 주세요.',
  last_guardian: '마지막 보호자는 해제할 수 없어요.',
  handoff_already_resolved: '다른 보호자가 먼저 판정했어요.',
  photo_too_large: '사진이 너무 커요. 다시 찍어 주세요.',
  unsupported_media: '사진 형식을 읽을 수 없어요.',
  daily_reading_limit: '오늘 판독 횟수를 다 썼어요. 내일 다시 해 주세요.',
  reading_failed: 'AI가 사진을 읽지 못했어요. 다시 찍어 주세요.',
  rate_limited: '요청이 많아요. 잠시 뒤에 다시 해 주세요.',
  pillbox_required: '약통을 먼저 등록해 주세요.',
  network_error: '서버에 연결하지 못했어요.',
  photo_expired: '보관 기간이 지난 사진이에요.',
  event_already_started: '이 시간의 약은 이미 진행 중이에요.',
  validation_error: '입력한 값을 확인해 주세요.',
  no_photo: '사진을 찍지 못했어요. 다시 찍어 주세요.',
};

export function guardianMessage(e: unknown): string {
  if (e instanceof ApiError) return GUARDIAN_MESSAGES[e.code as ErrorCode] ?? '문제가 생겼어요. 다시 해 주세요.';
  return '문제가 생겼어요. 다시 해 주세요.';
}
