// 모의 구현의 시드 데이터. 실제 앱에서는 보호자가 G1·G2·G3 에서 입력한 값이 쓰인다.
// 화면 코드는 이 값을 직접 쓰지 않는다 (호칭 하드코딩 금지). 모의 API 를 거쳐서만 나온다.
import type { TimeOfDay } from './types';

export const MOCK_SEED = {
  family: { elder_display_name: '어머니', guardian_display_name: '민수' },
  pillbox: {
    row_labels: ['아침', '저녁'],
    col_labels: ['월', '화', '수', '목', '금', '토', '일'],
  },
  dose_times: { morning: '08:00', noon: '12:30', evening: '19:00', bedtime: '21:30' } as Record<TimeOfDay, string>,
};
