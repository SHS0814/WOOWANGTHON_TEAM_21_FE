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
