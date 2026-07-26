# Generates the PLACEHOLDER voice guide audio with the local Windows SAPI
# voice: offline, no vendor, regenerable. These files are stand-ins until
# recorded Zimbabwean voices land (P5); the Shona lines through an English
# SAPI voice are knowingly wrong and labelled as placeholders everywhere
# (apps/web/public/voice/README.md and the disclosure register).
# Run from the repo root:  powershell -File tools/generate-placeholder-voice.ps1

Add-Type -AssemblyName System.Speech

$out = Join-Path $PSScriptRoot "..\apps\web\public\voice"
$lines = @(
  @{ lang = "en"; file = "approaching.wav"; text = "Your stop is coming up." },
  @{ lang = "en"; file = "get-off.wav";     text = "This is your stop. Get off here." },
  @{ lang = "en"; file = "walk.wav";        text = "Your walking leg starts here." },
  @{ lang = "sn"; file = "approaching.wav"; text = "Wakusvika pachiteshi chako." },
  @{ lang = "sn"; file = "get-off.wav";     text = "Chiteshi chako ndechichi. Chiburuka pano." },
  @{ lang = "sn"; file = "walk.wav";        text = "Kufamba netsoka kunotangira pano." },
  # the last kombi warning (V7): spoken on the plan screen, not in a ride
  @{ lang = "en"; file = "last-kombi.wav";  text = "The last kombi on this route is usually gone soon. Leave now if you can." },
  @{ lang = "sn"; file = "last-kombi.wav";  text = "Kombi yekupedzisira panzira iyi inowanzoenda munguva pfupi. Simuka izvozvi kana uchikwanisa." }
)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -1

foreach ($line in $lines) {
  $dir = Join-Path $out $line.lang
  New-Item -ItemType Directory -Force $dir | Out-Null
  $path = Join-Path $dir $line.file
  # 16 kHz mono 16 bit keeps each phrase under ~100 KB
  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $synth.SetOutputToWaveFile($path, $format)
  $synth.Speak($line.text)
  $synth.SetOutputToNull()
  Write-Output "wrote $path"
}
$synth.Dispose()
