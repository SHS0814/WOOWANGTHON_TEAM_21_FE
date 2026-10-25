import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { guardianName, useMe } from '@/lib/useMe';
import { needsExactAlarmPermission } from '@/notify/exactAlarm';
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
      // Android 정확한 알람 권한이 없으면 안내 화면을 한 번 거친다 (R-025 1번)
      router.replace((await needsExactAlarmPermission()) ? '/elder/alarm-permission' : '/elder');
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
