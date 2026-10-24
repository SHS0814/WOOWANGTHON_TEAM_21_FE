import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';

/** E1 동의. 짝짓기 이후에 실제 보호자 이름으로 보여준다 (R-008 C1, C4, 원칙 8) */
export default function Consent() {
  const family = useFamily();
  const { data: config } = useApiData(() => api.getConfig());
  const [busy, setBusy] = useState(false);
  if (!family || !config) return null;

  const agree = async () => {
    setBusy(true);
    await api.consent();
    router.replace('/elder');
  };

  return (
    <Screen scroll footer={<BigButton label="좋아요" onPress={agree} busy={busy} />}>
      <T variant="elderTitle">
        {family.guardian_display_name}님이 {family.elder_display_name} 약 드시는 걸 같이 챙기려고 해요.
      </T>
      <T variant="elderBody">약통 사진과 약 기록은 가족만 볼 수 있어요.</T>
      {config.photo_sent_to_external_ai ? <T variant="elderTitle">사진은 약 칸 확인을 위해 AI 서비스로 보내져요.</T> : null}
      <T variant="elderBody">괜찮으세요?</T>
    </Screen>
  );
}
