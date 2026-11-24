// "가족에게 한마디 남기기" 화면 (시제품, 팀 확인 전). 코스 끝 요약 화면에서 들어온다.
// 흐름: 안내·동의 → 녹음(최대 20초) → 들어 보기 / 다시 녹음 / 이대로 남기기 → 이 기기에 저장
// 보호자 폰으로 보내지 않는다. 화면에도 그렇게 알린다 (사실과 다르게 "전해 드릴게요"라고 하지 않는다).

import { h, button, message } from '../ui/components.js';
import { MAX_RECORD_MS, clockText, progressText, memoMeta } from './logic.js';
import { startRecording } from './recorder.js';
import { saveMemo } from './store.js';

/**
 * @param container  그릴 곳 (#app)
 * @param o.summary  summarizeCourse() 결과 (userId, courseId)
 * @param o.who      지금 하시는 분 표시 (코스 화면 위쪽과 같은 것, 없으면 null)
 * @param o.onDone   끝났을 때·남기지 않을 때 (코스 요약으로 돌아가기)
 * @returns { close() }  화면을 떠날 때 녹음·재생을 멈춘다
 */
export function renderVoiceMemo(container, { summary, who = null, onDone }) {
  let recording = null; // 녹음 중이면 startRecording() 결과
  let timer = null;
  let audio = null; // 들어 보기
  let audioUrl = null;
  let closed = false;

  function cleanup() {
    clearInterval(timer);
    timer = null;
    recording?.cancel();
    recording = null;
    audio?.pause();
    audio = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }

  function show(...children) {
    if (closed) return;
    container.innerHTML = '';
    container.append(h('div', { class: 'course' }, who, h('h1', {}, '가족에게 한마디 남기기'), ...children.flat().filter(Boolean)));
  }

  const done = () => {
    close();
    onDone();
  };

  function intro() {
    show(
      h('p', {}, '오늘 활동을 마친 느낌이나 가족에게 하고 싶은 말을 녹음할 수 있어요.'),
      h('p', {}, `한 번에 ${MAX_RECORD_MS / 1000}초까지 녹음돼요. 녹음한 뒤 직접 들어 보고 남길지 정할 수 있어요.`),
      message('녹음한 목소리는 이 기기에만 저장돼요. 보호자 폰으로 보내는 기능은 아직 준비 중이에요.', 'info'),
      h('div', { class: 'row' }, button('녹음할게요', record), button('괜찮아요', done, { variant: 'secondary' })),
    );
  }

  async function record() {
    cleanup();
    show(message('마이크를 켜고 있어요. 잠시만 기다려 주세요.', 'info'));
    try {
      recording = await startRecording();
    } catch (err) {
      failed(err.message);
      return;
    }
    if (closed) {
      recording.cancel();
      return;
    }
    const startedAt = Date.now();
    const time = h('p', { class: 'act-prompt', 'aria-live': 'off', style: { 'font-size': '56px' } }, progressText(0));
    // 20초가 되기 전에도 언제든 멈출 수 있다. "그만하기" 하나만 두면 녹음을 버리는 버튼으로 읽혀서 셋으로 나눴다
    show(
      h('div', { class: 'act-card' }, h('p', { class: 'act-question' }, '● 녹음하고 있어요. 말씀해 주세요.'), time),
      h(
        'div',
        { class: 'row' },
        button('■ 여기까지 남기기', () => stop('save')),
        button('멈추고 들어 보기', () => stop('review'), { variant: 'secondary' }),
        button('그만두기', giveUp, { variant: 'secondary' }),
      ),
      h('p', {}, `${MAX_RECORD_MS / 1000}초가 되면 저절로 멈추고 들어 보기로 넘어가요.`),
    );
    timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      time.textContent = progressText(elapsed);
      if (elapsed >= MAX_RECORD_MS) stop('review');
    }, 200);
  }

  /** 녹음 멈추기. next: 'save' 바로 남기기 / 'review' 들어 보고 정하기 */
  async function stop(next) {
    if (!recording) return;
    clearInterval(timer);
    timer = null;
    const rec = recording;
    recording = null;
    const result = await rec.stop();
    if (closed) return;
    if (next === 'save') save(result);
    else review(result);
  }

  /** 이번 녹음은 버리고 처음 안내로 */
  function giveUp() {
    cleanup();
    intro();
  }

  function review(result) {
    audioUrl = URL.createObjectURL(result.blob);
    audio = new Audio(audioUrl);
    show(
      message(`${clockText(result.durationMs)} 동안 녹음했어요. 한번 들어 보세요.`, 'good'),
      h(
        'div',
        { class: 'row' },
        button('▶ 들어 보기', () => {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }),
        button('다시 녹음하기', record, { variant: 'secondary' }),
      ),
      h('div', { class: 'row' }, button('이대로 남기기', () => save(result)), button('남기지 않기', done, { variant: 'secondary' })),
    );
  }

  async function save(result) {
    try {
      await saveMemo({ ...memoMeta({ summary, durationMs: result.durationMs, mimeType: result.mimeType }), blob: result.blob });
    } catch (err) {
      console.error('한마디를 저장하지 못했어요', err);
      failed('한마디를 저장하지 못했어요. 다시 해 볼까요?');
      return;
    }
    cleanup();
    show(
      message('한마디를 남겼어요. 이 기기에 저장했어요.', 'good'),
      h('p', {}, '보호자 폰으로 보내는 기능은 아직 준비 중이에요.'),
      h('div', { class: 'row' }, button('돌아가기', done)),
    );
  }

  function failed(text) {
    cleanup();
    show(message(text, 'retry'), h('div', { class: 'row' }, button('다시 해 보기', record), button('돌아가기', done, { variant: 'secondary' })));
  }

  function close() {
    closed = true;
    cleanup();
  }

  intro();
  return { close };
}
