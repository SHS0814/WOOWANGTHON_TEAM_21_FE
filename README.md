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
