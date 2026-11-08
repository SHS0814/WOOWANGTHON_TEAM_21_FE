import { View } from 'react-native';

import { Icon } from '@/components/guardian/Icon';
import { GText } from '@/components/guardian/ui';
import { guardian } from '@/theme';

/** 앱 표시 "약 챙김" (처음 화면, 역할 선택, 보호자 연결) */
export function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: guardian.color.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="pill" size={size * 0.56} color={guardian.color.onPrimary} strokeWidth={2.2} />
    </View>
  );
}

export function Brand({ tagline }: { tagline?: string }) {
  return (
    <View style={{ gap: 14 }}>
      <BrandMark />
      <View style={{ gap: 6 }}>
        <GText variant="display" accessibilityRole="header">
          약 챙김
        </GText>
        {tagline ? (
          <GText variant="body" color={guardian.color.sub}>
            {tagline}
          </GText>
        ) : null}
      </View>
    </View>
  );
}
