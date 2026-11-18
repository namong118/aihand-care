import { describe, it, expect } from 'vitest';
import {
  CODE_CHARS,
  makeCode,
  isValidCode,
  formatCode,
  pairingUrl,
  parsePairingUrl,
  sendMode,
  shouldSend,
  pairingsOf,
  addPairing,
  removePairing,
  removeUserPairings,
  pairingItem,
  summaryItem,
  revokeItem,
  enqueue,
  orderOutbox,
  markSent,
  markFailed,
  forgetInOutbox,
  flushOutbox,
  outboxStatusOf,
  parseOutbox,
  parsePairings,
} from './logic.js';

const NOW = Date.parse('2026-11-19T01:00:00.000Z');
const ALICE = 'u-2026-11-13T10:00:00.000Z';
const BOB = 'u-2026-11-13T10:05:00.000Z';
const CODE_A = 'ABCDEFGHJKMN';
const CODE_B = 'PQRSTUVWXYZ2';

/** 정해진 숫자로 채우는 가짜 무작위 함수 */
function fillWith(nums) {
  return (arr) => {
    arr.forEach((_, i) => (arr[i] = nums[i % nums.length]));
    return arr;
  };
}

function summary(fields = {}) {
  return { version: 1, courseId: '2026-11-19T00:30:00.000Z', userId: ALICE, who: 'user', activities: [], ...fields };
}

describe('연결 코드', () => {
  it('헷갈리는 글자 0·O·1·I·L을 뺀 31글자만 쓴다', () => {
    expect(CODE_CHARS).toHaveLength(31);
    for (const c of '0O1IL') expect(CODE_CHARS).not.toContain(c);
  });

  it('12글자를 만들고, 무작위 숫자를 31로 나눈 나머지로 글자를 고른다', () => {
    expect(makeCode(fillWith([0]))).toBe('AAAAAAAAAAAA');
    expect(makeCode(fillWith([30]))).toBe('999999999999');
    expect(makeCode(fillWith([31, 32]))).toBe('ABABABABABAB'); // 31 → 0번째, 32 → 1번째
  });

  it('만든 코드는 언제나 맞는 모양이다', () => {
    const code = makeCode(fillWith([4294967295, 123456789, 7]));
    expect(isValidCode(code)).toBe(true);
  });

  it('모양이 틀린 코드를 걸러 낸다', () => {
    expect(isValidCode(CODE_A)).toBe(true);
    expect(isValidCode('ABCD')).toBe(false); // 짧음
    expect(isValidCode('ABCDEFGHJKM0')).toBe(false); // 0 들어감
    expect(isValidCode('abcdefghjkmn')).toBe(false); // 소문자
    expect(isValidCode(null)).toBe(false);
  });

  it('화면에는 4글자씩 끊어 보여 준다', () => {
    expect(formatCode(CODE_A)).toBe('ABCD-EFGH-JKMN');
  });
});

describe('QR 주소', () => {
  it('배포 주소 guardian/ 뒤 # 에 코드와 호칭을 넣는다', () => {
    expect(pairingUrl(CODE_A, '봄날 어르신')).toBe(
      'https://namong118.github.io/aihand-care/guardian/#c=ABCDEFGHJKMN&n=%EB%B4%84%EB%82%A0%20%EC%96%B4%EB%A5%B4%EC%8B%A0',
    );
  });

  it('base 끝에 / 가 없어도 붙여 준다', () => {
    expect(pairingUrl(CODE_A, '해님', 'http://localhost:5173')).toMatch(/^http:\/\/localhost:5173\/guardian\/#c=/);
  });

  it('주소에서 코드와 호칭을 다시 꺼낼 수 있다 (& 같은 글자가 호칭에 있어도)', () => {
    expect(parsePairingUrl(pairingUrl(CODE_A, '봄&날 #1'))).toEqual({ code: CODE_A, name: '봄&날 #1' });
    expect(parsePairingUrl('https://example.com/')).toEqual({ code: null, name: null });
  });
});

describe('sendMode', () => {
  const full = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', VITE_STATION_KEY: 'secret' };

  it('세 값이 모두 있으면 진짜로 보낸다', () => {
    expect(sendMode(full)).toEqual({ mock: false, missing: [] });
  });

  it('하나라도 없거나 비어 있으면 Mock 이고, 빠진 이름만 알려 준다 (값은 담지 않음)', () => {
    expect(sendMode({ ...full, VITE_STATION_KEY: '' })).toEqual({ mock: true, missing: ['VITE_STATION_KEY'] });
    expect(sendMode({})).toEqual({
      mock: true,
      missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_STATION_KEY'],
    });
  });
});

describe('shouldSend', () => {
  const pairings = [{ code: CODE_A, userId: ALICE, createdAt: '2026-11-18T00:00:00.000Z' }];

  it('연결한 분의 코스는 보낸다', () => {
    expect(shouldSend(summary(), pairings)).toEqual({ send: true });
  });

  it('손님 코스는 보내지 않는다', () => {
    expect(shouldSend(summary({ userId: null, who: 'guest' }), pairings)).toEqual({ send: false, reason: 'guest' });
  });

  it('로그인 기능 전 코스(who: unknown)는 보내지 않는다', () => {
    expect(shouldSend(summary({ userId: null, who: 'unknown' }), pairings)).toEqual({ send: false, reason: 'unknown' });
  });

  it('보호자 앱을 연결하지 않은 분은 보내지 않는다', () => {
    expect(shouldSend(summary({ userId: BOB }), pairings)).toEqual({ send: false, reason: 'no-pairing' });
  });

  it('요약이 없으면 보내지 않는다', () => {
    expect(shouldSend(null, pairings)).toEqual({ send: false, reason: 'no-summary' });
  });
});

describe('연결 목록', () => {
  const list = [
    { code: CODE_B, userId: ALICE, createdAt: '2026-11-19T00:00:00.000Z' },
    { code: CODE_A, userId: ALICE, createdAt: '2026-11-18T00:00:00.000Z' },
    { code: 'JKMNPQRSTUVW', userId: BOB, createdAt: '2026-11-18T00:00:00.000Z' },
  ];

  it('한 사용자에 코드 여러 개, 먼저 연결한 것부터', () => {
    expect(pairingsOf(list, ALICE).map((p) => p.code)).toEqual([CODE_A, CODE_B]);
  });

  it('더하기·끊기·사용자 지우기', () => {
    expect(addPairing([], list[0])).toEqual([list[0]]);
    expect(removePairing(list, CODE_A).map((p) => p.code)).toEqual([CODE_B, 'JKMNPQRSTUVW']);
    expect(removeUserPairings(list, ALICE).map((p) => p.userId)).toEqual([BOB]);
  });
});

describe('대기열', () => {
  it('같은 코스 요약은 두 번 넣지 않는다 (courseId)', () => {
    let q = enqueue([], summaryItem(summary(), NOW));
    q = enqueue(q, summaryItem(summary(), NOW + 1000));
    expect(q).toHaveLength(1);
    q = enqueue(q, summaryItem(summary({ courseId: '2026-11-19T00:50:00.000Z' }), NOW));
    expect(q).toHaveLength(2);
  });

  it('새 칸은 tries 0 으로 시작하고 요약을 그대로 담는다', () => {
    const it0 = summaryItem(summary(), NOW);
    expect(it0).toMatchObject({ kind: 'summary', userId: ALICE, tries: 0, lastTriedAt: null, payload: summary() });
    expect(it0.addedAt).toBe('2026-11-19T01:00:00.000Z');
  });

  it('연결 코드(pairing)를 요약(summary)보다 먼저 보낸다. 늦게 넣었어도', () => {
    let q = enqueue([], summaryItem(summary(), NOW));
    q = enqueue(q, revokeItem({ code: CODE_B, userId: BOB }, NOW));
    q = enqueue(q, pairingItem({ code: CODE_A, userId: ALICE }, NOW + 5000));
    expect(orderOutbox(q).map((it) => it.kind)).toEqual(['pairing', 'summary', 'revoke']);
  });

  it('같은 종류는 넣은 순서대로', () => {
    let q = enqueue([], summaryItem(summary({ courseId: 'b' }), NOW + 1000));
    q = enqueue(q, summaryItem(summary({ courseId: 'a' }), NOW));
    expect(orderOutbox(q).map((it) => it.courseId)).toEqual(['a', 'b']);
  });

  it('성공하면 빼고, 실패하면 남겨 두고 tries 를 올린다', () => {
    const q = [summaryItem(summary(), NOW)];
    const id = q[0].id;
    expect(markSent(q, id)).toEqual([]);
    const failed = markFailed(markFailed(q, id, NOW, '인터넷 없음'), id, NOW + 60000, '인터넷 없음');
    expect(failed[0]).toMatchObject({ tries: 2, lastTriedAt: '2026-11-19T01:01:00.000Z', lastError: '인터넷 없음' });
  });

  it('사용자를 지우면 그 사람의 못 보낸 일은 빼고 지우기 요청만 남긴다', () => {
    let q = enqueue([], pairingItem({ code: CODE_A, userId: ALICE }, NOW));
    q = enqueue(q, summaryItem(summary(), NOW));
    q = enqueue(q, revokeItem({ code: CODE_A, userId: ALICE }, NOW));
    q = enqueue(q, pairingItem({ code: CODE_B, userId: BOB }, NOW));
    q = forgetInOutbox(q, ALICE, NOW);
    expect(q.map((it) => it.id)).toEqual([`pairing:${CODE_B}`, `forget:${ALICE}`]);
  });

  it('outboxStatus 모양', () => {
    expect(outboxStatusOf([1, 2], { lastSentAt: null, mock: true })).toEqual({ waiting: 2, lastSentAt: null, mock: true });
  });
});

describe('flushOutbox', () => {
  /** 메모리 대기열 + 보낸 순서 기록 */
  function setup(items, failIds = []) {
    let q = items;
    const sentIds = [];
    return {
      load: () => q,
      save: (next) => (q = next),
      send: async (it) => {
        if (failIds.includes(it.id)) throw new Error('인터넷 없음');
        sentIds.push(it.id);
      },
      now: () => NOW,
      get queue() {
        return q;
      },
      sentIds,
    };
  }

  it('순서대로 모두 보내고 대기열을 비운다', async () => {
    const s = setup([summaryItem(summary(), NOW), pairingItem({ code: CODE_A, userId: ALICE }, NOW)]);
    const result = await flushOutbox(s);
    expect(result).toEqual({ sent: 2, failed: null });
    expect(s.sentIds).toEqual([`pairing:${CODE_A}`, `summary:${ALICE}:${summary().courseId}`]);
    expect(s.queue).toEqual([]);
  });

  it('하나가 실패하면 거기서 멈추고, 실패한 칸과 뒤의 칸은 남긴다', async () => {
    const pair = pairingItem({ code: CODE_A, userId: ALICE }, NOW);
    const sum = summaryItem(summary(), NOW);
    const s = setup([sum, pair], [pair.id]);
    const result = await flushOutbox(s);
    expect(result.sent).toBe(0);
    expect(result.failed.id).toBe(pair.id);
    expect(s.sentIds).toEqual([]); // 연결 코드가 못 갔으니 요약도 보내지 않음
    expect(s.queue.find((it) => it.id === pair.id).tries).toBe(1);
    expect(s.queue.find((it) => it.id === sum.id).tries).toBe(0);
  });

  it('보내는 동안 새로 들어온 칸도 잃지 않고 보낸다', async () => {
    const first = summaryItem(summary(), NOW);
    const later = summaryItem(summary({ courseId: 'later' }), NOW);
    const s = setup([first]);
    const send = s.send;
    s.send = async (it) => {
      if (it.id === first.id) s.save(enqueue(s.load(), later)); // 보내는 중에 코스가 하나 더 끝남
      await send(it);
    };
    await flushOutbox(s);
    expect(s.sentIds).toEqual([first.id, later.id]);
    expect(s.queue).toEqual([]);
  });

  it('대기열이 비어 있으면 아무것도 하지 않는다', async () => {
    const s = setup([]);
    expect(await flushOutbox(s)).toEqual({ sent: 0, failed: null });
  });
});

describe('저장된 값 읽기', () => {
  it('깨진 값이면 빈 목록', () => {
    expect(parseOutbox('{깨짐')).toEqual([]);
    expect(parseOutbox('{"a":1}')).toEqual([]);
    expect(parseOutbox(null)).toEqual([]);
    expect(parsePairings('not json')).toEqual([]);
  });

  it('모양이 틀린 칸만 버린다', () => {
    const good = summaryItem(summary(), NOW);
    const raw = JSON.stringify([good, { id: 'x', kind: 'mystery' }, null, 'text']);
    expect(parseOutbox(raw)).toEqual([good]);

    const pairing = { code: CODE_A, userId: ALICE, createdAt: '2026-11-18T00:00:00.000Z' };
    const rawPairings = JSON.stringify([pairing, { code: 'short', userId: ALICE }, { code: CODE_B }]);
    expect(parsePairings(rawPairings)).toEqual([pairing]);
  });
});
