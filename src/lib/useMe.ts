import { api, type Me } from '@/api';
import { useApiData } from '@/lib/useApiData';

/** GET /me (3.6). 호칭·서버 설정·모의 여부의 출처. 호칭은 이 값만 쓴다 (하드코딩 금지) */
export function useMe() {
  return useApiData(() => api.me());
}

/** 어르신 화면에 보일 보호자 이름. 보호자가 여럿이면 첫 번째 (3.6) */
export function guardianName(me: Me | undefined): string {
  return me?.family.guardians[0]?.display_name ?? '보호자';
}
