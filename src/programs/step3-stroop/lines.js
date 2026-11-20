// STEP 3 멘트: 시작할 때, 답을 오래 기다릴 때, 답을 고른 뒤 하나씩 무작위로 고른다 (화면 글자와 말소리).
// 녹음 파일(#61, D 담당)도 이 문장 그대로 만든다. 문장을 고치면 D에게 알린다.
// "틀렸어요·정답·점수·맞힌"은 쓰지 않는다. 다르게 골랐을 때는 답이 되는 색을 말하지 않는다 (색은 화면이 따로 알려 준다).

/** 시작 화면이 열릴 때 */
export const START_LINES = [
  '안녕하세요! 같이 색깔 놀이 해 볼까요?',
  '반가워요! 오늘도 함께해요.',
  '준비되셨어요? 천천히 시작해요.',
  '글자 색을 잘 보고 카드를 골라 주세요!',
];

/** 답을 오래 기다릴 때 (뒤에 "카드를 내렸다가 다시 보여 주세요" 안내가 붙는다) */
export const IDLE_LINES = [
  '천천히 골라 주셔도 돼요.',
  '생각할 시간은 충분해요.',
  '기다리고 있을게요.',
  '글자 색을 한번 봐 주세요.',
  '준비되시면 카드를 보여 주세요.',
];

/** 맞게 골랐을 때. 뒤에 "글자 색은 OO이었어요."가 붙으므로 색 이름은 넣지 않는다. 빠르기·눈을 평가하는 말은 쓰지 않는다 */
export const GOOD_LINES = [
  '잘하셨어요!',
  '잘 고르셨어요!',
  '바로 그거예요!',
  '멋져요!',
  '최고예요!',
  '역시 잘하시네요!',
];

/** 다르게 골랐을 때. 같은 문제를 다시 하지 않고 다음 문제로 넘어가므로 "다시·한 번 더"는 쓰지 않는다 */
export const RETRY_LINES = [
  '괜찮아요, 헷갈리기 쉬운 문제였어요.',
  '괜찮아요. 다음 문제도 같이 해 봐요.',
  '다음에는 글자 뜻 말고 글자 색을 봐 주세요.',
  '천천히 하셔도 돼요.',
  '이런 문제는 누구나 헷갈려요.',
  '괜찮아요, 다음 문제로 가 볼게요.',
];

/** 목록에서 하나 고르기. rand 는 0 이상 1 미만 (시험에서 고정값을 넣는다) */
export function pickLine(lines, rand = Math.random) {
  const i = Math.min(lines.length - 1, Math.floor(rand() * lines.length));
  return lines[i];
}

/** 맞게 골랐을 때 멘트. label = 고른 카드 색 이름 */
export function goodLine(label, rand = Math.random) {
  return pickLine(GOOD_LINES, rand).replace('{color}', label);
}

/** 다르게 골랐을 때 멘트 */
export function retryLine(rand = Math.random) {
  return pickLine(RETRY_LINES, rand);
}

/** 시작 멘트 */
export function startLine(rand = Math.random) {
  return pickLine(START_LINES, rand);
}

/** 답을 오래 기다릴 때 멘트 */
export function idleLine(rand = Math.random) {
  return pickLine(IDLE_LINES, rand);
}
