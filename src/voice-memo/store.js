// 한마디 녹음 저장소: 브라우저 IndexedDB (스테이션 기기 안에만). 녹음 파일(blob)은 localStorage 에 넣기 어려워서 IndexedDB 를 쓴다.
// 시제품: 보호자 폰으로 보내지 않는다. 사용자마다 최근 KEEP_PER_USER 개만 남긴다.

import { memosToDrop } from './logic.js';

const DB_NAME = 'aihand-care-voice-memo';
const STORE = 'memos';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저는 녹음을 저장할 수 없어요'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 저장소 한 번 쓰기. fn(store) 가 돌려준 요청의 결과로 resolve */
async function run(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** 모든 한마디 (blob 포함) */
export function listMemos() {
  return run('readonly', (s) => s.getAll());
}

/** 한마디 저장 { ...memoMeta, blob }. 저장한 뒤 그 사용자의 오래된 것을 지운다 */
export async function saveMemo(memo) {
  await run('readwrite', (s) => s.put(memo));
  const drop = memosToDrop(await listMemos(), memo.userId);
  for (const id of drop) await run('readwrite', (s) => s.delete(id));
  return { dropped: drop.length };
}
