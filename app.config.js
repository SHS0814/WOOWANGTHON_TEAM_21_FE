// app.json 위에 저장소 밖 설정을 얹는다 (R-039).
// google-services.json(Firebase, Android 푸시)은 커밋하지 않는다. 경로를 환경 변수 GOOGLE_SERVICES_JSON 으로 받는다 (README "보호자 푸시").
// - 값이 없으면: 경고만 하고 Firebase 없이 설정한다 (Expo Go·웹·화면 개발은 그대로. 보호자 푸시만 안 됨)
// - 값이 있는데 파일이 없거나 패키지 이름이 다르면: 설정을 멈춘다 (빌드가 명확히 실패)
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const pkg = config.android?.package;
  const raw = process.env.GOOGLE_SERVICES_JSON;
  let googleServicesFile;

  if (raw) {
    const file = path.resolve(raw.replace(/^~(?=$|\/)/, require('os').homedir()));
    if (!fs.existsSync(file)) {
      throw new Error(`[app.config] GOOGLE_SERVICES_JSON 파일이 없습니다: ${file}`);
    }
    let names = [];
    try {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      names = (json.client ?? []).map((c) => c.client_info?.android_client_info?.package_name);
    } catch {
      throw new Error(`[app.config] GOOGLE_SERVICES_JSON 을 JSON 으로 읽지 못했습니다: ${file}`);
    }
    if (!names.includes(pkg)) {
      throw new Error(`[app.config] google-services.json 에 패키지 ${pkg} 가 등록돼 있지 않습니다 (Firebase 콘솔의 Android 앱 패키지 이름 확인)`);
    }
    googleServicesFile = file;
  } else if (!globalThis.__woowangWarnedNoFirebase) {
    globalThis.__woowangWarnedNoFirebase = true;
    console.warn(
      '[app.config] GOOGLE_SERVICES_JSON 이 없어 Firebase 없이 설정합니다. 이 상태로 만든 Android 빌드는 보호자 푸시를 받지 못합니다 (README "보호자 푸시").',
    );
  }

  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    // 앱이 푸시를 쓸 수 있는 빌드인지 알려준다 (G8 표시용, 경로는 넣지 않는다)
    extra: { ...config.extra, firebaseConfigured: Boolean(googleServicesFile) },
  };
};
