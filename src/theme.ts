// 접근성 기준 (R-008): 어르신 화면 본문 최소 28pt, 버튼 높이 최소 72pt·가로 전체, 고대비.
// 상태는 색만으로 구분하지 않는다 → 항상 기호(✓ ✕ ?)와 글자를 함께 쓴다.
export const colors = {
  bg: '#FFFFFF',
  text: '#111111',
  subtle: '#3D3D3D',
  border: '#1F1F1F',
  primary: '#0B4FA8',
  primaryText: '#FFFFFF',
  secondaryBg: '#EEF2F7',
  attention: '#8A3B00',
  attentionBg: '#FFF1E0',
  mockBg: '#5B2A86',
  mockText: '#FFFFFF',
  simBg: '#1D1D1D',
  simText: '#FFE25C',
};

export const font = {
  /** 어르신 화면 본문 최소값 */
  elderBody: 28,
  elderTitle: 40,
  elderHuge: 56,
  /** 보호자 화면 */
  body: 22,
  title: 28,
  small: 18,
};

export const BUTTON_MIN_HEIGHT = 72;
export const GUTTER = 24;

/**
 * 보호자 화면·처음 설정 화면 전용 토큰 (R-047, T-FE14).
 * 위의 어르신 값(colors, font, BUTTON_MIN_HEIGHT, GUTTER)은 바꾸지 않는다. 보호자 화면만 이 블록을 쓴다.
 * 대비는 모두 WCAG AA(본문 4.5:1) 이상: text/bg 14.9, sub/bg 6.7, primary/흰 6.1, 상태 글자/상태 배경 5.3 이상
 */
export const guardian = {
  color: {
    /** 보호자 화면은 흰 바탕 한 면. 카드 대신 구분선(line)으로 나눈다 (T-FE15) */
    bg: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E1E6ED',
    line: '#DCE1E8',
    divider: '#EDF0F4',
    text: '#14202E',
    sub: '#4B5767',
    muted: '#5D6B7C',
    primary: '#1B5FBF',
    primaryPressed: '#164E9E',
    primarySoft: '#EAF1FB',
    primaryStrong: '#0F4C9C',
    onPrimary: '#FFFFFF',
    /** 상태 색. 색만으로 구분하지 않도록 항상 아이콘·기호와 글자를 함께 쓴다 */
    ok: '#11704F',
    okSoft: '#E5F4EC',
    warn: '#8F5200',
    warnSoft: '#FFF3DC',
    danger: '#B3261E',
    dangerSoft: '#FDECEA',
    neutral: '#4B5767',
    neutralSoft: '#EEF1F5',
    /** 모의·시뮬레이션 표시는 어르신 화면과 같은 색을 쓴다 (헌장 6장) */
    mock: colors.mockBg,
    onMock: colors.mockText,
  },
  /** 글자 단계. 보호자 본문은 16 이상 */
  type: {
    display: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
    title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
    section: { fontSize: 19, lineHeight: 26, fontWeight: '700' },
    body: { fontSize: 17, lineHeight: 25, fontWeight: '400' },
    bodyStrong: { fontSize: 17, lineHeight: 25, fontWeight: '700' },
    sub: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
    label: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
    stat: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  },
  radius: { card: 16, control: 12, chip: 999 },
  space: { gutter: 20, card: 16, gap: 12, section: 24 },
  /** 터치 영역 최소 높이 */
  touch: 48,
  buttonHeight: 54,
} as const;

export type GuardianTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info';
