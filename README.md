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
| 어르신 | 복약 시각·재질문 로컬 알림 | `GET /dose-events/today` 의 `ask_times`(오늘)와 `GET /schedule` + `GET /me` `timing`(내일부터 7일치, 서울 시간 기준)으로 예약. 숫자는 서버 값. 사진을 올렸거나 끝난 건의 남은 알림은 취소 (`src/notify/elderSchedule.ts`, R-028 N18·N22) |
| 어르신 | 재촬영·안내 뒤 사진이 없을 때 | 요청 5분 뒤 "사진 한 장만 더 부탁드려요" 1회. 복용 권유 문구 없음. 사진을 올리면 취소 (R-028 N25) |
| 어르신 | 알림을 누르면 | 오늘 건 → E4, 미리 예약한 날 → 어르신 홈 (열린 건이 있으면 홈이 E4 를 보여줌, R-022) |
| 어르신 | 알림 준비 상태 보고 | 알림 권한·정확한 알람 권한을 앱 시작, 앞으로 올 때, 권한 화면에서 돌아온 직후 `PUT /devices/me/notification-status` 로 보고. 일정(`GET /schedule`)도 30초마다 확인해 `updated_at` 이 바뀌면 다시 예약 (R-032) |
| 보호자 | 어르신 폰 알림 설정이 꺼졌을 때 | G4 맨 위 한 줄(`elder_notification_warning`), G8 에 무엇을 켜야 하는지. 정상이면 아무것도 안 보임 (R-032) |
| 보호자 | 인계 푸시 | Expo 푸시 토큰을 `PUT /devices/me/push-token` 으로 등록. 누르면 `handoff_id` 로 G5 (`src/notify/guardianPush.ts`, `NotificationRouter.tsx`). G8 에 등록 상태 표시 |

- Android: 높은 중요도 채널 `dose-ask` (알람 볼륨으로 울림, 잠금 화면에 내용 표시), 정시 전달 요청(`delivery: 'alarmClock'`)
  - **정확한 알람 권한이 필요하다.** Android 14 부터 `SCHEDULE_EXACT_ALARM` 은 기본 거부라, 권한이 없으면 알림이 정해진 시각보다 몇 분 늦게 울릴 수 있다 (에뮬레이터 측정: 10분 뒤 알림의 허용 지연 창 +7분 29초, 권한을 주면 0). 어르신 폰 연결·동의 직후 권한이 없으면 앱이 안내 화면(`elder/alarm-permission`, [설정 열기] 하나)을 보여주고, 보호자가 켜고 돌아오면 자동으로 넘어간다 (R-025 1번)
- iOS: 시간 민감 알림 (`interruptionLevel: 'timeSensitive'`, `app.json` 에 entitlement). 대기 알림 한도(64개) 때문에 가까운 순 60개까지 예약한다
- 알림 권한: 동의 직후 한 번 묻는다. 거부했거나 정확한 알람 권한이 없으면 같은 안내 화면이 켜야 할 것을 하나씩 연다 (R-028 N24)
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

## 개발 빌드로 실행하기 (Android, 알림 확인용)

알림은 Expo Go 에서 확인할 수 없다 (위 표). 로컬 개발 빌드로 에뮬레이터나 실제 폰에서 확인한다.

### 준비
- Android SDK (Android Studio 설치 시 `~/Library/Android/sdk`), JDK 17 이상, `adb`
- `export ANDROID_HOME=~/Library/Android/sdk`
- 에뮬레이터: `~/Library/Android/sdk/emulator/emulator -list-avds` 로 이름 확인 → `emulator -avd <이름>` (창 없이: `-no-window -no-audio`). 부팅 확인: `adb shell getprop sys.boot_completed` 가 `1`

### 빌드와 실행
```bash
npx expo run:android            # 처음 한 번 (약 10분). NDK·CMake·Build-Tools 를 자동으로 받는다
                                # android/ 폴더가 생기지만 .gitignore 대상이다. 커밋하지 않는다
npx expo start --dev-client     # 그다음부터는 JS 만 다시 불러온다 (네이티브 설정을 바꿨을 때만 다시 빌드)
```
- 앱을 처음 열면 "주변 기기" 권한을 묻는다 (개발 빌드가 Metro 를 찾는 데 씀). 허용한다
- Metro 에 직접 붙이기: `adb shell am start -a android.intent.action.VIEW -d "woowang://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"`
- 앱 화면 바로 열기 (예: 안내 화면): `adb shell am start -a android.intent.action.VIEW -d "woowang://elder/alarm-permission" com.anonymous.woowangfe`
- 다시 불러오기: `adb shell input keyevent 82` → Reload

### 로컬 서버(BE)에 붙이기
- 에뮬레이터에서 내 PC 는 `10.0.2.2` 다: `EXPO_PUBLIC_API_MODE=http EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api/v1 npx expo start --dev-client`
- 서버 `.env` 의 `PUBLIC_BASE_URL=http://10.0.2.2:8000` (사진 URL 이 에뮬레이터에서 열리게). 시연 트리거·모의 시나리오는 `DEMO_MODE=true` + 시연 가족(`EXPO_PUBLIC_CREATE_DEMO_FAMILY=true`)
- 휴대폰 앱은 CORS 와 무관하다 (웹에서만 필요)

### 알림 확인에 쓰는 명령 (시험용)
| 무엇 | 명령 |
|---|---|
| 정확한 알람 권한 켜기/끄기 | `adb shell appops set com.anonymous.woowangfe SCHEDULE_EXACT_ALARM allow` (끄기: `--uid ... default`). **끄면 Android 가 앱 프로세스를 종료한다** |
| 예약된 알림(알람) 보기 | `adb shell dumpsys alarm \| grep -A8 com.anonymous.woowangfe \| grep origWhen` (`window=0` 이면 정시, `window=+7m…` 이면 정확한 알람 권한 없음) |
| 표시된 알림 보기 | `adb shell dumpsys notification --noredact \| grep -A30 "pkg=com.anonymous.woowangfe" \| grep -E "tag=\|android.title"` |
| 알림 채널 설정 보기 | `adb shell dumpsys notification --noredact \| grep "dose-ask"` (중요도 5, `USAGE_ALARM`) |
| 알림 창 열기 | `adb shell cmd statusbar expand-notifications` |
| 앱 데이터 지우기 (처음부터) | `adb shell pm clear com.anonymous.woowangfe` (권한도 초기화) |
| 기기 시간대 바꾸기 (N22) | `adb shell settings put global auto_time_zone 0; adb shell service call alarm 3 s16 America/Los_Angeles` (되돌리기: `Asia/Seoul`) |

- 모의 서버에서는 개발 도구의 "시뮬레이션"으로 지금 시각의 복약 건을 열고, 재질문 알림(+10분)을 기다려 누르면 E4 로 가는지 본다. 재촬영 알림은 "애매" 시나리오로 사진을 올린 뒤 5분
- Android 13+ 는 알림 권한을 두 번 거부하면 창을 더 띄우지 않는다. 다시 시험하려면 `pm clear`

## 배포 체크리스트

배포(APK·EAS 빌드) 전에 확인한다.

- [ ] **패키지 이름 바꾸기:** 지금은 기본값 `com.anonymous.woowangfe` 다 (`app.json` 에 `android.package`·`ios.bundleIdentifier` 가 없어서 생긴 이름). 배포용 이름을 정해 `app.json` 에 적는다. 한 번 배포한 뒤에는 바꾸기 어렵다 (R-025 4번)
- [ ] **서버 주소:** `EXPO_PUBLIC_API_MODE=http`, `EXPO_PUBLIC_API_BASE_URL=https://<터널 도메인>/api/v1` (EAS 빌드면 EAS 환경 변수로). 값은 커밋하지 않는다
- [ ] **원격 푸시:** EAS 프로젝트 id(`extra.eas.projectId`)와 FCM(Android)·APNs(iOS) 자격 증명. 사용자 결정 대기 (U-004). 없으면 보호자는 앱 안 목록과 30초 갱신으로만 인계를 본다
- [ ] **Android 정확한 알람 권한:** `SCHEDULE_EXACT_ALARM` 을 쓴다. Google Play 에 올리면 권한 사용 신고가 필요하다. 어르신 폰 연결 때 앱이 안내 화면을 보여준다
- [ ] **iOS 시간 민감 알림:** Apple 개발자 계정에서 Time Sensitive Notifications 기능을 켠다 (`app.json` entitlement)
- [ ] **시연 가족:** 시연용이면 `EXPO_PUBLIC_CREATE_DEMO_FAMILY=true` 와 서버 `DEMO_MODE=true`. 심사용 접근 정보는 README 에 적지 않는다 (비공개 제출 폼)
- [ ] **모의 표시:** 서버가 모의 판독이면 앱 상단 띠가 자동으로 보인다. 실제 AI 를 붙이면 띠가 사라지는지 확인한다

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
| expo-file-system | 사진 업로드 본문(File). Expo SDK 58 의 fetch(expo/fetch)는 React Native 식 `{ uri }` FormData 파트를 받지 않는다 (Q-011) |
| react-native-qrcode-svg | 연결 QR 표시 |
