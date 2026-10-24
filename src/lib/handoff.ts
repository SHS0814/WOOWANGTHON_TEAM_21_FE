import type { HandoffReason } from '@/api';

export const REASON_TITLE: Record<HandoffReason, string> = {
  no_response: '답이 없으셨어요',
  unclear: '사진 판독이 애매해요',
  unchanged: '약 칸이 그대로예요',
  double_suspected: '이중 복용이 의심돼요',
};

export function reasonDetail(reason: HandoffReason, elder: string, reaskCount: number, reminded: boolean): string {
  switch (reason) {
    case 'no_response':
      return `${elder}께 ${reaskCount + 1}번 여쭤봤는데 답이 없으셨어요.`;
    case 'unclear':
      return '다시 찍은 사진도 AI가 확실히 보지 못했어요. 사진을 보고 판정해 주세요.';
    case 'unchanged':
      return reminded ? '"약 드실 시간이에요"라고 한 번 안내했는데도 칸이 그대로예요.' : '이번 칸에 약이 그대로 있어요.';
    case 'double_suspected':
      return '아직 차 있어야 할 다른 칸도 비어 있어요.';
  }
}
