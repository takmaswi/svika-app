# AI usage map (paste this to any agent working in the Svika repo)

You are working on Svika. Read this before touching anything AI related. It tells you exactly which AI does what, what is a real model versus a rule, and what the production target is. Do not add AI where a rule or query is enough. Do not overclaim.

## The rule
All inference is server side and deployable to ZCHPC CCE. No model inference on rider phones. Every AI or vendor call goes through an adapter with a mock twin, so providers are swappable and the demo never dies if a vendor is down. No live vendor call sits in the ride path.

## What uses a large language model
Only language understanding. One job: turn a free text Shona or English sentence (for example "Ndoda kuenda Copacabana") into a known stop id from the seeded network. It also writes the bilingual audit narrative for owners.
- Current runtime: Gemini 2.5 Flash, server side (`lib/ai/aiClient.ts`).
- Production target: a self hosted open model (Gemma or Llama class) plus self hosted ASR for voice, fine tuned on our own Shona transport dataset. Gemini is dev time scaffolding only, swapped out through the adapter.
- Honesty line: say "native on server AI is the production target, cloud API in this deployment." Never claim the Shona model is ours while Gemini does the work.

## What is NOT a language model (the real AI value: three spines)
Each spine is a purpose built model measured against a named baseline. Do not replace these with an LLM.
1. ETA prediction. Arrival time with no timetable. Baseline: naive average. This is the headline AI.
2. Commute alerts. Learns a rider's routine and warns before their kombi. Baseline: fixed alarm clock.
3. Revenue anomaly. Flags leakage for owners. Baseline: fixed threshold. Flags patterns, never accuses a named person.

## What is NOT AI at all
- Trip planning: a route query over the seeded network (`lib/trip-planner`). Plain code.
- Destination geocoding (D1): a local index query over a committed corpus of named suburbs, landmarks and roads extracted from the self hosted OSM tiles (`tools/geocode-index`, `apps/web/src/lib/geocode`). Deterministic string scoring, no Google, no vendor in the ride path. Not AI, and the UI never pretends otherwise.
- Alight stop scoring (D1): candidate alight stops near a destination point are ranked by ride minutes plus boarding penalties plus an honest walking tail (`packages/shared/src/plan-to-point.ts`). Documented arithmetic rules; the no service case is stated plainly, never papered over.
- Alight guidance (D1): the in ride "your stop is next" and "chiburuka" cues are the existing geofence trigger engine over vehicle positions, extended to destination trips by the recorded walking tail. Distance thresholds, not a model.
- Remembering and saving trips: database storage.
- Voice: ElevenLabs is a studio tool only. Phrases are generated once and shipped as cached audio. No live call in the ride path.

## The dataset
The Shona to English transport lingo dataset is ours to build, label, and own. It is the moat and the reason native AI becomes viable. Rent the engine now, build the data asset in parallel, drop the dependency once the dataset is big enough to fine tune on.

## One line summary
Gemini 2.5 Flash resolves language today and is replaced by a self hosted fine tuned model in production. The three spines (ETA, commute alerts, anomaly) are the real AI and stay custom. Trip planning, saving trips, and voice are not AI.
