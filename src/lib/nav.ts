import { router, type Href } from 'expo-router';

/** 뒤로 갈 화면이 없으면(주소로 바로 열었을 때) 지정한 화면으로 간다 */
export function goBackOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
