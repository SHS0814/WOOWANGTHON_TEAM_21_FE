import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { elderSetupNeeds, needsAnySetup } from '@/notify/elderSetup';
import { canUseFullScreen, openFullScreenSettings, scheduleTestAlarm, setAskMode } from '@/notify/fullScreen';

/** 시험 알람까지 기다리는 시간. 그사이 보호자가 폰 화면을 끈다 */
const TEST_AFTER_SEC = 15;

/**
 * 약 시간에 어떻게 알릴지 고른다. 어르신 폰 연결·동의 직후 한 번 나온다 (Android, 화면에 띄울 수 있는 빌드만).
 * - 화면에 띄우기: 폰이 잠겨 있어도 질문 화면이 바로 열린다. Android 14 부터는 설정에서 "전체 화면 알림"을 허용해야 한다
 * - 알림으로만 받기: 지금까지와 같은 방식. 알림을 눌러야 질문 화면이 열린다
 * 보호자가 어르신 폰을 들고 고른다는 전제의 문구다 (알림 준비 안내 화면과 같음)
 */
export default function AskMode() {
  // 화면에 띄우기를 골랐는데 설정에서 허용이 필요한 상태
  const [waiting, setWaiting] = useState(false);
  // 화면에 띄우기를 고르고 허용까지 끝난 상태. 넘어가기 전에 한 번 시험해 볼 수 있다
  const [ready, setReady] = useState(false);
  const [testing, setTesting] = useState(false);

  const next = useCallback(async () => {
    const needs = await elderSetupNeeds();
    router.replace(needsAnySetup(needs) ? '/elder/alarm-permission' : '/elder');
  }, []);

  const choose = useCallback(
    async (mode: 'notification' | 'screen') => {
      await setAskMode(mode);
      if (mode === 'notification') await next();
      else if (canUseFullScreen()) setReady(true);
      else setWaiting(true);
    },
    [next],
  );

  // 설정에서 켜고 돌아오면 자동으로 넘어간다
  useEffect(() => {
    if (!waiting) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && canUseFullScreen()) {
        setWaiting(false);
        setReady(true);
      }
    });
    return () => sub.remove();
  }, [waiting, next]);

  if (ready) {
    return (
      <Screen
        scroll
        footer={
          <View style={{ gap: 12 }}>
            <BigButton label="다음" onPress={() => void next()} />
            <BigButton
              label={`${TEST_AFTER_SEC}초 뒤 시험하기`}
              variant="secondary"
              onPress={() => setTesting(scheduleTestAlarm(TEST_AFTER_SEC, Linking.createURL('/elder')))}
            />
          </View>
        }>
        <T variant="elderTitle">보호자께: 약 시간에 화면을 띄워 드릴게요</T>
        <T variant="elderBody">
          {testing
            ? `지금 폰 화면을 꺼 주세요. ${TEST_AFTER_SEC}초 뒤에 화면이 켜지면서 앱이 열리면 잘 되는 거예요.`
            : '이 폰에서 잘 되는지 한 번 시험해 볼 수 있어요.'}
        </T>
        <T variant="elderBody">폰을 쓰고 계실 때는 화면 위쪽 알림으로 보여요.</T>
      </Screen>
    );
  }

  if (waiting) {
    return (
      <Screen
        scroll
        footer={
          <View style={{ gap: 12 }}>
            <BigButton label="설정 열기" onPress={openFullScreenSettings} />
            <BigButton label="알림으로만 받기" variant="secondary" onPress={() => void choose('notification')} />
          </View>
        }>
        <T variant="elderTitle">보호자께: 화면에 띄우려면 한 가지를 켜 주세요</T>
        <T variant="elderBody">이 폰 설정에서 이 앱의 "전체 화면 알림"을 허용해 주세요.</T>
        <T variant="elderBody">[설정 열기]를 누르고 켠 뒤 돌아오면 자동으로 넘어가요.</T>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <View style={{ gap: 12 }}>
          <BigButton label="화면에 띄우기" onPress={() => void choose('screen')} />
          <BigButton label="알림으로만 받기" variant="secondary" onPress={() => void choose('notification')} />
        </View>
      }>
      <T variant="elderTitle">보호자께: 약 시간에 어떻게 알려 드릴까요?</T>
      <T variant="elderBody">화면에 띄우기: 폰이 잠겨 있어도 약 시간에 질문 화면이 바로 열려요.</T>
      <T variant="elderBody">알림으로만 받기: 소리와 알림으로 알려 드리고, 알림을 누르면 질문 화면이 열려요.</T>
    </Screen>
  );
}
