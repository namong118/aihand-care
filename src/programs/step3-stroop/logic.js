// STEP 3 색깔손: 문제 생성과 판정 (순수 함수, DOM·ctx 사용 금지)
//
// 화면에 색 이름 글자(예: "파랑")를 다른 색 잉크(예: 빨간색)로 보여준다.
// 사용자는 글자의 "뜻"이 아니라 "글자 색"에 맞는 색 태그를 고른다.
// colors 는 data/tags.json 모양: [{ id: 'RED', label: '빨강', color: '#...' }, ...]

/**
 * 난이도별 문제 종류
 *   easy:   글자 뜻과 색이 같다 (연습)
 *   normal: 같을 때도, 다를 때도 있다
 *   hard:   항상 다르다
 */
export const MODE_BY_DIFFICULTY = { easy: 'same', normal: 'mixed', hard: 'different' };

/**
 * 문제 하나 만들기
 * 반환: { wordId, inkId, congruent }
 *   wordId: 글자의 뜻, inkId: 글자 색(정답), congruent: 뜻과 색이 같은지
 */
export function makeQuestion(colors, difficulty = 'easy', rand = Math.random) {
  if (colors.length < 2) throw new Error('색이 2개 이상 있어야 합니다.');
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const mode = MODE_BY_DIFFICULTY[difficulty] ?? 'same';

  const word = pick(colors);
  let same;
  if (mode === 'same') same = true;
  else if (mode === 'different') same = false;
  else same = rand() < 0.5;

  const ink = same ? word : pick(colors.filter((c) => c.id !== word.id));
  return { wordId: word.id, inkId: ink.id, congruent: same };
}

/** 판정: 고른 태그가 글자 색과 같으면 정답. 글자 뜻을 고른 것인지도 알려준다. */
export function judge(question, tagId) {
  return {
    correct: tagId === question.inkId,
    pickedWord: !question.congruent && tagId === question.wordId,
  };
}
