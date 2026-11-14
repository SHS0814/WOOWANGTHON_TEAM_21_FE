import { View } from 'react-native';

import type { Layout, Reading } from '@/api';
import { PhotoWithBoxes } from '@/components/guardian/PhotoWithBoxes';
import { PillboxGrid } from '@/components/guardian/PillboxGrid';
import { GJudgeBadge, GText, Section } from '@/components/guardian/ui';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { spokenTime } from '@/lib/time';
import { guardian } from '@/theme';

const C = guardian.color;

/** 사진 한 장과 그 AI 판독 (사진 위 강조, 칸 격자). 인계 상세(G5)와 복약 기록 상세가 같이 쓴다 */
export function ReadingView({ reading, layout, title }: { reading: Reading; layout: Layout; title?: string }) {
  return (
    <Section>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <GText variant="bodyStrong">{title ?? '보내 주신 사진'}</GText>
          <GText variant="sub" color={C.sub}>
            {spokenTime(new Date(reading.photo.taken_at))} 촬영
          </GText>
        </View>
        <GJudgeBadge kind="ai" isMock={reading.is_mock} />
      </View>
      <PhotoWithBoxes reading={reading} aspect={pillboxAspect(layout)} />
      <PillboxGrid layout={layout} cells={reading.cells} targetCellId={reading.target_cell_id} />
    </Section>
  );
}
