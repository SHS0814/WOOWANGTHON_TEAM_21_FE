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

/** G1 가족 만들기에서 is_demo=true 로 만들지 (3.2). 서버가 DEMO_MODE 일 때만 받아 준다 */
export const CREATE_DEMO_FAMILY = process.env.EXPO_PUBLIC_CREATE_DEMO_FAMILY === 'true';

export type { Api, MockScenario } from './client';
export { ApiError, guardianMessage, isApiError } from './errors';
export * from './types';
