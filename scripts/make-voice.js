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
const sameVoice = old.voice === VOICE && old.rate === RATE;
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
}

// 문장 ↔ 파일 표 (가나다순으로 써서 변경 내용을 보기 쉽게)
const manifest = { voice: VOICE, rate: RATE, files };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const counts = Object.entries(byProgram)
  .map(([id, lines]) => `${id} ${text.uniqueSentences(lines).length}`)
  .join(', ');
console.log(`완료: 문장 ${sentences.length}개 (${counts}), 새로 만듦 ${jobs.length}, 지움 ${removed}`);
console.log('→ public/voice/*.wav, src/data/voice.json');
