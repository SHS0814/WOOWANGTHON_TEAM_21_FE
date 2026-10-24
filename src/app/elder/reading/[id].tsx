import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { api, isApiError, type UploadResultKind } from '@/api';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { uuid } from '@/lib/uuid';
import { colors } from '@/theme';

/** 3.18: 60초가 넘으면 문구를 바꾼다 (R-010 9번) */
const SLOW_MS = 60_000;
/** 같은 건을 판독 중(409 reading_in_progress)이면 잠시 뒤 같은 client_upload_id 로 다시 보낸다 */
const RETRY_MS = 3_000;
const MAX_TRIES = 5;

const KIND: Record<UploadResultKind, string> = {
  recorded: 'done',
  retake: 'retake',
  remind_retake: 'remind',
  guardian_notified: 'handoff',
};

/** E6 판독 중. 행동 없음. 서버가 정한 result 로 E7 화면을 고른다 */
export default function Reading() {
  const { id, uri, taken_at } = useLocalSearchParams<{ id: string; uri?: string; taken_at?: string }>();
  const started = useRef(false);
  const uploadId = useRef(uuid());
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const photo = { uri: uri || null, taken_at: taken_at || new Date().toISOString() };
    const send = async (tries: number): Promise<void> => {
      try {
        const res = await api.uploadDosePhoto(id, photo, uploadId.current);
        router.replace({
          pathname: '/elder/result/[id]',
          params: {
            id,
            kind: KIND[res.result] ?? 'handoff',
            tod: res.dose_event.slot.time_of_day,
            mock: res.is_mock ? '1' : '',
            sim: res.dose_event.is_simulated ? '1' : '',
          },
        });
      } catch (e) {
        if (isApiError(e, 'reading_in_progress') && tries < MAX_TRIES) {
          await new Promise((r) => setTimeout(r, RETRY_MS));
          return send(tries + 1);
        }
        // 5장: 사진을 받을 수 없는 상태면 홈으로 (오늘 상태를 다시 읽는다)
        if (isApiError(e, 'event_not_open') || isApiError(e, 'not_found')) return router.dismissTo('/elder');
        router.replace({ pathname: '/elder/result/[id]', params: { id, kind: 'error' } });
      }
    };
    void send(0);
  }, [id, uri, taken_at]);

  return (
    <Screen center>
      <ActivityIndicator size="large" color={colors.primary} />
      <T variant="elderTitle" style={{ textAlign: 'center' }}>
        {slow ? '확인이 오래 걸려요' : '확인하고 있어요'}
      </T>
    </Screen>
  );
}
