# Supertonic 한국어 음성 (sherpa-onnx, 오프라인). 문서: docs/voice.md
#
# 두 가지로 쓴다.
#   1) 음성 파일 만들기 (npm run voice 가 부른다):
#        python scripts/supertonic.py batch <jobs.json> <저장 폴더>
#        jobs.json = [{ "text": 읽을 글자, "file": 파일 이름 }, ...]
#   2) 실시간 읽기 서버 (라즈베리파이에서 켜 둔다. AI 인사처럼 매번 다른 문장용):
#        python scripts/supertonic.py serve            → http://127.0.0.1:8090
#        POST /tts  {"text": "..."}  → audio/wav       GET /health → ok
#      같은 기기(127.0.0.1)에서만 받는다. 앱은 Vite 의 /tts 넘기기로 부른다 (vite.config.js)
#
# 설정은 여기 한곳에: 목소리 1번, 품질(num_steps) 5, CPU 2개 (2026-11-25 D가 들어 보고 정함)
# 모델 폴더: 환경 변수 VOICE_MODEL_DIR, 없으면 ~/aihand-ai/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11
# 필요한 것: pip install sherpa-onnx (numpy 없이 동작)

import array
import io
import json
import os
import pathlib
import sys
import time
import wave
from http.server import BaseHTTPRequestHandler, HTTPServer

import sherpa_onnx

VOICE_ID = 1  # 목소리 번호 (0~9)
STEPS = 5  # 품질: 3 은 어색했고 8 은 느렸다
SPEED = 1.0
THREADS = 2  # 4개로 늘려도 거의 빨라지지 않았다. 적게 써서 라즈베리파이 열을 줄인다
LANG = 'ko'
OUT_RATE = 22050  # Supertonic 은 44100 Hz. 목소리에는 22050 이면 충분하고 파일이 절반이 된다
LEAD_MS = 30  # 앞 무음 (짧을수록 빨리 들린다)
TAIL_MS = 300  # 뒤 무음 (문장을 이어 읽을 때 쉼)
SILENCE = 300  # 16비트 기준 이 크기 이하는 무음으로 본다

DEFAULT_MODEL = pathlib.Path.home() / 'aihand-ai' / 'tts-models' / 'sherpa-onnx-supertonic-3-tts-int8-2026-05-11'


def load_tts():
    d = pathlib.Path(os.environ.get('VOICE_MODEL_DIR') or DEFAULT_MODEL)
    if not (d / 'tts.json').exists():
        sys.exit(f'Supertonic 모델이 없어요: {d}\n  docs/voice.md "Supertonic 준비"를 봐 주세요 (VOICE_MODEL_DIR 로 폴더를 바꿀 수 있어요)')
    f = lambda name: str(d / name)
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
                duration_predictor=f('duration_predictor.int8.onnx'),
                text_encoder=f('text_encoder.int8.onnx'),
                vector_estimator=f('vector_estimator.int8.onnx'),
                vocoder=f('vocoder.int8.onnx'),
                tts_json=f('tts.json'),
                unicode_indexer=f('unicode_indexer.bin'),
                voice_style=f('voice.bin'),
            ),
            num_threads=THREADS,
            provider='cpu',
        )
    )
    return sherpa_onnx.OfflineTts(config)


def synthesize(tts, text):
    """글자 → 16비트 모노 PCM (OUT_RATE), 앞뒤 무음 다듬음"""
    g = sherpa_onnx.GenerationConfig()
    g.sid = VOICE_ID
    g.num_steps = STEPS
    g.speed = SPEED
    g.extra['lang'] = LANG
    audio = tts.generate(text, g)
    samples = [max(-32768, min(32767, int(s * 32767))) for s in audio.samples]
    rate = audio.sample_rate
    # 44100 → 22050: 두 샘플씩 평균 (간단한 저역 통과를 겸한다)
    if rate == OUT_RATE * 2:
        samples = [(samples[i] + samples[i + 1]) // 2 for i in range(0, len(samples) - 1, 2)]
        rate = OUT_RATE
    return trim(samples, rate), rate


def trim(samples, rate):
    first = next((i for i, s in enumerate(samples) if abs(s) > SILENCE), None)
    if first is None:
        return samples
    last = len(samples) - 1 - next(i for i, s in enumerate(reversed(samples)) if abs(s) > SILENCE)
    start = max(0, first - rate * LEAD_MS // 1000)
    end = min(len(samples), last + 1 + rate * TAIL_MS // 1000)
    return samples[start:end]


def wav_bytes(samples, rate):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(array.array('h', samples).tobytes())
    return buf.getvalue()


def settings():
    """음성 파일 표(src/data/voice.json)에 적는 설정. 바뀌면 npm run voice 가 모두 다시 만든다"""
    return {'engine': 'supertonic-3-int8', 'voice': VOICE_ID, 'steps': STEPS, 'speed': SPEED, 'rate': OUT_RATE}


def batch(jobs_path, out_dir):
    jobs = json.loads(pathlib.Path(jobs_path).read_text(encoding='utf-8'))
    out = pathlib.Path(out_dir)
    tts = load_tts()
    for job in jobs:
        t = time.time()
        samples, rate = synthesize(tts, job['text'])
        (out / job['file']).write_bytes(wav_bytes(samples, rate))
        print(f"  {job['file']}  {time.time() - t:.1f}초  {job['text']}", flush=True)


class Handler(BaseHTTPRequestHandler):
    tts = None

    def do_GET(self):
        if self.path == '/health':
            self._send(200, b'ok', 'text/plain')
        else:
            self._send(404, b'not found', 'text/plain')

    def do_POST(self):
        if self.path != '/tts':
            self._send(404, b'not found', 'text/plain')
            return
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
            text = str(body.get('text', '')).strip()[:300]  # 너무 긴 글은 자른다 (열)
            if not text:
                self._send(400, b'empty text', 'text/plain')
                return
            samples, rate = synthesize(Handler.tts, text)
            self._send(200, wav_bytes(samples, rate), 'audio/wav')
        except Exception as err:  # 서버는 멈추지 않는다
            print('TTS 오류', err, flush=True)
            self._send(500, b'error', 'text/plain')

    def _send(self, code, data, ctype):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # 요청마다 줄을 찍지 않는다


def serve(port=8090):
    Handler.tts = load_tts()
    synthesize(Handler.tts, '준비')  # 첫 요청이 느리지 않게 미리 한 번
    print(f'Supertonic 읽기 서버: http://127.0.0.1:{port}  (목소리 {VOICE_ID}, 품질 {STEPS})', flush=True)
    HTTPServer(('127.0.0.1', port), Handler).serve_forever()  # 한 번에 하나씩 (ONNX 는 동시에 못 씀)


if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == 'batch':
        batch(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 2 and sys.argv[1] == 'serve':
        serve(int(sys.argv[2]) if len(sys.argv) >= 3 else 8090)
    elif len(sys.argv) >= 2 and sys.argv[1] == 'settings':
        print(json.dumps(settings()))
    else:
        print(__doc__ or '사용: supertonic.py batch <jobs.json> <폴더> | serve [포트] | settings')
        sys.exit(1)
