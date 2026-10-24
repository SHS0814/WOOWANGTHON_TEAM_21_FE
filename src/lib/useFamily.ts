import { api } from '@/api';
import { useApiData } from '@/lib/useApiData';

/** 호칭은 보호자가 입력한 값만 쓴다 (하드코딩 금지) */
export function useFamily() {
  return useApiData(() => api.getFamily()).data;
}
