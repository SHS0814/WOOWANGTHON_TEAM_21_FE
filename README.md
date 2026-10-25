# WOOWANGTHON_TEAM_00_FE

Expo (React Native + TypeScript) 앱. 어르신/보호자 역할을 한 앱에서 분기한다.

## 실행

```bash
npm install
cp .env.example .env    # 필요하면 값을 바꾼다. .env 는 커밋하지 않는다
npx expo start
npx tsc --noEmit        # 타입 검사
```

### 서버 선택 (`.env`)

| 변수 | 값 | 뜻 |
|---|---|---|
| `EXPO_PUBLIC_API_MODE` | `mock` (기본) / `http` | 모의 서버(앱 안) 또는 실제 서버 |
| `EXPO_PUBLIC_API_BASE_URL` | 예: `http://localhost:8000/api/v1` | `http` 일 때 필수. `/api/v1` 까지 |
| `EXPO_PUBLIC_CREATE_DEMO_FAMILY` | `false` / `true` | 가족 만들기를 시연용(`is_demo`)으로. 서버가 `DEMO_MODE=true` 여야 한다 |

## 모의 표시 (대회 규정)

- 서버가 모의 판독 중이면(`GET /me` 의 `server.reader_is_mock`) 모든 화면 맨 위에 **"모의 판독 (실제 AI 아님)"** 띠가 보인다. 모의 서버(`mock`)면 "모의 서버"도 붙는다
- 판독 결과 옆에는 "AI 판독 · 모의 결과", 결과 화면에는 "모의 결과" 배지가 붙는다
- 시연 트리거(`POST /dev/dose-events`)로 연 복약 건은 **"시뮬레이션"** 으로 표시된다. 띠의 [개발] 버튼에서 연다 (모의 서버이거나, 시연 가족 + 서버 `DEMO_MODE` 일 때만 보임)
- **모의 판독 시나리오** (`POST /dev/mock-scenario`, api.md 3.28): 개발 도구에서 다음 복약 사진 1장의 모의 판독 결과(정상 / 애매 / 칸 그대로 / 이중 의심)를 고른다. 재촬영·안내·인계는 서버 규칙대로 진행된다. 모의 서버이거나, 실제 서버의 시연 가족 + `DEMO_MODE` + mock 판독기일 때만 보인다. 고른 값은 띠에 "다음 사진: …"으로 보인다
- 모의 서버의 개발 도구에는 시간 흘려보내기(재질문 → 무응답 인계), 오늘 기록 초기화, 역할 바꾸기도 있다
- 서버의 상태 반영(무응답 인계 등)은 1분 예약 작업이 해서 최대 1분 늦다. 어르신 질문 화면·대기 홈, 보호자 홈은 화면이 보이는 동안 30초마다 다시 읽는다
- 웹에서 실제 서버를 쓰려면 서버의 `CORS_ORIGINS`에 웹 주소가 있어야 한다 (기본 `localhost:8081`). `npx expo start --web` 의 기본 포트가 8081 이다

## 알림 (MVP #1 "앱이 물어보기")

| 폰 | 무엇 | 어떻게 |
|---|---|---|
| 어르신 | 복약 시각·재질문 로컬 알림 | `GET /dose-events/today` 의 `ask_times`(오늘)와 `GET /schedule` + `GET /me` `timing`(내일부터 3일치)으로 예약. 숫자는 서버 값. 사진을 올렸거나 끝난 건의 남은 알림은 취소 (`src/notify/elderSchedule.ts`) |
| 어르신 | 알림을 누르면 | 오늘 건 → E4, 미리 예약한 날 → 어르신 홈 (열린 건이 있으면 홈이 E4 를 보여줌, R-022) |
| 보호자 | 인계 푸시 | Expo 푸시 토큰을 `PUT /devices/me/push-token` 으로 등록. 누르면 `handoff_id` 로 G5 (`src/notify/guardianPush.ts`, `NotificationRouter.tsx`). G8 에 등록 상태 표시 |

- Android: 높은 중요도 채널 `dose-ask` (알람 볼륨으로 울림, 잠금 화면에 내용 표시), 정시 전달 요청(`delivery: 'alarmClock'`)
  - **정확한 알람 권한이 필요하다.** Android 14 부터 `SCHEDULE_EXACT_ALARM` 은 기본 거부라, 권한이 없으면 알림이 정해진 시각보다 몇 분 늦게 울릴 수 있다 (에뮬레이터 측정: 10분 뒤 알림의 허용 지연 창 +7분 29초, 권한을 주면 0). 어르신 폰을 연결할 때 보호자가 폰 설정 → 앱 → 알람 및 리마인더에서 켜야 한다. 앱 안 안내 화면은 아직 없다
- iOS: 시간 민감 알림 (`interruptionLevel: 'timeSensitive'`, `app.json` 에 entitlement)
- 웹: 알림 없음

### Expo Go 와 개발 빌드

| 기능 | Expo Go | 개발 빌드 (`npx expo run:android` / EAS) |
|---|---|---|
| 앱 화면 전체 (모의·실서버) | ✓ | ✓ |
| 어르신 로컬 알림 (Android) | **✕** Expo Go 58.0.5 에 `expo-notifications` 가 요구하는 네이티브 모듈(`ExpoTopicSubscriptionModule`)이 없어 알림 모듈을 불러오지 못함. 앱은 알림 없이 계속 동작 (`src/notify/module.ts`) | ✓ 에뮬레이터(Android 17)에서 예약·정시 울림·누르면 E4·사진 뒤 남은 재질문 취소 확인 |
| 어르신 로컬 알림 (iOS) | 확인 못 함 (iOS 시뮬레이터 없음) | ✓ |
| iOS 시간 민감 알림 | ✕ (entitlement 는 빌드에만 들어감) | ✓ (Apple 개발자 계정에 Time Sensitive Notifications 기능 필요) |
| 보호자 원격 푸시 | ✕ (Android 는 SDK 53 부터 Expo Go 에서 불가) | ✓ EAS 프로젝트 id(`extra.eas.projectId`)와 FCM/APNs 자격 증명 필요. 없으면 G8 에 "푸시 설정이 없어 알림을 받을 수 없어요" |
| 잠금 화면 위 전체 화면 E4 (full-screen intent) | ✕ | 아직 없음. 아래 조사 참고 |

### full-screen intent (조사만, 구현 안 함)

- `expo-notifications` 에는 full-screen intent API 가 없다
- 필요한 것: `USE_FULL_SCREEN_INTENT` 권한, 알림에 `setFullScreenIntent(E4 를 여는 PendingIntent)`, E4 를 띄울 Activity 에 `showWhenLocked`·`turnScreenOn`
- Android 14(API 34)부터 이 권한은 통화·알람 앱 외에는 기본 거부다. 앱이 `NotificationManager.canUseFullScreenIntent()` 로 확인하고, 안 되면 `Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` 화면으로 보내 보호자가 대신 켜게 해야 한다 (UI 설계 4장의 안내 화면). Google Play 배포 시 권한 사용 신고가 필요하다
- 방법: ① `@notifee/react-native` (fullScreenAction 지원, 마지막 릴리스 2024-12 라 RN 0.88·New Architecture 호환을 따로 확인해야 함) ② 작은 Expo 네이티브 모듈(Kotlin) + config plugin 으로 직접 구현. 유지보수 위험이 작은 ②를 권한다. 둘 다 개발 빌드가 필요하다

## 구조

| 경로 | 내용 |
|---|---|
| `src/app/` | expo-router 화면. `elder/` 어르신(E1~E8), `guardian/` 보호자(G1~G8), `role.tsx` 역할 선택, `dev.tsx` 개발·시연 도구 |
| `src/api/` | 데이터 접근의 유일한 지점. `types.ts` 계약서(DOCS `docs/design/api.md`) 타입, `client.ts` 인터페이스, `http.ts` 실제 서버, `mock.ts` 모의 서버, `errors.ts` 오류 코드 |
| `src/components/` | 큰 버튼, 카메라(가이드 틀), 약통 격자 그림, 판독 사진, 모의 띠 |

## 외부 기술

| 기술 | 용도 |
|---|---|
| Expo, expo-router | 앱, 화면 이동 |
| expo-camera | 약통 촬영, 연결 QR 스캔 |
| expo-secure-store | 기기 토큰 보관 |
| react-native-qrcode-svg | 연결 QR 표시 |
