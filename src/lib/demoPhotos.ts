// 시연용 약통 사진 (시연 가족에서만 쓴다).
// 약과 약통이 없어도 실제 서버의 실제 AI 판독을 해 볼 수 있게, 미리 찍어 둔 사진을 고르게 한다.
// 판독 결과는 정해져 있지 않다: 고른 사진을 카메라로 찍은 사진과 똑같이 서버에 올려 판독한다.
// 사진마다 오른쪽 아래에 "샘플 사진" 글자가 들어 있어, 기록·인계 화면에서도 샘플임이 보인다 (대회 규정).
import { Asset } from 'expo-asset';
import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

import { seoulDay } from './seoulTime';

export interface DemoPhoto {
  key: string;
  module: number;
  /** 사진 속 약통 상태 */
  label: string;
  /** 지금 고르면 어떻게 쓰이는지 (없으면 빈 문자열) */
  hint: string;
}

export interface DemoGroup {
  title: string;
  /** 약통 칸 수 (등록된 약통과 같은 사진만 보여 줄 때 쓴다) */
  cols: number;
  note: string;
  photos: DemoPhoto[];
}

const WEEK = ['월', '화', '수', '목', '금', '토', '일'];

/** 7칸 약통: 월요일 칸부터 k 칸이 빈 사진 (k = 0 ~ 7) */
const W7: number[] = [
  require('../../assets/demo/w7_s0.jpg'),
  require('../../assets/demo/w7_s1.jpg'),
  require('../../assets/demo/w7_s2.jpg'),
  require('../../assets/demo/w7_s3.jpg'),
  require('../../assets/demo/w7_s4.jpg'),
  require('../../assets/demo/w7_s5.jpg'),
  require('../../assets/demo/w7_s6.jpg'),
  require('../../assets/demo/w7_s7.jpg'),
];

function weekLabel(k: number): string {
  if (k === 0) return '일곱 칸 모두 참';
  if (k === 7) return '일곱 칸 모두 빔';
  return k === 1 ? '월 칸 빔' : `월~${WEEK[k - 1]} 칸 빔`;
}

/** 오늘 요일(월=0) 기준으로 그 사진이 무엇에 맞는지 */
function weekHint(k: number, today: number): string {
  if (k === today) return `오늘(${WEEK[today]}) 드시기 전 · 약통 등록·채우기용`;
  if (k === today + 1) return `오늘(${WEEK[today]}) 드신 뒤`;
  if (k === today + 2) return '내일 칸까지 빔 (이중 복용 의심)';
  return '';
}

/** cols 를 주면 그 칸 수의 약통 사진만 돌려준다. 맞는 것이 없으면(다른 약통을 등록한 경우) 전부 돌려준다 */
export function demoGroups(now: Date, cols?: number): DemoGroup[] {
  const today = seoulDay(now).weekday;
  const all = allGroups(today);
  const same = cols ? all.filter((g) => g.cols === cols) : [];
  return same.length ? same : all;
}

function allGroups(today: number): DemoGroup[] {
  return [
    {
      title: '3칸 약통 (아침·점심·저녁)',
      cols: 3,
      note: '하루 약통. 왼쪽부터 아침·점심·저녁이에요.',
      photos: [
        { key: 'd3_s0', module: require('../../assets/demo/d3_s0.jpg'), label: '세 칸 모두 참', hint: '약통 등록·채우기용' },
        { key: 'd3_s1', module: require('../../assets/demo/d3_s1.jpg'), label: '아침 칸 빔', hint: '아침 드신 뒤' },
        { key: 'd3_s2', module: require('../../assets/demo/d3_s2.jpg'), label: '아침·점심 칸 빔', hint: '점심 드신 뒤' },
        { key: 'd3_s3', module: require('../../assets/demo/d3_s3.jpg'), label: '세 칸 모두 빔', hint: '저녁 드신 뒤' },
        { key: 'd3_tilted', module: require('../../assets/demo/d3_tilted.jpg'), label: '비스듬히 찍은 사진', hint: '' },
        { key: 'd3_blurry', module: require('../../assets/demo/d3_blurry.jpg'), label: '흔들린 사진', hint: '' },
      ],
    },
    {
      title: '7칸 약통 (월~일)',
      cols: 7,
      note: '일주일 약통. 월요일 칸부터 차례로 비운 사진이에요.',
      photos: [
        ...W7.map((module, k) => ({ key: `w7_s${k}`, module, label: weekLabel(k), hint: weekHint(k, today) })),
        { key: 'w7_tilted', module: require('../../assets/demo/w7_tilted.jpg'), label: '비스듬히 찍은 사진', hint: '' },
      ],
    },
  ];
}

/**
 * 고른 사진을 이 기기의 파일로 준비해 그 주소를 돌려준다 (카메라로 찍은 사진과 같은 방식으로 올리기 위해).
 *
 * Android 배포 빌드에서는 사진이 앱 리소스(drawable)로 들어가고, expo-asset 은 그 리소스 이름을 localUri 로 돌려준다
 * (화면에 그리는 데는 충분하지만 파일이 아니라서 올릴 수 없다). 그래서 파일 주소가 아니면 expo-asset 의 네이티브 함수로
 * 캐시 폴더에 복사한 파일 주소를 받는다. 개발 빌드는 Metro 에서 내려받은 파일 주소가 바로 온다
 */
export async function demoPhotoUri(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  let uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('샘플 사진을 준비하지 못했어요');
  const isFile = uri.startsWith('file://') && !uri.startsWith('file:///android_res/');
  if (Platform.OS === 'android' && !isFile) {
    const copied: unknown = await requireNativeModule('ExpoAsset').downloadAsync(uri, asset.hash, asset.type);
    uri = String(copied);
  }
  return uri;
}
