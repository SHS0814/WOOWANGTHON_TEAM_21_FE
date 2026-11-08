import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { guardian } from '@/theme';

/**
 * 보호자 화면 아이콘 (T-FE14). 이미 들어 있는 react-native-svg 로 직접 그린다.
 * @expo/vector-icons 는 expo-font(네이티브 모듈)가 필요해 개발 빌드를 다시 설치해야 하므로 쓰지 않는다.
 * 24×24 격자, 선 굵기 2 의 단순한 선 아이콘이다
 */
export type IconName =
  | 'home'
  | 'records'
  | 'settings'
  | 'pill'
  | 'pillbox'
  | 'clock'
  | 'camera'
  | 'phone'
  | 'alert'
  | 'alertCircle'
  | 'check'
  | 'checkCircle'
  | 'x'
  | 'xCircle'
  | 'chevronRight'
  | 'bell'
  | 'user'
  | 'users'
  | 'link'
  | 'refresh'
  | 'calendar'
  | 'info'
  | 'help'
  | 'plus'
  | 'minus'
  | 'shield'
  | 'qr'
  | 'image'
  | 'smartphone'
  | 'ai'
  | 'dot';

const P = (d: string) => <Path d={d} />;

const SHAPES: Record<IconName, React.ReactNode> = {
  home: (
    <>
      {P('M3 10.5 12 3l9 7.5')}
      {P('M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5')}
    </>
  ),
  records: (
    <>
      <Rect x={5} y={4} width={14} height={17} rx={2} />
      {P('M9 2.5h6v3H9z')}
      {P('M9 11h6M9 15h4')}
    </>
  ),
  settings: (
    <>
      {P('M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1')}
      <Circle cx={15} cy={6} r={2} />
      <Circle cx={9} cy={12} r={2} />
      <Circle cx={17} cy={18} r={2} />
    </>
  ),
  pill: (
    <>
      {P('M10.5 20.5a5 5 0 0 1-7-7l9-9a5 5 0 0 1 7 7z')}
      {P('M8.5 8.5l7 7')}
    </>
  ),
  pillbox: (
    <>
      <Rect x={3} y={5} width={18} height={14} rx={2} />
      {P('M9 5v14M15 5v14M3 12h18')}
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={9} />
      {P('M12 7v5l3 2')}
    </>
  ),
  camera: (
    <>
      {P('M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z')}
      <Circle cx={12} cy={13.5} r={3.5} />
    </>
  ),
  phone: P('M5 3.5h3.2l1.8 4.7-2.4 1.6a11 11 0 0 0 6.6 6.6l1.6-2.4 4.7 1.8V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2z'),
  alert: (
    <>
      {P('M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z')}
      {P('M12 9.5v4.5M12 17.2v.1')}
    </>
  ),
  alertCircle: (
    <>
      <Circle cx={12} cy={12} r={9} />
      {P('M12 7.5v5.5M12 16.3v.1')}
    </>
  ),
  check: P('M5 12.5l4.5 4.5L19 7'),
  checkCircle: (
    <>
      <Circle cx={12} cy={12} r={9} />
      {P('M8 12.5l3 3 5-6')}
    </>
  ),
  x: P('M6 6l12 12M18 6 6 18'),
  xCircle: (
    <>
      <Circle cx={12} cy={12} r={9} />
      {P('M9 9l6 6M15 9l-6 6')}
    </>
  ),
  chevronRight: P('M9 5l7 7-7 7'),
  bell: (
    <>
      {P('M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z')}
      {P('M10 20.5a2 2 0 0 0 4 0')}
    </>
  ),
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      {P('M4 21a8 8 0 0 1 16 0')}
    </>
  ),
  users: (
    <>
      <Circle cx={9} cy={8} r={3.5} />
      {P('M2.5 20a6.5 6.5 0 0 1 13 0')}
      {P('M16 4.5a3.5 3.5 0 0 1 0 7')}
      {P('M18 14.2a6.5 6.5 0 0 1 3.5 5.8')}
    </>
  ),
  link: (
    <>
      {P('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1')}
      {P('M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')}
    </>
  ),
  refresh: (
    <>
      {P('M20 12a8 8 0 1 1-2.3-5.7')}
      {P('M20 4v5h-5')}
    </>
  ),
  calendar: (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2} />
      {P('M3 10h18M8 3v4M16 3v4')}
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={9} />
      {P('M12 11v5.5M12 7.8v.1')}
    </>
  ),
  help: (
    <>
      <Circle cx={12} cy={12} r={9} />
      {P('M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 16.8v.1')}
    </>
  ),
  plus: P('M12 5v14M5 12h14'),
  minus: P('M5 12h14'),
  shield: (
    <>
      {P('M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z')}
      {P('M8.5 12l2.5 2.5 4.5-5')}
    </>
  ),
  qr: (
    <>
      <Rect x={3} y={3} width={7} height={7} rx={1} />
      <Rect x={14} y={3} width={7} height={7} rx={1} />
      <Rect x={3} y={14} width={7} height={7} rx={1} />
      {P('M14 14h3v3h-3zM21 14v.1M14 21v.1M17.5 21H21v-3.5')}
    </>
  ),
  image: (
    <>
      <Rect x={3} y={4} width={18} height={16} rx={2} />
      <Circle cx={9} cy={10} r={2} />
      {P('M21 16l-5-5-9 9')}
    </>
  ),
  smartphone: (
    <>
      <Rect x={6} y={2.5} width={12} height={19} rx={2.5} />
      {P('M11 18h2')}
    </>
  ),
  ai: (
    <>
      <Rect x={5} y={5} width={14} height={14} rx={3} />
      {P('M9 2.5V5M15 2.5V5M9 19v2.5M15 19v2.5M2.5 9H5M2.5 15H5M19 9h2.5M19 15h2.5')}
      {P('M9.5 14.5l1.6-5h1.8l1.6 5M10.1 12.8h3.8')}
    </>
  ),
  dot: <Circle cx={12} cy={12} r={4} />,
};

export function Icon({
  name,
  size = 22,
  color = guardian.color.text,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'dot' ? color : 'none'}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[name]}
    </Svg>
  );
}
