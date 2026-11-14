import type { DoseEvent } from '@/api';
import { BigButton } from '@/components/BigButton';
import { ExitButton } from '@/components/ExitButton';
import { SimulationTag } from '@/components/MockBanner';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { doseName } from '@/lib/doseLabel';

/** E4 복약 시간 질문 화면. 주 행동은 [사진 찍기] 하나, 맨 위에 작은 [나가기]. 질문 화면(ask/[id])과 어르신 홈(R-022)이 같이 쓴다 */
export function AskView({ ev, elderName, onTakePhoto }: { ev: DoseEvent; elderName: string; onTakePhoto: () => void }) {
  const name = doseName(ev);
  // ask_times = [복약 시각, 재질문1, 재질문2] (3.17). 재질문 시각이 지났으면 "다시 여쭤봐요"
  const reasked = ev.ask_times.slice(1).some((t) => Date.now() >= new Date(t).getTime());

  return (
    // 나가기: 지금 못 찍을 때 앱을 닫는다. 건은 열린 채로 남아 재질문이 오고, 끝내 응답이 없으면 보호자에게 넘어간다
    <Screen center header={<ExitButton />} footer={<BigButton label="사진 찍기" onPress={onTakePhoto} />}>
      {ev.is_simulated ? <SimulationTag /> : null}
      {ev.carried_over ? (
        // 전날 건: 시간이 지났으므로 "드실 시간이에요", "드시고" 같은 말은 하지 않는다 (원칙 6, R-007 C3)
        <>
          <T variant="elderTitle">
            {elderName}, {name} 약이에요.
          </T>
          <T variant="elderBody">약통 사진 한 장 찍어주실래요?</T>
        </>
      ) : (
        <>
          {reasked ? <T variant="elderBody">다시 여쭤봐요.</T> : null}
          <T variant="elderTitle">
            {elderName}, {name} 약 드실 시간이에요.
          </T>
          <T variant="elderBody">드시고 약통 사진 한 장 찍어주실래요?</T>
        </>
      )}
    </Screen>
  );
}
