import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { guardianName, useMe } from '@/lib/useMe';
import { askThenCheckSetup, needsAnySetup } from '@/notify/elderSetup';
import { fullScreenAvailable } from '@/notify/fullScreen';
import { reportNotificationStatus } from '@/notify/statusReport';
import { colors } from '@/theme';

/** E1 동의. 짝짓기 이후에 실제 보호자 이름으로 보여준다 (R-008 C1, C4, 원칙 8, api.md 3.5) */
export default function Consent() {
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!me) return null;

  const external = me.server.ai_external_transfer;
  const agree = async () => {
    setBusy(true);
    try {
      await api.consent({ agreed: true, consent_text_version: me.server.consent_text_version, ai_external_transfer_shown: external });
      // 알림 권한을 먼저 묻고, 알림이 거부됐거나 Android 정확한 알람 권한이 없으면 안내 화면을 한 번 거친다 (R-025 1번, R-028 N24)
      const needs = await askThenCheckSetup();
      // 권한 창에서 돌아온 직후 상태를 보고한다 (3.29, R-032)
      void reportNotificationStatus();
      // 화면에 띄울 수 있는 폰이면 먼저 알림 방식을 고른다 (고른 뒤 남은 권한 안내로 넘어간다)
      if (fullScreenAvailable) router.replace('/elder/ask-mode');
      else router.replace(needsAnySetup(needs) ? '/elder/alarm-permission' : '/elder');
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Screen scroll footer={<BigButton label="좋아요" onPress={agree} busy={busy} />}>
      <T variant="elderTitle">
        {guardianName(me)}님이 {me.family.elder_display_name} 약 드시는 걸 같이 챙기려고 해요.
      </T>
      <T variant="elderBody">약통 사진과 약 기록은 가족만 볼 수 있어요.</T>
      {external ? <T variant="elderTitle">사진은 약 칸 확인을 위해 AI 서비스로 보내져요.</T> : null}
      <T variant="elderBody">괜찮으세요?</T>
      {failed ? (
        <T variant="elderBody" style={{ color: colors.attention }}>
          잠시 뒤에 다시 눌러 주세요.
        </T>
      ) : null}
    </Screen>
  );
}
