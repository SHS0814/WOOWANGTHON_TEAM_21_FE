import { Children, type ReactNode } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

import { colors, font } from '@/theme';

type Variant = 'elderBody' | 'elderTitle' | 'elderHuge' | 'body' | 'title' | 'small';

/** 글자 사이에 넣으면 그 자리에서 줄이 바뀌지 않는다 (보이지 않는 문자, U+2060) */
const WJ = '\u2060';

/**
 * 한글은 글자 사이 어디서나 줄이 바뀔 수 있어서, 큰 글씨에서는 "찍어주세 / 요."처럼 한 글자만 다음 줄로 떨어진다.
 * 띄어쓰기에서만 줄이 바뀌게 어절 안의 글자를 서로 붙인다. 화면 폭보다 긴 어절(12자 넘음)은 그대로 둔다
 */
export function keepWords(text: string): string {
  return text
    .split(/(\s+)/)
    .map((w) => (/\s/.test(w) || [...w].length > 12 ? w : [...w].join(WJ)))
    .join('');
}

/** 글자만으로 된 내용이면 하나의 문자열로 합친다 ("민수" + "님이" 사이에서도 끊기지 않게). 아니면 null */
function plainText(children: ReactNode): string | null {
  const parts = Children.toArray(children);
  if (!parts.length || !parts.every((c) => typeof c === 'string' || typeof c === 'number')) return null;
  return parts.join('');
}

export function T({ variant = 'body', style, children, ...rest }: TextProps & { variant?: Variant }) {
  const size = font[variant];
  const bold = variant === 'elderTitle' || variant === 'elderHuge' || variant === 'title';
  // 어르신 화면의 큰 글씨만 처리한다
  const text = variant.startsWith('elder') ? plainText(children) : null;
  return (
    <RNText
      // 화면 읽기 기능에는 원래 글자를 준다
      accessibilityLabel={text ?? undefined}
      {...rest}
      style={[{ fontSize: size, lineHeight: Math.round(size * 1.35), color: colors.text, fontWeight: bold ? '700' : '400' }, style]}
    >
      {text === null ? children : keepWords(text)}
    </RNText>
  );
}
