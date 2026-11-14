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
- 시연 트리거(`POST /dev/dose-events`)로 연 복약 건은 **"시뮬레이션"** 으로 표시된다. 시연 도구(`dev.tsx`)에서 연다. 모의 서버·모의 판독이면 띠의 [개발] 버튼으로, 실제 판독을 쓰는 시연 가족(서버 `DEMO_MODE`)이면 띠가 없으므로 **어르신 홈의 날짜를 길게 누르거나 보호자 설정 탭의 "시연 도구"** 로 연다. 오늘 요일의 모든 시간대를 고를 수 있다 (시각이 지난 시간대도 서버가 시연용으로 만들어 준다)
- **모의 판독 시나리오** (`POST /dev/mock-scenario`, api.md 3.28): 개발 도구에서 다음 복약 사진 1장의 모의 판독 결과(정상 / 애매 / 칸 그대로 / 이중 의심)를 고른다. 재촬영·안내·인계는 서버 규칙대로 진행된다. 모의 서버이거나, 실제 서버의 시연 가족 + `DEMO_MODE` + mock 판독기일 때만 보인다. 고른 값은 띠에 "다음 사진: …"으로 보인다
- **시연 초기화** (`POST /dev/reset`): 시연 도구의 "시연 초기화 (기록 모두 지우기)"는 그 시연 가족의 복약 기록·확인할 일·복약 사진을 모두 지운다. 연결·약통·복약 시각은 남고, 약통은 마지막으로 등록하거나 채운 상태로 돌아간다. 시연을 처음부터 다시 할 때 쓴다 (실제 서버의 시연 가족에서만 보인다)
- **실제 판독이면 맨 위 띠는 나오지 않는다** (시연 가족이어도). 모의 판독일 때만 띠가 보인다
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
| 보호자 | 인계 푸시 (Android 만) | 서버가 FCM 으로 직접 보낸다 (R-039, Expo 푸시 서비스 안 씀). 앱은 기기 FCM 토큰(`getDevicePushTokenAsync`)을 `PUT /devices/me/push-token` 으로 등록하고, 토큰이 바뀌면 다시 보낸다. 채널 `guardian`(높은 중요도). 누르면 `handoff_id` 로 G5 (`src/notify/guardianPush.ts`, `NotificationRouter.tsx`). G8 에 등록 상태 표시. **iOS 는 푸시 없음** (R-039): 토큰을 보내지 않고, 인계는 G4 목록과 30초 갱신으로 본다 |

- Android: 높은 중요도 채널 `dose-ask` (알람 볼륨으로 울림, 잠금 화면에 내용 표시), 정시 전달 요청(`delivery: 'alarmClock'`)
  - **정확한 알람 권한이 필요하다.** Android 14 부터 `SCHEDULE_EXACT_ALARM` 은 기본 거부라, 권한이 없으면 알림이 정해진 시각보다 몇 분 늦게 울릴 수 있다 (에뮬레이터 측정: 10분 뒤 알림의 허용 지연 창 +7분 29초, 권한을 주면 0). 어르신 폰 연결·동의 직후 권한이 없으면 앱이 안내 화면(`elder/alarm-permission`, [설정 열기] 하나)을 보여주고, 보호자가 켜고 돌아오면 자동으로 넘어간다 (R-025 1번)
- iOS: 시간 민감 알림 (`interruptionLevel: 'timeSensitive'`, `app.json` 에 entitlement). 대기 알림 한도(64개) 때문에 가까운 순 60개까지 예약한다
- 알림 권한: 동의 직후 한 번 묻는다. 거부했거나 정확한 알람 권한이 없으면 같은 안내 화면이 켜야 할 것을 하나씩 연다 (R-028 N24)
- 웹: 알림 없음

### Expo Go 와 개발 빌드

| 기능 | Expo Go | 개발 빌드 (`npx expo run:android`) |
|---|---|---|
| 앱 화면 전체 (모의·실서버) | ✓ | ✓ |
| 어르신 로컬 알림 (Android) | **✕** Expo Go 58.0.5 에 `expo-notifications` 가 요구하는 네이티브 모듈(`ExpoTopicSubscriptionModule`)이 없어 알림 모듈을 불러오지 못함. 앱은 알림 없이 계속 동작 (`src/notify/module.ts`) | ✓ 에뮬레이터(Android 17)에서 예약·정시 울림·누르면 E4·사진 뒤 남은 재질문 취소 확인 |
| 어르신 로컬 알림 (iOS) | 확인 못 함 (iOS 시뮬레이터 없음) | ✓ |
| iOS 시간 민감 알림 | ✕ (entitlement 는 빌드에만 들어감) | ✓ (Apple 개발자 계정에 Time Sensitive Notifications 기능 필요) |
| 보호자 원격 푸시 (Android) | ✕ (Android 는 SDK 53 부터 Expo Go 에서 불가) | ✓ `GOOGLE_SERVICES_JSON` 을 주고 빌드해야 한다 (아래 "보호자 푸시"). 없이 만든 빌드는 G8 에 "푸시 설정이 없어 알림을 받을 수 없어요" |
| 잠금 화면 위 전체 화면 E4 (full-screen intent) | ✕ | 선택 기능 (아래 "화면에 띄우기"). S22 Ultra(Android 16) 개발 빌드에서 시험 알람으로 확인. release APK 에서는 선택 화면까지만 확인 |

### 화면에 띄우기 (full-screen intent, 선택 기능)

어르신 폰 연결·동의 직후 보호자가 **"화면에 띄우기 / 알림으로만 받기"** 중에 고른다 (`elder/ask-mode`). 고른 값은 그 폰에만 저장하고(서버·API 변경 없음), 연결을 해제하면 지워져 다시 고른다. 기본 동작(고르지 않았거나 "알림으로만 받기")은 지금까지의 알림 그대로다.

- `expo-notifications` 에는 full-screen intent API 가 없어서 작은 네이티브 모듈을 직접 만들었다: `modules/woowang-fullscreen` (Kotlin, Expo 자동 연결. prebuild 없이 gradle 만 다시 돌리면 들어간다)
  - `AlarmStore`: 복약 시각마다 `AlarmManager.setAlarmClock` 예약 (정확한 알람 권한이 없으면 `setAndAllowWhileIdle`). 재부팅·앱 업데이트 뒤 다시 건다 (`BootReceiver`)
  - `DoseAlarmReceiver`: 시각이 되면 채널 `dose-ask-screen` 으로 알림을 내고 `setFullScreenIntent` 로 질문 화면(E4) 딥링크를 연다. 화면이 꺼졌거나 잠겨 있으면 화면이 바로 열리고, 폰을 쓰는 중이면 위쪽 알림으로 보인다 (Android 동작)
  - `WoowangFullScreenPackage`: 이 알람으로 열린 경우에만 `setShowWhenLocked`·`setTurnScreenOn` 을 켠다. 앱 아이콘이나 보호자 푸시로 연 화면은 잠금 해제 뒤에 보인다
- 예약은 `src/notify/elderSchedule.ts` 가 같은 목록으로 한다. "화면에 띄우기"이고 권한이 있으면 네이티브 알람만 예약하고 일반 알림은 지운다 (두 번 울리지 않게). 권한이 꺼지면 다음 동기화에서 일반 알림으로 돌아간다 (`src/notify/fullScreen.ts`)
- Android 14(API 34)부터 `USE_FULL_SCREEN_INTENT` 는 통화·알람 앱 외에는 기본 거부다. 선택 화면이 `canUseFullScreenIntent()` 로 확인하고, 꺼져 있으면 [설정 열기]로 "전체 화면 알림" 설정에 보낸다. Google Play 배포 시 권한 사용 신고가 필요하다
- 선택 화면에서 "화면에 띄우기"를 고르면 **[15초 뒤 시험하기]** 로 그 폰에서 되는지 바로 볼 수 있다 (시험 알람은 어르신 홈을 연다)
- 알람으로 띄운 화면은 실제로 앞에 나온 뒤 화면이 꺼지거나 홈으로 나가면 잠금 화면 위 표시를 되돌린다. 되돌리지 않으면 전원 버튼으로 꺼도 화면이 다시 켜지고, 앞에 나오기 전에 되돌리면 화면이 켜지지 않는다 (둘 다 실기기에서 겪음, `WoowangFullScreenPackage.kt`)
- **확인한 것 (2026-11-13, S22 Ultra·Android 16, 개발 빌드):** 잠금·화면 꺼짐 상태에서 시험 알람이 화면을 켜고 잠금 화면 위로 앱을 띄움 → 어르신 홈 이동, 앱 프로세스를 종료한 상태에서도 같음, 화면을 끄면 다시 잠기고 켜면 잠금 화면이 나옴, "화면에 띄우기"면 네이티브 알람만 21개·"알림으로만 받기"면 기존 알림만 21개. **확인 못 한 것:** 실제 복약 건 알람이 E4 로 가는지(시험 알람은 홈), release APK, 재부팅 뒤 재예약, 다른 제조사·Android 14 이상에서 권한이 꺼진 경우의 설정 안내
- iOS·웹·Expo Go 에는 이 모듈이 없어 선택 화면이 나오지 않고 알림 방식으로 동작한다

## 시연용 샘플 사진 (시연 가족)

약과 약통이 없어도 실제 서버의 실제 AI 판독을 해 볼 수 있게, 미리 찍어 둔 약통 사진을 고를 수 있다. **판독 결과를 정해 두지 않는다.** 고른 사진은 카메라로 찍은 사진과 똑같이 서버에 올라가 판독·분류된다.

- 시연 가족(`is_demo` + 서버 `DEMO_MODE`)에서만, 사진을 찍는 세 화면(약통 등록, 약통 채우기, 어르신 복약 촬영)에 **"샘플 사진 고르기 (시연용)"** 버튼이 나온다. 카메라도 그대로 쓸 수 있다
- 사진은 `assets/demo/` 에 있다 (직접 찍은 사진, 긴 변 1600). 사진마다 오른쪽 아래에 **"샘플 사진"** 글자가 들어 있어 기록·인계 화면에서도 샘플임이 보인다 (대회 규정)
  - 3칸 약통(아침·점심·저녁): 모두 참 / 아침 빔 / 아침·점심 빔 / 모두 빔 / 비스듬히 / 흔들림
  - 7칸 약통(월~일): 월요일 칸부터 0~7칸 비운 8장 / 비스듬히. 오늘 요일에 맞는 사진에 "오늘 드시기 전", "오늘 드신 뒤" 안내가 붙는다
- 복약 촬영과 약통 채우기에서는 등록된 약통과 칸 수가 같은 사진만 보인다 (다른 약통 사진은 판독이 "애매"로 나온다)
- Android release 빌드에서는 사진이 앱 리소스로 들어가 파일 주소가 없다. 올리기 전에 캐시 폴더에 파일로 복사한다 (`src/lib/demoPhotos.ts`)
- **확인한 것 (2026-11-14, S22 Ultra, release APK + 실제 서버·실제 판독):** 샘플 사진 업로드와 판독, 약통 구조 인식, 인계 푸시 도착. 사진 15장은 실제 판독기로 각각 확인했다 (3칸 "아침·점심 빔"은 6회 중 6회 정확)

## 보호자 푸시 (Firebase, R-039)

- Firebase 프로젝트 `medicine` 에 Android 앱 `kr.dementiacheck.app` 으로 등록돼 있다. 서버(BE)가 FCM HTTP v1 으로 직접 보낸다
- `google-services.json` 은 **저장소에 넣지 않는다** (`.gitignore`). 저장소 밖 경로를 환경 변수 `GOOGLE_SERVICES_JSON` 으로 준다 (`.env` 또는 셸). `app.config.js` 가 이 경로를 `android.googleServicesFile` 로 넣는다
  - 값이 없으면: 경고만 하고 Firebase 없이 설정한다. Expo Go·웹·화면 개발은 그대로 되고, 그 상태로 만든 Android 빌드만 푸시를 못 받는다
  - 값이 있는데 파일이 없거나, 파일에 빌드할 패키지(기본 `kr.dementiacheck.app`, 보호자용 `kr.dementiacheck.app.guardian`)가 없으면: 설정 단계에서 멈춘다
- `GOOGLE_SERVICES_JSON` 을 바꾸면 `npx expo prebuild --platform android` 부터 다시 한다 (`android/app/google-services.json` 으로 복사된다. `android/` 도 커밋 안 함)
- Android 채널 id 는 `guardian` (서버 `FCM_ANDROID_CHANNEL_ID` 기본값과 같음). 서버가 채널을 안 적어도 앱 기본 채널이 `guardian` 이다
- 확인: 보호자 등록 뒤 서버 로그에 `PUT /devices/me/push-token 204`. 토큰 유효성은 BE `scripts/fcm_check.py <서비스 계정 키 경로> <기기 토큰>` 이 200
- **시험할 때 앱을 `am force-stop` 으로 끄지 않는다.** Android 가 앱을 "중지됨" 상태로 두어 FCM 을 받지 않는다 (실제 사용자가 최근 앱에서 밀어 끈 것과 다름). 홈으로 나간 뒤 `adb shell am kill kr.dementiacheck.app` 으로 끄고 `adb shell pidof kr.dementiacheck.app` 가 비었는지 본다
- Metro 를 `CI=1` 로 띄우면 파일 감시가 꺼져 코드를 고쳐도 옛 번들을 준다. 시험할 때는 `CI` 없이 띄운다

## 개발 빌드로 실행하기 (Android, 알림 확인용)

알림은 Expo Go 에서 확인할 수 없다 (위 표). 로컬 개발 빌드로 에뮬레이터나 실제 폰에서 확인한다.

### 준비
- Android SDK (Android Studio 설치 시 `~/Library/Android/sdk`), JDK 17 이상, `adb`
- `export ANDROID_HOME=~/Library/Android/sdk`
- 에뮬레이터: `~/Library/Android/sdk/emulator/emulator -list-avds` 로 이름 확인 → `emulator -avd <이름>` (창 없이: `-no-window -no-audio`). 부팅 확인: `adb shell getprop sys.boot_completed` 가 `1`

### 빌드와 실행
```bash
GOOGLE_SERVICES_JSON=~/woowang-secrets/google-services.json \
  npx expo run:android          # 처음 한 번 (약 10분). NDK·CMake·Build-Tools 를 자동으로 받는다
                                # android/ 폴더가 생기지만 .gitignore 대상이다. 커밋하지 않는다
npx expo start --dev-client     # 그다음부터는 JS 만 다시 불러온다 (네이티브 설정을 바꿨을 때만 다시 빌드)
```
- 앱을 처음 열면 "주변 기기" 권한을 묻는다 (개발 빌드가 Metro 를 찾는 데 씀). 허용한다
- Metro 에 직접 붙이기: `adb shell am start -a android.intent.action.VIEW -d "woowang://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"`
- 앱 화면 바로 열기 (예: 안내 화면): `adb shell am start -a android.intent.action.VIEW -d "woowang://elder/alarm-permission" kr.dementiacheck.app`
- 다시 불러오기: `adb shell input keyevent 82` → Reload

### 로컬 서버(BE)에 붙이기
- 에뮬레이터에서 내 PC 는 `10.0.2.2` 다: `EXPO_PUBLIC_API_MODE=http EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api/v1 npx expo start --dev-client`
- 서버 `.env` 의 `PUBLIC_BASE_URL=http://10.0.2.2:8000` (사진 URL 이 에뮬레이터에서 열리게). 시연 트리거·모의 시나리오는 `DEMO_MODE=true` + 시연 가족(`EXPO_PUBLIC_CREATE_DEMO_FAMILY=true`)
- 휴대폰 앱은 CORS 와 무관하다 (웹에서만 필요)

### 알림 확인에 쓰는 명령 (시험용)
| 무엇 | 명령 |
|---|---|
| 정확한 알람 권한 켜기/끄기 | `adb shell appops set kr.dementiacheck.app SCHEDULE_EXACT_ALARM allow` (끄기: `--uid ... default`). **끄면 Android 가 앱 프로세스를 종료한다** |
| 예약된 알림(알람) 보기 | `adb shell dumpsys alarm \| grep -A8 kr.dementiacheck.app \| grep origWhen` (`window=0` 이면 정시, `window=+7m…` 이면 정확한 알람 권한 없음) |
| 표시된 알림 보기 | `adb shell dumpsys notification --noredact \| grep -A30 "pkg=kr.dementiacheck.app" \| grep -E "tag=\|android.title"` |
| 알림 채널 설정 보기 | `adb shell dumpsys notification --noredact \| grep "dose-ask"` (중요도 5, `USAGE_ALARM`) |
| 알림 창 열기 | `adb shell cmd statusbar expand-notifications` |
| 앱 데이터 지우기 (처음부터) | `adb shell pm clear kr.dementiacheck.app` (권한도 초기화) |
| 기기 시간대 바꾸기 (N22) | `adb shell settings put global auto_time_zone 0; adb shell service call alarm 3 s16 America/Los_Angeles` (되돌리기: `Asia/Seoul`) |

- 모의 서버에서는 개발 도구의 "시뮬레이션"으로 지금 시각의 복약 건을 열고, 재질문 알림(+10분)을 기다려 누르면 E4 로 가는지 본다. 재촬영 알림은 "애매" 시나리오로 사진을 올린 뒤 5분
- Android 13+ 는 알림 권한을 두 번 거부하면 창을 더 띄우지 않는다. 다시 시험하려면 `pm clear`

## 배포 체크리스트

배포(로컬 release APK) 전에 확인한다.

- [x] **패키지 이름:** `kr.dementiacheck.app` (`app.json` `android.package`, R-039. Firebase 에 이 이름으로 등록됨). 예전 `com.anonymous.woowangfe` 로 깐 개발 빌드는 다른 앱이라 따로 지운다
- [ ] **서버 주소:** `EXPO_PUBLIC_API_MODE=http`, `EXPO_PUBLIC_API_BASE_URL=https://<터널 도메인>/api/v1` 빌드할 때 셸 환경 변수나 `.env` 로 준다 (값이 APK 안에 들어간다). 값은 커밋하지 않는다
- [ ] **원격 푸시 (Android):** `GOOGLE_SERVICES_JSON=~/woowang-secrets/google-services.json` 을 주고 prebuild·빌드한다 (위 "보호자 푸시"). 빌드 경고에 `GOOGLE_SERVICES_JSON 이 없어` 가 나오면 푸시 없는 APK 다. 서버는 `PUSH_PROVIDER=fcm`. iOS 푸시는 하지 않는다 (R-039, 발표의 한계)
- [ ] **release 서명 키:** 저장소 밖에 둔다 (아래 "release APK"). 같은 키로 서명해야 덮어 설치(업데이트)가 된다. 키를 잃으면 심사위원 폰의 앱을 지우고 다시 깔아야 한다
- [ ] **Android 정확한 알람 권한:** `SCHEDULE_EXACT_ALARM` 을 쓴다. Google Play 에 올리면 권한 사용 신고가 필요하다. 어르신 폰 연결 때 앱이 안내 화면을 보여준다
- [ ] **iOS 시간 민감 알림:** Apple 개발자 계정에서 Time Sensitive Notifications 기능을 켠다 (`app.json` entitlement)
- [ ] **시연 가족:** 시연용이면 `EXPO_PUBLIC_CREATE_DEMO_FAMILY=true` 와 서버 `DEMO_MODE=true`. 심사용 접근 정보는 README 에 적지 않는다 (비공개 제출 폼)
- [ ] **모의 표시:** 서버가 모의 판독이면 앱 상단 띠가 자동으로 보인다. 실제 AI 를 붙이면 띠가 사라지는지 확인한다

## release APK (로컬, EAS 없이)

서명 키와 비밀번호는 저장소 밖에 둔다. `plugins/withReleaseSigning.js` 가 prebuild 때 release 서명 설정을 `android/app/build.gradle` 에 넣고, 값은 Gradle 속성에서 읽는다. 속성이 없으면 release 빌드가 `SigningConfig "release" is missing required property "storeFile"` 로 멈춘다 (디버그 키로 서명하지 않음).

```bash
# 1) 서명 키 만들기 (처음 한 번. 키와 비밀번호를 잃지 않게 따로 보관)
keytool -genkeypair -v -storetype PKCS12 -keystore ~/woowang-secrets/release.jks \
  -alias woowang -keyalg RSA -keysize 2048 -validity 10000

# 2) ~/.gradle/gradle.properties (저장소 밖)에 적는다
WOOWANG_RELEASE_STORE_FILE=/Users/<나>/woowang-secrets/release.jks
WOOWANG_RELEASE_STORE_PASSWORD=...
WOOWANG_RELEASE_KEY_ALIAS=woowang
WOOWANG_RELEASE_KEY_PASSWORD=...

# 3) 빌드. EXPO_PUBLIC_* 값이 APK 에 들어가므로 실제 서버 주소로
export GOOGLE_SERVICES_JSON=~/woowang-secrets/google-services.json
export EXPO_PUBLIC_API_MODE=http EXPO_PUBLIC_API_BASE_URL=https://<터널 도메인>/api/v1
npx expo prebuild --platform android --clean
(cd android && ./gradlew :app:assembleRelease)
# 결과: android/app/build/outputs/apk/release/app-release.apk
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk   # 서명 확인 (build-tools 안)
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

- release APK 는 Metro 없이 JS 가 APK 안에 들어간다. 시연 도구는 모의 서버이거나 시연 가족 + 서버 `DEMO_MODE` 일 때만 열린다 (위 "모의 표시")
- **release 는 `http://` 서버에 붙지 않는다** (Android 기본값: 평문 HTTP 는 디버그 빌드만 허용). 서버 주소는 `https://` 터널 주소여야 한다. 로컬 `http://10.0.2.2:8000` 으로 시험하려면 개발 빌드를 쓴다
- 시험 결과 (2026-10-30, 맥 M 계열, 시험용 키): `assembleRelease` 11분 15초, APK 121MB (4개 ABI 포함), `apksigner` v2 서명 확인, 패키지 `kr.dementiacheck.app`. 속성 없이 빌드하면 `packageRelease` 에서 멈춤 확인
- APK 는 저장소에 넣지 않는다

## 폰 한 대에 앱 두 개 (시험·시연, R-044)

`APP_VARIANT=guardian` 으로 빌드하면 어르신용과 함께 설치되는 다른 앱이 된다. 값이 없으면 지금까지와 똑같은 기본 빌드다. 없는 값을 주면 설정 단계에서 멈춘다. 역할은 두 앱 모두 지금처럼 앱 안에서 고른다.

| | 기본 | `APP_VARIANT=guardian` |
|---|---|---|
| Android 패키지 | `kr.dementiacheck.app` | `kr.dementiacheck.app.guardian` |
| 앱 이름 | 약 챙김 | 약 챙김 보호자 |
| 딥링크 scheme | `woowang` | `woowang-guardian` |

- `google-services.json` 하나에 두 패키지가 모두 있어야 한다. 빌드하는 패키지가 없으면 설정 단계에서 멈춘다. 서버는 같은 Firebase 프로젝트의 서비스 계정으로 두 앱에 보내므로 서버 설정은 그대로다
- 앱 안 이동과 알림 눌러 G5 이동은 scheme 을 쓰지 않는다. QR 값 `woowang://pair?code=...` 는 두 앱이 같은 형식으로 쓰는 값이고, 읽을 때 `code` 만 본다 (`src/lib/pairCode.ts`)
- 위 "개발 빌드"·"알림 확인" 명령을 보호자용에 쓸 때는 패키지를 `kr.dementiacheck.app.guardian`, scheme 을 `woowang-guardian` 으로 바꾼다

### 빌드 (android/ 는 한 번에 한 변형만)

`android/` 폴더는 하나라서 한 번에 한 변형만 담는다. gradle 만 다시 돌리면 직전 변형이 빌드되고, APK 도 같은 경로에 덮어쓴다. 그래서 **변형을 바꿀 때마다 `--clean` 으로 다시 만들고, APK 는 저장소 밖으로 복사한 뒤 다음 변형을 빌드한다.** 환경 변수는 gradle 단계에서도 다시 읽히므로(앱에 들어가는 설정) 아래처럼 prebuild 와 gradle 을 같은 셸에서 실행한다. 괄호는 값이 다음 명령으로 새지 않게 한다. 서명 속성은 "release APK" 와 같고, 두 앱에 같은 키를 쓴다.

```bash
export GOOGLE_SERVICES_JSON=~/woowang-secrets/google-services.json
export EXPO_PUBLIC_API_MODE=http EXPO_PUBLIC_API_BASE_URL=https://<터널 도메인>/api/v1
mkdir -p ~/woowang-apks

# 어르신용 (기본)
(unset APP_VARIANT
  npx expo prebuild --platform android --clean &&
  (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a) &&
  cp android/app/build/outputs/apk/release/app-release.apk ~/woowang-apks/woowang-elder.apk)

# 보호자용
(export APP_VARIANT=guardian
  npx expo prebuild --platform android --clean &&
  (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a) &&
  cp android/app/build/outputs/apk/release/app-release.apk ~/woowang-apks/woowang-guardian.apk)

adb install -r ~/woowang-apks/woowang-elder.apk
adb install -r ~/woowang-apks/woowang-guardian.apk
```

- `-PreactNativeArchitectures=arm64-v8a` 는 폰용으로 빌드 시간과 크기를 줄인다. 에뮬레이터(x86_64)에 깔려면 뺀다
- 개발 빌드로 보호자용을 띄울 때는 Metro 에도 같은 값을 준다: `APP_VARIANT=guardian npx expo start --dev-client`. Metro 하나는 한 변형의 설정만 주므로, 두 앱을 함께 시험할 때는 release APK 를 쓴다
- 심사위원 APK 는 지금처럼 기본 빌드다 (R-044)

## 구조

| 경로 | 내용 |
|---|---|
| `src/app/` | expo-router 화면. `elder/` 어르신(E1~E8), `guardian/` 보호자(G1~G8), `role.tsx` 역할 선택, `dev.tsx` 개발·시연 도구 |
| `src/api/` | 데이터 접근의 유일한 지점. `types.ts` 계약서(DOCS `docs/design/api.md`) 타입, `client.ts` 인터페이스, `http.ts` 실제 서버, `mock.ts` 모의 서버, `errors.ts` 오류 코드 |
| `src/components/` | 큰 버튼, 카메라(가이드 틀), 시연용 샘플 사진 고르기, 약통 격자 그림, 판독 사진, 모의 띠 |
| `assets/demo/` | 시연용 약통 사진 (위 "시연용 샘플 사진") |
| `app.config.js` | `app.json` 위에 저장소 밖 설정(`GOOGLE_SERVICES_JSON`)과 보호자용 빌드 변형(`APP_VARIANT`)을 얹는다 |
| `plugins/withReleaseSigning.js` | release APK 서명 설정 (값은 Gradle 속성, 저장소 밖) |

## 외부 기술

| 기술 | 용도 |
|---|---|
| Expo, expo-router | 앱, 화면 이동 |
| expo-camera | 약통 촬영, 연결 QR 스캔 |
| expo-secure-store | 기기 토큰 보관 |
| expo-file-system | 사진 업로드 본문(File). Expo SDK 58 의 fetch(expo/fetch)는 React Native 식 `{ uri }` FormData 파트를 받지 않는다 (Q-011) |
| react-native-qrcode-svg | 연결 QR 표시 |
