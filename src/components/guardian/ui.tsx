// 보호자 화면·처음 설정 화면 전용 구성 요소 (R-047, T-FE14).
// 어르신 화면이 쓰는 공용 컴포넌트(Text, BigButton, Screen 등)는 건드리지 않고 여기서 새로 만든다.
import { Children, Fragment, isValidElement, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/guardian/Icon';
import { guardian, type GuardianTone } from '@/theme';

const C = guardian.color;

// ── 글자 ──────────────────────────────────────────────

type TypeName = keyof typeof guardian.type;

export function GText({ variant = 'body', color, style, ...rest }: TextProps & { variant?: TypeName; color?: string }) {
  return <Text {...rest} style={[guardian.type[variant] as TextStyle, { color: color ?? C.text }, style]} />;
}

// ── 화면 틀 ───────────────────────────────────────────

interface ScreenProps {
  children: ReactNode;
  /** 화면 맨 위 큰 제목 (탭 화면). 쌓인 화면은 머리줄 제목을 쓴다 */
  title?: string;
  /** 제목 위의 작은 줄 (예: 날짜) */
  eyebrow?: string;
  /** 하단 고정 행동 영역 */
  footer?: ReactNode;
  scroll?: boolean;
  center?: boolean;
  /** 하단 탭 안의 화면이면 탭이 아래 여백을 맡는다 */
  inTabs?: boolean;
  /** 한 화면에 담아야 하는 곳(홈): 구획 사이 여백을 줄인다 */
  dense?: boolean;
  /** 스크롤 영역 높이와 내용 높이를 알려준다 (홈이 넘치지 않게 줄이는 데 쓴다) */
  onMeasure?: (viewport: number, content: number) => void;
  /** 화면 맨 위로 올리는 등 스크롤을 직접 다룰 때 */
  scrollRef?: Ref<ScrollViewInstance>;
}

export function GScreen({ children, title, eyebrow, footer, scroll = true, center, inTabs, dense, onMeasure, scrollRef }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const measured = useRef({ viewport: 0, content: 0 });
  const measure = (k: 'viewport' | 'content', v: number) => {
    measured.current[k] = v;
    const m = measured.current;
    if (onMeasure && m.viewport && m.content) onMeasure(m.viewport, m.content);
  };
  const bottom = inTabs ? 0 : insets.bottom;
  const head =
    title || eyebrow ? (
      <View style={{ gap: 2, marginBottom: 4 }}>
        {eyebrow ? (
          <GText variant="label" color={C.sub}>
            {eyebrow}
          </GText>
        ) : null}
        {title ? (
          <GText variant="display" accessibilityRole="header">
            {title}
          </GText>
        ) : null}
      </View>
    ) : null;
  const content = [s.content, dense && { gap: 10, paddingTop: 10 }, center && s.center, !footer && { paddingBottom: 24 + bottom }];
  return (
    <View style={s.root}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          onLayout={onMeasure ? (e) => measure('viewport', e.nativeEvent.layout.height) : undefined}
          onContentSizeChange={onMeasure ? (_, h) => measure('content', h) : undefined}
        >
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[content, { flex: 1 }]}>
          {head}
          {children}
        </View>
      )}
      {footer ? <View style={[s.footer, { paddingBottom: 12 + bottom }]}>{footer}</View> : null}
    </View>
  );
}

// ── 구획 ──────────────────────────────────────────────
// 흰 바탕 한 면 위에서 상자 없이 섹션 제목과 얇은 구분선으로만 나눈다 (T-FE15).
// 구획(Section·ListGroup)은 아래에 구분선을 하나 긋고 끝난다. 그래서 구획이 이어져도 선이 겹치지 않는다

/** 내용 한 덩어리. 테두리·그림자·둥근 모서리 없이 아래 구분선으로만 나눈다 */
export function Section({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.section, style]}>{children}</View>;
}

/** 섹션 제목. 오른쪽에 개수나 링크를 붙일 수 있다 */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <GText variant="section" accessibilityRole="header" style={{ flex: 1 }}>
        {children}
      </GText>
      {right}
    </View>
  );
}

/** 행 사이와 마지막 행 아래에 얇은 구분선을 넣는다 */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[s.list, style]}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={s.divider} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

// ── 상태 색 ───────────────────────────────────────────

export const TONE: Record<GuardianTone, { fg: string; bg: string; icon: IconName }> = {
  ok: { fg: C.ok, bg: C.okSoft, icon: 'checkCircle' },
  warn: { fg: C.warn, bg: C.warnSoft, icon: 'alert' },
  danger: { fg: C.danger, bg: C.dangerSoft, icon: 'alertCircle' },
  neutral: { fg: C.neutral, bg: C.neutralSoft, icon: 'clock' },
  info: { fg: C.primaryStrong, bg: C.primarySoft, icon: 'info' },
};

/** 동그란 바탕 위 아이콘 */
export function IconBubble({ name, tone = 'info', size = 40 }: { name: IconName; tone?: GuardianTone; size?: number }) {
  return (
    <View style={[s.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: TONE[tone].bg }]}>
      <Icon name={name} size={Math.round(size * 0.55)} color={TONE[tone].fg} />
    </View>
  );
}

/** 상태 칩. 색만으로 구분하지 않도록 아이콘과 글자를 함께 쓴다 */
export function StatusChip({ tone, label, icon }: { tone: GuardianTone; label: string; icon?: IconName }) {
  const t = TONE[tone];
  return (
    <View style={[s.chip, { backgroundColor: t.bg }]} accessible accessibilityLabel={label}>
      <Icon name={icon ?? t.icon} size={16} color={t.fg} strokeWidth={2.4} />
      <Text style={[s.chipText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** 안내·경고. 상자 대신 왼쪽 색 막대 + 아이콘 + 글자로 보인다 (색만으로 구분하지 않는다) */
export function Notice({
  tone,
  title,
  children,
  icon,
  onPress,
  accessibilityLabel,
}: {
  tone: GuardianTone;
  title?: string;
  children?: ReactNode;
  icon?: IconName;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const t = TONE[tone];
  const body = (
    <>
      <View style={{ paddingTop: 2 }}>
        <Icon name={icon ?? t.icon} size={22} color={t.fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <GText variant="bodyStrong" color={t.fg === C.primaryStrong ? C.text : t.fg}>
            {title}
          </GText>
        ) : null}
        {typeof children === 'string' ? <GText variant="sub">{children}</GText> : children}
      </View>
      {onPress ? <Icon name="chevronRight" size={20} color={C.sub} /> : null}
    </>
  );
  const style = [s.notice, { borderLeftColor: t.fg }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [style, pressed && s.pressed]}>
      {body}
    </Pressable>
  );
}

// ── 버튼 ──────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function GButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconColor,
  disabled,
  busy,
  accessibilityLabel,
  accessibilityHint,
  compact,
  selected,
  stacked,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  /** 아이콘만 다른 색으로 (예: 판정 버튼의 ✓ 초록, ✕ 빨강) */
  iconColor?: string;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** 줄 안에 들어가는 작은 버튼 (높이 48) */
  compact?: boolean;
  /** 고르는 버튼에서 고른 상태 */
  selected?: boolean;
  /** 아이콘을 글자 위에 둔다 (버튼 여럿을 한 줄에 둘 때) */
  stacked?: boolean;
}) {
  const v = BUTTON[variant];
  const off = disabled || busy;
  const fg = disabled ? C.sub : v.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!busy, ...(selected !== undefined ? { selected } : {}) }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { minHeight: compact ? guardian.touch : guardian.buttonHeight, backgroundColor: v.bg, borderColor: v.border },
        compact && { paddingHorizontal: 14 },
        stacked && { flexDirection: 'column', gap: 4, paddingHorizontal: 8, minHeight: 72 },
        selected && { backgroundColor: C.primarySoft, borderColor: C.primary, borderWidth: 2 },
        disabled && s.btnDisabled,
        pressed && { backgroundColor: v.pressed },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={stacked ? 24 : compact ? 18 : 20} color={disabled ? C.sub : (iconColor ?? fg)} strokeWidth={2.4} /> : null}
          <Text style={[s.btnText, compact && { fontSize: 16 }, { color: fg }]} numberOfLines={2}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const BUTTON: Record<ButtonVariant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: C.primary, fg: C.onPrimary, border: C.primary, pressed: C.primaryPressed },
  secondary: { bg: C.card, fg: C.text, border: '#C5CEDA', pressed: C.neutralSoft },
  ghost: { bg: 'transparent', fg: C.primaryStrong, border: 'transparent', pressed: C.primarySoft },
  danger: { bg: C.card, fg: C.danger, border: '#E8B4AF', pressed: C.dangerSoft },
};

// ── 목록 행 ───────────────────────────────────────────

export function ListRow({
  icon,
  iconTone = 'info',
  title,
  titleColor,
  subtitle,
  right,
  onPress,
  chevron = !!onPress,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  children,
  dense,
}: {
  icon?: IconName;
  iconTone?: GuardianTone;
  title: string;
  /** 제목 글자 색 (예: 확인할 일은 빨간 글자) */
  titleColor?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'radio';
  accessibilityState?: { selected?: boolean; checked?: boolean };
  /** 행 아래에 붙는 내용 (예: 칩, 경고) */
  children?: ReactNode;
  /** 한 화면에 담아야 하는 곳(홈)의 낮은 행. 터치 높이는 48 이상 유지 */
  dense?: boolean;
}) {
  const inner = (
    <>
      {icon ? <IconBubble name={icon} tone={iconTone} size={dense ? 36 : 40} /> : null}
      <View style={{ flex: 1, gap: dense ? 0 : 2 }}>
        <GText variant="bodyStrong" color={titleColor}>
          {title}
        </GText>
        {typeof subtitle === 'string' ? (
          <GText variant="sub" color={C.sub}>
            {subtitle}
          </GText>
        ) : (
          subtitle
        )}
        {children}
      </View>
      {right}
      {chevron ? <Icon name="chevronRight" size={20} color={C.muted} /> : null}
    </>
  );
  const rowStyle = [s.row, dense && s.rowDense];
  if (!onPress) return <View style={rowStyle}>{inner}</View>;
  return (
    <Pressable
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: C.neutralSoft }]}
    >
      {inner}
    </Pressable>
  );
}

/** 여럿 중 하나를 고르는 행 */
export function RadioRow({ selected, title, detail, onPress }: { selected: boolean; title: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: C.neutralSoft }]}
    >
      <View style={[s.radio, selected && s.radioOn]}>{selected ? <View style={s.radioDot} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <GText variant={selected ? 'bodyStrong' : 'body'}>{title}</GText>
        {detail ? (
          <GText variant="sub" color={C.sub}>
            {detail}
          </GText>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={20} color={C.primary} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}

/** 여럿 중 하나를 고르는 알약 모양 버튼 줄 (기간·필터). 고른 것은 채움 + ✓ 로 표시한다 */
export function ChoiceChips<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  /** 화면 읽기용 묶음 이름 */
  label: string;
}) {
  return (
    <View style={s.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.key)}
            style={({ pressed }) => [s.choice, on && s.choiceOn, pressed && !on && { backgroundColor: C.neutralSoft }]}
          >
            {on ? <Icon name="check" size={16} color={C.onPrimary} strokeWidth={2.8} /> : null}
            <Text style={[s.choiceText, on && { color: C.onPrimary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── 입력 ──────────────────────────────────────────────

export function GField({
  label,
  value,
  onChangeText,
  placeholder,
  verbatim,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  /** 코드처럼 대소문자를 구분하는 값: 자동 대문자·자동 고침을 끈다 */
  verbatim?: boolean;
  hint?: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <GText variant="label">{label}</GText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        accessibilityLabel={label}
        accessibilityHint={hint}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[s.input, focus && s.inputFocus]}
        {...(verbatim ? { autoCapitalize: 'none' as const, autoCorrect: false, spellCheck: false } : {})}
      />
      {hint ? (
        <GText variant="sub" color={C.sub}>
          {hint}
        </GText>
      ) : null}
    </View>
  );
}

// ── AI·모의 표시 ──────────────────────────────────────

/**
 * 판독 결과 옆 표시 (원칙 1, 헌장 6장). 누가 판단했는지와, 모의 판독이면 "모의 결과"를 함께 보인다.
 * 모의 표시는 어르신 화면과 같은 보라색 바탕 흰 글자로 눈에 띄게 둔다
 */
export function GJudgeBadge({ kind, isMock, guardianName }: { kind: 'ai' | 'guardian'; isMock?: boolean; guardianName?: string }) {
  return (
    <View style={s.badgeRow}>
      <View style={[s.chip, { backgroundColor: kind === 'ai' ? C.primarySoft : C.neutralSoft }]}>
        <Icon name={kind === 'ai' ? 'ai' : 'user'} size={16} color={kind === 'ai' ? C.primaryStrong : C.neutral} strokeWidth={2.2} />
        <Text style={[s.chipText, { color: kind === 'ai' ? C.primaryStrong : C.neutral }]}>
          {kind === 'ai' ? 'AI 판독' : `${guardianName ?? '보호자'} 판정`}
        </Text>
      </View>
      {kind === 'ai' && isMock ? <MockTag label="모의 결과" a11y="모의 결과, 실제 AI 아님" /> : null}
    </View>
  );
}

/** 모의·시뮬레이션 데이터 표시 (보라 바탕 흰 글자) */
export function MockTag({ label, a11y }: { label: string; a11y?: string }) {
  return (
    <View style={[s.chip, { backgroundColor: C.mock }]} accessible accessibilityLabel={a11y ?? label}>
      <Icon name="info" size={16} color={C.onMock} strokeWidth={2.4} />
      <Text style={[s.chipText, { color: C.onMock }]}>{label}</Text>
    </View>
  );
}

/** 큰 숫자 + 설명 */
export function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <GText variant="stat">{value}</GText>
        {unit ? (
          <GText variant="bodyStrong" color={C.sub}>
            {unit}
          </GText>
        ) : null}
      </View>
      <GText variant="sub" color={C.sub}>
        {label}
      </GText>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <View style={s.errorRow} accessibilityRole="alert">
      <Icon name="alertCircle" size={20} color={C.danger} />
      <GText variant="body" color={C.danger} style={{ flex: 1 }}>
        {children}
      </GText>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: guardian.space.gutter, paddingTop: 16, gap: 16, flexGrow: 1 },
  center: { justifyContent: 'center' },
  footer: {
    paddingHorizontal: guardian.space.gutter,
    paddingTop: 12,
    gap: 10,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  section: { gap: 12, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  list: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line, marginTop: -8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: -4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  bubble: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: guardian.radius.chip,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chipText: { fontSize: 16, lineHeight: 21, fontWeight: '700', flexShrink: 1 },
  notice: { flexDirection: 'row', gap: 12, paddingVertical: 4, paddingLeft: 12, borderLeftWidth: 3, alignItems: 'flex-start' },
  pressed: { opacity: 0.75 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: guardian.radius.control,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: 'stretch',
  },
  btnDisabled: { backgroundColor: '#DDE3EA', borderColor: '#DDE3EA' },
  btnText: { fontSize: 17, lineHeight: 23, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, marginHorizontal: -8, paddingVertical: 14, minHeight: 64 },
  rowDense: { paddingVertical: 8, minHeight: 52 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: guardian.radius.chip,
    borderWidth: 1.5,
    borderColor: '#C5CEDA',
    backgroundColor: C.card,
  },
  choiceOn: { backgroundColor: C.primary, borderColor: C.primary },
  choiceText: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: C.text },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#8C99A8', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.primary },
  input: {
    borderWidth: 1.5,
    borderColor: '#C5CEDA',
    borderRadius: guardian.radius.control,
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    minHeight: 52,
    backgroundColor: C.card,
  },
  inputFocus: { borderColor: C.primary, borderWidth: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  errorRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
