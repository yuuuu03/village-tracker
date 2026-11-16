# Village Tracker

Track builders, labs, pets and upgrade timers across all your Clash of Clans villages. You get a time river across every village, an upgrade planner, push reminders 1 minute before each finish, a comparison across villages, clan stats, read-only share links and backups.

Everything below runs on free plans:

| What | Used for | Cost |
|---|---|---|
| **GitHub** | Code + hosting (GitHub Pages) + weekly game-data refresh | Free (public repo) |
| **Supabase** | Sign-in by email link, database, API relay, push reminders | Free plan |
| **Clash of Clans developer account** | API key for live stats and clan data | Free |
| **Node.js 18+** on your computer | Two one-off commands (push keys, Supabase CLI) | Free |

A custom domain is optional. Supercell's fan content rules don't allow "clash" or "supercell" in it.

---

## 1 · Put the code on GitHub and turn on Pages

1. Create a **public** repository, e.g. `village-tracker`, and upload every file in this folder.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push any change, or run **Actions → Deploy site → Run workflow**.
4. Your site is at `https://YOUR-USERNAME.github.io/village-tracker/`.

At this point the site already works on its own, saving data in the browser.

## 2 · Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project** (free plan).
2. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**.
3. **Authentication → URL Configuration**: set **Site URL** to your GitHub Pages address, and add the same address under **Redirect URLs**.
4. **Authentication → Providers → Email**: on, which is the default. Sign-in is by emailed link, with no passwords.
5. **Project Settings → API**: copy the **Project URL** and the **Publishable key** (`sb_publishable_…`, or the legacy anon key on older projects) into `public/config.js`.

The anon key is meant to be public. Row Level Security in `schema.sql` stops users seeing each other's data.

### 2b · Lock it to you (so nobody else can sign up or use your storage)

1. **Authentication → Users → Add user → Create new user**: your email, tick **Auto confirm**.
2. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". The sign-in screen also refuses unknown emails, so nobody can create an account.
3. **SQL Editor**: run `insert into public.allowed_emails (email) values ('you@example.com');` with your address. Add a line per person you want to let in.
4. Optional, for iPhone Home Screen apps: **Authentication → Emails → Magic Link** template, add `Code: {{ .Token }}`. The sign-in screen then accepts the 6-digit code, so the link doesn't open in Safari instead of the app.

The free plan's database holds 500 MB. Four villages use well under 1 MB, and the daily tidy-up job in `cron.sql` deletes old reminders.

## 3 · Push reminder keys

On your computer:

Open `https://YOUR-USERNAME.github.io/village-tracker/keys.html` and tap **Make my keys** (nothing to install). Or, with Node: `npx web-push generate-vapid-keys`.

- Put the **Public Key** into `public/config.js` as `vapidPublicKey`.
- Keep the **Private Key** for step 4. Never commit it.

## 4 · Deploy the three server functions

No installs needed: **Edge Functions → Deploy a new function → Via Editor**, paste each `index.ts`, and add the secrets under **Edge Functions → Secrets**. Turn **off** JWT verification for all three functions (check again after every redeploy). `coc` checks your sign-in and the allow-list itself. The CLI route below does the same thing.

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF          # from the project URL
npx supabase secrets set \
  COC_API_TOKEN="your-clash-api-key" \
  VAPID_PUBLIC="public-key-from-step-3" \
  VAPID_PRIVATE="private-key-from-step-3" \
  VAPID_CONTACT="you@example.com" \
  CRON_SECRET="any-long-random-text"
npx supabase functions deploy coc --no-verify-jwt
npx supabase functions deploy send-reminders --no-verify-jwt
npx supabase functions deploy calendar --no-verify-jwt
```

`calendar` serves your private calendar feed. Only someone with your secret link can read it.

## 5 · Clash of Clans API key

1. Sign in at [developer.clashofclans.com](https://developer.clashofclans.com) → **My Account → Create New Key**.
2. Set **Allowed IP addresses** to `45.79.218.79`. That's the RoyaleAPI proxy the `coc` function calls through, because Supabase's own IPs change.
3. Use that key as `COC_API_TOKEN` in step 4.
4. Set `apiEnabled: true` in `public/config.js`.

## 6 · Schedule the reminders

1. **Database → Extensions**: enable **pg_cron** and **pg_net**.
2. Open `supabase/cron.sql`, replace `YOUR-PROJECT-REF` and `YOUR-CRON-SECRET`, and run it in the SQL Editor.

## 7 · Load the game data (upgrade times and costs)

First add a repository variable `GAME_DATA_URL` (Settings → Secrets and variables → Actions → Variables) pointing at a Clash game-data JSON you trust: each item needs its game id and, per level, the Town Hall required, time and cost. Then run **Actions → Refresh game data → Run workflow**. It also runs every Monday. Alternatively, run `node scripts/build-game-data.mjs` and commit `public/game-data.json`.

This turns on max-level badges, Town Hall progress, the max-level celebration, the **"Left at TH…"** list and fills in planner times automatically. Check the data source's licence before you publish (`GAME_DATA_URL` in the script). The run prints a sample: if Cannon's levels look right, it worked.

## 8 · Commit `config.js`, then use it

Commit the filled-in `public/config.js`; the site redeploys automatically. Then on each device:

1. Open the site. It shows **Welcome back, Chief**: enter your email, then tap the link in the email (or type the code).
   - **Calendar tab → Live calendar link** adds every finish to your phone's calendar and keeps it updated after each paste.
2. **⚙ Settings → Push reminders → Turn on.**
   - **iPhone:** first tap **Share → Add to Home Screen**, then open the app from the Home Screen (iOS 16.4 or later).
3. In Clash: **Settings → More Settings → Data Export → Copy**, then tap **Paste export**. On the real site that's one tap.

---

## Rules for publishing (Supercell fan content policy)

- **Free only.** No paid features or premium tier. Ads and true donations are allowed.
- **Keep the disclaimer.** It's already in the footer and in Settings.
- **No "clash" or "supercell"** in your domain or social account names.
- **Don't imply endorsement**, and don't post leaks.
- **Add a privacy policy** if other people use it: you store their player tags and village data.

## Never commit these
The Supabase **service role** key, the **VAPID private** key, the **Clash API token** and the **CRON_SECRET**. They live only in Supabase secrets.

## Checklist after deploying

These parts couldn't be run while building, because the build environment had no internet. Please check each one:

- [ ] Email sign-in link arrives and signs you in. Your local villages move to your account.
- [ ] Pasting on phone and computer shows the same villages.
- [ ] **Player & clan** shows trophies and war stars; **Open clan page** lists members.
- [ ] A test upgrade ending within a few minutes sends a push 1 minute before and at the finish.
- [ ] **Share a read-only link** opens in a private window without signing in.
- [ ] The game-data run prints sensible Cannon levels.

## Folder map

```
public/                 the website (served by GitHub Pages)
  index.html            the whole app
  config.js             your Supabase URL/keys (public values only)
  sw.js                 push notifications + offline shell
  manifest.webmanifest  install-to-home-screen info
  game-data.json        created by the game-data workflow
supabase/
  schema.sql            tables, security rules, allow-list, share + feed
  cron.sql              every-minute reminders + daily tidy-up
  functions/coc/        Clash API relay (keeps your key secret)
  functions/send-reminders/  sends push notifications
  functions/calendar/   private calendar feed (.ics)
scripts/build-game-data.mjs
.github/workflows/      deploy site + weekly game-data refresh
```

This content is not affiliated with, endorsed, sponsored, or specifically approved by Supercell and Supercell is not responsible for it. For more information see Supercell's Fan Content Policy: www.supercell.com/fan-content-policy.
