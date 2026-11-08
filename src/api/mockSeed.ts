// 모의 구현의 시드 데이터. 실제 앱에서는 보호자가 G1·G2·G3 에서 입력한 값이 쓰인다.
// 화면 코드는 이 값을 직접 쓰지 않는다 (호칭 하드코딩 금지). 모의 API 를 거쳐서만 나온다.
import type { TimeOfDay } from './types';

export const MOCK_SEED = {
  family: { elder_display_name: '어머니', guardian_display_name: '민수' },
  // 시연 약통 (R-054): 아침·점심·저녁 3칸 하루 약통 (요일 칸 없음). 칸마다 월~일 매일 쓰고 드신 뒤 다시 채운다.
  // 일주일 약통으로 보려면 row_labels: ['아침', '저녁'], col_labels: ['월', '화', '수', '목', '금', '토', '일']
  pillbox: {
    row_labels: ['하루'],
    col_labels: ['아침', '점심', '저녁'],
  },
  dose_times: { morning: '08:00', noon: '12:30', evening: '19:00', bedtime: '21:30' } as Record<TimeOfDay, string>,
};
