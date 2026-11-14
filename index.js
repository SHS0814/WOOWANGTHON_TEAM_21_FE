// 앱 진입점. 화면 없이 백그라운드로 깨어날 때(서버의 데이터 푸시)도 이 파일이 불린다.
// 백그라운드 작업은 화면 코드(app/_layout)보다 먼저, 여기서 정의해야 화면이 뜨지 않아도 등록된다 (expo-task-manager).
require('./src/notify/elderPush').setupElderScheduleTask();
require('expo-router/entry');
