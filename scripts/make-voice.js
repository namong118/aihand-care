// 음성 파일 만들기: npm run voice  (Windows 전용, #61, docs/voice.md)
//
// 1) STEP 1~4의 음성 문구를 모은다 (src/programs/voice-lines.js)
// 2) 문장으로 나눠 문장마다 WAV 파일을 만든다 → public/voice/<해시>.wav  (Windows 한국어 음성 Heami, scripts/make-voice.ps1)
// 3) 문장 ↔ 파일 표를 쓴다 → src/data/voice.json  (앱의 src/ui/voice.js 가 읽는다)
//
// 이미 있는 파일은 다시 만들지 않는다. 모두 다시 만들려면: npm run voice -- --all
// 더 이상 쓰지 않는 문장의 파일은 지운다.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const VOICE = 'Microsoft Heami Desktop';
const RATE = -1;

// 앞뒤 무음 다듬기. Heami 는 앞에 약 0.18초, 뒤에 약 0.85초 무음을 넣는다.
// 앞 무음이 길면 "가위, 바위, 보!"의 "보!"가 코드가 부른 때보다 늦게 들린다 (STEP 2 동시에 모드는 "보!" 시각으로 판정).
// 뒤 무음은 문장을 이어서 재생할 때의 쉼으로 조금 남긴다.
const LEAD_MS = 30;
const TAIL_MS = 300;
const SILENCE = 300; // 이 크기(16비트 기준) 이하는 무음으로 본다

/** WAV(16비트 모노) 앞뒤 무음을 잘라 같은 파일에 다시 쓴다 */
function trimWav(path) {
  const buf = readFileSync(path);
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') fmt = { rate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22), channels: buf.readUInt16LE(pos + 10) };
    if (id === 'data') data = { start: pos + 8, size };
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16 || fmt.channels !== 1) return; // 예상과 다른 형식이면 그대로 둔다
  const count = data.size / 2;
  const sample = (k) => buf.readInt16LE(data.start + 2 * k);
  let first = 0;
  while (first < count && Math.abs(sample(first)) <= SILENCE) first++;
  if (first >= count) return; // 전부 무음
  let last = count - 1;
  while (last > first && Math.abs(sample(last)) <= SILENCE) last--;
  const from = Math.max(0, first - Math.round((fmt.rate * LEAD_MS) / 1000));
  const to = Math.min(count, last + 1 + Math.round((fmt.rate * TAIL_MS) / 1000));
  const pcm = buf.subarray(data.start + 2 * from, data.start + 2 * to);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVEfmt ', 8, 'ascii');
  head.writeUInt32LE(16, 16); // fmt 크기
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // 모노
  head.writeUInt32LE(fmt.rate, 24);
  head.writeUInt32LE(fmt.rate * 2, 28); // 1초당 바이트
  head.writeUInt16LE(2, 32); // 샘플 하나 바이트
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([head, pcm]));
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'voice');
const manifestPath = join(root, 'src', 'data', 'voice.json');
const rebuildAll = process.argv.includes('--all');

if (process.platform !== 'win32') {
  console.error('음성 파일은 Windows 한국어 음성(Heami)으로 만들어서 Windows 에서만 실행할 수 있어요.');
  process.exit(1);
}

// 프로그램 파일은 JSON 을 import 하므로 Vite 로 불러온다 (새 패키지 없이)
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
let byProgram;
let text;
try {
  ({ allVoiceLines: byProgram } = await server.ssrLoadModule('/src/programs/voice-lines.js'));
  text = await server.ssrLoadModule('/src/ui/voice-text.js');
  byProgram = byProgram();
} finally {
  await server.close();
}

const sentences = text.uniqueSentences(Object.values(byProgram).flat());
const files = {};
const owner = new Map(); // 파일 이름 → 문장 (해시가 겹치는지 확인)
for (const sentence of sentences) {
  const file = text.fileNameFor(sentence);
  if (owner.has(file)) {
    console.error(`파일 이름이 겹쳐요: "${owner.get(file)}" / "${sentence}"`);
    process.exit(1);
  }
  owner.set(file, sentence);
  files[sentence] = file;
}

mkdirSync(outDir, { recursive: true });
const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const TRIM = { leadMs: LEAD_MS, tailMs: TAIL_MS };
const sameVoice = old.voice === VOICE && old.rate === RATE && JSON.stringify(old.trim) === JSON.stringify(TRIM);
const jobs = sentences
  .filter((s) => rebuildAll || !sameVoice || !existsSync(join(outDir, files[s])))
  .map((s) => ({ text: text.toSpoken(s), file: files[s] }));

// 쓰지 않는 파일 지우기
let removed = 0;
for (const name of readdirSync(outDir)) {
  if (name.endsWith('.wav') && !owner.has(name)) {
    rmSync(join(outDir, name));
    removed++;
  }
}

if (jobs.length > 0) {
  console.log(`음성 파일 ${jobs.length}개를 만들어요 (${VOICE})...`);
  const jobsPath = join(tmpdir(), `aihand-care-voice-${process.pid}.json`);
  writeFileSync(jobsPath, JSON.stringify(jobs), 'utf8');
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'make-voice.ps1'), '-Jobs', jobsPath, '-OutDir', outDir, '-Voice', VOICE, '-Rate', String(RATE)];
  // PowerShell 7(pwsh)이 있으면 쓰고, 없으면 Windows 기본 PowerShell
  let result = spawnSync('pwsh', args, { stdio: 'inherit' });
  if (result.error) result = spawnSync('powershell', args, { stdio: 'inherit' });
  rmSync(jobsPath, { force: true });
  if (result.status !== 0) {
    console.error('음성 파일을 만들지 못했어요. 위의 오류를 확인해 주세요.');
    process.exit(1);
  }
  for (const job of jobs) trimWav(join(outDir, job.file));
}

// 문장 ↔ 파일 표 (가나다순으로 써서 변경 내용을 보기 쉽게)
const manifest = { voice: VOICE, rate: RATE, trim: TRIM, files };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const counts = Object.entries(byProgram)
  .map(([id, lines]) => `${id} ${text.uniqueSentences(lines).length}`)
  .join(', ');
console.log(`완료: 문장 ${sentences.length}개 (${counts}), 새로 만듦 ${jobs.length}, 지움 ${removed}`);
console.log('→ public/voice/*.wav, src/data/voice.json');
