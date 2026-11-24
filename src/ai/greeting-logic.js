// 코스 끝 "오늘의 한마디": 오프라인 AI(라즈베리파이 안의 작은 언어 모델)가 따뜻한 마무리 인사를 만든다.
// 순수 함수만 둔다 (DOM·fetch 사용 금지). 자세한 내용: docs/ai-greeting.md
//
// 원칙
// - AI 가 만든 말은 그대로 믿지 않는다. 금지어가 있거나 형식이 이상하면 버리고 미리 써 둔 인사(FALLBACK)를 쓴다.
// - 건강·치료·예방·효과처럼 지어낸 조언, 점수·평가처럼 들리는 말은 금지 (CLAUDE.md, docs/decisions.md 6번).
// - AI 에게는 활동 이름과 "모두 함께 했는지"만 준다. 숫자(완료 수·반응 시간)는 주지 않는다 (평가처럼 말할 수 있어서).

/**
 * 금지어. AI 인사에 하나라도 들어 있으면 쓰지 않는다.
 * 일부러 넓게 잡았다 (예: "건강하세요"처럼 좋은 뜻이어도 뺀다). 문장이 버려지면 미리 써 둔 인사를 쓰면 된다.
 */
export const BANNED_WORDS = [
  // 건강·의료 (지어낸 건강 조언 금지)
  '건강', '치매', '예방', '치료', '진단', '증상', '질병', '질환', '환자', '병원', '의사', '의학', '처방', '복용', '약을', '약은', '약도',
  '혈압', '혈당', '통증', '재활', '회복', '노화', '장수',
  // 효과·좋아진다는 주장
  '효과', '효능', '개선', '향상', '좋아지', '나아지', '젊어지', '튼튼', '강화', '도움이 되', '도움이 될', '도움이 돼', '좋습니다',
  '기억력', '인지', '두뇌', '뇌', '집중력', '근력', '근육', '운동 효과',
  // 점수·평가 (활동 기록만 말한다)
  '점수', '등급', '정답', '틀렸', '틀린', '실패', '못하', '부족', '잘하셨', '우수', '평균', '상위', '하위',
];

/** 인사로 쓸 수 있는 길이 (글자 수) */
export const MIN_LENGTH = 8;
export const MAX_LENGTH = 90;

// 그림 글자 (화면·음성에서 이상하게 보일 수 있어 뺀다)
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

/**
 * AI 답을 인사 모양으로 다듬기: 앞뒤 따옴표·그림 글자·줄바꿈 정리, 앞의 두 문장까지만.
 * 모델이 "인사:" 같은 머리말을 붙이면 뗀다.
 */
export function cleanGreeting(raw) {
  let text = String(raw ?? '')
    .replace(EMOJI, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(인사|답변|대답|로봇)\s*[:：]\s*/, '')
    .replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '')
    .trim();
  const sentences = text.match(/[^.!?。]+[.!?。]*/g) ?? [];
  text = sentences
    .slice(0, 2)
    .map((s) => s.trim())
    .join(' ')
    .trim();
  return text;
}

/**
 * 다듬은 인사를 써도 되는지.
 * 반환: { ok: true } | { ok: false, reason: 'empty'|'short'|'long'|'banned'|'not-korean'|'number', word? }
 */
export function checkGreeting(text) {
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length < MIN_LENGTH) return { ok: false, reason: 'short' };
  if (text.length > MAX_LENGTH) return { ok: false, reason: 'long' };
  // 띄어쓰기를 빼고도 본다: "잘 하셨어요", "도움이  돼요" 처럼 띄어 써서 빠져나가지 않게
  const compact = text.replace(/\s+/g, '');
  const word = BANNED_WORDS.find((w) => text.includes(w) || compact.includes(w.replace(/\s+/g, '')));
  if (word) return { ok: false, reason: 'banned', word };
  // 영어·한자 등이 섞이면 모델이 엉뚱하게 답한 것으로 본다
  if (/[A-Za-z一-鿿]/.test(text)) return { ok: false, reason: 'not-korean' };
  // 숫자를 말하면 기록을 평가처럼 말할 수 있다
  if (/[0-9]/.test(text)) return { ok: false, reason: 'number' };
  return { ok: true };
}

/** 미리 써 둔 인사 (AI 를 쓸 수 없거나 AI 답을 버렸을 때). 금지어가 없는지 테스트로 확인한다 */
export const FALLBACK_GREETINGS = [
  '오늘도 함께해 주셔서 고마워요. 다음에 또 반갑게 만나요!',
  '손으로 함께한 시간이 즐거웠어요. 편히 쉬세요!',
  '오늘 함께해서 정말 즐거웠어요. 좋은 하루 보내세요!',
  '로봇도 오늘 함께해서 신났어요. 다음에 또 만나요!',
];

/** 네 가지 활동을 모두 함께 했을 때 */
export const FALLBACK_ALL_DONE = [
  '네 가지 활동을 끝까지 함께해 주셨어요. 고마워요, 다음에 또 만나요!',
  '오늘 활동을 모두 함께했어요. 즐거운 하루 보내세요!',
];

/** 미리 써 둔 인사 고르기. rand 는 0 이상 1 미만 */
export function fallbackGreeting(summary, rand = Math.random) {
  const list = playedAll(summary) ? [...FALLBACK_ALL_DONE, ...FALLBACK_GREETINGS] : FALLBACK_GREETINGS;
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
}

function playedAll(summary) {
  return Boolean(summary?.finished && summary.activities?.length && summary.activities.every((a) => a.status === 'played'));
}

/**
 * AI 에게 보낼 대화 (OpenAI 형식 messages).
 *   summary: summarizeCourse() 결과, titleOf: 프로그램 id → 화면 이름 ('step4-coach' → '손운동'), name: 호칭(없으면 null)
 * 숫자(완료 수·시간)는 넣지 않는다.
 */
export function buildMessages({ summary, titleOf, name = null }) {
  const played = (summary?.activities ?? []).filter((a) => a.status === 'played').map((a) => titleOf(a.program));
  const system = [
    '너는 어르신이 손으로 하는 활동 프로그램 "손잇다"의 다정한 로봇 친구다.',
    '활동을 마친 어르신께 마무리 인사를 한다.',
    '규칙:',
    '- 한국어 존댓말로 1~2문장, 60자 이내로 짧게 말한다.',
    '- 함께해 주셔서 고맙다, 즐거웠다, 다음에 또 만나자 같은 따뜻한 말만 한다.',
    '- 건강, 병, 치료, 예방, 효과, 기억력, 두뇌, 운동 효과 같은 말은 절대 하지 않는다.',
    '- 점수, 평가, 잘했다·못했다, 숫자는 말하지 않는다.',
    '- 인사말만 쓰고 다른 설명은 쓰지 않는다.',
  ].join('\n');
  const parts = [];
  if (name) parts.push(`호칭: ${name}`);
  parts.push(played.length ? `오늘 함께한 활동: ${played.join(', ')}` : '오늘 함께한 활동: 없음');
  if (playedAll(summary)) parts.push('네 가지 활동을 모두 함께했다.');
  parts.push('마무리 인사를 해 줘.');
  return [
    { role: 'system', content: system },
    { role: 'user', content: parts.join('\n') },
  ];
}
