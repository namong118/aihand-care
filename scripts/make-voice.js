// 음성 파일 만들기: npm run voice  (#61, docs/voice.md)
//
// 1) STEP 1~4의 음성 문구를 모은다 (src/programs/voice-lines.js)
// 2) 문장으로 나눠 문장마다 WAV 파일을 만든다 → public/voice/<해시>.wav
//    목소리: Supertonic 3 (sherpa-onnx, 오프라인) 1번·품질 5. scripts/supertonic.py 가 만든다
// 3) 문장 ↔ 파일 표를 쓴다 → src/data/voice.json  (앱의 src/ui/voice.js 가 읽는다)
//
// 이미 있는 파일은 다시 만들지 않는다 (목소리 설정이 바뀌면 모두 다시). 모두 다시 만들려면: npm run voice -- --all
// 더 이상 쓰지 않는 문장의 파일은 지운다.
//
// Python 과 모델 준비: docs/voice.md "Supertonic 준비". Windows·라즈베리파이·맥 어디서나 된다.
//   VOICE_PYTHON: 쓸 python (기본: ~/aihand-ai/tts-venv 의 python, 없으면 python3/python)

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'voice');
const manifestPath = join(root, 'src', 'data', 'voice.json');
const script = join(root, 'scripts', 'supertonic.py');
const rebuildAll = process.argv.includes('--all');

/** 쓸 python 찾기: VOICE_PYTHON → ~/aihand-ai/tts-venv → python3 → python */
function findPython() {
  const venv = join(homedir(), 'aihand-ai', 'tts-venv');
  const candidates = [
    process.env.VOICE_PYTHON,
    join(venv, 'Scripts', 'python.exe'), // Windows
    join(venv, 'bin', 'python'), // 라즈베리파이·맥
    'python3',
    'python',
  ].filter(Boolean);
  for (const py of candidates) {
    const r = spawnSync(py, ['-c', 'import sherpa_onnx'], { stdio: 'ignore' });
    if (r.status === 0) return py;
  }
  console.error('sherpa-onnx 가 설치된 python 을 찾지 못했어요. docs/voice.md "Supertonic 준비"를 봐 주세요.');
  process.exit(1);
}

const python = findPython();
const env = { ...process.env, PYTHONIOENCODING: 'utf-8' }; // 문장 글자가 콘솔에서 깨지지 않게
const settingsRun = spawnSync(python, [script, 'settings'], { encoding: 'utf8', env });
if (settingsRun.status !== 0) {
  console.error(settingsRun.stderr || '목소리 설정을 읽지 못했어요');
  process.exit(1);
}
const VOICE = JSON.parse(settingsRun.stdout);

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
const sameVoice = JSON.stringify(old.voice) === JSON.stringify(VOICE);
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
  console.log(`음성 파일 ${jobs.length}개를 만들어요 (Supertonic 목소리 ${VOICE.voice}·품질 ${VOICE.steps})...`);
  const jobsPath = join(tmpdir(), `aihand-care-voice-${process.pid}.json`);
  writeFileSync(jobsPath, JSON.stringify(jobs), 'utf8');
  const result = spawnSync(python, [script, 'batch', jobsPath, outDir], { stdio: 'inherit', env });
  rmSync(jobsPath, { force: true });
  if (result.status !== 0) {
    console.error('음성 파일을 만들지 못했어요. 위의 오류를 확인해 주세요.');
    process.exit(1);
  }
}

// 문장 ↔ 파일 표 (가나다순으로 써서 변경 내용을 보기 쉽게)
const manifest = { voice: VOICE, files };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const counts = Object.entries(byProgram)
  .map(([id, lines]) => `${id} ${text.uniqueSentences(lines).length}`)
  .join(', ');
console.log(`완료: 문장 ${sentences.length}개 (${counts}), 새로 만듦 ${jobs.length}, 지움 ${removed}`);
console.log('→ public/voice/*.wav, src/data/voice.json');
