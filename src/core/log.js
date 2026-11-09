// 활동 기록: 회차가 끝날 때마다 공통 필드로 저장하고, 요약·CSV 내보내기를 한다.
// 기록은 브라우저 localStorage 에 저장된다 (이 컴퓨터, 이 브라우저에만 남는다).
// 개인정보는 저장하지 않는다. 사용자 구분 없이 날짜순 기록만 남긴다.
// (예전 버전 기록에 있던 user 값은 읽을 때 버린다)

export const STORAGE_KEY = 'aihand-care.records.v1';

// CLAUDE.md 의 공통 필드. CSV 열 순서도 이 순서를 따른다.
export const FIELDS = [
  'program',
  'startedAt',
  'endedAt',
  'total',
  'done',
  'skipped',
  'avgReactionMs',
  'detail',
];

const REQUIRED = ['program', 'startedAt', 'endedAt', 'total', 'done'];

/**
 * 기록 한 건을 검사하고 빠진 선택 필드를 기본값으로 채운다.
 * 필수 필드가 없으면 에러 (개발 중에 바로 알 수 있게).
 */
export function normalizeRecord(input) {
  const missing = REQUIRED.filter((k) => input[k] === undefined || input[k] === null || input[k] === '');
  if (missing.length > 0) {
    throw new Error(`기록에 필수 항목이 없습니다: ${missing.join(', ')}`);
  }
  if (!Number.isFinite(input.total) || !Number.isFinite(input.done)) {
    throw new Error('total 과 done 은 숫자여야 합니다.');
  }
  return {
    program: input.program,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    total: input.total,
    done: input.done,
    skipped: input.skipped ?? 0,
    avgReactionMs: input.avgReactionMs ?? null,
    detail: input.detail ?? {},
  };
}

/** 숫자 배열의 평균. 비어 있으면 null. 반올림해서 정수 ms 로. */
export function average(numbers) {
  const valid = numbers.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/**
 * 프로그램별 요약.
 * 반환: { [program]: { count, total, done, skipped, doneRate, avgReactionMs } }
 *   count: 회차 수, doneRate: done 합 / total 합 (0~1, total 이 0이면 null)
 */
export function summarize(records) {
  const result = {};
  for (const r of records) {
    const s = (result[r.program] ??= {
      count: 0,
      total: 0,
      done: 0,
      skipped: 0,
      reactions: [],
    });
    s.count += 1;
    s.total += r.total;
    s.done += r.done;
    s.skipped += r.skipped ?? 0;
    if (Number.isFinite(r.avgReactionMs)) s.reactions.push(r.avgReactionMs);
  }
  for (const key of Object.keys(result)) {
    const s = result[key];
    s.doneRate = s.total > 0 ? s.done / s.total : null;
    s.avgReactionMs = average(s.reactions);
    delete s.reactions;
  }
  return result;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싸고, 안의 따옴표는 두 번 쓴다.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 기록 배열을 CSV 문자열로. 엑셀에서 한글이 깨지지 않도록 BOM 은 downloadCSV 에서 붙인다. */
export function toCSV(records) {
  const lines = [FIELDS.join(',')];
  for (const r of records) {
    lines.push(FIELDS.map((f) => csvCell(r[f])).join(','));
  }
  return lines.join('\r\n');
}

/** 메모리 저장소 (테스트용, 또는 localStorage 를 쓸 수 없을 때). */
export function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = '__aihand_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    console.warn('localStorage 를 쓸 수 없어 기록을 메모리에만 저장합니다 (새로고침하면 사라짐).');
    return createMemoryStorage();
  }
}

/**
 * 저장소에서 읽은 기록 한 건을 지금 모양으로 바꾼다. 읽을 수 없는 기록이면 null.
 * 예전 버전 기록(user 포함)도 깨지지 않게 읽고, user 는 버린다.
 */
export function fromStored(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.program !== 'string') return null;
  const total = Number(raw.total);
  const done = Number(raw.done);
  if (!Number.isFinite(total) || !Number.isFinite(done)) return null;
  return {
    program: raw.program,
    startedAt: raw.startedAt ?? '',
    endedAt: raw.endedAt ?? '',
    total,
    done,
    skipped: Number.isFinite(raw.skipped) ? raw.skipped : 0,
    avgReactionMs: Number.isFinite(raw.avgReactionMs) ? raw.avgReactionMs : null,
    detail: raw.detail && typeof raw.detail === 'object' ? raw.detail : {},
  };
}

/** 시작 시각 오름차순 (오래된 것부터). 시각이 같거나 읽을 수 없으면 저장된 순서를 지킨다. */
export function sortByDate(records) {
  const time = (r) => {
    const t = Date.parse(r.startedAt);
    return Number.isNaN(t) ? Infinity : t;
  };
  return records
    .map((r, i) => [r, i])
    .sort(([a, i], [b, j]) => time(a) - time(b) || i - j)
    .map(([r]) => r);
}

/**
 * 기록 저장소를 만든다.
 * ctx.log 로 공개되는 것은 record 하나지만, 대시보드는 list·clear·downloadCSV 도 쓴다.
 */
export function createLog({ storage = defaultStorage() } = {}) {
  function load() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(fromStored).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  function save(records) {
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  const listeners = new Set();

  return {
    /** 회차 기록 한 건 저장. 저장된 기록을 돌려준다. */
    record(input) {
      const rec = normalizeRecord(input);
      const records = load();
      records.push(rec);
      save(records);
      listeners.forEach((cb) => cb(rec));
      return rec;
    },
    /** 저장된 기록 전체, 날짜순 (오래된 것부터). program 을 주면 그 프로그램만. */
    list({ program } = {}) {
      return sortByDate(load().filter((r) => !program || r.program === program));
    },
    clear() {
      save([]);
    },
    onRecord(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/** 브라우저에서 CSV 파일을 내려받게 한다 (화면 전용, 테스트하지 않음). */
export function downloadCSV(records, filename = 'aihand-activity.csv') {
  const blob = new Blob(['﻿' + toCSV(records)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
