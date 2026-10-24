// 앱의 유일한 데이터 접근 지점. 실제 서버가 생기면 여기서 구현체만 바꾼다.
import { createMockApi } from './mock';
import type { Api } from './client';

export const api: Api = createMockApi();

export type { Api, MockScenario, PairingCode } from './client';
export * from './types';
