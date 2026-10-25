import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';

import { api, isApiError, type Photo } from '@/api';
import { colors } from '@/theme';

/**
 * 서명 URL 사진 (2.3). 만료됐거나 서명 오류로 못 읽으면 GET /photos/{id} 로 한 번 새로 받는다 (5장).
 * 보관 기간이 지난 사진은 그렇게 표시한다.
 */
export function RemotePhoto({
  photo,
  style,
  label,
  size = 'guardian',
}: {
  photo: Photo;
  style?: StyleProp<ImageStyle>;
  label?: string;
  /** 어르신 화면이면 안내 글씨를 28pt 로 (R-021 Q-003) */
  size?: 'elder' | 'guardian';
}) {
  const [p, setP] = useState(photo);
  const [state, setState] = useState<'ok' | 'expired' | 'failed'>('ok');
  const [retried, setRetried] = useState(false);

  useEffect(() => setP(photo), [photo]);

  const refresh = () => {
    if (retried) return setState('failed');
    setRetried(true);
    api.photo(photo.id).then(setP, (e) => setState(isApiError(e, 'photo_expired') ? 'expired' : 'failed'));
  };

  useEffect(() => {
    if (p.url && new Date(p.url_expires_at).getTime() < Date.now()) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  if (!p.url || state !== 'ok') {
    const text = !p.url ? '사진 없음 (모의 촬영)' : state === 'expired' ? '보관 기간이 지난 사진이에요' : '사진을 불러오지 못했어요';
    return (
      <View style={[style, styles.empty]}>
        <Text style={[styles.text, size === 'elder' && { fontSize: 28 }]}>{text}</Text>
      </View>
    );
  }
  return <Image source={{ uri: p.url }} style={style} resizeMode="cover" accessibilityLabel={label ?? '약통 사진'} onError={refresh} />;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDD' },
  text: { fontSize: 18, color: colors.text },
});
