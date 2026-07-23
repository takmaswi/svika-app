# Deploying Svika to a live URL

This is the handoff for the steps that need your accounts, Takunda. The code,
config and fixes are done and committed. What is left is the clicking: signing
in to Vercel and Render, pasting the environment values, and applying one
database migration. None of it needs a code change.

## What goes where

- **apps/web** (the rider app, owner dashboard, landing, demo door) goes to
  **Vercel**. This is the public URL a judge opens.
- **Supabase** (database and auth) is already live. It needs one new migration
  applied and one reset command run.
- **services/spine** (the arrival AI) goes to **Render** on the free plan. It is
  optional: if it is not up, the app falls back to the mock twin and every
  arrival label reads "demo estimate", so the demo still works end to end.
  Deploying it turns those labels into real numbers from the two recorded rides.

The whole thing is designed so the demo never dies on a missing piece.

## Before you start

You need, and only you can authorise:

1. A Vercel account with this GitHub repo connected.
2. A Render account with this GitHub repo connected (only if you want real
   arrival numbers; skip for the mock twin).
3. The values already in your local `.env.local`: the Supabase URL and anon key,
   the MapTiler key, and the demo passwords. You will paste these into the Vercel
   and Render dashboards. They never go in the repo.

## Step 1: Supabase (apply the demo clean start)

The live database is at 0029. One migration is new.

1. Open the Supabase project, SQL editor.
2. Paste and run the contents of `packages/db/migrations/0030_demo_clean_start.sql`.
   It adds `my_demo_since()`, extends `demo_reset_mine()` to retire stale tickets,
   and adds `demo_reset_all()`. Security review on it came back clean.
3. Run the one command hard reset so every judge starts on a clean profile:

   ```bash
   pnpm db:demo-reset
   ```

   This uses the service role key from your `.env.local` (the only place outside
   the seed that key is used). It retires every demo persona's live tickets,
   levels their wallets to the $5 float and frees the judge pool. Nothing is
   deleted: money is append only, so a stale ticket is retired with an appended
   `expired` event and the per visit stats window moves instead.

Note: the per visit reset also runs automatically every time a judge taps the
demo door, so profiles stay believable without you running anything during the
demo. The command above is the between sessions hard reset.

## Step 2: Vercel (the front door)

1. Vercel dashboard, Add New, Project, import this repo.
2. **Root Directory: set it to `apps/web`.** This is the one setting that matters.
   Vercel detects Next.js and the pnpm workspace automatically. The committed
   `apps/web/vercel.json` pins the install and build commands.
3. Add these Environment Variables (Production). Copy the values from your
   `.env.local`:

   | Variable | Value | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase URL | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key | public by design |
   | `NEXT_PUBLIC_MAP_TILES_URL` | your raw MapTiler key | fallback tiles only since M0; the map is self hosted (tools/map-tiles). Hosting the PMTiles file for the deploy is a later decision: set `NEXT_PUBLIC_MAP_PMTILES_URL` when it moves off the static dir |
   | `DEMO_JUDGE_PASSWORD` | your demo pool password | signs judges in |
   | `DEMO_OWNER_EMAIL` | demo.owner@svika.app | owner demo door |
   | `DEMO_OWNER_PASSWORD` | your value | |
   | `DEMO_CONDUCTOR_EMAIL` | demo.conductor@svika.app | the story hwindi |
   | `DEMO_CONDUCTOR_PASSWORD` | your value | |
   | `DEMO_RIDER_EMAIL` | demo.rider@svika.app | the story friend |
   | `DEMO_RIDER_PASSWORD` | your value | |
   | `AI_PROVIDER` | `mock` | text AI stays on the mock twin |
   | `SPINE_URL` | (fill after Step 3, or leave empty) | empty is fine: mock twin serves |

   Do **not** set `SUPABASE_SERVICE_ROLE_KEY` here. It belongs to the seed and CI
   only, never the app. Do **not** set `E2E_AUTH`. That flag opens a test login
   endpoint and must never exist in a deploy.

4. Deploy. When it finishes, open the URL. You have the live front door.

## Step 3: Render (the arrival AI, optional)

Skip this and the demo works on the mock twin. Do it for real arrival numbers.

1. Render dashboard, New, Blueprint. Point it at this repo. Render reads the
   committed `render.yaml` and proposes the `svika-spine` web service.
2. Set the two values it asks for (marked as needing input in the blueprint):
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, same values as
   Vercel. No service role key: the spine reads only public data.
3. Create and deploy. When it is live, copy the service URL and check
   `https://YOUR-SPINE.onrender.com/health` returns `{"ok":true,...}` style JSON.

## Step 4: Wire them together

1. In Vercel, set `SPINE_URL` to your Render URL (no trailing slash), for example
   `https://svika-spine.onrender.com`. Redeploy the web app so it picks the value
   up.
2. Optional keep warm: the free Render service sleeps after about 15 minutes
   idle, so the first arrival call after a nap falls back to the mock twin for a
   few seconds while it wakes. To avoid that during judging, add a GitHub repo
   secret named `SPINE_HEALTH_URL` set to `https://YOUR-SPINE.onrender.com/health`.
   The committed workflow `.github/workflows/spine-keepwarm.yml` then pings it
   every 10 minutes. Without the secret the workflow does nothing.

## Post deploy check (the gate)

Open the live Vercel URL on a phone and walk it:

- [ ] The landing shows the one tap demo door as the obvious front door; phone
      sign in is clearly the operator and owner path below it.
- [ ] Tap the demo door. You land in the real app as a fresh persona, wallet at
      $5.00, no stranger's ride history on the profile.
- [ ] Phone sign in with the test number and the fixed code lands in a real
      account (the Twilio and test number OTP config already lives in Supabase).
- [ ] The live map draws the corridor, the stops and the moving kombis.
- [ ] Book a trip. The wallet debits, a board code appears, the ledger moves.
- [ ] On the conductor app, clear the fare offline, then let it reconcile.
- [ ] Open the footer link "What is real, what is staged": the disclosure
      register renders as a page.
- [ ] Tap the demo door fast, before the page settles: it opens the app, it does
      not error (the pre hydration 500 is fixed).

When the URL passes this walk, the deploy is done.

## Environment reference

- App (Vercel): see the table in Step 2.
- Spine (Render): `NODE_VERSION`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Local and CI only, never a deploy: `SUPABASE_SERVICE_ROLE_KEY`, the test user
  credentials, `E2E_AUTH`.
- `.env.example` documents every key.
