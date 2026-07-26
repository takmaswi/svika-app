# Voice guide audio: PLACEHOLDER FILES

Every file here is a stand-in generated with the local Windows SAPI voice
(`tools/generate-placeholder-voice.ps1`). The Shona lines through an English
synthesiser are knowingly wrong; they exist so the trigger engine, caching
and settings are real and testable today. Recorded Zimbabwean voices with
signed consent replace these in P5, same file names, no code change.

| File | Cue | Line |
| --- | --- | --- |
| `en/approaching.wav` | approaching | Your stop is coming up. |
| `en/get-off.wav` | get off | This is your stop. Get off here. |
| `en/walk.wav` | walk | Your walking leg starts here. |
| `sn/approaching.wav` | approaching | Wakusvika pachiteshi chako. |
| `sn/get-off.wav` | get off | Chiteshi chako ndechichi. Chiburuka pano. |
| `sn/walk.wav` | walk | Kufamba netsoka kunotangira pano. |
| `en/last-kombi.wav` | last kombi (V7) | The last kombi on this route is usually gone soon. Leave now if you can. |
| `sn/last-kombi.wav` | last kombi (V7) | Kombi yekupedzisira panzira iyi inowanzoenda munguva pfupi. Simuka izvozvi kana uchikwanisa. |

Declared in the disclosure register. Ride audio is preloaded when a ride
starts and played from memory: zero network calls at play time (proven in
`apps/web/test/voice-audio-cache.test.ts`). The last kombi cue is not a ride
cue, so it is not in the ride preload; the plan screen loads it once through
`CachedPhrase` and every later tap plays from memory, proven by the same
test file. It plays only when the rider taps listen: a warning that speaks
unasked is a warning nobody keeps switched on.

## The P5 recording list

Every line above gets recorded by a consenting Zimbabwean voice artist in
P5, plus the two guide mode phrases approved on the M2 gate (2026-07-25).
The guide phrases are screen only until their audio exists; the copy below
is the dict.ts `guide.cue.*` text verbatim (Shona rides the standing
external translator pass before any studio session).

| Future file | Cue | Line |
| --- | --- | --- |
| `en/guide-off-path.wav` | guide: off path | You have left the path. Head back toward the line. |
| `en/guide-arrived.wav` | guide: arrived | You have arrived |
| `sn/guide-off-path.wav` | guide: off path | Wabuda munzira. Dzokera kumutsara. |
| `sn/guide-arrived.wav` | guide: arrived | Wasvika |
