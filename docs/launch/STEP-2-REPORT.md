# Step 2 report: username and password accounts

Plan: docs/LAUNCH-CROWD-PLAN.md, Step 2. Flag: `accounts`. Status: wall green, shipped.

## How an account is made (and why this way)

Supabase Auth needs an email or a phone. The plan allows two routes: an anonymous sign in converted to a username identity, or a synthetic address per user. We use the synthetic address, `r-<20 random>@users.svika.invalid`:

- `.invalid` is reserved by RFC 2606 and RFC 6761. It can never resolve, so mail to it can never be delivered, and nobody can ever register it. A password reset by email can therefore never be used to take an account over.
- The address is random and carries no username. The username lives in `account_usernames` (unique, lower case, 3 to 20 of `a-z 0-9 _ .`, screened by the places wordlist plus a reserved list). A freed username can never reach an old account.
- Accounts are created by the `svika-accounts` Edge Function with the platform's own service role and `email_confirm: true`, so no mail is ever attempted. The web app and the repo never hold the service key.
- Anonymous sign in was rejected: converting an anonymous user still needs an email or phone at the moment of conversion, and it would leave an anonymous auth user behind for every abandoned sign up.

## What changed, item by item

| plan item | what shipped |
| --- | --- |
| 1. sign up, code once | username and password only, a live "this username is free" line, then the approved Recovery-Code screen once: Copy, Save as photo, three tips, "I saved it". The code screen stands alone, without the sign up hero, as the approved screen does |
| 2. leaked password check | in the function: Have I Been Pwned range API, only the first five characters of the SHA-1 leave, with padding; if it is slow or down a local list of the most guessed passwords still holds. The dashboard toggle cannot cover this: it does not apply to admin created users, and it is a Pro plan feature |
| 2. rate limits and attempt log | every attempt is logged server side (`auth_attempts`, address stored only as a peppered hash, rows deleted after 30 days). Sign ups: 10 per address per hour. Wrong passwords, wrong recovery codes and username lookups share one allowance: 30 per address inside a rolling 15 minutes |
| 2. lockout | 5 wrong passwords for one username inside 15 minutes lock it. Refused tries are not logged, so the lock lifts on its own 15 minutes after the fifth miss at the latest. A correct sign in or a recovery clears it. The message says how many minutes are left, in English and Shona |
| 3. recovery | username plus code sets a new password. The code is 12 symbols from 31 (about 7.9e17), stored only as a salted SHA-256, single use, and a new one is shown after every reset. Recovery has no lock per username, so nobody can lock a rider out on purpose; guessing is held back per address and by the size of the code space (a million addresses at the full allowance would need over 100,000 years on average) |
| 4. phone OTP | kept only at `/login?method=phone`, linked from nowhere, for test and owner accounts |
| 5. delete my account | the existing anonymise path (`anonymise_me`), then `forget_my_username` (username and recovery code gone), then the function's `delete_account` removes the auth user itself: address, password hash, identities and sessions. See the ruling below |
| 6. privacy page | under `accounts`: what we store, what we never ask for, how long we keep it, who we share with, how to delete |

## Ruling: the profile outlives the auth user (migration 0051)

Every account gets a wallet the moment it is created. Wallets, tickets, journeys, transfers and gifts point at `profiles` with ON DELETE RESTRICT because money history is append only, and `profiles` was deleted together with its auth user. So deleting an auth user failed for every account. Mhofu ruled on 13 Nov 2026: hard delete the auth user and keep the anonymised profile. Migration 0051 drops only the `profiles` to `auth.users` cascade. No data is removed, and new profiles are still created from new auth users. This is the one deliberate exception to "additive only" in the launch migrations.

`delete_account` deletes only the caller's own account (read from the caller's token, never the body), only a username account (demo personas and the seeded test accounts keep the anonymise only path), and only after the username is forgotten. Checked in the live database after AU-15: no auth row, no identities, profile name and phone empty, the wallet row kept.

## Honesty fixes found on the way

- The consent screen told every new account "Your name, phone number and language choice are stored". A username account is never asked for either, so it now reads "Your username and language choice are stored with your account".
- The Recovery-Code screen rendered inside the sign up hero: two page headings and a main landmark inside another.

## Deviation from the approved screen

- Sign-Up's notice "Your home and work stay on this phone" is not true of today's app (home and work arrive in Step 7 of the plan, kept on the phone by default). It reads "Svika never asks for your phone number, email or name." until it is.

## Logged, not fixed here

- Shona strings for accounts and privacy are machine drafted placeholders, like the rest; the translator pass is owed.
- e2e and security runs create real username accounts (one per run each). Deleted ones leave only an empty profile and wallet; the ones from the two early red runs before delete was wired still exist, with test usernames `e2e_*`.

## Proof

- Unit: `test/accounts-rules.test.ts` (18): the hidden domain, the address bucket, the leaked check, the lock lifting at 15 minutes, a recovery opening a locked username, wrong codes never locking, the shared allowance, the wait in seconds. `test/accounts-client.test.ts` (5): error copy and the wait in minutes in both languages.
- e2e `e2e/accounts.spec.ts` (6), against the live function and database: sign up and the code once, the consent copy, name taken, wrong password and unknown name answer alike, recovery (new code, old code dead), five misses lock with the minutes shown and the saved code still works and clears the lock, delete removes the sign in and the code.
- RLS: AU-1 to AU-16 in `packages/db/test/rls.security.test.mjs`, including the delete door (a guest key or a phone account cannot use it, it refuses while the username is held, afterwards the token's user no longer exists).
- Security review of the branch: no findings at or above confidence 8. A made up `x-forwarded-for` was tried live and landed in the same bucket.
- Screenshots, 360px, both themes, both languages, local production build with the preview cookie: `docs/design-evidence/launch/step-2/` (sign up, sign in, recovery, privacy, and the inline error on an empty sign up). The live Recovery-Code screen is in `live-recovery-code.png`.

## Wall (13 Nov 2026, on 2536631)

- typecheck clean, lint clean
- unit 547 (shared 114, conductor 37, spine 101, web 295)
- e2e 95 passed, 0 skipped, one worker against one production build
- RLS 292 passed, 0 failed (AU-1 to AU-16 new in this step)

## Live check (svika-web.vercel.app, deploy dpl_EHS3XcPWUcDDvgREygq4boy6U7Mp from a clean clone of b67ff2e, 360px)

- Public: `/signup` answers 404 (accounts flag off until Step 12).
- With the preview key: back button 48 by 48; the availability line said "This username is free" (the browser called the function from the live origin, so CORS holds); a real sign up showed the Recovery-Code screen with one heading and a code in three groups of four; the consent screen said "Your username and language choice" and no phone number; signed in by username; delete my account ran through the live server action and the function and landed on the front door; the old username and password then failed with "That username and password do not match."
- Database afterwards: no username row and no auth row for the probe, its emptied profile kept (`live-signup.png`, `live-recovery-code.png`).
