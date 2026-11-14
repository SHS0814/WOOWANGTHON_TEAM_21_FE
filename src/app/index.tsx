import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { BrandMark } from '@/components/guardian/Brand';
import { useRole } from '@/lib/role';
import { colors } from '@/theme';

export default function Index() {
  const { role, loading } = useRole();
  // 저장된 역할을 읽는 짧은 순간. 빈 화면 대신 앱 표시만 둔다 (바탕은 어르신 화면과 같은 흰색이라 넘어갈 때 깜빡이지 않는다)
  if (loading)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }} accessibilityLabel="약, 드셨나요?">
        <BrandMark size={72} />
      </View>
    );
  if (role === 'elder') return <Redirect href="/elder" />;
  if (role === 'guardian') return <Redirect href="/guardian" />;
  return <Redirect href="/role" />;
}
