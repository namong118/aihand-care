# 음성 파일 만들기 (Windows 전용). scripts/make-voice.js 가 부른다. 직접 실행하지 않아도 된다.
# Windows 한국어 음성(Microsoft Heami)으로 문장마다 WAV 파일(16kHz, 16비트, 모노)을 만든다.
#   -Jobs  : [{ "text": 읽을 글자, "file": 파일 이름 }, ...] 이 들어 있는 JSON 파일
#   -OutDir: WAV 를 저장할 폴더 (public/voice)
param(
  [Parameter(Mandatory = $true)][string]$Jobs,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Voice = 'Microsoft Heami Desktop',
  [int]$Rate = -1
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8 # 문장 글자가 콘솔에서 깨지지 않게
Add-Type -AssemblyName System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$names = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if ($names -notcontains $Voice) {
  Write-Error "한국어 음성 '$Voice' 이(가) 없습니다. Windows 설정 > 시간 및 언어 > 음성에서 한국어 음성을 추가해 주세요. 있는 음성: $($names -join ', ')"
}
$synth.SelectVoice($Voice)
$synth.Rate = $Rate # -10(느림) ~ 10(빠름). -1 = 어르신이 알아듣기 쉽게 조금 천천히

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$list = Get-Content -Raw -Encoding UTF8 $Jobs | ConvertFrom-Json

foreach ($job in $list) {
  $path = Join-Path $OutDir $job.file
  $synth.SetOutputToWaveFile($path, $format)
  $synth.Speak($job.text)
  $synth.SetOutputToNull()
  Write-Output "  $($job.file)  $($job.text)"
}
$synth.Dispose()
