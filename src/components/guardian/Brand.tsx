import { Image, View } from 'react-native';

import { GText } from '@/components/guardian/ui';
import { guardian } from '@/theme';

const APP_ICON = require('../../../assets/icon.png');

/** 앱 표시 "약, 드셨나요?" (처음 화면, 역할 선택, 보호자 연결). 홈 화면 아이콘과 같은 그림을 쓴다 */
export function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={APP_ICON}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      accessibilityIgnoresInvertColors
    />
  );
}

export function Brand({ tagline }: { tagline?: string }) {
  return (
    <View style={{ gap: 14 }}>
      <BrandMark />
      <View style={{ gap: 6 }}>
        <GText variant="display" accessibilityRole="header">
          약, 드셨나요?
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
