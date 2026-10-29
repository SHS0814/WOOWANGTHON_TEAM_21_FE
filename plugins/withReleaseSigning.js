// 로컬 release APK 서명 (R-039, EAS 없이). android/ 는 prebuild 때마다 새로 만들어져서 build.gradle 을 직접 고치면 사라진다.
// 서명 키와 비밀번호는 저장소 밖에 두고 Gradle 속성으로 넘긴다 (~/.gradle/gradle.properties 또는 -P, README "release APK").
// 속성이 없으면 release 빌드가 `SigningConfig "release" is missing required property "storeFile"` 로 멈춘다 (디버그 키로 몰래 서명하지 않음)
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (findProperty('WOOWANG_RELEASE_STORE_FILE')) {
                storeFile file(findProperty('WOOWANG_RELEASE_STORE_FILE'))
                storePassword findProperty('WOOWANG_RELEASE_STORE_PASSWORD')
                keyAlias findProperty('WOOWANG_RELEASE_KEY_ALIAS')
                keyPassword findProperty('WOOWANG_RELEASE_KEY_PASSWORD')
            }
        }`;

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    let src = c.modResults.contents;
    if (src.includes('WOOWANG_RELEASE_STORE_FILE')) return c;
    const debugBlock = /(signingConfigs \{\s*debug \{[^}]*\})/;
    const releaseUse = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!debugBlock.test(src) || !releaseUse.test(src)) {
      throw new Error('[withReleaseSigning] android/app/build.gradle 모양이 달라 release 서명을 넣지 못했습니다');
    }
    src = src.replace(debugBlock, `$1${RELEASE_SIGNING}`).replace(releaseUse, '$1signingConfig signingConfigs.release');
    c.modResults.contents = src;
    return c;
  });
