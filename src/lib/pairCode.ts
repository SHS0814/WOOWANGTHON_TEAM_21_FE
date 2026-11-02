/** QR·초대 링크 값 woowang://pair?code=... 에서 code 를 꺼낸다 (api.md 3.3 qr_payload) */
export function codeFromPayload(data: string): string | null {
  const m = /[?&]code=([^&\s]+)/.exec(data);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    // 잘못된 % 표기: 입력 도중일 수 있으니 그대로 둔다 (서버가 code_invalid 로 답한다)
    return m[1];
  }
}

/** 입력칸의 초대 코드. 코드만 넣어도, 공유받은 링크째 붙여넣어도 된다 */
export function normalizeInviteCode(input: string): string {
  return codeFromPayload(input) ?? input.replace(/\s/g, '');
}

/** 6자리 숫자는 어르신 폰 연결용 예비 코드다. 보호자 초대 코드에는 없다 (api.md 3.3) */
export function isElderShortCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
