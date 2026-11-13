// 시연 코스 진행 정보 저장: 코스마다 { id, plan, skipped, finished, endedAt }.
// 활동 결과는 ctx.log 기록에 있고(detail.course), 여기에는 기록으로 알 수 없는 것만 둔다:
//   - 어떤 순서로 하려던 코스인지 (plan: 프로그램 id 목록)
//   - "이 활동 건너뛰기"로 넘어간 활동 (skipped: order 목록)
//   - "코스 마치기"까지 갔는지 (finished), 끝낸 시각 (endedAt)
// 기록과 같은 이유로 이 브라우저(localStorage)에만 남는다. 개인정보는 넣지 않는다.

import { createMemoryStorage } from '../core/log.js';

export const COURSE_STORAGE_KEY = 'aihand-care.courses.v1';

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // 막혀 있으면 아래 메모리 저장소
  }
  return createMemoryStorage();
}

/**
 * @param {{ storage?: Storage }} o  테스트에서는 createMemoryStorage()
 * @returns { start(meta), skip(id, order), end(id, { finished, endedAt }), get(id), list() }
 */
export function createCourseStore({ storage = defaultStorage() } = {}) {
  function load() {
    try {
      const parsed = JSON.parse(storage.getItem(COURSE_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.id === 'string' && Array.isArray(m.plan)) : [];
    } catch {
      return [];
    }
  }
  function save(list) {
    try {
      storage.setItem(COURSE_STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.error('코스 진행 정보를 저장하지 못했어요', err);
    }
  }
  function update(id, fn) {
    const list = load();
    const meta = list.find((m) => m.id === id);
    if (!meta) return null;
    fn(meta);
    save(list);
    return meta;
  }

  return {
    /** 코스 시작. plan: 프로그램 id 목록 */
    start({ id, plan }) {
      const meta = { id, plan: [...plan], skipped: [], finished: false, endedAt: null };
      save([...load().filter((m) => m.id !== id), meta]);
      return meta;
    },
    /** "이 활동 건너뛰기" */
    skip(id, order) {
      return update(id, (m) => {
        if (!m.skipped.includes(order)) m.skipped.push(order);
      });
    },
    /** 코스 끝 (마치기 = finished true, 그만하기 = false) */
    end(id, { finished, endedAt }) {
      return update(id, (m) => {
        m.finished = Boolean(finished);
        m.endedAt = endedAt;
      });
    },
    get(id) {
      return load().find((m) => m.id === id) ?? null;
    },
    list() {
      return load();
    },
  };
}
