# UtilX Release Process

End-to-end steps for shipping a change from local edits to production. Pipeline:
`development` -> `staging` -> `main`. Netlify auto-deploys each branch to its own preview URL,
and `main` to production (utilx.tools). Each stage has its own isolated Turso database.

## 1. Make your edits

Edit files directly in the local `devtoolbox` folder (this is a real git clone of
`sksels/utilx`, checked out to the `development` branch by default).

## 2. Push to development

```powershell
cd "C:\Users\FusionGamingMasterPC\OneDrive\Desktop\Website\devtoolbox"
.\release.ps1 -Branch development -Message "CR#2: keyboard shortcuts + shareable URLs"
```

What this does: fetches and syncs `development` with origin, shows you a `git status --short`
diff of exactly what changed, asks for `y/n` confirmation, then commits and pushes.

If it's the very first time using git on this machine and it complains about identity:

```powershell
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

then re-run the `.\release.ps1` command above.

## 3. Visual check on the development preview

Open the `development` branch's Netlify preview URL and click through whatever changed.
No command for this step — it's manual review.

## 4. Promote development -> staging

Merge `development` into `staging` directly (locally with `git merge`, or on GitHub) and push.
No PR is required — see the note below.

This push triggers the `performance` job in CI (Lighthouse budgets against the built site).
Check the **Actions** tab for a green run before moving on to step 5.

## 5. QA on staging

Open the `staging` branch's Netlify preview URL (separate DB from dev and prod) and test as
needed.

## 6. Promote staging -> main

Merge `staging` into `main` directly (locally with `git merge`, or on GitHub) and push. No PR is
required here either.

This push triggers the `sanity` job in CI (build + unit tests). Check the **Actions** tab for a
green run.

**Note on CI and PRs (updated Aug 21 2026):** `ci.yml` is pure push-triggered — there's no
`pull_request` trigger and no branch-protection required-status-check on this repo, by design
(see `ARCHITECTURE.md` §7 and `STYLE_GUIDE.md`'s Definition of Done section). CI never
technically blocks a merge; it's a fast automated signal, not a gate. Promotion safety is
procedural: confirm the previous stage's CI run was green *before* promoting, the same way you'd
confirm it via a PR check, just without GitHub enforcing it for you. This is the right tradeoff
for a single-maintainer project with no forks or parallel contributors — revisit (add
`pull_request` triggers and real branch protection back) if that ever changes. Using a PR instead
of a direct merge is still fine if you prefer the review-diff UI; it just isn't required to
trigger CI the way it used to be.

## 7. Production deploy

Automatic — Netlify redeploys `utilx.tools` from the new `main` commit. No manual step.

## 8. Sanity-check production

Spot-check the live site. Quick way to check specific files deployed correctly:

```powershell
# from any machine with internet, e.g. in a browser or via curl
curl -I https://utilx.tools/tools/lib/cron.js
```

Look for `HTTP/2 200` and the right `content-type`.

## 9. Tag a GitHub Release (optional, do this after step 6 is actually merged)

- Go to `github.com/sksels/utilx/releases/new`.
- Tag: something like `cr2` (create new tag on publish).
- Target: `main`.
- Title: e.g. "CR#2 — Keyboard Shortcuts & Shareable URLs".
- Click **Generate release notes**, review, then **Publish release**.

Don't create the release before the code is actually merged to `main` — the release just tags
whatever commit is on the target branch at that moment.

## 10. Update the backlog sheet

Flip the shipped item(s)' Status column to "Shipped" in `utilx-backlog.xlsx`.

---

## Quick reference: all commands in order

```powershell
cd "C:\Users\FusionGamingMasterPC\OneDrive\Desktop\Website\devtoolbox"
.\release.ps1 -Branch development -Message "<describe the change>"
# ... visual check on development preview ...
# ... merge development -> staging on GitHub (triggers CI) ...
# ... QA on staging preview ...
# ... open PR staging -> main on GitHub, confirm CI, merge ...
# ... sanity-check production ...
# ... optionally create a GitHub Release tagging main ...
```
