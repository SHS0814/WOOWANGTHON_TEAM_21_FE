// 앱의 유일한 데이터 접근 지점. 환경 변수로 구현체를 고른다.
//   EXPO_PUBLIC_API_MODE=mock (기본) | http
//   EXPO_PUBLIC_API_BASE_URL=https://<터널 도메인>/api/v1   (http 일 때 필수)
import type { Api } from './client';
import { createHttpApi } from './http';
import { createMockApi } from './mock';

function create(): Api {
  const mode = process.env.EXPO_PUBLIC_API_MODE ?? 'mock';
  if (mode === 'http') {
    const base = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!base) throw new Error('EXPO_PUBLIC_API_MODE=http 이면 EXPO_PUBLIC_API_BASE_URL 이 필요해요');
    return createHttpApi(base);
  }
  return createMockApi();
}

export const api: Api = create();

/**
 * 시연용 빌드인지 (EXPO_PUBLIC_DEMO_BUILD=true). 배포용 빌드에는 시연 장치가 하나도 보이지 않는다.
 * 시연용 빌드는 한 폰에서 어르신·보호자를 오가고(연결 건너뛰기), 준비된 샘플 사진으로 바로 해 볼 수 있다
 */
export const DEMO_BUILD = process.env.EXPO_PUBLIC_DEMO_BUILD === 'true';

/** G1 가족 만들기에서 is_demo=true 로 만들지 (3.2). 서버가 DEMO_MODE 일 때만 받아 준다. 시연용 빌드는 항상 시연 가족 */
export const CREATE_DEMO_FAMILY = DEMO_BUILD || process.env.EXPO_PUBLIC_CREATE_DEMO_FAMILY === 'true';

export type { Api } from './client';
export { ApiError, guardianMessage, isApiError } from './errors';
export * from './types';
