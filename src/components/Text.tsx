import { Text as RNText, type TextProps } from 'react-native';

import { colors, font } from '@/theme';

type Variant = 'elderBody' | 'elderTitle' | 'elderHuge' | 'body' | 'title' | 'small';

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const size = font[variant];
  const bold = variant === 'elderTitle' || variant === 'elderHuge' || variant === 'title';
  return (
    <RNText
      {...rest}
      style={[{ fontSize: size, lineHeight: Math.round(size * 1.35), color: colors.text, fontWeight: bold ? '700' : '400' }, style]}
    />
  );
}
